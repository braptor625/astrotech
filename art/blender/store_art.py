"""AstroTech store art: Blender (bpy) renders a 3D scene, then a pixel pass turns it into game-style art.

    python3 art/blender/store_art.py               # all Steam capsule sizes -> art/store/
    python3 art/blender/store_art.py header main   # only some
    python3 art/blender/store_art.py --seed 7      # different asteroid / starfield

Needs `pip install bpy pillow fonttools brotli` (bpy 4.2+ / Python 3.11+) or run inside Blender:
    blender -b -P art/blender/store_art.py -- header
Cycles on CPU is used so it works headless with no GPU.

Pipeline per size: build scene in normalized frame coords -> Cycles render at 1/PX resolution
(transparent film) -> composite over a dithered void + pixel starfield -> ordered-dither to the game
palette -> logo in Silkscreen (the game's display font) -> nearest-neighbour upscale x PX -> crop.
"""
import math, pathlib, random, sys, tempfile

import bpy
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'art' / 'store'

# name: (width, height, pixel size, layout, logo)
SIZES = {
    'header':       (920, 430, 3, 'wide', True),      # Steam header capsule
    'small':        (462, 174, 3, 'small', True),     # small capsule: mostly logo
    'main':         (1232, 706, 4, 'wide', True),     # main capsule
    'vertical':     (748, 896, 4, 'tall', True),      # vertical capsule
    'library':      (600, 900, 3, 'tall', True),      # library capsule
    'library_hero': (3840, 1240, 6, 'hero', False),   # library hero: no text allowed
    'library_logo': (1280, 720, 6, 'logo', True),     # transparent logo only
}

def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

# style.css tokens plus material ramps. Every output pixel is one of these.
PALETTE = [hexc(c) for c in (
    '#060918', '#0b0d1f', '#111842', '#18225a', '#1d2a63', '#283a86', '#4157a8', '#5670c9',
    '#eef1ff', '#a4afde', '#6672a8', '#ffd866', '#b9862a', '#ff6b6b', '#ffb347',
    '#86c3ee',
    '#2a211d', '#45362c', '#6b5444', '#8f7a66', '#b8a48c',     # asteroid rock
    '#123a7a', '#1f5fb0', '#2f7a46', '#5aa05a', '#c9b98a',     # earth
    '#c0402a', '#fff2c0',                                      # flame
)]
PAL = np.array(PALETTE, dtype=np.float32)
BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) + 0.5) / 16 - 0.5

# ---------------------------------------------------------------- Blender scene

def lin(c):  # sRGB hex -> linear RGBA for Blender
    def f(v): v /= 255; return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (*[f(v) for v in hexc(c)], 1.0)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links, m.node_tree.nodes['Principled BSDF']

def ramp(nodes, stops, constant=False):
    r = nodes.new('ShaderNodeValToRGB'); cr = r.color_ramp
    if constant: cr.interpolation = 'CONSTANT'
    cr.elements[0].position, cr.elements[0].color = stops[0][0], lin(stops[0][1])
    cr.elements[1].position, cr.elements[1].color = stops[-1][0], lin(stops[-1][1])
    for p, c in stops[1:-1]: e = cr.elements.new(p); e.color = lin(c)
    return r

def asteroid(loc, r, seed):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=r, location=loc)
    o = bpy.context.object; o.name = 'Asteroid'
    o.scale = (1.0, 0.82, 0.9); o.rotation_euler = (0.4, 0.2, 0.6 + seed)
    for kind, size, strength in (('CLOUDS', 0.55, 0.22), ('VORONOI', 0.28, -0.07)):
        t = bpy.data.textures.new(kind, kind)
        t.noise_scale = size * r
        if kind == 'VORONOI': t.distance_metric = 'DISTANCE'
        d = o.modifiers.new(kind, 'DISPLACE'); d.texture = t; d.strength = strength * r; d.texture_coords = 'GLOBAL'
    bpy.ops.object.shade_smooth()
    m, n, l, b = mat('Rock')
    noise = n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 3.0; noise.inputs['Detail'].default_value = 8
    noise.noise_dimensions = '4D'; noise.inputs['W'].default_value = seed
    rr = ramp(n, [(0.3, '#2a211d'), (0.45, '#45362c'), (0.55, '#6b5444'), (0.7, '#8f7a66')])
    l.new(noise.outputs['Fac'], rr.inputs['Fac'])
    # ore veins: thin voronoi cracks, kept only where a low-frequency noise mask is high
    vor = n.new('ShaderNodeTexVoronoi'); vor.feature = 'DISTANCE_TO_EDGE'; vor.inputs['Scale'].default_value = 7.0
    crack = n.new('ShaderNodeMath'); crack.operation = 'LESS_THAN'; crack.inputs[1].default_value = 0.025
    l.new(vor.outputs['Distance'], crack.inputs[0])
    mask_n = n.new('ShaderNodeTexNoise'); mask_n.inputs['Scale'].default_value = 1.6
    mask_n.noise_dimensions = '4D'; mask_n.inputs['W'].default_value = seed + 11
    mask = n.new('ShaderNodeMath'); mask.operation = 'GREATER_THAN'; mask.inputs[1].default_value = 0.57
    l.new(mask_n.outputs['Fac'], mask.inputs[0])
    vein = n.new('ShaderNodeMath'); vein.operation = 'MULTIPLY'
    l.new(crack.outputs[0], vein.inputs[0]); l.new(mask.outputs[0], vein.inputs[1])
    mix = n.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    l.new(vein.outputs[0], mix.inputs['Factor']); l.new(rr.outputs['Color'], mix.inputs[6]); mix.inputs[7].default_value = lin('#ffd866')
    l.new(mix.outputs[2], b.inputs['Base Color'])
    b.inputs['Emission Color'].default_value = lin('#ffb347'); l.new(vein.outputs[0], b.inputs['Emission Strength'])
    b.inputs['Roughness'].default_value = 0.85
    o.data.materials.append(m)
    return o

def earth(loc, r):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=r, location=loc)
    o = bpy.context.object; o.name = 'Earth'; o.rotation_euler = (0.5, 0.3, 2.2); bpy.ops.object.shade_smooth()
    m, n, l, b = mat('Earth')
    noise = n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 2.2; noise.inputs['Detail'].default_value = 10
    rr = ramp(n, [(0.0, '#123a7a'), (0.5, '#1f5fb0'), (0.53, '#2f7a46'), (0.62, '#5aa05a'), (0.7, '#c9b98a')], constant=True)
    l.new(noise.outputs['Fac'], rr.inputs['Fac']); l.new(rr.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.6
    o.data.materials.append(m)
    # clouds
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=r * 1.02, location=loc)
    c = bpy.context.object; c.name = 'Clouds'; bpy.ops.object.shade_smooth()
    m, n, l, b = mat('Clouds')
    cn = n.new('ShaderNodeTexNoise'); cn.inputs['Scale'].default_value = 3.5; cn.inputs['Detail'].default_value = 6; cn.noise_dimensions = '4D'
    cn.inputs['W'].default_value = 3
    cr = ramp(n, [(0.55, '#000000'), (0.6, '#ffffff')], constant=True)
    l.new(cn.outputs['Fac'], cr.inputs['Fac']); l.new(cr.outputs['Color'], b.inputs['Alpha'])
    b.inputs['Base Color'].default_value = lin('#eef1ff')
    c.data.materials.append(m)
    # atmosphere rim: emission by facing, transparent in the middle
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=r * 1.08, location=loc)
    a = bpy.context.object; a.name = 'Atmo'; bpy.ops.object.shade_smooth()
    m = bpy.data.materials.new('Atmo'); m.use_nodes = True; n, l = m.node_tree.nodes, m.node_tree.links
    n.clear()
    out = n.new('ShaderNodeOutputMaterial'); lw = n.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35
    em = n.new('ShaderNodeEmission'); em.inputs['Color'].default_value = lin('#86c3ee'); em.inputs['Strength'].default_value = 1.1
    tr = n.new('ShaderNodeBsdfTransparent'); mx = n.new('ShaderNodeMixShader')
    pw = n.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 2.5
    l.new(lw.outputs['Facing'], pw.inputs[0]); l.new(pw.outputs[0], mx.inputs['Fac'])
    l.new(tr.outputs[0], mx.inputs[1]); l.new(em.outputs[0], mx.inputs[2]); l.new(mx.outputs[0], out.inputs['Surface'])
    a.data.materials.append(m)

def solid(name, color, emit=0.0):
    m, n, l, b = mat(name)
    b.inputs['Base Color'].default_value = lin(color); b.inputs['Roughness'].default_value = 0.5
    if emit: b.inputs['Emission Color'].default_value = lin(color); b.inputs['Emission Strength'].default_value = emit
    return m

def rocket(loc, length, angle):
    """A chunky rocket built along local +Z, then turned to point `angle` radians right of screen-up."""
    L = length; parts = []
    hull, band, fin, fire, core = solid('Hull', '#eef1ff'), solid('Band', '#ff6b6b'), solid('Fin', '#ff6b6b'), solid('Fire', '#ffb347', 8), solid('Core', '#fff2c0', 14)
    def add(op, m, **kw):
        op(**kw); o = bpy.context.object; o.data.materials.append(m); parts.append(o); return o
    add(bpy.ops.mesh.primitive_cylinder_add, hull, vertices=24, radius=0.11 * L, depth=0.62 * L, location=(0, 0, 0.05 * L))
    add(bpy.ops.mesh.primitive_cylinder_add, band, vertices=24, radius=0.113 * L, depth=0.07 * L, location=(0, 0, 0.22 * L))
    add(bpy.ops.mesh.primitive_cone_add, hull, vertices=24, radius1=0.11 * L, depth=0.26 * L, location=(0, 0, 0.49 * L))
    add(bpy.ops.mesh.primitive_cone_add, solid('Bell', '#6672a8'), vertices=16, radius1=0.09 * L, radius2=0.05 * L, depth=0.08 * L, location=(0, 0, -0.3 * L))
    for k in range(3):
        a = k * 2 * math.pi / 3 + 0.3
        f = add(bpy.ops.mesh.primitive_cube_add, fin, size=1, location=(math.cos(a) * 0.15 * L, math.sin(a) * 0.15 * L, -0.18 * L))
        f.scale = (0.11 * L, 0.02 * L, 0.2 * L); f.rotation_euler = (0, 0, a)
    add(bpy.ops.mesh.primitive_cone_add, fire, vertices=16, radius1=0.085 * L, depth=0.55 * L, location=(0, 0, -0.6 * L), rotation=(math.pi, 0, 0))
    add(bpy.ops.mesh.primitive_cone_add, core, vertices=16, radius1=0.045 * L, depth=0.3 * L, location=(0, 0, -0.45 * L), rotation=(math.pi, 0, 0))
    bpy.ops.object.empty_add(location=(0, 0, 0)); root = bpy.context.object
    for p in parts: p.parent = root
    # X: lay the +Z axis onto screen-up (+Y), tipped a little toward the camera; Y: roll to show fins; Z: heading
    root.rotation_euler = (-math.pi / 2 + 0.3, 0.5, -angle); root.location = loc
    return root

def trail(points, width):
    cu = bpy.data.curves.new('Trail', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = width; cu.bevel_resolution = 2
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new('Trail', cu); bpy.context.collection.objects.link(o)
    o.data.materials.append(solid('TrailM', '#5670c9', 0.8))

def lights():
    for name, rot, color, energy in (('Key', (0.9, 0.6, 0.5), '#ffe7b0', 4.5), ('Rim', (-1.9, -0.9, 0), '#86c3ee', 2.2)):
        d = bpy.data.lights.new(name, 'SUN'); d.energy = energy; d.color = lin(color)[:3]; d.angle = 0.02
        o = bpy.data.objects.new(name, d); o.rotation_euler = rot; bpy.context.collection.objects.link(o)

LAYOUTS = {  # fractional frame coords (0..1, y up); sizes in units of the frame's short side
    'wide':  dict(ast=(0.78, 0.52, 0.4), earth=(0.04, 0.0, 0.36), rocket=(0.5, 0.3, 0.2, 0.95), logo=(0.05, 0.66, 0.52)),
    'small': dict(ast=(0.9, 0.5, 0.5), earth=None, rocket=(0.68, 0.3, 0.26, 0.95), logo=(0.05, 0.52, 0.6)),
    'tall':  dict(ast=(0.7, 0.5, 0.34), earth=(0.08, 0.02, 0.32), rocket=(0.34, 0.33, 0.14, 0.75), logo=(0.5, 0.86, 0.86)),
    'hero':  dict(ast=(0.72, 0.5, 0.42), earth=(0.12, 0.08, 0.36), rocket=(0.44, 0.36, 0.16, 0.9), logo=None),
}

def render_scene(w, h, layout, seed, path):
    reset()
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48; sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, h, 100
    sc.render.film_transparent = True; sc.render.filter_size = 0.6
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.world = bpy.data.worlds.new('W'); sc.world.color = (0, 0, 0)
    H = 10.0; Wd = H * w / h; M = min(Wd, H)
    def at(fx, fy, z=0): return ((fx - 0.5) * Wd, (fy - 0.5) * H, z)
    cam = bpy.data.cameras.new('Cam'); cam.type = 'ORTHO'; cam.sensor_fit = 'HORIZONTAL'; cam.ortho_scale = Wd; cam.clip_end = 200
    co = bpy.data.objects.new('Cam', cam); co.location = (0, 0, 50); sc.collection.objects.link(co); sc.camera = co
    lights()
    L = LAYOUTS[layout]
    ax, ay, ar = L['ast']; asteroid(at(ax, ay), ar * M, seed)
    rx, ry, rl, rang = L['rocket']; rocket(at(rx, ry, 2), rl * M, rang)
    if L['earth']:
        ex, ey, er = L['earth']; earth(at(ex, ey, -3), er * M)
        p0, p2 = at(ex, ey, -1), at(rx, ry, 1)
        dx, dy = -math.sin(rang), -math.cos(rang)  # trail leaves the rocket's tail
        tail = (p2[0] + dx * rl * M * 0.75, p2[1] + dy * rl * M * 0.75, 1)
        k = er * M / math.hypot(tail[0] - p0[0], tail[1] - p0[1])  # leave Earth on the side facing the rocket
        start = (p0[0] + (tail[0] - p0[0]) * k, p0[1] + (tail[1] - p0[1]) * k, 0)
        mid = ((start[0] + tail[0]) / 2 + 0.03 * M, (start[1] + tail[1]) / 2 - 0.04 * M, 0)
        trail([start, mid, tail], 0.006 * M)
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- pixel pass

def quantize(rgb):
    """Ordered dither to PALETTE. rgb: HxWx3 float 0..255."""
    h, w, _ = rgb.shape
    t = np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w, None] * 24.0
    x = np.clip(rgb + t, 0, 255).reshape(-1, 1, 3)
    # perceptual-ish weights
    d = (((x - PAL[None]) * np.array([0.30, 0.59, 0.11], np.float32) * 3) ** 2).sum(-1)
    return PAL[d.argmin(1)].reshape(h, w, 3)

def background(w, h, seed):
    rnd = random.Random(seed)
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    top, bot = np.array(hexc('#0b0d1f'), np.float32), np.array(hexc('#18225a'), np.float32)
    bg = np.broadcast_to(top + (bot - top) * (y ** 1.6), (h, w, 3)).copy()
    stars = []
    for _ in range(int(w * h / 90)):
        x, yy = rnd.randrange(w), rnd.randrange(h)
        stars.append((x, yy, rnd.choice(['#eef1ff', '#a4afde', '#6672a8', '#6672a8', '#86c3ee'])))
    for _ in range(max(2, w * h // 9000)):  # a few big twinkles like the in-game sky
        stars.append((rnd.randrange(w), rnd.randrange(h), 'plus'))
    return bg, stars

def plot_stars(img, stars):
    h, w, _ = img.shape
    for x, y, c in stars:
        if c == 'plus':
            for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= x + dx < w and 0 <= y + dy < h: img[y + dy, x + dx] = hexc('#eef1ff') if (dx, dy) == (0, 0) else hexc('#a4afde')
        else: img[y, x] = hexc(c)

_FONTS = {}
def font(weight, px):
    key = (weight, px)
    if key not in _FONTS:
        from fontTools.ttLib import TTFont
        src = ROOT / 'src' / 'fonts' / f'silkscreen-latin-{weight}-normal.woff2'
        ttf = pathlib.Path(tempfile.gettempdir()) / f'silkscreen-{weight}.ttf'
        if not ttf.exists():
            f = TTFont(str(src)); f.flavor = None; f.save(str(ttf))
        _FONTS[key] = ImageFont.truetype(str(ttf), px)
    return _FONTS[key]

def draw_logo(im, cx, cy, width_frac, anchor_left):
    """ASTROTECH in Silkscreen Bold, gold with dark outline and drop shadow; subtitle under it.
    Font sizes are multiples of 8 so Silkscreen's pixel grid stays exact."""
    W, H = im.size
    unit = 1
    while font('700', 8 * (unit + 1)).getlength('ASTROTECH') <= width_frac * W: unit += 1
    big, small = font('700', 8 * unit), font('400', 8 * max(1, unit // 3))
    title, sub = 'ASTROTECH', 'MINING CO.  EST. 2187'
    tw, sw = big.getlength(title), small.getlength(sub)
    th = 5 * unit  # Silkscreen cap height = 5 font pixels
    x = int(cx * W) if anchor_left else int(cx * W - tw / 2)
    y = int((1 - cy) * H - th / 2)
    d = ImageDraw.Draw(im); d.fontmode = '1'
    o = max(1, unit // 2)
    for dx in range(-o, o + 1):  # outline
        for dy in range(-o, o + o + 1):
            d.text((x + dx, y + dy), title, font=big, fill=hexc('#060918'))
    d.text((x, y + o), title, font=big, fill=hexc('#b9862a'))   # bevel shadow
    d.text((x, y), title, font=big, fill=hexc('#ffd866'))
    if unit < 3: return
    sx = x + (0 if anchor_left else int((tw - sw) / 2))
    sy = y + th * 2 + o * 2
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1, 2):
            d.text((sx + dx, sy + dy), sub, font=small, fill=hexc('#060918'))
    d.text((sx, sy), sub, font=small, fill=hexc('#a4afde'))

def make(name, seed):
    W, H, px, layout, logo = SIZES[name]
    w, h = math.ceil(W / px), math.ceil(H / px)
    if layout == 'logo':
        im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        draw_logo(im, 0.5, 0.55, 0.86, False)
    else:
        raw = pathlib.Path(tempfile.gettempdir()) / f'astrotech_{name}_raw.png'
        render_scene(w, h, layout, seed, raw)
        r = np.asarray(Image.open(raw).convert('RGBA'), np.float32)
        bg, stars = background(w, h, seed)
        plot_stars(bg, stars)
        # dithered alpha keeps the atmosphere glow and trail soft without semi-transparent pixels
        a = r[..., 3:4] / 255
        t = np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w, None] + 0.5
        cover = (a > t * 0.9).astype(np.float32)
        img = quantize(r[..., :3] * cover + bg * (1 - cover))
        # starfield and void stay exact (not dithered)
        img = np.where(cover > 0, img, bg)
        im = Image.fromarray(img.astype(np.uint8), 'RGB')
        L = LAYOUTS[layout]
        if logo and L['logo']:
            lx, ly, lw = L['logo']; draw_logo(im, lx, ly, lw, layout in ('wide', 'small'))
    im = im.resize((w * px, h * px), Image.NEAREST)
    ox, oy = (im.width - W) // 2, (im.height - H) // 2
    im = im.crop((ox, oy, ox + W, oy + H))
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f'{name}_{W}x{H}.png'; im.save(p, optimize=True)
    print('wrote', p.relative_to(ROOT))

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    seed = 3
    if '--seed' in argv: i = argv.index('--seed'); seed = int(argv[i + 1]); del argv[i:i + 2]
    for n in argv or list(SIZES): make(n, seed)

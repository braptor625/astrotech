# Renders a contact sheet of body variants (earth at several rotations, metal, ice ring, gas giant ring) to a PNG.
# usage: gfxsheet.py <out.png> [low|high|ultra]
import sys, os, pathlib, base64
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
out = sys.argv[1]; gfx = sys.argv[2] if len(sys.argv) > 2 else 'high'
with sync_playwright() as p:
    exe = os.environ.get('CHROMIUM_PATH') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
    b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
    pg = b.new_page(viewport={'width': 1400, 'height': 800})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto((root / 'steam/game/index.html').as_uri()); pg.wait_for_timeout(800)
    url = pg.evaluate("""(gfx) => { AT.E.S.settings.gfx = gfx; const R = AT.R;
      const cv = document.createElement('canvas'); cv.width = 560; cv.height = 300; const g = cv.getContext('2d', {willReadFrequently:true});
      g.fillStyle = '#05060f'; g.fillRect(0,0,560,300);
      const L = [150, -70, 60];
      [0.0, 1.5, 3.0, 4.5].forEach((rot, i) => R.drawBody(g, 50 + i * 100, 55, 44 + i * 0.25, null, { kind: 'earth', tex: R.earthTexture(), rot, cloudRot: rot * 0.3, light: L, atmo: '#86c3ee' }));
      const pal = ['#0e1120', '#6a4a30', '#9a7a52', '#c9a878', '#ecd8b4'];
      R.drawBody(g, 450, 55, 44, ['#0e1120', '#4a4a5c', '#7a7a90', '#a8a8c0', '#dcdcec'], { tex: R.rockTexture(77, {}), rot: 0.4, light: [-0.7, -0.5, 0.5], spec: 0.9, metal: true, ore: ['#ffd866', '#ff8f3d'] });
      R.drawBody(g, 60, 170, 40, ['#0e1020', '#3a4a60', '#6a8aa8', '#a8c8e0', '#e8f4ff'], { tex: R.rockTexture(31, {icy: true}), rot: 1.0, light: [-0.7, -0.5, 0.5], spec: 0.2, ring: { inner: 1.35, outer: 2.0, elev: 0.3, ang: -0.3, cols: ['#3a3a4a', '#8a98b8', '#d8e4f8'] } });
      R.drawBody(g, 220, 170, 38, ['#2a1a10', '#8a5a30', '#c9935a', '#e8c890', '#f8e8c0'], { kind: 'band', tex: R.bandTexture(4), rot: 0.5, light: [-0.7, -0.4, 0.6], ring: { inner: 1.4, outer: 2.3, elev: 0.28, ang: -0.25, cols: ['#4a3a2a', '#9a8260', '#d8c49a'] } });
      R.drawBody(g, 380, 170, 40, pal, { tex: R.rockTexture(5, {}), rot: 2.0, light: [0.7, -0.4, 0.5] });
      R.drawBody(g, 500, 170, 14, pal, { tex: R.rockTexture(9, {}), rot: 0.4, light: [-0.7, -0.5, 0.5] });
      R.drawStar(g, 90, 250, 22, '#ff6b4a', 1.0, { corona: 0.5, spikes: true });
      R.drawStar(g, 220, 250, 22, '#9ca6ff', 1.0, { corona: 0.45, spikes: true, pulsar: true });
      R.drawGalaxy(g, 400, 250, 40, '#86c3ee', 5, 12, 'galaxy', 0.5);
      R.drawGalaxy(g, 500, 250, 36, '#ffb070', 5, 13, 'elliptical', 0.6);
      return cv.toDataURL(); }""", gfx)
    open(out, 'wb').write(base64.b64decode(url.split(',')[1]))
    b.close()
print(errs or 'ok')

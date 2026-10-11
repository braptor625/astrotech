// AstroTech — low-level pixel renderer: noise, dithering, spheres, stars, galaxies, bitmap font.
(function (AT) {
  'use strict';
  const R = AT.R = {};

  // ---------- color helpers ----------
  const hexCache = {};
  R.rgb = function (hex) {
    if (hexCache[hex]) return hexCache[hex];
    const h = hex.replace('#', '');
    return (hexCache[hex] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  };
  R.mix = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  R.hex = function (c) { return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
  R.bayer = function (x, y) { return BAYER[(y & 3) * 4 + (x & 3)]; };

  // ---------- seeded noise ----------
  function hash(x, y, z, s) {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const sm = (t) => t * t * (3 - 2 * t);
  R.noise3 = function (x, y, z, s) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    let r = 0;
    for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const w = (dx ? xf : 1 - xf) * (dy ? yf : 1 - yf) * (dz ? zf : 1 - zf);
      r += w * hash(xi + dx, yi + dy, zi + dz, s);
    }
    return r;
  };
  R.fbm3 = function (x, y, z, s, oct) {
    let a = 0.5, f = 1, r = 0, n = 0;
    for (let i = 0; i < (oct || 4); i++) { r += a * R.noise3(x * f, y * f, z * f, s + i * 17); n += a; a *= 0.5; f *= 2.03; }
    return r / n;
  };

  // ---------- sphere textures (equirectangular, sampled on the 3D sphere: no seams) ----------
  const TW = 128, TH = 64;
  R.TW = TW; R.TH = TH;
  function sphereTexture(fn) {
    const h = new Float32Array(TW * TH), k = new Uint8Array(TW * TH);
    for (let j = 0; j < TH; j++) {
      const lat = (j / (TH - 1) - 0.5) * Math.PI;
      for (let i = 0; i < TW; i++) {
        const lon = (i / TW) * Math.PI * 2;
        const x = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon);
        const o = fn(x, y, z, lat, lon);
        h[j * TW + i] = o.h; k[j * TW + i] = o.k || 0;
      }
    }
    return { h, k };
  }
  R.texCache = {};
  // rocky / icy body: height from fbm with craters; k = 1 marks ore flecks, 2 marks ice
  R.rockTexture = function (seed, opts) {
    const key = 'rock:' + seed + ':' + (opts && opts.icy ? 1 : 0);
    if (R.texCache[key]) return R.texCache[key];
    const rand = AT.SPR.rng(seed);
    const craters = [];
    for (let i = 0; i < 14; i++) {
      const lat = Math.asin(rand() * 2 - 1), lon = rand() * Math.PI * 2;
      craters.push({ x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon), r: 0.08 + rand() * 0.22 });
    }
    const s = seed % 1000;
    const tex = sphereTexture((x, y, z) => {
      let h = R.fbm3(x * 2.2 + 5, y * 2.2, z * 2.2, s, 4);
      for (const c of craters) {
        const d = Math.hypot(x - c.x, y - c.y, z - c.z) / c.r;
        if (d < 1) h -= (1 - d * d) * 0.35;
        else if (d < 1.25) h += (1.25 - d) * 0.5;
      }
      const fleck = R.noise3(x * 14, y * 14, z * 14, s + 99);
      let k = fleck > 0.86 ? 1 : 0;
      if (opts && opts.icy && R.noise3(x * 5, y * 5, z * 5, s + 7) > 0.62) k = 2;
      return { h, k };
    });
    // irregular outline: radius scale per screen angle
    tex.limb = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      tex.limb[i] = 0.82 + 0.18 * R.fbm3(Math.cos(a) * 1.3 + 9, Math.sin(a) * 1.3, 0.5, s + 3, 3) * 1.6 - 0.1;
    }
    return (R.texCache[key] = tex);
  };
  R.earthTexture = function () {
    if (R.texCache.earth) return R.texCache.earth;
    const t = sphereTexture((x, y, z, lat) => {
      const n = R.fbm3(x * 1.6 + 3, y * 1.6, z * 1.6, 42, 5);
      const land = n > 0.53;
      const pole = Math.abs(lat) > 1.18 + R.noise3(x * 4, y * 4, z * 4, 5) * 0.2;
      let k = land ? 1 : 0;
      if (land && Math.abs(lat) < 0.5 && R.noise3(x * 3, y * 3, z * 3, 77) > 0.55) k = 3; // desert
      if (pole) k = 2;
      return { h: n, k };
    });
    t.clouds = sphereTexture((x, y, z) => ({ h: R.fbm3(x * 2.5, y * 4, z * 2.5, 9, 4) }));
    t.lights = sphereTexture((x, y, z) => ({ h: R.noise3(x * 30, y * 30, z * 30, 3) }));
    return (R.texCache.earth = t);
  };
  R.bandTexture = function (seed) {
    const key = 'band:' + seed;
    if (R.texCache[key]) return R.texCache[key];
    return (R.texCache[key] = sphereTexture((x, y, z) => ({ h: 0.5 + 0.5 * Math.sin(y * 9 + R.fbm3(x * 2, y * 6, z * 2, seed, 3) * 4) })));
  };

  function texSample(arr, lon, lat) {
    let u = (lon / (Math.PI * 2)) % 1; if (u < 0) u += 1;
    const v = Math.max(0, Math.min(0.9999, lat / Math.PI + 0.5));
    return arr[Math.floor(v * TH) * TW + Math.floor(u * TW)];
  }

  // draw a lit, dithered, rotating body. pal = array of 4-5 colors dark→light
  // opts: { tex, rot, light:[x,y,z], kind:'rock'|'earth'|'band', ore:[colors], ice, atmo:color, tilt }
  R.drawBody = function (g, cx, cy, r, pal, opts) {
    const tex = opts.tex, rot = opts.rot || 0;
    const L = opts.light || [-0.6, -0.55, 0.58];
    const ll = Math.hypot(L[0], L[1], L[2]);
    const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
    const size = Math.ceil(r * 1.25) + 2;
    const x0 = Math.floor(cx - size), y0 = Math.floor(cy - size), w = size * 2, h = size * 2;
    const img = g.getImageData(x0, y0, w, h);
    const d = img.data;
    const cols = pal ? pal.map(R.rgb) : [];
    const ore = opts.ore ? opts.ore.map(R.rgb) : null;
    const isEarth = opts.kind === 'earth';
    const outline = R.rgb('#05070f');
    const atmo = opts.atmo ? R.rgb(opts.atmo) : null;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dx = (x0 + px + 0.5 - cx) / r, dy = (y0 + py + 0.5 - cy) / r;
        let lim = 1;
        if (tex.limb) { const a = Math.atan2(dy, dx); let i = Math.floor(((a / (Math.PI * 2)) + 1) * 64) % 64; lim = tex.limb[i]; }
        const dist = Math.hypot(dx, dy);
        const idx = (py * w + px) * 4;
        if (dist > lim) {
          if (dist < lim + 1.2 / r) { // 1px outline / atmosphere
            if (atmo) {
              const lit = -(dx * lx + dy * ly) / dist;
              if (lit > -0.3) { const c = R.mix(atmo, [5, 7, 15], 0.4 - Math.min(0.4, lit * 0.6)); d[idx] = c[0]; d[idx + 1] = c[1]; d[idx + 2] = c[2]; d[idx + 3] = 255; }
            } else { d[idx] = outline[0]; d[idx + 1] = outline[1]; d[idx + 2] = outline[2]; d[idx + 3] = 255; }
          } else if (atmo && dist < lim + 2.4 / r) {
            const lit = -(dx * lx + dy * ly) / dist;
            if (lit > 0.2 && ((px + py) & 1)) { d[idx] = atmo[0] * 0.55; d[idx + 1] = atmo[1] * 0.55; d[idx + 2] = atmo[2] * 0.7; d[idx + 3] = 255; }
          }
          continue;
        }
        const nx = dx / lim, ny = dy / lim;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        // tilt the body a little so poles are visible
        const tilt = opts.tilt || 0.25;
        const yy = ny * Math.cos(tilt) - nz * Math.sin(tilt), zz = ny * Math.sin(tilt) + nz * Math.cos(tilt);
        const lat = Math.asin(Math.max(-1, Math.min(1, yy)));
        const lon = Math.atan2(nx, zz) + rot;
        const hgt = texSample(tex.h, lon, lat);
        const hgt2 = texSample(tex.h, lon + 0.05, lat), hgt3 = texSample(tex.h, lon, lat + 0.05);
        // bumped normal
        const bx = nx + (hgt - hgt2) * 2.2, by = ny + (hgt - hgt3) * 2.2;
        const bl = Math.hypot(bx, by, nz) || 1;
        let lit = (bx * lx + by * ly + nz * lz) / bl;
        let c;
        if (isEarth) {
          const k = texSample(tex.k, lon, lat);
          const sea = [[10, 30, 70], [22, 66, 130], [50, 120, 190]];
          const land = [[30, 60, 30], [60, 110, 50], [110, 150, 70]];
          const desert = [[110, 80, 40], [170, 130, 70], [220, 190, 120]];
          const ice = [[150, 170, 200], [210, 225, 240], [250, 252, 255]];
          const set = k === 2 ? ice : k === 3 ? desert : k === 1 ? land : sea;
          const lv = lit + R.bayer(px, py) * 0.25;
          c = lv < 0.05 ? null : lv < 0.35 ? set[0] : lv < 0.7 ? set[1] : set[2];
          const cl = texSample(tex.clouds.h, lon * 1.0 + (opts.cloudRot || 0), lat);
          if (cl > 0.56 && lv > 0.0) c = lv < 0.4 ? [150, 160, 180] : [235, 240, 248];
          if (!c) { // night side
            const lightsOn = k === 1 && texSample(tex.lights.h, lon, lat) > (opts.cityLights || 0.8);
            c = lightsOn ? [255, 210, 120] : [6, 10, 26];
          }
        } else if (opts.kind === 'band') {
          const lv = lit + R.bayer(px, py) * 0.25;
          const tone = Math.floor(hgt * 3.99);
          const base = cols[Math.min(cols.length - 1, 1 + (tone % 3))];
          c = lv < 0.05 ? cols[0] : R.mix(base, [255, 255, 255], Math.max(0, lv - 0.75) * 0.6);
          if (lv < 0.3 && lv >= 0.05) c = R.mix(cols[0], base, 0.5);
        } else {
          lit += (hgt - 0.5) * 0.35;
          const lv = lit + R.bayer(px, py) * 0.3;
          const n = cols.length;
          const li = lv < -0.05 ? 0 : lv < 0.25 ? 1 : lv < 0.6 ? 2 : n - 1;
          c = cols[Math.min(n - 1, li)];
          const k = texSample(tex.k, lon, lat);
          if (k === 1 && ore && lv > 0.15) c = ore[Math.floor((lon * 7 + lat * 3) * 3) & 1 ? 0 : Math.min(1, ore.length - 1)];
          if (k === 2 && lv > 0.05) c = lv > 0.45 ? [235, 245, 255] : [150, 180, 210];
        }
        d[idx] = c[0]; d[idx + 1] = c[1]; d[idx + 2] = c[2]; d[idx + 3] = 255;
      }
    }
    g.putImageData(img, x0, y0);
  };
  // project a point at (lat, lon) on the rotating body to the screen; returns null when on the far side
  R.surfacePoint = function (cx, cy, r, lat, lon, rot, tilt, lift) {
    tilt = tilt || 0.25;
    const L = lon - rot;
    const x = Math.cos(lat) * Math.sin(L), yy = Math.sin(lat), zz = Math.cos(lat) * Math.cos(L);
    // undo tilt
    const y = yy * Math.cos(tilt) + zz * Math.sin(tilt);
    const z = -yy * Math.sin(tilt) + zz * Math.cos(tilt);
    if (z < 0.05) return null;
    const k = r * (1 + (lift || 0));
    return { x: cx + x * k, y: cy + y * k, z };
  };

  // ---------- stars ----------
  R.drawStar = function (g, cx, cy, r, color, t, opts) {
    opts = opts || {};
    const base = R.rgb(color);
    const size = Math.ceil(r * 1.6) + 3;
    const x0 = Math.floor(cx - size), y0 = Math.floor(cy - size), w = size * 2, h = size * 2;
    const img = g.getImageData(x0, y0, w, h), d = img.data;
    const hot = R.mix(base, [255, 255, 245], 0.75), dark = R.mix(base, [40, 10, 0], 0.45);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const dx = (x0 + px + 0.5 - cx) / r, dy = (y0 + py + 0.5 - cy) / r;
      const dist = Math.hypot(dx, dy);
      const idx = (py * w + px) * 4;
      if (dist <= 1) {
        const limb = Math.sqrt(1 - dist * dist);
        const gran = R.noise3(dx * 6, dy * 6, t * 0.4, 11) - 0.5;
        const lv = limb * 0.85 + gran * 0.5 + R.bayer(px, py) * 0.2;
        const c = lv > 0.7 ? hot : lv > 0.35 ? base : dark;
        d[idx] = c[0]; d[idx + 1] = c[1]; d[idx + 2] = c[2]; d[idx + 3] = 255;
      } else if (dist < 1.6) {
        // corona: dithered, flickering
        const ang = Math.atan2(dy, dx);
        const fl = R.noise3(Math.cos(ang) * 3, Math.sin(ang) * 3, t * 0.8, 21);
        const reach = 1 + (opts.corona || 0.35) * (0.4 + fl);
        if (dist < reach) {
          const p = (reach - dist) / (reach - 1);
          if (p + R.bayer(px, py) * 0.9 > 0.55) {
            const c = R.mix(base, [255, 255, 255], 0.2);
            d[idx] = c[0]; d[idx + 1] = c[1]; d[idx + 2] = c[2]; d[idx + 3] = 255;
          }
        }
      }
    }
    g.putImageData(img, x0, y0);
  };

  // ---------- galaxies (precomputed point clouds) ----------
  const galCache = {};
  R.galaxyPoints = function (seed, kind, n) {
    const key = seed + kind;
    if (galCache[key]) return galCache[key];
    const rand = AT.SPR.rng(seed);
    const pts = [];
    const arms = kind === 'galaxy' ? 2 + Math.floor(rand() * 2) : 0;
    for (let i = 0; i < (n || 600); i++) {
      if (kind === 'galaxy') {
        const arm = Math.floor(rand() * arms);
        const d = Math.pow(rand(), 0.7);
        const a = arm * (Math.PI * 2 / arms) + d * 4.2 + (rand() - 0.5) * 0.5;
        pts.push({ r: d, a, b: rand(), core: d < 0.18 });
      } else {
        const d = Math.pow(rand(), 1.8);
        pts.push({ r: d, a: rand() * Math.PI * 2, b: rand(), core: d < 0.2 });
      }
    }
    return (galCache[key] = pts);
  };
  R.drawGalaxy = function (g, cx, cy, r, color, t, seed, kind, tiltY) {
    const pts = R.galaxyPoints(seed, kind);
    const base = color, core = '#fff6d8';
    const ty = tiltY || 0.45;
    for (const p of pts) {
      const a = p.a + t * 0.02 * (1.2 - p.r);
      const x = cx + Math.cos(a) * p.r * r, y = cy + Math.sin(a) * p.r * r * ty;
      g.fillStyle = p.core ? core : p.b > 0.85 ? '#ffffff' : base;
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    g.fillStyle = core;
    g.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3);
    if (kind === 'quasar') {
      g.fillStyle = '#e8f8ff';
      for (let k = 2; k < r * 1.4; k += 1) if ((k + Math.floor(t * 8)) % 3) { g.fillRect(Math.round(cx), Math.round(cy - k), 1, 1); g.fillRect(Math.round(cx), Math.round(cy + k), 1, 1); }
    }
  };

  // ---------- primitives ----------
  R.disc = function (g, cx, cy, r, col) {
    g.fillStyle = col;
    for (let y = -r; y <= r; y++) {
      const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
      g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
  };
  R.line = function (g, x0, y0, x1, y1, col, dash) {
    g.fillStyle = col;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, i = 0;
    for (let guard = 0; guard < 2000; guard++) {
      if (!dash || (i++ % dash) < dash / 2) g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  R.ellipse = function (g, cx, cy, rx, ry, col, step) {
    g.fillStyle = col;
    const n = Math.max(24, Math.floor((rx + ry) * 2));
    for (let i = 0; i < n; i += (step || 1)) {
      const a = (i / n) * Math.PI * 2;
      g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
    }
  };

  // ---------- 3x5 bitmap font ----------
  const F = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
    G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
    S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
    '.': '000000000000010', ',': '000000000010100', ':': '000010000010000', '-': '000000111000000', '+': '000010111010000', '/': '001001010100100',
    '%': '101001010100101', '(': '010100100100010', ')': '010001001001010', "'": '010010000000000', '!': '010010010000010', '?': '110001010000010',
    '$': '011110010011110', '#': '101111101111101', '>': '100010001010100', '<': '001010100010001', '=': '000111000111000', '*': '000101010101000',
    ' ': '000000000000000', '_': '000000000000111', '"': '101101000000000',
  };
  // ---------- 5x7 bitmap font (default): 6px advance, 8px line height ----------
  // Each glyph is 7 rows of 5 chars ('#' = ink), rows separated by '/'.
  const F5src = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.', C: '.###./#...#/#..../#..../#..../#...#/.###.',
    D: '###../#..#./#...#/#...#/#...#/#..#./###..', E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
    G: '.###./#...#/#..../#.###/#...#/#...#/.####', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#', I: '.###./..#../..#../..#../..#../..#../.###.',
    J: '..###/...#./...#./...#./...#./#..#./.##..', K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#', O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    P: '####./#...#/#...#/####./#..../#..../#....', Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..', U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
    V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..', W: '#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#...../#####',
    0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '..#../.##../..#../..#../..#../..#../.###.', 2: '.###./#...#/....#/...#./..#../.#.../#####',
    3: '#####/...#./..#../...#./....#/#...#/.###.', 4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
    6: '..##./.#.../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...', 8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
    9: '.###./#...#/#...#/.####/....#/...#./.##..',
    '.': '...../...../...../...../...../.##../.##..', ',': '...../...../...../...../.##../..#../.#...', '-': '...../...../...../#####/...../...../.....',
    ':': '...../.##../.##../...../.##../.##../.....', '+': '...../..#../..#../#####/..#../..#../.....', '/': '....#/...#./...#./..#../.#.../#..../#....',
    '%': '##..#/##.#./...#./..#../.#.../#.##./##..#', '(': '...#./..#../.#.../.#.../.#.../..#../...#.', ')': '.#.../..#../...#./...#./...#./..#../.#...',
    "'": '..#../..#../.#.../...../...../...../.....', '!': '..#../..#../..#../..#../..#../...../..#..', '?': '.###./#...#/....#/...#./..#../...../..#..',
    '$': '..#../.####/#.#../.###./..#.#/####./..#..', '#': '.#.#./#####/.#.#./.#.#./#####/.#.#./.....', '>': '#..../.#.../..#../...#./..#../.#.../#....',
    '<': '...#./..#../.#.../#..../.#.../..#../...#.', '=': '...../...../#####/...../#####/...../.....', '*': '...../#.#.#/.###./#####/.###./#.#.#/.....',
    '_': '...../...../...../...../...../...../#####', '"': '.#.#./.#.#./...../...../...../...../.....', ' ': '...../...../...../...../...../...../.....',
  };
  const F5 = Object.fromEntries(Object.entries(F5src).map(([k, v]) => [k, v.split('/')]));
  // size: 's' = 3x5 (4px advance, 6px line), 'm' = 5x7 (6px advance, 8px line).
  // Omitted size follows the player's text-size setting; the setting is read defensively.
  R.defaultSize = function () {
    let v;
    try { v = AT.E.S.settings.textSize; } catch (e) { v = undefined; }
    return v === 'normal' ? 's' : 'm';
  };
  const sizeOf = (size) => (size === 's' || size === 'm' ? size : R.defaultSize());
  R.textH = function (size) { return sizeOf(size) === 's' ? 6 : 8; };
  R.textWidth = function (s, size) { return String(s).length * (sizeOf(size) === 's' ? 4 : 6) - 1; };
  R.text = function (g, s, x, y, col, shadow, size) {
    size = sizeOf(size);
    s = String(s).toUpperCase();
    if (shadow) R.text(g, s, x + 1, y + 1, shadow, null, size);
    g.fillStyle = col;
    let cx = Math.round(x);
    const yy = Math.round(y);
    if (size === 's') {
      for (const ch of s) {
        const glyph = F[ch] || F['?'];
        for (let i = 0; i < 15; i++) if (glyph[i] === '1') g.fillRect(cx + (i % 3), yy + Math.floor(i / 3), 1, 1);
        cx += 4;
      }
    } else {
      for (const ch of s) {
        const glyph = F5[ch] || F5['?'];
        for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (glyph[r][c] === '#') g.fillRect(cx + c, yy + r, 1, 1);
        cx += 6;
      }
    }
  };
})(window.AT = window.AT || {});

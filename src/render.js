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

  // ---------- quality tiers ----------
  // gfx: 'low' costs about what the old renderer did, 'high' is the default, 'ultra' has the most detail.
  const TIERS = {
    low:   { name: 'low',   tw: 128, th: 64,  craters: 14, smooth: false, step: 2.0, budget: 1.5, gal: 650,  flare: false, trail: 0, dust: false, halo: 1 },
    high:  { name: 'high',  tw: 256, th: 128, craters: 34, smooth: true,  step: 1.5, budget: 1.5, gal: 2400, flare: true,  trail: 2, dust: true,  halo: 2 },
    ultra: { name: 'ultra', tw: 512, th: 256, craters: 64, smooth: true,  step: 1.0, budget: 3.0, gal: 6000, flare: true,  trail: 4, dust: true,  halo: 3 },
  };
  R.TIERS = TIERS;
  R.tier = function () {
    const s = AT.E && AT.E.S && AT.E.S.settings;
    return TIERS[s && s.gfx] || TIERS.high;
  };
  // 1 normally; slower when the player asked for reduced motion
  R.motion = function () { return AT.reducedMotion ? 0.2 : 1; };

  // per-frame budget (ms) for progressive sprite refreshes; scene.js calls R.beginFrame() once per frame
  let frameStamp = 0, spent = 0;
  R.beginFrame = function () { frameStamp = performance.now(); spent = 0; };
  function budgetLeft() {
    const now = performance.now();
    if (now - frameStamp > 14) { frameStamp = now; spent = 0; } // scene never called beginFrame
    return R.tier().budget - spent;
  }

  // ---------- sphere textures (equirectangular, sampled on the 3D sphere: no seams) ----------
  // Each texture keeps: h height, a albedo shift, k material, and d = interleaved [gradEast, gradNorth, albedo, height]
  // (the gradients are the bump map: slope of the height field in sphere-radius units)
  let uidSeq = 0;
  function sphereTexture(tier, fn) {
    const tw = tier.tw, th = tier.th, n = tw * th;
    const h = new Float32Array(n), a = new Float32Array(n), k = new Uint8Array(n);
    const o = { h: 0, a: 0, k: 0 };
    for (let j = 0; j < th; j++) {
      const lat = (j / (th - 1) - 0.5) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (let i = 0; i < tw; i++) {
        const lon = (i / tw) * Math.PI * 2;
        o.a = 0; o.k = 0;
        fn(cl * Math.sin(lon), sl, cl * Math.cos(lon), lat, lon, o);
        const p = j * tw + i;
        h[p] = o.h; a[p] = o.a; k[p] = o.k;
      }
    }
    return { tw, th, h, a, k, uid: ++uidSeq, tier: tier.name };
  }
  function addSlopes(t, gain, hmul) {
    const { tw, th, h, a } = t, d = new Float32Array(tw * th * 4);
    const dl = Math.PI * 2 / tw, dp = Math.PI / (th - 1);
    for (let j = 0; j < th; j++) {
      const lat = (j / (th - 1) - 0.5) * Math.PI, cl = Math.max(0.14, Math.cos(lat));
      const jm = Math.max(0, j - 1), jp = Math.min(th - 1, j + 1);
      for (let i = 0; i < tw; i++) {
        const im = (i - 1 + tw) % tw, ip = (i + 1) % tw, p = j * tw + i, q = p * 4;
        const ge = (h[j * tw + ip] - h[j * tw + im]) / (2 * dl * cl) * gain;
        const gn = (h[jp * tw + i] - h[jm * tw + i]) / ((jp - jm) * dp) * gain;
        d[q] = ge > 2.5 ? 2.5 : ge < -2.5 ? -2.5 : ge; d[q + 1] = gn > 2.5 ? 2.5 : gn < -2.5 ? -2.5 : gn;
        d[q + 2] = a[p]; d[q + 3] = h[p] * (hmul || 1);
      }
    }
    t.d = d;
    return t;
  }
  R.texCache = {};
  const texOrder = [];
  function texPut(key, tex) {
    R.texCache[key] = tex; texOrder.push(key);
    while (texOrder.length > 16) { const old = texOrder.shift(); if (!/^(earth|moon)/.test(old)) delete R.texCache[old]; else texOrder.push(old); if (texOrder.every((k) => /^(earth|moon)/.test(k))) break; }
    return tex;
  }
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const tierOf = (opts) => (opts && opts.tier && TIERS[opts.tier]) || R.tier();

  // rocky / icy body: lumpy fbm + ridges, craters with raised rims and dark floors, ore veins (k&7 = 1), ice patches (k&7 = 2)
  R.rockTexture = function (seed, opts) {
    const tier = tierOf(opts), icy = !!(opts && opts.icy);
    const key = 'rock:' + seed + ':' + (icy ? 1 : 0) + ':' + tier.name;
    if (R.texCache[key]) return R.texCache[key];
    const rand = AT.SPR.rng(seed);
    const craters = [];
    for (let i = 0; i < tier.craters; i++) {
      const lat = Math.asin(rand() * 2 - 1), lon = rand() * Math.PI * 2;
      const rc = i < 2 ? 0.17 + rand() * 0.12 : 0.035 + Math.pow(rand(), 2.2) * 0.2;
      craters.push({ x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon), r: rc, c2: 1 - 0.5 * (rc * 1.7) * (rc * 1.7) });
    }
    const s = seed % 1000;
    const tex = sphereTexture(tier, (x, y, z, lat, lon, o) => {
      const n1 = R.fbm3(x * 2.2 + 5, y * 2.2, z * 2.2, s, 4);
      const n2 = R.fbm3(x * 4.5, y * 4.5 + 3, z * 4.5, s + 31, 3);
      let h = (n1 - 0.5) * 0.14 + (1 - Math.abs(n2 * 2 - 1)) * 0.035; // lumps + ridges
      let a = (n1 - 0.5) * 0.45 + (n2 - 0.5) * 0.25;
      for (let ci = 0; ci < craters.length; ci++) {
        const c = craters[ci];
        const dot = x * c.x + y * c.y + z * c.z;
        if (dot < c.c2) continue;
        const d = Math.sqrt(Math.max(0, 2 - 2 * dot)) / c.r;
        if (d > 1.7) continue;
        const depth = c.r * 0.55;
        if (d < 1) {
          const bowl = 1 - Math.pow(d, 2.4);
          h -= depth * bowl;
          h += depth * 0.3 * Math.exp(-(d * d) / 0.03); // central peak
          a -= 0.36 * Math.pow(Math.max(0, 1 - d * d), 0.6); // dark floor
        }
        const rimd = (d - 1) / 0.16;
        h += c.r * 0.22 * Math.exp(-rimd * rimd);
        if (d > 1) h += c.r * 0.08 * Math.exp(-(d - 1) * 3.5);
        a += 0.34 * Math.exp(-((d - 1.04) / 0.2) * ((d - 1.04) / 0.2)); // bright rim
      }
      // ore veins: thin ridged lines inside a patchy zone, plus sparse flecks
      const zone = R.fbm3(x * 3 + 8, y * 3, z * 3, s + 50, 3);
      const wv = R.noise3(x * 7 + R.noise3(x * 3, y * 3, z * 3, s + 5) * 1.6, y * 7, z * 7, s + 99);
      const fleck = R.noise3(x * 16, y * 16, z * 16, s + 98);
      let k = 0;
      if ((zone > 0.56 && Math.abs(wv - 0.5) < 0.02) || fleck > 0.955) k = 1;
      if (icy && R.noise3(x * 5, y * 5, z * 5, s + 7) > 0.62) k = 2;
      if (k) k |= (Math.floor(R.noise3(x * 41, y * 41, z * 41, s + 4) * 31.99)) << 3;
      o.h = h; o.a = a; o.k = k;
    });
    addSlopes(tex, 1);
    tex.icy = icy;
    // irregular outline: radius scale per screen angle
    tex.limb = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
      const an = (i / 64) * Math.PI * 2;
      tex.limb[i] = 0.82 + 0.18 * R.fbm3(Math.cos(an) * 1.3 + 9, Math.sin(an) * 1.3, 0.5, s + 3, 3) * 1.6 - 0.1;
    }
    return texPut(key, tex);
  };
  // earth: k 0 sea, 1 land, 2 ice cap, 3 desert; plus a cloud deck and city lights
  R.earthTexture = function () {
    const tier = R.tier(), key = 'earth:' + tier.name;
    if (R.texCache[key]) return R.texCache[key];
    const t = sphereTexture(tier, (x, y, z, lat, lon, o) => {
      const n = R.fbm3(x * 1.6 + 3, y * 1.6, z * 1.6, 42, 5);
      const land = n > 0.53;
      const pole = Math.abs(lat) > 1.18 + R.noise3(x * 4, y * 4, z * 4, 5) * 0.2;
      let k = land ? 1 : 0;
      if (land && Math.abs(lat) < 0.5 && R.noise3(x * 3, y * 3, z * 3, 77) > 0.55) k = 3;
      if (pole) k = 2;
      const mt = land ? R.fbm3(x * 6 + 1, y * 6, z * 6, 12, 3) : 0; // mountains
      o.h = land ? (n - 0.53) * 0.5 + mt * 0.05 : 0;
      o.a = land ? (mt - 0.5) * 0.8 : (R.noise3(x * 30, y * 30, z * 30, 8) - 0.5);
      o.k = k;
    });
    addSlopes(t, 1);
    const c = sphereTexture(tier, (x, y, z, lat, lon, o) => { o.h = R.fbm3(x * 2.5, y * 4, z * 2.5, 9, 4); });
    t.clouds = c.h;
    const l = sphereTexture(tier, (x, y, z, lat, lon, o) => {
      const pop = R.fbm3(x * 5 + 2, y * 5, z * 5, 19, 3);
      const city = R.noise3(x * 34, y * 34, z * 34, 3);
      o.h = Math.min(1, city * city * (0.15 + 1.4 * sstep(0.5, 0.62, pop)));
    });
    t.lights = l.h;
    return texPut(key, t);
  };
  // gas giant: zonal bands sheared by turbulence, with a couple of storm ovals
  R.bandTexture = function (seed, opts) {
    const tier = tierOf(opts), key = 'band:' + seed + ':' + tier.name;
    if (R.texCache[key]) return R.texCache[key];
    const rand = AT.SPR.rng(seed + 5);
    const storms = [];
    for (let i = 0; i < 2; i++) storms.push({ lat: (rand() - 0.5) * 1.0, lon: rand() * Math.PI * 2, rx: 0.2 + rand() * 0.15, ry: 0.08 + rand() * 0.05 });
    const tex = sphereTexture(tier, (x, y, z, lat, lon, o) => {
      const shear = Math.sin(y * 7 + seed) * 0.5 + Math.sin(y * 17) * 0.15;
      const cs = Math.cos(shear), sn = Math.sin(shear);
      const xr = x * cs + z * sn, zr = -x * sn + z * cs;
      const turb = R.fbm3(xr * 3, y * 9, zr * 3, seed, 4);
      let v = 0.5 + 0.5 * Math.sin(y * 9 + turb * 5);
      let a = (turb - 0.5) * 0.4;
      for (const st of storms) {
        let dl = lon - st.lon; dl = Math.atan2(Math.sin(dl), Math.cos(dl));
        const q = (dl / st.rx) * (dl / st.rx) + ((lat - st.lat) / st.ry) * ((lat - st.lat) / st.ry);
        if (q < 1) { const sw = R.fbm3(xr * 9, y * 14, zr * 9, seed + 7, 3); v = 0.15 + 0.5 * sw + (q > 0.7 ? 0.25 : 0); a -= (1 - q) * 0.2; }
      }
      o.h = v; o.a = a;
    });
    addSlopes(tex, 0.25);
    return texPut(key, tex);
  };
  // star surface: granulation cells and dark spots
  R.starTexture = function (seed, opts) {
    const tier = tierOf(opts), key = 'star:' + seed + ':' + tier.name;
    if (R.texCache[key]) return R.texCache[key];
    const s = seed % 1000;
    const tex = sphereTexture(tier, (x, y, z, lat, lon, o) => {
      const g1 = R.noise3(x * 7, y * 7, z * 7, s + 11), g2 = R.noise3(x * 15 + 3, y * 15, z * 15, s + 12);
      const g = 0.6 * g1 + 0.4 * g2;
      const sp = sstep(0.7, 0.78, R.fbm3(x * 2.4 + 1, y * 2.4, z * 2.4, s + 13, 3)) * (Math.abs(lat) < 1.0 ? 1 : 0);
      o.h = g; o.a = sp;
    });
    tex.d = new Float32Array(tex.tw * tex.th * 4);
    for (let p = 0; p < tex.tw * tex.th; p++) { tex.d[p * 4 + 2] = tex.a[p]; tex.d[p * 4 + 3] = tex.h[p]; }
    return texPut(key, tex);
  };

  // ---------- sprites: bodies are rendered into cached canvases, refreshed progressively ----------
  const BAYER_T = new Float32Array(16);
  for (let i = 0; i < 16; i++) BAYER_T[i] = BAYER[i];
  const spriteCache = {}, spriteOrder = [];
  function spriteGet(key) {
    let sp = spriteCache[key];
    if (!sp) {
      sp = spriteCache[key] = { key, done: false, job: null, geom: null, cv: null, buf: null };
      spriteOrder.push(key);
      if (spriteOrder.length > 60) { const old = spriteOrder.shift(); delete spriteCache[old]; }
    }
    return sp;
  }
  function spriteSize(sp, w, h) {
    if (sp.cv && sp.cv.width === w && sp.cv.height === h) return;
    sp.cv = document.createElement('canvas'); sp.cv.width = w; sp.cv.height = h;
    sp.cx = sp.cv.getContext('2d'); sp.buf = sp.cx.createImageData(w, h);
    sp.done = false;
  }
  // run the sprite's pending job: `force` finishes it now, otherwise within the frame budget
  function spriteAdvance(sp, force) {
    const job = sp.job;
    if (!job) return;
    if (!force) { if (budgetLeft() <= 0.15) return; }
    const t0 = performance.now(), lim = force ? 1e9 : budgetLeft();
    const chunk = Math.max(2, Math.ceil(job.h / 40));
    while (job.y < job.h) {
      job.fn(sp, job.y, Math.min(job.h, job.y + chunk));
      job.y += chunk;
      if (performance.now() - t0 > lim) break;
    }
    spent += performance.now() - t0;
    if (job.y >= job.h) { sp.cx.putImageData(sp.buf, 0, 0); sp.done = true; sp.job = null; sp.stamp = job.stamp; }
  }

  // ---------- body geometry (static per size / light / tilt): normals, bump basis, dither bases, outline, rings ----------
  const geoms = {}, geomOrder = [];
  function buildGeom(r, tex, tilt, L, o) {
    const kind = o.kind;
    const halo = o.atmo ? Math.max(3, Math.round(r * 0.075)) : 0;
    const ring = o.ring || null;
    let S = Math.ceil(r * (o.extent || 1.01)) + halo + 3;
    if (ring) S = Math.max(S, Math.ceil(r * ring.outer) + 2);
    const w = S * 2, h = S * 2, n = w * h;
    const G = { w, h, S, r, L: L.slice(), tilt, kind };
    const mask = G.mask = new Uint8Array(n);
    const A = G.A = new Float32Array(n), B = G.B = new Float32Array(n), C = G.C = new Float32Array(n);
    const Hn = G.Hn = new Float32Array(n), Bh = G.Bh = new Float32Array(n), Ch = G.Ch = new Float32Array(n);
    const rim = G.rim = new Float32Array(n), sh = G.sh = new Float32Array(n), nzA = G.nz = new Float32Array(n);
    const U0 = G.u0 = new Float32Array(n), RA = G.rowA = new Int32Array(n), RB = G.rowB = new Int32Array(n), FV = G.fv = new Float32Array(n);
    const base = G.base = new Uint8ClampedArray(n * 4);
    let front = null, DIST = null, AI = null;
    if (ring) front = G.front = new Uint8ClampedArray(n * 4);
    if (o.extent) { DIST = G.dist = new Float32Array(n); AI = G.ai = new Uint8Array(n); }
    const tw = tex.tw, th = tex.th;
    const lx = L[0], ly = L[1], lz = L[2];
    let hx = lx, hy = ly, hz = lz + 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const atmo = o.atmo ? R.rgb(o.atmo) : null;
    const outline = [5, 7, 15];
    // ring plane
    let a1, a2, Nr, rcol;
    if (ring) {
      const ra = ring.ang || 0, se = Math.sin(ring.elev), ce = Math.cos(ring.elev);
      a1 = [Math.cos(ra), Math.sin(ra), 0]; a2 = [-Math.sin(ra) * se, Math.cos(ra) * se, ce];
      Nr = [Math.sin(ra) * ce, -Math.cos(ra) * ce, se];
      rcol = (ring.cols || ['#4a3a2a', '#9a8260', '#d8c49a']).map(R.rgb);
    }
    const ringDens = (rr) => {
      const u = (rr - ring.inner) / (ring.outer - ring.inner);
      if (u < 0 || u > 1) return 0;
      if (u > 0.6 && u < 0.67) return 0;
      return 0.5 + 0.5 * Math.sin(u * 40 + Math.sin(u * 11) * 2.2) * (0.6 + 0.4 * Math.sin(u * 7));
    };
    const limb = tex.limb && !o.noLimb ? tex.limb : null;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = py * w + px, q = i * 4;
        const X = (px + 0.5 - S) / r, Y = (py + 0.5 - S) / r;
        let lim = 1;
        const dist = Math.hypot(X, Y);
        if (limb) { const an = Math.atan2(Y, X); lim = limb[Math.floor(((an / (Math.PI * 2)) + 1) * 64) % 64]; }
        if (DIST) { DIST[i] = dist; AI[i] = Math.min(127, Math.floor((Math.atan2(Y, X) / (Math.PI * 2) + 0.5) * 128)); }
        // ring pixels (static): drawn into base when behind, into front when in front of the body
        if (ring) {
          const ra = ring.ang || 0, se = Math.sin(ring.elev), ce = Math.cos(ring.elev);
          const p1 = X * Math.cos(ra) + Y * Math.sin(ra), p2 = (-X * Math.sin(ra) + Y * Math.cos(ra)) / se;
          const rr = Math.hypot(p1, p2);
          if (rr > ring.inner && rr < ring.outer) {
            const dn = ringDens(rr), bd = BAYER_T[(py & 3) * 4 + (px & 3)];
            if (dn > 0.12 && dn * 0.8 + 0.3 + bd * 0.5 > 0.55) {
              const Qx = p1 * a1[0] + p2 * a2[0], Qy = p1 * a1[1] + p2 * a2[1], Qz = p1 * a1[2] + p2 * a2[2];
              const bq = Qx * lx + Qy * ly + Qz * lz, dq = bq * bq - (Qx * Qx + Qy * Qy + Qz * Qz - 1);
              const shadow = dq > 0 && bq < 0;
              const tone = shadow ? 0 : dn > 0.7 ? 2 : 1;
              const cc = rcol[tone];
              const dst = (p2 * ce > 0) ? front : base;
              dst[q] = cc[0]; dst[q + 1] = cc[1]; dst[q + 2] = cc[2]; dst[q + 3] = 255;
            }
          }
        }
        if (dist > lim) {
          const dpx = (dist - lim) * r;
          if (dist < lim + 1.2 / r && !atmo) { base[q] = outline[0]; base[q + 1] = outline[1]; base[q + 2] = outline[2]; base[q + 3] = 255; }
          else if (atmo && dpx <= halo + 1) { // dithered atmospheric glow, strongest toward the sun
            const litd = -(X * lx + Y * ly) / (dist * Math.hypot(lx, ly, 1e-6) + 1e-6) * Math.hypot(lx, ly);
            const lw = Math.max(0, Math.min(1, litd * 0.8 + 0.4));
            const pt = (1 - dpx / (halo + 1)) * (0.35 + 0.65 * lw), bd = BAYER_T[(py & 3) * 4 + (px & 3)];
            if (pt + bd * 0.55 > 0.34) {
              const k = pt > 0.7 ? 1 : pt > 0.45 ? 0.62 : 0.34;
              base[q] = atmo[0] * k + 12; base[q + 1] = atmo[1] * k + 14; base[q + 2] = atmo[2] * k + 28; base[q + 3] = 255;
            } else if (dpx < 1.4) { base[q] = outline[0]; base[q + 1] = outline[1]; base[q + 2] = outline[2]; base[q + 3] = 255; }
          }
          continue;
        }
        const nx = X / lim, ny = Y / lim, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        mask[i] = 1; nzA[i] = nz;
        const yy = ny * ct - nz * st, zz = ny * st + nz * ct;
        const lat = Math.asin(Math.max(-1, Math.min(1, yy)));
        const lon0 = Math.atan2(nx, zz);
        const cl = Math.max(0.12, Math.hypot(nx, zz)), sl = yy;
        // tangent frame (east, north) in view space
        const ex = zz / cl, ey0 = 0, ez0 = -nx / cl;
        const nx_t = -sl * nx / cl, ny_t = cl, nz_t = -sl * zz / cl;
        const Ex = ex, Ey = ey0 * ct + ez0 * st, Ez = -ey0 * st + ez0 * ct;
        const Nx = nx_t, Ny = ny_t * ct + nz_t * st, Nz = -ny_t * st + nz_t * ct;
        A[i] = nx * lx + ny * ly + nz * lz; B[i] = Ex * lx + Ey * ly + Ez * lz; C[i] = Nx * lx + Ny * ly + Nz * lz;
        Hn[i] = nx * hx + ny * hy + nz * hz; Bh[i] = Ex * hx + Ey * hy + Ez * hz; Ch[i] = Nx * hx + Ny * hy + Nz * hz;
        const f = 1 - nz; rim[i] = f * f * f;
        U0[i] = (lon0 / (Math.PI * 2)) * tw;
        const v = (lat / Math.PI + 0.5) * (th - 1), j0 = Math.min(th - 2, Math.max(0, Math.floor(v)));
        RA[i] = j0 * tw; RB[i] = (j0 + 1) * tw; FV[i] = v - j0;
        if (ring) { // ring shadow on the body
          const nd = Nr[0] * lx + Nr[1] * ly + Nr[2] * lz;
          if (Math.abs(nd) > 0.02) {
            const tau = -(Nr[0] * nx + Nr[1] * ny + Nr[2] * nz) / nd;
            if (tau > 0) {
              const rr = Math.hypot(nx + tau * lx, ny + tau * ly, nz + tau * lz);
              if (rr > ring.inner && rr < ring.outer) { const dn = ringDens(rr); if (dn > 0.2) sh[i] = Math.min(1, dn * 1.2); }
            }
          }
        }
      }
    }
    return G;
  }
  function geomFor(key, r, tex, tilt, L, o) {
    let G = geoms[key];
    if (G && L[0] * G.L[0] + L[1] * G.L[1] + L[2] * G.L[2] > 0.9996) return G;
    G = geoms[key] = buildGeom(r, tex, tilt, L, o);
    if (geomOrder.indexOf(key) < 0) { geomOrder.push(key); if (geomOrder.length > 40) delete geoms[geomOrder.shift()]; }
    return G;
  }
  const flat = (arr) => { const o = new Float32Array(arr.length * 3); arr.forEach((c, i) => { o[i * 3] = c[0]; o[i * 3 + 1] = c[1]; o[i * 3 + 2] = c[2]; }); return o; };
  const palCache = {};
  function palFlat(list) { const k = list.join(); return palCache[k] || (palCache[k] = flat(list.map(R.rgb))); }

  // ---------- body shading (rows y0..y1 of the sprite) ----------
  const COOL = [130, 185, 255];
  function rowsRock(sp, y0, y1) {
    const G = sp.geom, P = sp.P, tex = P.tex, D = tex.d, K = tex.k, w = G.w, out = sp.buf.data;
    const tw = tex.tw, twm = tw - 1, cols = P.cols, nc = cols.length / 3, ore = P.ore;
    const rt = P.rot / (Math.PI * 2) * tw, smooth = P.smooth, bk = P.bump, spec = P.spec, metal = P.metal;
    const { A, B, C, Hn, Bh, Ch, rim, sh, mask, u0, rowA, rowB, fv, base, front } = G;
    const icy = tex.icy;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, q = i * 4;
        if (!mask[i]) {
          if (front && front[q + 3]) { out[q] = front[q]; out[q + 1] = front[q + 1]; out[q + 2] = front[q + 2]; out[q + 3] = 255; }
          else { out[q] = base[q]; out[q + 1] = base[q + 1]; out[q + 2] = base[q + 2]; out[q + 3] = base[q + 3]; }
          continue;
        }
        const bd = BAYER_T[(y & 3) * 4 + (x & 3)];
        const u = u0[i] + rt, iu = Math.floor(u), i0 = iu & twm, i1 = (i0 + 1) & twm;
        const fu = smooth ? u - iu : 0, fvv = smooth ? fv[i] : 0;
        const w00 = (1 - fu) * (1 - fvv), w10 = fu * (1 - fvv), w01 = (1 - fu) * fvv, w11 = fu * fvv;
        const p00 = (rowA[i] + i0) << 2, p10 = (rowA[i] + i1) << 2, p01 = (rowB[i] + i0) << 2, p11 = (rowB[i] + i1) << 2;
        const ge = D[p00] * w00 + D[p10] * w10 + D[p01] * w01 + D[p11] * w11;
        const gn = D[p00 + 1] * w00 + D[p10 + 1] * w10 + D[p01 + 1] * w01 + D[p11 + 1] * w11;
        const alb = D[p00 + 2] * w00 + D[p10 + 2] * w10 + D[p01 + 2] * w01 + D[p11 + 2] * w11;
        const ndl = A[i] - bk * (ge * B[i] + gn * C[i]);
        let hn = Hn[i] - bk * (ge * Bh[i] + gn * Ch[i]);
        const kk = K[rowA[i] + (fu > 0.5 ? i1 : i0)];
        const mat = kk & 7;
        // ramp position: crisp terminator, dithered falloff, albedo from craters
        const v = ndl * 1.0 + alb * 0.8 + bd * 0.3 - sh[i] * 0.75;
        let idx;
        if (v < 0) idx = 0; else if (v < 0.14) idx = 1; else if (v < 0.4) idx = 2; else if (v < 0.78) idx = 3; else idx = nc - 1;
        if (idx > nc - 1) idx = nc - 1;
        let r = cols[idx * 3], g = cols[idx * 3 + 1], b = cols[idx * 3 + 2];
        if (idx === 0) { // ambient bounce on the night side, strongest next to the terminator
          const bn = (ndl > -0.5 ? (ndl + 0.5) : 0) * 0.5 + alb * 0.12;
          if (bn + bd * 0.35 > 0.4) { r = cols[3] * 0.34 + r * 0.66; g = cols[4] * 0.34 + g * 0.66; b = cols[5] * 0.4 + b * 0.6; }
        }
        if (mat === 1 && ndl > 0.04 && ore) { // ore vein: tinted, with a facet glint
          const facet = (kk >> 3) / 31;
          const oi = (kk >> 3) & 1 ? 3 : 0;
          r = ore[oi] * 0.8 + r * 0.2; g = ore[oi + 1] * 0.8 + g * 0.2; b = ore[oi + 2] * 0.8 + b * 0.2;
          const gl = hn + (facet - 0.5) * 0.4;
          if (gl > 0.9) { r = 255; g = 252; b = 235; } else if (gl > 0.78 && ndl > 0.2) { r = r * 0.55 + 140; g = g * 0.55 + 135; b = b * 0.55 + 120; }
        } else if (mat === 2 && ndl > -0.02) { // ice patch
          if (v > 0.5) { r = 238; g = 247; b = 255; } else if (v > 0.1) { r = 150; g = 184; b = 216; }
        }
        // specular: metallic and icy bodies
        const sa = icy ? Math.max(spec, 0.5) : spec;
        if (sa > 0 && hn > 0.5 && ndl > 0) {
          const h2 = hn * hn, h4 = h2 * h2, h8 = h4 * h4, sp16 = h8 * h8;
          const spv = (metal ? sp16 : h8 * h4) * sa;
          if (spv + bd * 0.28 > 0.62) { r = r * 0.25 + 255 * 0.75; g = g * 0.25 + 252 * 0.75; b = b * 0.25 + 245 * 0.75; }
          else if (spv + bd * 0.28 > 0.4) { r = r * 0.6 + 100; g = g * 0.6 + 100; b = b * 0.6 + 96; }
        }
        // cool rim light, stronger on the sun side
        const rm = rim[i] * (0.45 + 0.55 * Math.max(0, Math.min(1, A[i] + 0.25)));
        if (rm + bd * 0.4 > 0.5) { const m = rm > 0.75 ? 0.62 : 0.4; r += (COOL[0] - r) * m; g += (COOL[1] - g) * m; b += (COOL[2] - b) * m; }
        out[q] = r; out[q + 1] = g; out[q + 2] = b; out[q + 3] = 255;
        if (front && front[q + 3]) { out[q] = front[q]; out[q + 1] = front[q + 1]; out[q + 2] = front[q + 2]; }
      }
    }
  }
  const SEA = [[6, 20, 52], [14, 48, 108], [26, 88, 158], [58, 138, 205]];
  const LAND = [[16, 38, 24], [36, 78, 38], [74, 122, 52], [118, 156, 78]];
  const DESERT = [[70, 48, 26], [124, 92, 52], [176, 138, 82], [218, 184, 116]];
  const ICE = [[112, 132, 168], [174, 196, 224], [224, 237, 250], [252, 254, 255]];
  const ROCKM = [[40, 36, 38], [86, 78, 74], [132, 120, 108], [180, 170, 160]];
  function rowsEarth(sp, y0, y1) {
    const G = sp.geom, P = sp.P, tex = P.tex, D = tex.d, K = tex.k, CL = tex.clouds, LT = tex.lights, w = G.w, out = sp.buf.data;
    const tw = tex.tw, th = tex.th, twm = tw - 1, smooth = P.smooth;
    const rt = P.rot / (Math.PI * 2) * tw, crt = (P.rot + P.cloudRot) / (Math.PI * 2) * tw;
    const { A, B, C, Hn, rim, mask, u0, rowA, rowB, fv, base } = G;
    const shU = tw * 0.032 / (Math.PI * 2) * 6, shV = (th - 1) * 0.034 / Math.PI; // cloud-shadow offsets
    const city = P.city, atm = P.atmoC;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, q = i * 4;
        if (!mask[i]) { out[q] = base[q]; out[q + 1] = base[q + 1]; out[q + 2] = base[q + 2]; out[q + 3] = base[q + 3]; continue; }
        const bd = BAYER_T[(y & 3) * 4 + (x & 3)];
        const f0 = smooth ? fv[i] : 0;
        const u = u0[i] + rt, iu = Math.floor(u), i0 = iu & twm, i1 = (i0 + 1) & twm, fu = smooth ? u - iu : 0;
        const w00 = (1 - fu) * (1 - f0), w10 = fu * (1 - f0), w01 = (1 - fu) * f0, w11 = fu * f0;
        const ra = rowA[i], rb = rowB[i];
        const p00 = (ra + i0) << 2, p10 = (ra + i1) << 2, p01 = (rb + i0) << 2, p11 = (rb + i1) << 2;
        const ge = D[p00] * w00 + D[p10] * w10 + D[p01] * w01 + D[p11] * w11;
        const gn = D[p00 + 1] * w00 + D[p10 + 1] * w10 + D[p01 + 1] * w01 + D[p11 + 1] * w11;
        const alb = D[p00 + 2] * w00 + D[p10 + 2] * w10 + D[p01 + 2] * w01 + D[p11 + 2] * w11;
        const mat = K[ra + (fu > 0.5 ? i1 : i0)];
        const land = mat !== 0;
        const ndl = A[i] - (land ? 0.9 : 0) * (ge * B[i] + gn * C[i]);
        // clouds (own rotation) and their soft shadow, displaced away from the sun
        const cu = u0[i] + crt, ciu = Math.floor(cu), c0 = ciu & twm, c1 = (c0 + 1) & twm, cf = smooth ? cu - ciu : 0;
        const cd = (CL[ra + c0] * (1 - cf) + CL[ra + c1] * cf) * (1 - f0) + (CL[rb + c0] * (1 - cf) + CL[rb + c1] * cf) * f0;
        const su = u0[i] + crt - B[i] * shU, siu = Math.floor(su), s0 = siu & twm;
        const sv = Math.max(0, Math.min(th - 2, Math.floor(ra / tw + f0 - C[i] * shV)));
        const sd = CL[sv * tw + s0];
        const cloud = cd - 0.555 + bd * 0.07;
        const nzr = rim[i];
        const v = ndl * 1.1 + bd * 0.26;
        let r, g, b;
        const set = mat === 2 ? ICE : mat === 3 ? DESERT : mat === 1 ? LAND : SEA;
        if (v < 0) { // night side
          const sc = set === SEA ? SEA[0] : set;
          r = (mat === 0 ? 4 : 8); g = (mat === 0 ? 8 : 12); b = (mat === 0 ? 20 : 22);
          const bn = (ndl > -0.45 ? ndl + 0.45 : 0) * 0.6;
          if (bn + bd * 0.3 > 0.28) { r += 6; g += 10; b += 26; }
          if (mat === 1 || mat === 3) {
            const lv = (LT[ra + (fu > 0.5 ? i1 : i0)]);
            if (lv > city && cloud < -0.02 && ndl + bd * 0.1 < -0.05) { r = lv > city + 0.12 ? 255 : 252; g = lv > city + 0.12 ? 232 : 196; b = lv > city + 0.12 ? 160 : 98; }
            else if (lv > city - 0.06 && ((x + y) & 1) && ndl < -0.1 && cloud < -0.05) { r = 96; g = 62; b = 26; }
          }
          if (cloud > 0) { r += 8; g += 12; b += 22; }
        } else {
          const idx = v < 0.2 ? 0 : v < 0.46 ? 1 : v < 0.76 ? 2 : 3;
          const aa = (mat === 1 ? alb * 0.9 : 0);
          let ii = idx + (aa + bd * 0.1 > 0.3 ? 1 : 0) - (aa + bd * 0.1 < -0.28 ? 1 : 0);
          ii = ii < 0 ? 0 : ii > 3 ? 3 : ii;
          let c = set[ii];
          if (mat === 1 && ge * ge + gn * gn > 0.5 && alb > 0.2) c = ROCKM[ii];
          r = c[0]; g = c[1]; b = c[2];
          // ocean glint
          if (mat === 0 && cloud < 0) {
            const hn = Hn[i] + alb * 0.05;
            if (hn > 0.9) { const h2 = hn * hn, h4 = h2 * h2, h8 = h4 * h4, h16 = h8 * h8, s = h16 * h16 * h8; if (s + bd * 0.3 > 0.52) { r = 255; g = 250; b = 232; } else if (h16 * h8 + bd * 0.3 > 0.55) { r = r * 0.35 + 150; g = g * 0.35 + 168; b = b * 0.35 + 180; } }
          }
          // bluish terminator
          if (v < 0.3) { const m = (0.3 - v) * (bd > -0.1 ? 0.9 : 0.4); r += (34 - r) * m; g += (74 - g) * m; b += (170 - b) * m; }
          // cloud shadow
          if (sd > 0.575 && cloud < 0) { r *= 0.7; g *= 0.74; b *= 0.82; }
          // clouds
          if (cloud > 0) {
            const th2 = cd > 0.66 ? 1 : 0;
            if (v < 0.22) { r = 120 + th2 * 20; g = 134 + th2 * 18; b = 168 + th2 * 14; }
            else if (v < 0.5) { r = 188 + th2 * 18; g = 200 + th2 * 16; b = 224 + th2 * 10; }
            else { r = 236 + th2 * 14; g = 240 + th2 * 12; b = 250 + th2 * 4; }
          }
        }
        // atmosphere: dithered scattering band just inside the limb
        const sun = 0.3 + 0.7 * Math.max(0, Math.min(1, ndl + 0.35));
        const at = nzr * 1.5 * sun;
        if (at + bd * 0.32 > 0.5 && atm) { const m = at > 0.95 ? 0.85 : at > 0.7 ? 0.6 : 0.38; r += (atm[0] - r) * m; g += (atm[1] - g) * m; b += (atm[2] - b) * m; }
        out[q] = r; out[q + 1] = g; out[q + 2] = b; out[q + 3] = 255;
      }
    }
  }
  function rowsBand(sp, y0, y1) {
    const G = sp.geom, P = sp.P, tex = P.tex, D = tex.d, w = G.w, out = sp.buf.data;
    const tw = tex.tw, twm = tw - 1, cols = P.cols, nc = cols.length / 3, smooth = P.smooth;
    const rt = P.rot / (Math.PI * 2) * tw;
    const { A, rim, sh, mask, u0, rowA, rowB, fv, base, front } = G;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, q = i * 4;
        if (!mask[i]) {
          if (front && front[q + 3]) { out[q] = front[q]; out[q + 1] = front[q + 1]; out[q + 2] = front[q + 2]; out[q + 3] = 255; }
          else { out[q] = base[q]; out[q + 1] = base[q + 1]; out[q + 2] = base[q + 2]; out[q + 3] = base[q + 3]; }
          continue;
        }
        const bd = BAYER_T[(y & 3) * 4 + (x & 3)];
        const u = u0[i] + rt, iu = Math.floor(u), i0 = iu & twm, i1 = (i0 + 1) & twm, fu = smooth ? u - iu : 0, f0 = smooth ? fv[i] : 0;
        const w00 = (1 - fu) * (1 - f0), w10 = fu * (1 - f0), w01 = (1 - fu) * f0, w11 = fu * f0;
        const p00 = (rowA[i] + i0) << 2, p10 = (rowA[i] + i1) << 2, p01 = (rowB[i] + i0) << 2, p11 = (rowB[i] + i1) << 2;
        const hv = D[p00 + 3] * w00 + D[p10 + 3] * w10 + D[p01 + 3] * w01 + D[p11 + 3] * w11;
        const al = D[p00 + 2] * w00 + D[p10 + 2] * w10 + D[p01 + 2] * w01 + D[p11 + 2] * w11;
        const tone = Math.min(nc - 2, Math.floor((hv + bd * 0.12) * (nc - 1.01)) + 1);
        const v = A[i] * 1.15 + al * 0.5 + bd * 0.26 - sh[i] * 0.8;
        let r = cols[tone * 3], g = cols[tone * 3 + 1], b = cols[tone * 3 + 2];
        if (v < 0.02) { r = cols[0] + 4; g = cols[1] + 4; b = cols[2] + 8; }
        else if (v < 0.2) { r = r * 0.45 + cols[0] * 0.55; g = g * 0.45 + cols[1] * 0.55; b = b * 0.45 + cols[2] * 0.55; }
        else if (v < 0.45) { r = r * 0.75 + cols[0] * 0.25; g = g * 0.75 + cols[1] * 0.25; b = b * 0.75 + cols[2] * 0.25; }
        else if (v > 0.95) { r += (255 - r) * 0.22; g += (255 - g) * 0.22; b += (255 - b) * 0.22; }
        const rm = rim[i] * (0.5 + 0.5 * Math.max(0, Math.min(1, A[i] + 0.25)));
        if (rm + bd * 0.4 > 0.6) { r += (COOL[0] - r) * 0.35; g += (COOL[1] - g) * 0.35; b += (COOL[2] - b) * 0.35; }
        out[q] = r; out[q + 1] = g; out[q + 2] = b; out[q + 3] = 255;
        if (front && front[q + 3]) { out[q] = front[q]; out[q + 1] = front[q + 1]; out[q + 2] = front[q + 2]; }
      }
    }
  }

  // draw a lit, dithered, rotating body. pal = array of 4-5 colors dark→light
  // opts: { tex, rot, light:[x,y,z], kind:'rock'|'earth'|'band', ore:[colors], atmo:color, tilt, spec:0..1, metal, ring:{inner,outer,elev,ang,cols}, cloudRot, cityLights }
  R.drawBody = function (g, cx, cy, r, pal, opts) {
    const tex = opts.tex, T = R.tier();
    const kind = opts.kind || 'rock', tilt = opts.tilt || 0.25;
    const L0 = opts.light || [-0.6, -0.55, 0.58], ll = Math.hypot(L0[0], L0[1], L0[2]) || 1;
    const L = [L0[0] / ll, L0[1] / ll, L0[2] / ll];
    const rr = Math.round(r * 4) / 4;
    const key = 'b|' + tex.uid + '|' + rr + '|' + kind + '|' + (opts.atmo || '') + '|' + (opts.ring ? 'R' : '') + '|' + T.name + (pal ? '|' + pal.join('') : '');
    const sp = spriteGet(key);
    const geo = geomFor('g' + key, rr, tex, tilt, L, { kind, atmo: opts.atmo, ring: opts.ring });
    spriteSize(sp, geo.w, geo.h);
    const rot = opts.rot || 0, crot = opts.cloudRot || 0;
    const stepRad = T.step / Math.max(4, rr);
    const stale = !sp.done || sp.geom !== geo || Math.abs(rot - sp.rot) > stepRad || Math.abs(crot - sp.crot) > stepRad;
    if (stale && !sp.job) {
      sp.geom = geo; sp.rot = rot; sp.crot = crot;
      const P = sp.P = { tex, rot, cloudRot: crot, smooth: T.smooth, bump: kind === 'earth' ? 1 : (opts.bump || 1.15), spec: opts.spec || 0, metal: !!opts.metal, city: opts.cityLights || 0.8 };
      P.cols = pal ? palFlat(pal) : null; P.n = pal ? pal.length : 0;
      P.ore = opts.ore ? palFlat(opts.ore) : null;
      P.atmoC = opts.atmo ? R.rgb(opts.atmo) : null;
      sp.buf.data.set(geo.base);
      sp.job = { y: 0, h: geo.h, fn: kind === 'earth' ? rowsEarth : kind === 'band' ? rowsBand : rowsRock };
    }
    if (sp.job) spriteAdvance(sp, !sp.done);
    if (sp.done) g.drawImage(sp.cv, Math.round(cx) - geo.S, Math.round(cy) - geo.S);
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

  // ---------- cached backdrop (dithered gradient) ----------
  const bgCache = {};
  R.bgFill = function (g, W, H, c0, c1) {
    const key = W + 'x' + H + c0 + c1;
    let cv = bgCache[key];
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const b = cv.getContext('2d');
      b.fillStyle = c0; b.fillRect(0, 0, W, H);
      b.fillStyle = c1;
      for (let y = Math.floor(H * 0.5); y < H; y++) {
        const p = (y - H * 0.5) / (H * 0.5);
        for (let x = y & 1; x < W; x += 2) if (((x * 13 + y * 7) % 10) / 10 < p * 0.8) b.fillRect(x, y, 1, 1);
      }
      if (Object.keys(bgCache).length > 12) for (const k in bgCache) delete bgCache[k];
      bgCache[key] = cv;
    }
    g.drawImage(cv, 0, 0);
  };

  // ---------- stars ----------
  const flareCache = {};
  // four-point lens-flare spikes plus short diagonals, pixel crisp, drawn once per (length, color)
  function flareFor(len, col, from) {
    from = from || 2;
    const key = len + col + from;
    if (flareCache[key]) return flareCache[key];
    const S = len * 2 + 1, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const c = cv.getContext('2d'), img = c.createImageData(S, S), d = img.data;
    const base = R.rgb(col), hot = R.mix(base, [255, 255, 255], 0.8);
    const put = (x, y, k, w) => {
      x += len; y += len; if (x < 0 || y < 0 || x >= S || y >= S) return;
      const cc = k < 0.3 ? hot : R.mix(base, [255, 255, 255], 0.3), o = (y * S + x) * 4;
      d[o] = cc[0]; d[o + 1] = cc[1]; d[o + 2] = cc[2]; d[o + 3] = 255;
    };
    for (let k = from; k <= len; k++) {
      const f = (k - from) / (len - from), inten = Math.pow(1 - f, 0.9);
      for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const bd = BAYER_T[(k & 3) * 4 + ((k >> 2) & 3)];
        if (inten + bd * 0.5 > 0.22) put(sx * k, sy * k, f, 1);
        if (f < 0.4 && (k & 1) === 0) { put(sx * k + sy, sy * k + sx, f, 1); put(sx * k - sy, sy * k - sx, f, 1); }
      }
      if (f < 0.4) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (inten + BAYER_T[((k + 1) & 3) * 4 + (k & 3)] * 0.5 > 0.4) put(sx * k * 0.7 | 0, sy * k * 0.7 | 0, f, 1);
    }
    c.putImageData(img, 0, 0);
    return (flareCache[key] = cv);
  }
  function rowsStar(sp, y0, y1) {
    const G = sp.geom, P = sp.P, tex = P.tex, D = tex.d, w = G.w, out = sp.buf.data;
    const tw = tex.tw, twm = tw - 1, smooth = P.smooth, ang = P.ang;
    const { nz, mask, u0, rowA, rowB, fv, dist, ai } = G;
    const r1 = P.rot1 / (Math.PI * 2) * tw, r2 = P.rot2 / (Math.PI * 2) * tw;
    const c = P.cols, base = P.base, ext = P.extent, cor = P.corona, dk = P.dark;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, q = i * 4;
        const bd = BAYER_T[(y & 3) * 4 + (x & 3)];
        if (!mask[i]) {
          const dd = dist[i];
          out[q + 3] = 0;
          if (dd > ext) continue;
          const A = ang[ai[i]];
          const reach = 1 + cor * (0.4 + 1.1 * A);
          if (dd < reach) {
            const e = (dd - 1) / (reach - 1), I = Math.pow(1 - e, 1.5);
            if (I + bd * 0.75 > 0.3) {
              const k = I > 0.86 ? 3 : I > 0.5 ? 2 : 1;
              out[q] = c[k * 3]; out[q + 1] = c[k * 3 + 1]; out[q + 2] = c[k * 3 + 2]; out[q + 3] = 255;
            }
          } else {
            const hI = 0.5 * Math.exp(-(dd - reach) * 2.6 / Math.max(0.3, cor * 1.6)) * (0.6 + 0.4 * A);
            if (hI + bd * 0.34 > 0.3) {
              const k = hI > 0.4 ? 1 : 0;
              out[q] = c[k * 3] * 0.62; out[q + 1] = c[k * 3 + 1] * 0.62; out[q + 2] = c[k * 3 + 2] * 0.62 + 10; out[q + 3] = 255;
            }
          }
          continue;
        }
        const u = u0[i] + r1, iu = Math.floor(u), i0 = iu & twm, i1 = (i0 + 1) & twm, fu = smooth ? u - iu : 0, f0 = smooth ? fv[i] : 0;
        const w00 = (1 - fu) * (1 - f0), w10 = fu * (1 - f0), w01 = (1 - fu) * f0, w11 = fu * f0;
        const p00 = (rowA[i] + i0) << 2, p10 = (rowA[i] + i1) << 2, p01 = (rowB[i] + i0) << 2, p11 = (rowB[i] + i1) << 2;
        const g1 = D[p00 + 3] * w00 + D[p10 + 3] * w10 + D[p01 + 3] * w01 + D[p11 + 3] * w11;
        const sp1 = D[p00 + 2] * w00 + D[p10 + 2] * w10 + D[p01 + 2] * w01 + D[p11 + 2] * w11;
        // second, counter-rotating granulation layer
        const u2 = u0[i] * 1.0 + tw * 0.37 + r2, iu2 = Math.floor(u2), j0 = iu2 & twm, j1 = (j0 + 1) & twm, fu2 = smooth ? u2 - iu2 : 0;
        const jh = tex.th - 1, ja = (((rowA[i] / tw) | 0) + (jh / 3 | 0)) % jh, jb = (ja + 1) % jh;
        const g2 = (D[((ja * tw + j0) << 2) + 3] * (1 - fu2) + D[((ja * tw + j1) << 2) + 3] * fu2) * (1 - f0) + (D[((jb * tw + j0) << 2) + 3] * (1 - fu2) + D[((jb * tw + j1) << 2) + 3] * fu2) * f0;
        const mu = nz[i];
        const ld = 0.4 + 0.65 * Math.sqrt(mu);
        const gran = (g1 + g2) * 0.5;
        const v = ld * (0.8 + 0.9 * (gran - 0.5)) - sp1 * 0.42 * dk + bd * 0.12;
        const k = v < 0.36 ? 0 : v < 0.58 ? 1 : v < 0.8 ? 2 : v < 1.0 ? 3 : 4;
        let r = c[k * 3], g = c[k * 3 + 1], b = c[k * 3 + 2];
        if (mu < 0.16) { r = r * 0.5 + 255 * 0.5; g = g * 0.55 + 150 * 0.45; b = b * 0.6 + 90 * 0.4; if (dk === 0) { r = c[9]; g = c[10]; b = c[11]; } }
        out[q] = r; out[q + 1] = g; out[q + 2] = b; out[q + 3] = 255;
      }
    }
  }
  const SUNL = [0, 0, 1];
  // opts: { corona, spikes, pulsar, hot }
  R.drawStar = function (g, cx, cy, r, color, t, opts) {
    opts = opts || {};
    const T = R.tier(), mot = R.motion();
    const tt = t * mot;
    const cor = opts.corona || 0.35;
    const extent = 1 + cor * 1.6 + (T.halo > 1 ? 0.7 : 0.25);
    const rr = Math.round(r * 4) / 4;
    const tex = R.starTexture(Math.floor(rr * 13) + 3, { tier: r < 12 ? 'low' : null });
    const key = 's|' + rr + '|' + color + '|' + cor + '|' + T.name;
    const sp = spriteGet(key);
    const geo = geomFor('g' + key, rr, tex, 0.1, SUNL, { kind: 'star', extent, noLimb: true });
    spriteSize(sp, geo.w, geo.h);
    if ((!sp.done || tt - sp.t > 0.09) && !sp.job) {
      sp.geom = geo; sp.t = tt;
      const base = R.rgb(color), dark = [40, 8, 0];
      const cols = [R.mix(base, dark, 0.55), R.mix(base, dark, 0.2), base, R.mix(base, [255, 255, 245], 0.45), R.mix(base, [255, 255, 245], 0.85), R.mix(base, [255, 255, 255], 0.5)];
      const angTab = new Float32Array(128);
      for (let i = 0; i < 128; i++) { const a = (i / 128) * Math.PI * 2 - Math.PI; angTab[i] = R.noise3(Math.cos(a) * 3 + 20, Math.sin(a) * 3, tt * 0.8, 21) * 0.6 + R.noise3(Math.cos(a) * 7, Math.sin(a) * 7 + 5, tt * 1.3, 22) * 0.4; }
      sp.P = { tex, rot1: tt * 0.05, rot2: -tt * 0.08, smooth: T.smooth, cols: flat(cols), base, ang: angTab, extent, corona: cor, dark: r < 4 ? 0 : 1 };
      sp.job = { y: 0, h: geo.h, fn: rowsStar, stamp: tt };
    }
    if (sp.job) spriteAdvance(sp, !sp.done);
    const X = Math.round(cx), Y = Math.round(cy);
    if (sp.done) g.drawImage(sp.cv, X - geo.S, Y - geo.S);
    if (opts.spikes && T.flare && r >= 3) {
      const len = Math.min(300, Math.round(r * 2.4 + 10));
      g.drawImage(flareFor(len, color, Math.round(r * 0.97)), X - len, Y - len);
    }
    if (opts.pulsar) R.drawBeam(g, cx, cy, r, color, t, opts.beamLen);
  };
  // rotating pulsar beams (a dithered wedge each way) with fading trails behind the sweep, composed in a scratch buffer
  let beamS = null;
  R.drawBeam = function (g, cx, cy, r, color, t, len) {
    const T = R.tier(), mot = R.motion();
    const a = t * 2.4 * (mot < 1 ? 0.25 : 1);
    len = Math.round(len || r * 3.6);
    const padw = Math.ceil(len * 0.03 + 4), bw = len * 2 + 8, bh = Math.ceil(len * 0.5) * 2 + padw * 2 + 8;
    if (!beamS || beamS.w !== bw || beamS.h !== bh) {
      const cv = document.createElement('canvas'); cv.width = bw; cv.height = bh;
      const c = cv.getContext('2d'); beamS = { w: bw, h: bh, cv, c, img: c.createImageData(bw, bh) };
    }
    const d = beamS.img.data;
    // only the rows and columns the sweep can touch are cleared, filled and copied
    let mx = 0, my = 0;
    for (let k = 0; k <= T.trail; k++) { mx = Math.max(mx, Math.abs(Math.cos(a - k * 0.16))); my = Math.max(my, Math.abs(Math.sin(a - k * 0.16))); }
    const ex = Math.ceil(mx * (len + r) + padw + 2), ey = Math.ceil(my * 0.5 * (len + r) + padw + 2);
    const bx0 = Math.max(0, (bw >> 1) - ex), bx1 = Math.min(bw, (bw >> 1) + ex), by0 = Math.max(0, (bh >> 1) - ey), by1 = Math.min(bh, (bh >> 1) + ey);
    d.fill(0, by0 * bw * 4, by1 * bw * 4);
    const base = R.rgb(color), mid = R.mix(base, [255, 255, 255], 0.6), edge = R.mix(base, [255, 255, 255], 0.25);
    const ox = bw >> 1, oy = bh >> 1, X0 = Math.round(cx), Y0 = Math.round(cy);
    const sweep = (ang, dens, wmul) => {
      const dx = Math.cos(ang), dy = Math.sin(ang) * 0.5, nl = Math.hypot(dx, dy), px = -dy / nl, py = dx / nl;
      const steps = Math.ceil(len / 0.8);
      for (let s = 0; s < steps; s++) {
        const k = r * 0.55 + s * 0.8, wv = (0.7 + k * 0.03) * wmul, fall = 1 - (k - r * 0.55) / len;
        for (const sgn of [1, -1]) {
          const X = dx * k * sgn, Y = dy * k * sgn;
          for (let j = -Math.ceil(wv); j <= Math.ceil(wv); j++) {
            const I = (1 - Math.abs(j) / (wv + 0.01)) * (0.55 + 0.6 * fall) * dens;
            const ix = Math.round(X + px * j), iy = Math.round(Y + py * j);
            if (I + BAYER_T[((iy + Y0) & 3) * 4 + ((ix + X0) & 3)] * 0.5 < 0.28) continue;
            const bx = ix + ox, by = iy + oy;
            if (bx < 0 || by < 0 || bx >= bw || by >= bh) continue;
            const o = (by * bw + bx) * 4, c = I > 0.78 ? WHITE3 : I > 0.5 ? mid : edge;
            if (d[o + 3] && dens < 0.99) continue; // trails never overwrite the main beam
            d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
          }
        }
      }
    };
    for (let k = T.trail; k >= 1; k--) sweep(a - k * 0.16, 0.7 - k * 0.12, 0.6);
    sweep(a, 1, 1);
    beamS.c.putImageData(beamS.img, 0, 0, bx0, by0, bx1 - bx0, by1 - by0);
    g.drawImage(beamS.cv, bx0, by0, bx1 - bx0, by1 - by0, X0 - ox + bx0, Y0 - oy + by0, bx1 - bx0, by1 - by0);
  };
  const WHITE3 = [255, 255, 255];

  // ---------- galaxies (precomputed point clouds + analytic spiral glow, dithered) ----------
  const galCache = {};
  R.galaxyPoints = function (seed, kind, n) {
    const key = seed + kind + (n || 600);
    if (galCache[key]) return galCache[key];
    const rand = AT.SPR.rng(seed);
    const N = n || 600, arms = kind === 'galaxy' ? 2 + Math.floor(rand() * 2) : 0;
    const pr = new Float32Array(N), pa = new Float32Array(N), pb = new Float32Array(N), pz = new Float32Array(N);
    const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
    for (let i = 0; i < N; i++) {
      if (kind === 'galaxy') {
        if (i % 5 === 0) { pr[i] = Math.pow(rand(), 2.2) * 0.34; pa[i] = rand() * Math.PI * 2; pb[i] = rand(); pz[i] = 1; continue; } // bulge
        const arm = Math.floor(rand() * arms), d = Math.pow(rand(), 0.75);
        pr[i] = d; pa[i] = arm * (Math.PI * 2 / arms) + d * 4.2 + gauss() * (0.42 - d * 0.1); pb[i] = rand(); pz[i] = 0;
      } else {
        const d = Math.pow(rand(), 1.8); pr[i] = d; pa[i] = rand() * Math.PI * 2; pb[i] = rand(); pz[i] = d < 0.6 ? 1 : 0.6;
      }
    }
    return (galCache[key] = { pr, pa, pb, pz, arms, N });
  };
  function rowsGalaxy(sp, y0, y1) {
    const P = sp.P, w = sp.buf.width, out = sp.buf.data, E = sp.E, pol = sp.pol, rad = sp.rad, hz = sp.hz, cc = P.cc, arms = P.arms, rot = P.rot;
    const dust = P.dust, ell = P.ell;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, q = i * 4, dd = rad[i];
        let e = E[i];
        if (dd < 1.1) {
          let arm = 1;
          if (arms) {
            const ph = (pol[i] - rot * (1 - dd / 1.2) - dd * 4.2) * arms, c = Math.cos(ph);
            { const cs = 0.5 + 0.5 * c; arm = 0.22 + 0.9 * cs * cs; }
            if (dust && dd > 0.1) { const cl = Math.cos(ph - 0.9); if (cl > 0.3) e -= Math.pow(cl, 5) * 0.9 * Math.min(1, (dd - 0.1) * 5) * Math.min(1, (1.0 - dd) * 5 + 0.3); }
          }
          e += hz[i * 2] * arm + hz[i * 2 + 1] + (ell ? 0.95 * hz[i * 2] * 1.1 : 0);
        }
        const v = e + BAYER_T[(y & 3) * 4 + (x & 3)] * 0.42;
        if (v < 0.3) { out[q + 3] = 0; continue; }
        const k = v < 0.52 ? 0 : v < 0.9 ? 1 : v < 1.3 ? 2 : v < 1.9 ? 3 : 4, c = cc[k];
        out[q] = c[0]; out[q + 1] = c[1]; out[q + 2] = c[2]; out[q + 3] = 255;
      }
    }
  }
  R.drawGalaxy = function (g, cx, cy, r, color, t, seed, kind, tiltY) {
    const T = R.tier(), mot = R.motion();
    const ty = tiltY || 0.45, tt = t * mot;
    const N = Math.max(50, Math.min(T.gal, Math.round(T.gal * Math.pow(Math.max(0.03, r / 130), 1.2))));
    const rr = Math.round(r * 2) / 2;
    const key = 'gx|' + seed + kind + rr + '|' + ty + '|' + T.name + color;
    const sp = spriteGet(key);
    const S = Math.ceil(rr * (kind === 'quasar' ? 1.5 : 1.04)) + 3, w = S * 2, h = S * 2;
    spriteSize(sp, w, h);
    if (!sp.pol || sp.pol.length !== w * h) { // static per-pixel polar coordinates in the disc plane, and the static glow terms
      sp.pol = new Float32Array(w * h); sp.rad = new Float32Array(w * h); sp.hz = new Float32Array(w * h * 2);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const X = (x + 0.5 - S) / rr, Y = (y + 0.5 - S) / (rr * ty), i = y * w + x, dd = Math.sqrt(X * X + Y * Y);
        sp.pol[i] = Math.atan2(Y, X); sp.rad[i] = dd;
        const fade = 1 - sstep(0.75, 1.08, dd), hk = kind === 'galaxy' ? 1.05 : kind === 'elliptical' ? 0.9 : 0.5;
        sp.hz[i * 2] = dd < 1.1 ? hk * Math.exp(-dd * 1.8) * fade : 0;
        sp.hz[i * 2 + 1] = dd < 1.1 ? 1.5 * Math.exp(-(dd * dd) / 0.012) : 0;
      }
      sp.E = new Float32Array(w * h); sp.done = false;
    }
    if (!sp.job && (!sp.done || tt - sp.t > 0.12)) {
      sp.t = tt;
      const pts = R.galaxyPoints(seed, kind, N), E = sp.E;
      E.fill(0);
      const base = R.rgb(color);
      const bright = Math.max(0.55, Math.min(1.5, 0.7 + r / 80));
      const put = (x, y, v) => { const ix = Math.round(x) + S, iy = Math.round(y) + S; if (ix >= 0 && iy >= 0 && ix < w && iy < h) E[iy * w + ix] += v; };
      const spin = (d) => tt * 0.08 * (1.2 - d);
      for (let i = 0; i < pts.N && i < N; i++) {
        const d = pts.pr[i], a = pts.pa[i] + spin(d), z = pts.pz[i];
        const x = Math.cos(a) * d * rr, y = Math.sin(a) * d * rr * (z === 1 ? Math.min(0.9, ty + 0.25) : ty);
        const b = pts.pb[i], v = (0.45 + b * 0.6) * (1.15 - d * 0.5) * bright;
        put(x, y, v);
        if (b > 0.93) { put(x + 1, y, v * 0.5); put(x, y + 1, v * 0.5); put(x - 1, y, v * 0.35); put(x, y - 1, v * 0.35); }
      }
      if (kind === 'quasar') {
        for (let k = 2; k < rr * 1.4; k++) { const f = 1 - k / (rr * 1.4), ph = (k + Math.floor(tt * 8)) % 3; if (ph) { put(0, -k, 0.8 * f + 0.4); put(0, k, 0.8 * f + 0.4); if (ph === 1 && f > 0.4) { put(1, -k, 0.4); put(1, k, 0.4); } } }
      }
      sp.P = { cc: [R.mix(base, [8, 8, 20], 0.5), base, R.mix(base, [255, 255, 255], 0.5), [255, 240, 205], [255, 255, 255]], arms: pts.arms, rot: tt * 0.096, dust: T.dust && pts.arms > 0, ell: kind === 'elliptical' };
      sp.job = { y: 0, h, fn: rowsGalaxy, stamp: tt };
    }
    if (sp.job) spriteAdvance(sp, !sp.done);
    if (sp.done) g.drawImage(sp.cv, Math.round(cx) - S, Math.round(cy) - S);
    if (kind === 'quasar' && T.flare && r > 10) { const fl = Math.round(r * 0.5) + 6; g.drawImage(flareFor(fl, '#bfe8ff', 2), Math.round(cx) - fl, Math.round(cy) - fl); }
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

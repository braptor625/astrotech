// AstroTech — pooled pixel particle engine (AT.FX).
// Structure-of-arrays pool (typed arrays, no per-particle objects), palette-snapped colour ramps over life,
// dithered sprite atlas (no blur, integer pixels), additive glow discs, sub-emitters, rings, streaks, ambient life.
// Particles live in canvas-internal pixels; views are 'map' | 'launch' | 'target'.
(function (AT) {
  'use strict';
  const FX = AT.FX = {};
  const MAXP = 6500, RES = 16, RES1 = RES - 1;
  const VIEW = { map: 0, launch: 1, target: 2 };
  const TAU = Math.PI * 2, HALF = Math.PI / 2;
  const rnd = Math.random;
  let W = 384, H = 216, curView = 0, time = 0;
  let level = 'high', mul = 2.2, cap = 2600;
  const LEVELS = { low: [1, 900], high: [2.2, 2600], ultra: [3.6, 6000] };

  // ---------------------------------------------------------------- palette & ramps
  const PAL = ['#ffffff', '#fff2b0', '#ffe9a0', '#ffd866', '#ffb347', '#ff8f3d', '#e8571f', '#c4471c', '#8a2a1a', '#5a2a2a', '#3a2226', '#ff6b6b',
    '#e8e8e8', '#c8c8d0', '#a8a8b4', '#8a8e9c', '#6a6e7e', '#4a4e5e', '#3a3e4e', '#2a2e3a', '#1c1f2a', '#e8ecff', '#8b97c9', '#5a6496',
    '#d8c8a8', '#b8a888', '#8a7a60', '#6a5c48', '#4a4034', '#e8f4ff', '#c8e0f4', '#a8c8e8', '#86c3ee', '#c8e8ff', '#3d79a8', '#4a6a8a', '#2a4a6a',
    '#6be08a', '#2f8a4a', '#c8ffd8', '#1d5a30', '#5fd6ff', '#4f6ad6', '#9ca6ff', '#4fe0c0', '#e8fff8', '#d9733f', '#a8841f', '#0a0f26'];
  const COLORS = []; const cmap = {};
  function colorIdx(hex) { let i = cmap[hex]; if (i === undefined) { i = COLORS.length; COLORS.push(hex); cmap[hex] = i; } return i; }
  PAL.forEach(colorIdx);
  const PALRGB = PAL.map((h) => AT.R.rgb(h));
  function snap(c) {
    let b = 0, bd = 1e9;
    for (let i = 0; i < PALRGB.length; i++) { const p = PALRGB[i], d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; b = i; } }
    return b;
  }
  const RAMPS = [];
  // stops: [[pos, '#hex'], ...] interpolated then snapped to the palette
  function ramp(stops) {
    const a = new Uint8Array(RES);
    for (let i = 0; i < RES; i++) {
      const u = i / RES1; let s = 0;
      while (s < stops.length - 2 && u > stops[s + 1][0]) s++;
      const A = stops[s], B = stops[s + 1], f = Math.max(0, Math.min(1, (u - A[0]) / Math.max(1e-6, B[0] - A[0])));
      a[i] = snap(AT.R.mix(AT.R.rgb(A[1]), AT.R.rgb(B[1]), f));
    }
    RAMPS.push(a); return RAMPS.length - 1;
  }
  // exact stepped ramp (no snapping) from a colour list — for body-palette dust and ore
  const exactCache = {};
  function rampExact(cols) {
    const key = cols.join(''); if (exactCache[key] !== undefined) return exactCache[key];
    const a = new Uint8Array(RES);
    for (let i = 0; i < RES; i++) a[i] = colorIdx(cols[Math.min(cols.length - 1, Math.floor(i / RES * cols.length))]);
    RAMPS.push(a); return (exactCache[key] = RAMPS.length - 1);
  }
  const RP = {
    fire: ramp([[0, '#ffffff'], [0.14, '#fff2b0'], [0.3, '#ffd866'], [0.5, '#ff8f3d'], [0.7, '#c4471c'], [0.88, '#5a2a2a'], [1, '#3a3e4e']]),
    hot: ramp([[0, '#ffffff'], [0.25, '#fff2b0'], [0.5, '#ffd866'], [0.75, '#ff8f3d'], [1, '#c4471c']]),
    spark: ramp([[0, '#ffffff'], [0.2, '#ffe9a0'], [0.45, '#ffb347'], [0.75, '#e8571f'], [1, '#5a2a2a']]),
    smokeD: ramp([[0, '#e8e8e8'], [0.3, '#c8c8d0'], [0.7, '#a8a8b4'], [1, '#8a8e9c']]),
    smokeN: ramp([[0, '#6a6e7e'], [0.4, '#4a4e5e'], [1, '#2a2e3a']]),
    smokeK: ramp([[0, '#6a6e7e'], [0.3, '#4a4e5e'], [0.7, '#3a3e4e'], [1, '#2a2e3a']]),
    soot: ramp([[0, '#8a2a1a'], [0.12, '#4a4e5e'], [1, '#1c1f2a']]),
    dust: ramp([[0, '#d8c8a8'], [0.5, '#b8a888'], [1, '#8a7a60']]),
    dustN: ramp([[0, '#6a5c48'], [1, '#4a4034']]),
    steam: ramp([[0, '#ffffff'], [0.5, '#e8f4ff'], [1, '#c8e0f4']]),
    ice: ramp([[0, '#ffffff'], [0.3, '#c8e8ff'], [0.7, '#86c3ee'], [1, '#3d79a8']]),
    ion: ramp([[0, '#e8fff8'], [0.3, '#5fd6ff'], [0.7, '#4f6ad6'], [1, '#2a4a6a']]),
    green: ramp([[0, '#c8ffd8'], [0.4, '#6be08a'], [1, '#2f8a4a']]),
    gold: ramp([[0, '#ffffff'], [0.3, '#ffe9a0'], [0.6, '#ffd866'], [1, '#a8841f']]),
    blue: ramp([[0, '#ffffff'], [0.3, '#9ca6ff'], [0.7, '#4f6ad6'], [1, '#2a4a6a']]),
    red: ramp([[0, '#ffffff'], [0.3, '#ff6b6b'], [0.7, '#c4471c'], [1, '#5a2a2a']]),
    teal: ramp([[0, '#e8fff8'], [0.4, '#4fe0c0'], [1, '#1d5a30']]),
    flash: ramp([[0, '#ffffff'], [0.4, '#fff2b0'], [0.75, '#ffb347'], [1, '#e8571f']]),
    debris: ramp([[0, '#ffd866'], [0.12, '#ff8f3d'], [0.3, '#8a8e9c'], [1, '#4a4e5e']]),
    glowDim: ramp([[0, '#6a2a12'], [1, '#4a2410']]),
    steamN: ramp([[0, '#a8c8e8'], [0.5, '#8a8e9c'], [1, '#6a6e7e']]),
    streak: ramp([[0, '#ffffff'], [0.3, '#c8d8ff'], [0.7, '#8b97c9'], [1, '#5a6496']]),
    white: ramp([[0, '#ffffff'], [1, '#c8c8d0']]),
  };

  // ---------------------------------------------------------------- dithered sprite atlas
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const DENS = [1.0, 0.8, 0.58, 0.36, 0.16];
  const discCache = [], glowCache = [];
  function mk(D) { const c = document.createElement('canvas'); c.width = c.height = D; return c; }
  function discSprite(ci, D, lvl) {
    const a = discCache[ci] || (discCache[ci] = []); const key = D * 5 + lvl;
    if (a[key]) return a[key];
    const c = mk(D), x = c.getContext('2d'); x.fillStyle = COLORS[ci];
    const h = (D - 1) / 2, d0 = DENS[lvl];
    for (let py = 0; py < D; py++) for (let px = 0; px < D; px++) {
      const dd = Math.hypot(px - h, py - h); if (dd > D / 2 - 0.25) continue;
      const v = dd / (D / 2);
      if (d0 * (1 - 0.5 * v * v) > BAY[(py & 3) * 4 + (px & 3)] || (D <= 3 && lvl < 2)) x.fillRect(px, py, 1, 1);
    }
    return (a[key] = c);
  }
  function glowSprite(ci, D) {
    const a = glowCache[ci] || (glowCache[ci] = []);
    if (a[D]) return a[D];
    const c = mk(D), x = c.getContext('2d'); x.fillStyle = COLORS[ci];
    const h = (D - 1) / 2;
    for (let py = 0; py < D; py++) for (let px = 0; px < D; px++) {
      const v = Math.hypot(px - h, py - h) / (D / 2); if (v > 1) continue;
      if (v < 0.3 || (1 - v) * 1.45 > BAY[(py & 3) * 4 + (px & 3)]) x.fillRect(px, py, 1, 1);
    }
    return (a[D] = c);
  }

  // ---------------------------------------------------------------- particle pool (SoA)
  const F = (n) => new Float32Array(n);
  const px_ = F(MAXP), py_ = F(MAXP), pvx = F(MAXP), pvy = F(MAXP), page = F(MAXP), plife = F(MAXP), ps0 = F(MAXP), ps1 = F(MAXP);
  const pgrav = F(MAXP), pdrag = F(MAXP), pwind = F(MAXP), prot = F(MAXP), pvrot = F(MAXP), psubAcc = F(MAXP), psubRate = F(MAXP), pfloor = F(MAXP);
  const pview = new Uint8Array(MAXP), player = new Uint8Array(MAXP), pramp = new Uint8Array(MAXP), pkind = new Uint8Array(MAXP), pfl = new Uint8Array(MAXP), pdn = new Uint8Array(MAXP);
  const psub = new Int16Array(MAXP), pdeath = new Int16Array(MAXP);
  const act = new Int32Array(MAXP), freeStk = new Int32Array(MAXP);
  let nAct = 0, nFree = MAXP;
  for (let i = 0; i < MAXP; i++) freeStk[i] = MAXP - 1 - i;
  const DEFS = [];
  let windV = 0, oFloor = 0;

  function lerp2(r) { return r[0] + (r[1] - r[0]) * rnd(); }
  const A2 = (v) => (Array.isArray(v) ? v : [v, v]);
  // kind: 0 disc, 1 glow, 2 tumbling debris, 3 spark (head+tail). layer: 0 back smoke, 1 fire/sparks, (glow drawn additive after)
  function def(o) {
    const d = Object.assign({ ramp: RP.fire, layer: 1, kind: 0, life: [0.5, 1], spd: [0, 0], spread: TAU, s0: [1, 1], s1: [1, 1], grav: 0, drag: 0, wind: 0, fade: 0,
      floor: 0, vrot: 0, sub: null, subRate: 0, death: null, deathN: 0, prio: 1, dir: null, inherit: 0 }, o);
    d.life = A2(d.life); d.spd = A2(d.spd); d.s0 = A2(d.s0); d.s1 = A2(d.s1); d.id = DEFS.length; DEFS.push(d); return d;
  }

  function emit(d, view, x, y, n, dir, spread, spdMul, sizeMul, ivx, ivy, x2, y2) {
    for (let i = 0; i < n; i++) {
      if (nAct >= cap || nFree === 0) return;
      if (d.prio === 0 && nAct > cap * 0.9) return;
      const k = freeStk[--nFree]; act[nAct++] = k;
      const base = dir !== undefined ? dir : d.dir !== null ? d.dir : rnd() * TAU;
      const a = base + (rnd() - 0.5) * (spread !== undefined ? spread : d.spread);
      const s = lerp2(d.spd) * (spdMul === undefined ? 1 : spdMul);
      const t = x2 === undefined ? 0 : rnd();
      px_[k] = x2 === undefined ? x : x + (x2 - x) * t; py_[k] = y2 === undefined ? y : y + (y2 - y) * t;
      pvx[k] = Math.cos(a) * s + (ivx || 0); pvy[k] = Math.sin(a) * s + (ivy || 0);
      page[k] = 0; plife[k] = lerp2(d.life);
      const sm = sizeMul === undefined ? 1 : sizeMul;
      ps0[k] = lerp2(d.s0) * sm; ps1[k] = lerp2(d.s1) * sm;
      pgrav[k] = d.grav; pdrag[k] = d.drag; pwind[k] = d.wind; prot[k] = rnd() * TAU; pvrot[k] = (rnd() - 0.5) * 2 * d.vrot;
      psubAcc[k] = rnd(); psubRate[k] = d.subRate; psub[k] = d.sub ? d.sub.id : -1; pdeath[k] = d.death ? d.death.id : -1; pdn[k] = d.deathN;
      pview[k] = view; player[k] = d.layer; pramp[k] = d.ramp; pkind[k] = d.kind;
      pfl[k] = (d.fade ? 1 : 0) | ((d.floor || oFloor) ? 2 : 0); pfloor[k] = d.floor || oFloor;
    }
  }
  function killAt(i) { const k = act[i]; freeStk[nFree++] = k; act[i] = act[--nAct]; }

  const cnt = (rate, dt) => Math.floor(rate * dt * mul + rnd());
  // soft volumes (smoke, steam, dust) are the costly sprites: scale them with sqrt of the gfx multiplier
  const cntS = (rate, dt) => Math.floor(rate * dt * Math.sqrt(mul) + rnd());
  FX.n = (x) => Math.floor(x * mul + rnd());
  FX.cnt = cnt;

  // ---------------------------------------------------------------- emitter definitions
  const D = FX.defs = {};
  D.emberTrail = def({ ramp: RP.spark, kind: 0, life: [0.15, 0.3], s0: 1, s1: 0.4, layer: 1, prio: 0 });
  D.flame = def({ ramp: RP.fire, life: [0.28, 0.55], spd: [70, 125], spread: 0.38, s0: [2.6, 4.2], s1: [0.8, 1.4], drag: 1.3, dir: HALF });
  D.flameJet = def({ ramp: RP.hot, life: [0.22, 0.45], spd: [70, 150], spread: 0.25, s0: [2.4, 3.6], s1: [0.8, 1.2], drag: 1.6 });
  D.ember = def({ ramp: RP.spark, kind: 3, life: [0.5, 1.2], spd: [40, 120], spread: 1.3, s0: 1, s1: 1, grav: 130, drag: 0.35, dir: HALF, sub: D.emberTrail, subRate: 24 });
  D.smokeD = def({ ramp: RP.smokeD, layer: 0, prio: 0, life: [1.8, 3.2], spd: [14, 55], spread: 0.6, s0: [3, 5], s1: [10, 16], drag: 1.5, grav: -7, wind: 0.35, fade: 1 });
  D.smokeN = def(Object.assign({}, D.smokeD, { ramp: RP.smokeN }));
  D.columnD = def({ ramp: RP.smokeD, layer: 0, prio: 0, life: [3, 5.5], spd: [2, 16], spread: TAU, s0: [4, 6], s1: [10, 16], drag: 0.9, grav: -2.5, wind: 0.8, fade: 1 });
  D.columnN = def(Object.assign({}, D.columnD, { ramp: RP.smokeN }));
  D.steam = def({ ramp: RP.steam, layer: 0, prio: 0, life: [1.4, 2.8], spd: [14, 48], spread: 1.1, s0: [3, 6], s1: [10, 16], drag: 1.2, grav: -11, wind: 0.5, fade: 1, dir: -HALF });
  D.steamN = def(Object.assign({}, D.steam, { ramp: RP.steamN }));
  D.groundGlow = def({ ramp: RP.glowDim, kind: 1, life: [0.06, 0.08], s0: 41, s1: 41, prio: 0 });
  D.dust = def({ ramp: RP.dust, layer: 0, prio: 0, life: [0.8, 1.5], spd: [60, 140], spread: 0.2, s0: [2, 3], s1: [5, 8], drag: 2.4, grav: -3, wind: 0.2, fade: 1 });
  D.dustN = def(Object.assign({}, D.dust, { ramp: RP.dustN }));
  D.soot = def({ ramp: RP.soot, layer: 0, prio: 0, life: [1.2, 2.2], spd: [4, 22], spread: TAU, s0: [2, 3], s1: [6, 10], drag: 1, grav: -4, wind: 0.5, fade: 1 });
  // explosion pieces
  D.sparkTrail = def({ ramp: RP.spark, life: [0.12, 0.3], s0: 1, s1: 0.4, prio: 0 });
  D.spark = def({ ramp: RP.spark, kind: 3, life: [0.5, 1.4], spd: [40, 170], drag: 0.9, sub: D.sparkTrail, subRate: 16 });
  D.fireball = def({ ramp: RP.fire, life: [0.45, 0.95], spd: [8, 55], s0: [3.5, 6], s1: [7, 11], drag: 2.2 });
  D.debris = def({ ramp: RP.debris, kind: 2, life: [1, 2.2], spd: [22, 90], s0: [2, 3.4], s1: [2, 2.4], drag: 0.5, vrot: 14, sub: D.emberTrail, subRate: 10 });
  D.puff = def({ ramp: RP.smokeK, layer: 0, prio: 0, life: [1.6, 2.8], spd: [4, 26], s0: [4, 7], s1: [10, 17], drag: 1.2, wind: 0.2, fade: 1 });
  // map
  D.shipTrail = def({ ramp: RP.fire, life: [0.6, 1.2], spd: [3, 12], spread: 0.6, s0: [1.6, 2.2], s1: [0.4, 0.8], drag: 1.5 });
  D.shipGlow = def({ ramp: RP.hot, kind: 1, layer: 1, life: [0.09, 0.12], s0: 7, s1: 3, prio: 0 });
  D.sparkle = def({ ramp: RP.gold, kind: 3, life: [0.5, 1.0], spd: [10, 36], drag: 1.6 });
  D.coin = def({ ramp: RP.gold, life: [0.9, 1.5], spd: [6, 18], s0: [1.6, 2.2], s1: [1, 1], grav: -14, drag: 0.8, dir: -HALF, spread: 1.2 });
  D.cometDust = def({ ramp: RP.ice, life: [1.6, 2.8], spd: [10, 26], spread: 0.35, s0: [1.2, 1.8], s1: [0.4, 0.8], drag: 0.35 });
  D.cometGlow = def({ ramp: RP.ice, kind: 1, life: [0.09, 0.12], s0: 9, s1: 5, prio: 0 });
  D.cometIon = def({ ramp: RP.ion, life: [0.6, 1.1], spd: [30, 52], spread: 0.1, s0: 1, s1: 1, drag: 0.2 });
  D.glint = def({ ramp: RP.gold, kind: 3, life: [0.3, 0.6], spd: [6, 22], drag: 1 });
  D.contrail = def({ ramp: RP.white, layer: 0, prio: 0, life: [4, 6], spd: [0, 2], s0: 1.2, s1: [2.4, 3.2], drag: 0.6, wind: 0.6, fade: 1 });
  // close-up
  D.drillSpark = def({ ramp: RP.spark, kind: 3, life: [0.3, 0.8], spd: [28, 90], spread: 1.5, drag: 0.4 });
  D.ore = def({ ramp: RP.debris, kind: 2, life: [3, 5], spd: [5, 14], spread: 1.6, s0: [2, 3], s1: 2, vrot: 4, drag: 0.1 });
  D.shell = def({ ramp: RP.gold, kind: 3, life: [0.7, 0.95], spd: [130, 170], spread: 0.3, dir: -HALF, grav: 100, drag: 0.1, sub: D.sparkTrail, subRate: 40 });
  // fireworks bursts (death sub-emitters)
  function burstDef(r) { return def({ ramp: r, kind: 3, life: [0.9, 1.7], spd: [30, 120], drag: 1.1, grav: 40, sub: D.sparkTrail, subRate: 8 }); }
  const BURSTS = [burstDef(RP.gold), burstDef(RP.blue), burstDef(RP.green), burstDef(RP.red), burstDef(RP.spark)];
  const SHELLS = BURSTS.map((b) => def(Object.assign({}, D.shell, { ramp: b.ramp, death: b, deathN: 38 })));

  // ---------------------------------------------------------------- rings, flashes, streaks
  const NR = 64; const rx = F(NR), ry_ = F(NR), rr0 = F(NR), rr1 = F(NR), rage = F(NR), rlife = F(NR), rsq = F(NR);
  const rview = new Uint8Array(NR), rramp = new Uint8Array(NR), rstyle = new Uint8Array(NR), rthick = new Uint8Array(NR), ron = new Uint8Array(NR);
  function ring(view, x, y, r0, r1, life, rampId, squash, thick, style) {
    for (let i = 0; i < NR; i++) if (!ron[i]) {
      ron[i] = 1; rx[i] = x; ry_[i] = y; rr0[i] = r0; rr1[i] = r1; rage[i] = 0; rlife[i] = life; rsq[i] = squash; rview[i] = view; rramp[i] = rampId; rthick[i] = thick; rstyle[i] = style || 0; return;
    }
  }
  const NF = 16; const fx_ = F(NF), fy_ = F(NF), fr0 = F(NF), fr1 = F(NF), fage = F(NF), flife = F(NF); const fview = new Uint8Array(NF), fon = new Uint8Array(NF);
  function flash(view, x, y, r0, r1, life) {
    for (let i = 0; i < NF; i++) if (!fon[i]) { fon[i] = 1; fx_[i] = x; fy_[i] = y; fr0[i] = r0; fr1[i] = r1; fage[i] = 0; flife[i] = life; fview[i] = view; return; }
  }
  const NS = 16; const sx = F(NS), sy = F(NS), svx = F(NS), svy = F(NS), sage = F(NS), slife = F(NS), slen = F(NS); const sview = new Uint8Array(NS), son = new Uint8Array(NS), sramp = new Uint8Array(NS);
  function streak(view, x, y, vx, vy, life, len, rampId) {
    for (let i = 0; i < NS; i++) if (!son[i]) { son[i] = 1; sx[i] = x; sy[i] = y; svx[i] = vx; svy[i] = vy; sage[i] = 0; slife[i] = life; slen[i] = len; sview[i] = view; sramp[i] = rampId; return; }
  }
  let shakeMag = 0, shakeX = 0, shakeY = 0, scrFlash = 0;
  const later = [];
  const rm = () => !!AT.reducedMotion;

  // ---------------------------------------------------------------- composites: explosions & events
  FX.explosion = function (viewName, x, y, scale, gravity) {
    const v = VIEW[viewName], s = scale || 1, rmo = rm();
    flash(v, x, y, 3 * s, 15 * s, rmo ? 0.2 : 0.38);
    ring(v, x, y, 2, 36 * s, 0.75, RP.flash, 1, 2, 0);
    ring(v, x, y, 1, 22 * s, 0.9, RP.fire, 1, 1, 0);
    emit(D.fireball, v, x, y, FX.n(9 * s), undefined, undefined, s, s);
    const save = D.debris.grav; D.debris.grav = gravity || 0;
    emit(D.debris, v, x, y, FX.n(11 * s), undefined, undefined, s);
    D.debris.grav = save;
    const sg = D.spark.grav; D.spark.grav = gravity ? gravity * 0.7 : 0;
    emit(D.spark, v, x, y, FX.n(18 * s), undefined, undefined, s);
    D.spark.grav = sg;
    emit(D.puff, v, x, y, FX.n(5 * s), undefined, undefined, s, s);
    if (!rmo) { shakeMag = Math.max(shakeMag, 2.2 * Math.min(1.4, s)); if (s > 0.8) scrFlash = Math.max(scrFlash, 0.22); }
  };
  FX.deliveryGlint = function (viewName, x, y) {
    const v = VIEW[viewName];
    ring(v, x, y, 1, 7, 0.55, RP.gold, 1, 1, 1);
    emit(D.coin, v, x, y - 2, FX.n(4), undefined, undefined, 1);
    emit(D.sparkle, v, x, y, FX.n(8));
  };
  FX.arrival = function (viewName, x, y) {
    const v = VIEW[viewName];
    ring(v, x, y, 1, 5, 0.45, RP.white, 1, 1, 1);
    emit(D.sparkle, v, x, y, FX.n(6));
    ring(v, x, y, 2, 11, 0.7, RP.ice, 1, 1, 0);
  };
  FX.ping = function (viewName, x, y) { ring(VIEW[viewName], x, y, 1, 11, 1.1, RP.green, 0.62, 1, 0); };
  FX.ringAt = function (viewName, X, Y, r1, life, rampName, squash) { ring(VIEW[viewName], X, Y, 1, r1, life, RP[rampName] || RP.white, squash || 1, 1, 0); };
  FX.glintAt = function (viewName, x, y, n) { emit(D.glint, VIEW[viewName], x, y, n || 1); };
  FX.comet = function (viewName, x, y, ang, dt) {
    const v = VIEW[viewName];
    emit(D.cometDust, v, x, y, cnt(14, dt), ang, 0.4); emit(D.cometGlow, v, x, y, 1);
    emit(D.cometIon, v, x, y, cnt(6, dt), ang + 0.15, 0.1);
  };
  FX.shipTrail = function (viewName, x, y, heading, dt, dim) {
    const v = VIEW[viewName];
    emit(D.shipTrail, v, x, y, cnt(dim ? 12 : 30, dt), heading + Math.PI, 0.5);
    if (!dim) emit(D.shipGlow, v, x, y, 1);
  };
  FX.mining = function (viewName, x, y) { if (rnd() < 0.3) emit(D.glint, VIEW[viewName], x, y, 1); };
  FX.repair = function (viewName, x, y) { emit(D.drillSpark, VIEW[viewName], x, y, FX.n(2), -HALF, 2.5, 0.6); };
  FX.drill = function (viewName, x, y, ang, bodyCols, dt) {
    const v = VIEW[viewName];
    emit(D.drillSpark, v, x, y, cnt(18, dt), ang, 1.5);
    const sv = D.ore.ramp; D.ore.ramp = rampExact(bodyCols);
    const dd = D.dustB || (D.dustB = def({ layer: 0, prio: 0, life: [1.1, 2], spd: [10, 30], spread: 0.9, s0: [1.4, 2], s1: [4, 7], drag: 1.1, fade: 1 }));
    dd.ramp = rampExact([bodyCols[0], bodyCols[1], bodyCols[2]]);
    emit(dd, v, x, y, cnt(9, dt), ang, 0.9);
    if (rnd() < dt * 1.6) emit(D.ore, v, x, y, 1, ang, 1.6);
    D.ore.ramp = sv;
  };
  // blinking beacon light, drawn straight onto the canvas (additive halo when lit)
  FX.light = function (g, x, y, hex, tt, phase, period, duty) {
    const on = (((tt + phase) % period) + period) % period < period * (duty || 0.3);
    x = Math.round(x); y = Math.round(y);
    if (!on) { g.fillStyle = '#3a2226'; g.fillRect(x, y, 1, 1); return; }
    g.fillStyle = hex; g.fillRect(x, y, 1, 1);
    const pc = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter';
    g.drawImage(glowSprite(colorIdx(hex === '#ff6b6b' ? '#8a2a1a' : hex === '#6be08a' ? '#1d5a30' : '#6a5c48'), 9), x - 4, y - 4);
    g.globalCompositeOperation = pc;
  };

  // ---------------------------------------------------------------- launch complex composites
  function dustRamp(d) { return d ? D.dustN : D.dust; }
  FX.ignition = function (x, ground, dark) {
    const v = 1, dd = dustRamp(dark);
    ring(v, x, ground, 3, 70, 1.2, dark ? RP.dustN : RP.dust, 0.16, 1, 0);
    ring(v, x, ground, 2, 40, 0.9, RP.steam, 0.16, 1, 0);
    const stm = dark ? D.steamN : D.steam;
    emit(stm, v, x - 6, ground, FX.n(7), Math.PI + 0.3, 0.9, 1.2);
    emit(stm, v, x + 6, ground, FX.n(7), -0.3, 0.9, 1.2);
    emit(dd, v, x, ground, FX.n(10), Math.PI, 0.2); emit(dd, v, x, ground, FX.n(10), 0, 0.2);
    flash(v, x, ground - 2, 3, 12, 0.3);
  };
  FX.liftoff = function (x, ground, dark) {
    const v = 1;
    ring(v, x, ground, 3, 110, 1.5, dark ? RP.dustN : RP.dust, 0.15, 2, 0);
    ring(v, x, ground, 2, 64, 1.1, RP.fire, 0.15, 1, 0);
    emit(dustRamp(dark), v, x, ground, FX.n(14), Math.PI, 0.3, 1.3); emit(dustRamp(dark), v, x, ground, FX.n(14), 0, 0.3, 1.3);
    emit(D.flameJet, v, x, ground - 1, FX.n(10), Math.PI, 0.2); emit(D.flameJet, v, x, ground - 1, FX.n(10), 0, 0.2);
    flash(v, x, ground - 3, 6, 22, 0.4);
    if (!rm()) shakeMag = Math.max(shakeMag, 1.6);
  };
  // per-frame exhaust for a rocket on the pad / ascending. fy = nozzle y, thr 0..1, alt = pixels above pad.
  FX.exhaust = function (x, fy, prevFy, ground, alt, thr, dt, dark, nozW) {
    const v = 1, gk = Math.max(0, 1 - alt / 70);
    oFloor = ground;
    emit(D.flame, v, x, fy + 1, cnt(95 * thr, dt), undefined, undefined, 0.8 + thr * 0.4, 0.55 + nozW * 0.15, 0, 0);
    emit(D.ember, v, x, fy + 2, cnt(15 * thr, dt), undefined, undefined, 1);
    oFloor = 0;
    const smk = dark ? D.smokeN : D.smokeD;
    if (gk > 0.02) {
      const stm = dark ? D.steamN : D.steam;
      emit(D.groundGlow, v, x, ground - 6, 1);
      emit(stm, v, x - 9, ground - 1, cntS(20 * gk, dt), Math.PI * 1.05, 1.0, 1);
      emit(stm, v, x + 9, ground - 1, cntS(20 * gk, dt), -0.05 * Math.PI, 1.0, 1);
      emit(dustRamp(dark), v, x, ground - 1, cntS(22 * gk, dt), Math.PI, 0.18);
      emit(dustRamp(dark), v, x, ground - 1, cntS(22 * gk, dt), 0, 0.18);
      emit(smk, v, x, ground - 1, cntS(16 * gk, dt), Math.PI, 0.5); emit(smk, v, x, ground - 1, cntS(16 * gk, dt), 0, 0.5);
      emit(D.flameJet, v, x, ground - 1, cnt(26 * gk * thr, dt), Math.PI, 0.2); emit(D.flameJet, v, x, ground - 1, cnt(26 * gk * thr, dt), 0, 0.2);
    }
    if (alt > 0) { // the lingering column: puffs left along the climb, drifting on the wind
      const col = dark ? D.columnN : D.columnD;
      emit(col, v, x, fy, cntS(34, dt), undefined, undefined, 1, 1, 0, 0, x, prevFy);
    }
  };
  // heat shimmer: shift pixel rows above the pad sideways
  let shimCv = null, shimG = null;
  FX.shimmer = function (g, x, ground, alt, thr, tt) {
    if (rm() || thr < 0.4 || alt > 60) return;
    const w = 34, x0 = Math.round(x - w / 2), top = Math.round(ground - 26 - alt * 0.4), h = Math.max(1, ground - 2 - top);
    // snapshot the strip into a small scratch canvas once (self-blits would copy the whole canvas per row)
    if (!shimCv) { shimCv = document.createElement('canvas'); shimCv.width = 40; shimCv.height = 64; shimG = shimCv.getContext('2d'); shimG.imageSmoothingEnabled = false; }
    shimG.clearRect(0, 0, 40, 64); shimG.drawImage(g.canvas, x0, top, w, Math.min(h, 64), 0, 0, w, Math.min(h, 64));
    for (let i = 0; i < h && i < 64; i++) {
      const off = Math.round(Math.sin((top + i) * 0.95 - tt * 24) * 1.2 * thr);
      if (off) g.drawImage(shimCv, 0, i, w, 1, x0 + off, top + i, w, 1);
    }
  };
  // direct-drawn layered flame (white-hot core, yellow mid, orange skin, shock diamonds). dir +1 = plume points down.
  const PQ = []; let pqn = 0;
  FX.plume = function (g, x, y, nozW, len, thr, tt) { // queued: drawn between smoke and sparks so steam never hides the flame
    const q = PQ[pqn] || (PQ[pqn] = {}); pqn++; q.x = x; q.y = y; q.n = nozW; q.l = len; q.th = thr; q.t = tt;
  };
  function plumeDraw(g, x, y, nozW, len, thr, tt) {
    len = Math.max(3, Math.round(len * (0.45 + 0.55 * thr)));
    const nw = Math.max(2, nozW | 0), hw0 = nw / 2;
    // halo
    const pc = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter';
    const hd = Math.round(len * 1.3 + 8) | 1; g.drawImage(glowSprite(colorIdx('#6a2a12'), hd), Math.round(x - hd / 2), Math.round(y + len * 0.2 - hd / 2));
    g.globalCompositeOperation = pc;
    const cx = Math.round(x);
    for (let k = 0; k < len; k++) {
      const u = k / len, yy = Math.round(y) + k;
      const hw = hw0 * (1 + 0.4 * Math.sin(Math.min(1, u * 3) * HALF)) * (1 - Math.pow(u, 1.5) * 0.93);
      const fl = Math.round((Math.sin(tt * 52 + k * 1.9) + Math.sin(tt * 33 + k * 0.7)) * 0.35 * u * 2);
      const wo = Math.max(1, Math.round(hw * 2)), wm = Math.max(1, Math.round(hw * 1.3)), wc = Math.max(1, Math.round(hw * 0.55));
      if (u > 0.78) { g.fillStyle = '#e8571f'; if ((k + Math.floor(tt * 30)) & 1) g.fillRect(cx + fl - (wo >> 1), yy, wo, 1); continue; }
      g.fillStyle = u > 0.5 ? '#e8571f' : '#ff8f3d'; g.fillRect(cx + fl - (wo >> 1), yy, wo, 1);
      if (u < 0.7) { g.fillStyle = u < 0.35 ? '#ffd866' : '#ffb347'; g.fillRect(cx + fl - (wm >> 1), yy, wm, 1); }
      if (u < 0.5) { g.fillStyle = u < 0.2 ? '#ffffff' : '#fff2b0'; g.fillRect(cx + fl - (wc >> 1), yy, wc, 1); }
    }
    // shock diamonds
    const sp = Math.max(3, Math.round(len * 0.24));
    for (let i = 0; i < 4; i++) {
      const k0 = 2 + i * sp; if (k0 + 2 >= len * 0.78) break;
      if (Math.sin(tt * 46 + i * 2.3) < -0.35) continue;
      const yy = Math.round(y) + k0, w2 = Math.max(1, Math.round(hw0 * (0.55 - i * 0.08)));
      g.fillStyle = '#fff2b0'; g.fillRect(cx - w2, yy + 1, w2 * 2 + 1, 1);
      g.fillStyle = '#ffffff'; g.fillRect(cx, yy, 1, 3); g.fillRect(cx - Math.max(0, w2 - 1), yy + 1, Math.max(1, w2 * 2 - 1), 1);
    }
  };
  FX.landing = function (x, fy, ground, f, dt, dark, dmg) {
    const v = 1, near = Math.max(0, (f - 0.45) / 0.55);
    oFloor = ground;
    emit(D.flame, v, x, fy + 1, cnt(80, dt), undefined, undefined, 1, 0.8);
    emit(D.ember, v, x, fy + 2, cnt(8, dt), undefined, undefined, 0.8);
    oFloor = 0;
    if (near > 0) {
      emit(dustRamp(dark), v, x, ground - 1, cntS(30 * near, dt), Math.PI, 0.2); emit(dustRamp(dark), v, x, ground - 1, cntS(30 * near, dt), 0, 0.2);
      emit(dark ? D.smokeN : D.smokeD, v, x, ground - 1, cntS(8 * near, dt), -HALF, 2.5, 0.6);
    }
    if (dmg) { emit(D.soot, v, x, fy - 8, cntS(24, dt), undefined, undefined, 1); emit(D.spark, v, x, fy - 12, cnt(4, dt), undefined, undefined, 0.5); }
  };
  FX.touchdown = function (x, ground, dark) {
    const v = 1;
    ring(v, x, ground, 3, 62, 1.1, dark ? RP.dustN : RP.dust, 0.16, 1, 0);
    emit(dustRamp(dark), v, x, ground, FX.n(14), Math.PI, 0.3, 1); emit(dustRamp(dark), v, x, ground, FX.n(14), 0, 0.3, 1);
    flash(v, x, ground - 2, 2, 9, 0.25);
  };

  // ---------------------------------------------------------------- celebration (prestige)
  FX.celebrate = function () {
    for (let i = 0; i < 9; i++) later.push({ t: i * 0.22 + rnd() * 0.1, fn: () => {
      const k = (rnd() * SHELLS.length) | 0, x = W * (0.15 + rnd() * 0.7), y = H * (0.75 + rnd() * 0.2);
      emit(SHELLS[k], curView, x, y, 1, -HALF + (x < W / 2 ? 0.12 : -0.12) * rnd(), 0.15);
    } });
    flash(curView, W / 2, H / 2, 6, 40, 0.5);
  };
  FX.later = (delay, fn) => later.push({ t: delay, fn });

  // ---------------------------------------------------------------- ambient: stars, shooting stars, meteors, birds, plane
  let ambDark = 0, ambHorizon = 100, nextStreak = 2, nextBird = 6, nextPlane = 25;
  const NB = 24; const bx = F(NB), by = F(NB), bvx = F(NB), bph = F(NB), bon = new Uint8Array(NB);
  const plane = { on: false, x: 0, y: 0, vx: 0 };
  FX.setAmbient = function (dark, horizon) { ambDark = dark; ambHorizon = horizon; };
  FX.skyStars = function (g, stars, horizon, dark, tt) {
    if (dark < 0.25) return;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i]; if (s.y >= horizon - 4) continue;
      if ((((i * 2654435761) >>> 0) / 4294967296) > dark - 0.15) continue;
      const x = s.x | 0, y = s.y | 0, ph = Math.sin(tt * (1.1 + s.z * 0.45) + s.tw * 5);
      if (ph < -0.55 && s.z < 3) continue;
      const warm = (i % 5) === 0, cool = (i % 5) === 1;
      g.fillStyle = s.z === 3 ? (ph > 0.3 ? '#ffffff' : warm ? '#ffe9c8' : cool ? '#c8d8ff' : '#e8ecff') : s.z === 2 ? (ph > 0.4 ? '#c8d0ee' : '#8b97c9') : (ph > 0.5 ? '#8b97c9' : '#4a5488');
      g.fillRect(x, y, 1, 1);
      if (s.z === 3 && ph > 0.86) { g.fillStyle = warm ? '#ffd866' : '#9ca6ff'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); }
    }
  };
  function ambientSpawn(dt) {
    if (curView === 1) {
      if (ambDark > 0.5) { nextStreak -= dt; if (nextStreak <= 0) { nextStreak = 6 + rnd() * 14; const ang = 0.35 + rnd() * 0.5, sp = 170 + rnd() * 80, left = rnd() < 0.5; streak(1, W * (0.15 + rnd() * 0.7), ambHorizon * (0.05 + rnd() * 0.3), (left ? 1 : -1) * Math.cos(ang) * sp, Math.sin(ang) * sp, 0.9 + rnd() * 0.5, 14 + rnd() * 8, RP.streak); } }
      if (ambDark < 0.2) {
        nextBird -= dt;
        if (nextBird <= 0) {
          nextBird = 12 + rnd() * 25; const dirn = rnd() < 0.5 ? 1 : -1, y0 = ambHorizon * (0.1 + rnd() * 0.35), n = 3 + ((rnd() * 3) | 0);
          for (let i = 0, c = 0; i < NB && c < n; i++) if (!bon[i]) { bon[i] = 1; c++; bx[i] = dirn > 0 ? -6 - c * 5 : W + 6 + c * 5; by[i] = y0 + (c % 2 ? c * 2 : -c * 2) + rnd() * 3; bvx[i] = dirn * (22 + rnd() * 6); bph[i] = rnd() * 6; }
        }
        nextPlane -= dt;
        if (nextPlane <= 0 && !plane.on) { nextPlane = 40 + rnd() * 50; plane.on = true; const dirn = rnd() < 0.5 ? 1 : -1; plane.vx = dirn * 38; plane.x = dirn > 0 ? -8 : W + 8; plane.y = ambHorizon * (0.06 + rnd() * 0.15); }
      }
    } else if (curView === 2 || curView === 0) {
      nextStreak -= dt;
      if (nextStreak <= 0) {
        nextStreak = (curView === 2 ? 2.2 : 7) + rnd() * 5;
        const ang = (rnd() - 0.5) * 1.2 + (rnd() < 0.5 ? 0.6 : Math.PI - 0.6), sp = 150 + rnd() * 90;
        streak(curView, rnd() * W, rnd() * H * 0.6, Math.cos(ang) * sp, Math.sin(ang) * sp, 0.3 + rnd() * 0.25, 6 + rnd() * 5, RP.streak);
      }
    }
  }

  // ---------------------------------------------------------------- frame: update
  FX.setView = function (name) {
    const v = VIEW[name]; if (v === curView) return;
    for (let i = nAct - 1; i >= 0; i--) if (pview[act[i]] !== v) killAt(i);
    for (let i = 0; i < NR; i++) if (rview[i] !== v) ron[i] = 0;
    for (let i = 0; i < NF; i++) if (fview[i] !== v) fon[i] = 0;
    for (let i = 0; i < NS; i++) if (sview[i] !== v) son[i] = 0;
    curView = v; later.length = 0;
  };
  FX.resize = function (w, h) { W = w; H = h; FX.clear(); };
  FX.clear = function () { for (let i = nAct - 1; i >= 0; i--) killAt(i); ron.fill(0); fon.fill(0); son.fill(0); bon.fill(0); plane.on = false; later.length = 0; };
  FX.update = function (dt, viewName) {
    FX.setView(viewName);
    time += dt;
    let gl = 'high'; try { gl = AT.E.S.settings.gfx || 'high'; } catch (e) { }
    if (gl !== level) { level = LEVELS[gl] ? gl : 'high'; mul = LEVELS[level][0]; cap = LEVELS[level][1]; }
    windV = 7 + Math.sin(time * 0.11) * 6 + Math.sin(time * 0.37) * 2.5;
    ambientSpawn(dt);
    for (let i = later.length - 1; i >= 0; i--) { later[i].t -= dt; if (later[i].t <= 0) { const f = later[i].fn; later.splice(i, 1); f(); } }
    const dragK = dt;
    for (let i = 0; i < nAct;) {
      const k = act[i]; page[k] += dt;
      if (page[k] >= plife[k]) {
        if (pdeath[k] >= 0) emit(DEFS[pdeath[k]], pview[k], px_[k], py_[k], pdn[k], undefined, undefined, 1, 1, pvx[k] * 0.25, pvy[k] * 0.25);
        killAt(i); continue;
      }
      const dr = 1 / (1 + pdrag[k] * dragK);
      let vx = pvx[k] * dr, vy = pvy[k] * dr + pgrav[k] * dt;
      if (pwind[k]) vx += (windV - vx) * pwind[k] * dt;
      let y = py_[k] + vy * dt;
      if ((pfl[k] & 2) && y > pfloor[k] && vy > 0) { y = pfloor[k]; vy *= -0.3; vx *= 0.6; }
      px_[k] += vx * dt; py_[k] = y; pvx[k] = vx; pvy[k] = vy; prot[k] += pvrot[k] * dt;
      if (psub[k] >= 0) {
        psubAcc[k] += psubRate[k] * dt * (mul > 1.5 ? 1 : 0.7);
        while (psubAcc[k] >= 1) { psubAcc[k] -= 1; emit(DEFS[psub[k]], pview[k], px_[k], py_[k], 1, undefined, undefined, 1, 1, vx * 0.1, vy * 0.1); }
      }
      i++;
    }
    for (let i = 0; i < NR; i++) if (ron[i] && (rage[i] += dt) >= rlife[i]) ron[i] = 0;
    for (let i = 0; i < NF; i++) if (fon[i] && (fage[i] += dt) >= flife[i]) fon[i] = 0;
    for (let i = 0; i < NS; i++) if (son[i]) { sage[i] += dt; sx[i] += svx[i] * dt; sy[i] += svy[i] * dt; if (sage[i] >= slife[i]) son[i] = 0; }
    for (let i = 0; i < NB; i++) if (bon[i]) { bx[i] += bvx[i] * dt; bph[i] += dt * 7; if (bx[i] < -30 || bx[i] > W + 30) bon[i] = 0; }
    if (plane.on) {
      plane.x += plane.vx * dt; emit(D.contrail, 1, plane.x - Math.sign(plane.vx) * 3, plane.y + 1, cnt(7, dt), undefined, undefined, 1);
      if (plane.x < -30 || plane.x > W + 30) plane.on = false;
    }
    if (shakeMag > 0.05) { shakeX = Math.round((rnd() - 0.5) * 2 * shakeMag); shakeY = Math.round((rnd() - 0.5) * 2 * shakeMag); shakeMag *= Math.exp(-9 * dt); } else { shakeMag = 0; shakeX = shakeY = 0; }
    if (scrFlash > 0) scrFlash = Math.max(0, scrFlash - dt * 1.8);
  };
  FX.begin = function (g) { if (shakeX || shakeY) { g.save(); g.translate(shakeX, shakeY); FX._sk = true; } else FX._sk = false; };
  FX.end = function (g) { if (FX._sk) g.restore(); };

  // ---------------------------------------------------------------- frame: draw
  function spriteOf(ci, Dm, lvl) { return discSprite(ci, Dm > 40 ? 40 : Dm, lvl); }
  function drawPass(g, v, layer) {
    let last = -1;
    const lo = -24, hx = W + 24, hy = H + 24;
    for (let i = 0; i < nAct; i++) {
      const k = act[i]; if (pview[k] !== v || player[k] !== layer || pkind[k] === 1) continue;
      const u = page[k] / plife[k], ci = RAMPS[pramp[k]][(u * RES1) | 0];
      const x = Math.round(px_[k]), y = Math.round(py_[k]);
      if (x < lo || x > hx || y < lo || y > hy) continue;
      const kind = pkind[k], sz = ps0[k] + (ps1[k] - ps0[k]) * u;
      const lvl = (pfl[k] & 1) ? Math.min(4, Math.max(0, ((u - 0.4) * 8) | 0)) : 0;
      if (ci !== last) { g.fillStyle = COLORS[ci]; last = ci; }
      if (kind === 3) {
        g.fillRect(x, y, 1, 1);
        const tx = Math.round(px_[k] - pvx[k] * 0.035), ty = Math.round(py_[k] - pvy[k] * 0.035);
        if (tx !== x || ty !== y) { const c2 = RAMPS[pramp[k]][Math.min(RES1, ((u * RES1) | 0) + 3)]; g.fillStyle = COLORS[c2]; g.fillRect(tx, ty, 1, 1); last = c2; }
        continue;
      }
      if (kind === 2) {
        const dx = Math.round(Math.cos(prot[k])), dy = Math.round(Math.sin(prot[k]));
        g.fillRect(x, y, 1, 1); g.fillRect(x + dx, y + dy, 1, 1);
        if (sz >= 2.4) { g.fillRect(x - dx, y - dy, 1, 1); g.fillRect(x + dy, y - dx, 1, 1); }
        continue;
      }
      const Dm = (sz + 0.5) | 0; if (Dm < 1) continue;
      if (Dm === 1) { if (lvl < 3 || ((x + y) & 1)) g.fillRect(x, y, 1, 1); }
      else if (Dm === 2 && lvl < 3) g.fillRect(x, y, 2, 2);
      else if (Dm === 2) { if ((x + y) & 1) g.fillRect(x, y, 1, 1); }
      else g.drawImage(spriteOf(ci, Dm, lvl), x - (Dm >> 1), y - (Dm >> 1));
    }
  }
  function drawGlow(g, v) {
    const pc = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < nAct; i++) {
      const k = act[i]; if (pview[k] !== v || pkind[k] !== 1) continue;
      const u = page[k] / plife[k], ci = RAMPS[pramp[k]][(u * RES1) | 0];
      const Dm = Math.max(3, Math.round(ps0[k] + (ps1[k] - ps0[k]) * u)) | 1;
      g.drawImage(glowSprite(ci, Math.min(Dm, 41)), Math.round(px_[k] - Dm / 2), Math.round(py_[k] - Dm / 2));
    }
    g.globalCompositeOperation = pc;
  }
  FX.draw = function (g, viewName) {
    const v = VIEW[viewName];
    // sky life (behind effects)
    if (v === 1) {
      for (let i = 0; i < NB; i++) if (bon[i]) {
        const x = Math.round(bx[i]), y = Math.round(by[i]), up = (Math.floor(bph[i]) & 1);
        g.fillStyle = '#1a1e2c';
        if (up) { g.fillRect(x - 2, y - 1, 2, 1); g.fillRect(x + 1, y - 1, 2, 1); g.fillRect(x, y, 1, 1); } else { g.fillRect(x - 2, y + 1, 2, 1); g.fillRect(x + 1, y + 1, 2, 1); g.fillRect(x, y, 1, 1); }
      }
      if (plane.on) {
        const x = Math.round(plane.x), y = Math.round(plane.y), d = Math.sign(plane.vx);
        g.fillStyle = '#e8ecff'; g.fillRect(x - 3, y, 7, 1); g.fillStyle = '#a8b4d8'; g.fillRect(x - 1, y - 1, 2, 1); g.fillRect(x - 1, y + 1, 2, 1); g.fillStyle = '#ff6b6b'; g.fillRect(x + 3 * d, y, 1, 1);
      }
    }
    drawPass(g, v, 0);
    for (let i = 0; i < pqn; i++) { const q = PQ[i]; plumeDraw(g, q.x, q.y, q.n, q.l, q.th, q.t); }
    pqn = 0;
    drawPass(g, v, 1);
    drawGlow(g, v);
    // flashes
    for (let i = 0; i < NF; i++) if (fon[i] && fview[i] === v) {
      const u = fage[i] / flife[i], r = fr0[i] + (fr1[i] - fr0[i]) * Math.sqrt(u), Dm = Math.max(3, Math.round(r * 2));
      g.drawImage(spriteOf(RAMPS[RP.flash][(u * RES1) | 0], Dm, Math.min(4, (u * 5) | 0)), Math.round(fx_[i] - Dm / 2), Math.round(fy_[i] - Dm / 2));
    }
    // rings
    for (let i = 0; i < NR; i++) if (ron[i] && rview[i] === v) {
      const u = rage[i] / rlife[i], cx = rx[i], cy = ry_[i], th = rthick[i];
      const ci = RAMPS[rramp[i]][(u * RES1) | 0]; g.fillStyle = COLORS[ci];
      if (rstyle[i] === 1) { // cross glint
        const L = Math.round(rr1[i] * Math.sin(Math.PI * u)), X = Math.round(cx), Y = Math.round(cy);
        g.fillRect(X - L, Y, L * 2 + 1, 1); g.fillRect(X, Y - L, 1, L * 2 + 1);
        const L2 = L >> 1; for (let d = 1; d <= L2; d++) { g.fillRect(X + d, Y + d, 1, 1); g.fillRect(X - d, Y + d, 1, 1); g.fillRect(X + d, Y - d, 1, 1); g.fillRect(X - d, Y - d, 1, 1); }
        g.fillStyle = '#ffffff'; g.fillRect(X, Y, 1, 1);
        continue;
      }
      const e = 1 - (1 - u) * (1 - u), r = rr0[i] + (rr1[i] - rr0[i]) * e, dens = 1 - u * 0.95;
      const n = Math.min(220, Math.ceil(TAU * r * (rsq[i] < 0.5 ? 0.75 : 1.1)) + 6);
      for (let j = 0; j < n; j++) {
        const a = j / n * TAU, X = Math.round(cx + Math.cos(a) * r), Y = Math.round(cy + Math.sin(a) * r * rsq[i]);
        if (rsq[i] < 0.5 && Y > cy + 1) continue; // flat ground rings are front-lit lines only
        if (dens < BAY[(Y & 3) * 4 + (X & 3)]) continue;
        g.fillRect(X, Y, th, th);
      }
    }
    // streaks
    for (let i = 0; i < NS; i++) if (son[i] && sview[i] === v) {
      const u = sage[i] / slife[i], sp = Math.hypot(svx[i], svy[i]) || 1, nx = svx[i] / sp, ny = svy[i] / sp, L = Math.round(slen[i] * (u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3));
      for (let j = 0; j < L; j++) {
        g.fillStyle = COLORS[RAMPS[sramp[i]][Math.min(RES1, ((j / slen[i]) * RES1 * 0.9 + u * 3) | 0)]];
        g.fillRect(Math.round(sx[i] - nx * j), Math.round(sy[i] - ny * j), 1, 1);
      }
    }
    if (scrFlash > 0 && !rm()) { const pa = g.globalAlpha; g.globalAlpha = scrFlash; g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.globalAlpha = pa; }
  };
  FX.stats = () => ({ active: nAct, cap, level, mul });
  FX.level = () => level;
})(window.AT = window.AT || {});

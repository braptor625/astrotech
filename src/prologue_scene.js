// AstroTech: the prologue's Launch Complex. scene.js calls SC.proDraw(ctx) from drawLaunch while E.proActive(); everything here is drawn from
// the prologue state (S.pro) each frame, plus a few one-shot effects fed by SC.proEvent (prologue_ui.js forwards the engine's pro* hook events).
// Stages: bare lot -> scaffolding (first part) -> test stand (engine built) -> gantry (first assembly) -> finished pad (Hop cleared) -> dish (Orbit cleared).
(function (AT) {
  'use strict';
  const SC = AT.scene, R = AT.R, FX = AT.FX, E = AT.E, PRO = AT.PROLOGUE;
  const TIERS = PRO.tiers;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const A = { feat: null, last: null, fireId: 0, fireT: 0, att: null, attId: 0, scorch: 0, ghost: null, banner: null, weld: 0, spark: 0, stand: { boom: 0 } };
  let canvases = {};
  const HOLD = 1.2; // seconds on the pad before liftoff

  SC.proReset = function () { A.feat = null; A.attId = 0; A.fireId = 0; A.scorch = 0; A.ghost = null; A.banner = null; A.att = null; };

  // =====================================================================
  // helpers
  // =====================================================================
  function palette(dark) {
    const m = (hex) => (dark ? R.hex(R.mix(R.rgb(hex), [10, 14, 44], 0.5)) : hex);
    return {
      k: '#0a0f26', hi: m('#eef2ff'), mid: m('#b4bee6'), lo: m('#6c78b0'), red: m('#ff6b6b'), redLo: m('#b8403f'), win: m('#86c3ee'), eng: m('#5d6590'), engLo: m('#2c3258'), bell: m('#9aa3c9'),
      steel: m('#8a92b8'), steelLo: m('#4a5078'), rust: m('#a83a3a'), rustDark: m('#5a2a2a'), conc: m('#b4b4a8'), concLo: m('#8a8a80'), yel: '#ffd866',
    };
  }
  function partCanvas(type) {
    if (!canvases[type] && AT.proUI && AT.proUI.partCanvas) canvases[type] = AT.proUI.partCanvas(type);
    return canvases[type];
  }
  // vertical lattice tower (gantry / scaffold / stand columns)
  function lattice(g, x, yTop, yBot, w, col) {
    g.fillStyle = col;
    g.fillRect(x, yTop, 1, yBot - yTop); g.fillRect(x + w - 1, yTop, 1, yBot - yTop);
    for (let y = yTop; y < yBot; y += 4) { g.fillRect(x, y, w, 1); const d = ((y - yTop) / 4) % 2; g.fillRect(d ? x + 1 : x + w - 2, y + 1, 1, 1); g.fillRect(d ? x + 2 : x + w - 3, y + 2, 1, 1); }
  }

  // The rocket for a tier, built bottom-up to `frac` (0..1). x = centre, yb = y of the nozzle bottoms. Returns { top, h, w }.
  const TANK_H = [10, 21, 15, 15], BODY_W = [11, 13, 15, 15];
  function rocketGeom(ti) {
    const T = TIERS[ti], a = T.parts.airframe || 1, e = T.parts.engine || 1, v = T.parts.avionics || 1;
    const bw = BODY_W[ti], engH = ti === 0 ? 5 : 6, tankH = TANK_H[ti], avH = 6 * v, noseH = ti === 0 ? 7 : 9;
    return { a, e, v, bw, engH, tankH, avH, noseH, h: engH + tankH * a + avH + noseH, ti };
  }
  function drawRocket(g, x, yb, ti, frac, P, o) {
    o = o || {};
    const q = rocketGeom(ti), K = P;
    const vis = Math.max(1, Math.round(q.h * clamp(frac, 0, 1)));
    const left = Math.round(x - q.bw / 2);
    g.save();
    g.beginPath(); g.rect(left - 14, yb - vis, q.bw + 28, vis + 2); g.clip();
    let y = yb;
    // engines
    const ew = Math.floor(q.bw / q.e);
    for (let i = 0; i < q.e; i++) {
      const ex = left + Math.round(i * (q.bw - ew) / Math.max(1, q.e - 1)) + (q.e === 1 ? Math.floor((q.bw - ew) / 2) : 0);
      g.fillStyle = K.k; g.fillRect(ex - 1, y - q.engH - 1, ew + 2, q.engH + 2);
      g.fillStyle = K.eng; g.fillRect(ex, y - q.engH, ew, q.engH);
      g.fillStyle = K.engLo; g.fillRect(ex, y - 1, ew, 1);
      g.fillStyle = K.bell; g.fillRect(ex + 1, y - q.engH, 1, q.engH - 1);
    }
    y -= q.engH;
    // tanks
    for (let i = 0; i < q.a; i++) {
      const top = y - q.tankH;
      g.fillStyle = K.k; g.fillRect(left - 1, top - 1, q.bw + 2, q.tankH + 2);
      const w3 = q.bw / 3;
      g.fillStyle = K.hi; g.fillRect(left, top, Math.ceil(w3), q.tankH);
      g.fillStyle = K.mid; g.fillRect(left + Math.ceil(w3), top, Math.ceil(w3), q.tankH);
      g.fillStyle = K.lo; g.fillRect(left + Math.ceil(w3) * 2, top, q.bw - Math.ceil(w3) * 2, q.tankH);
      g.fillStyle = K.red; g.fillRect(left, top + 1, q.bw, 1);
      g.fillStyle = K.redLo; g.fillRect(left, y - 2, q.bw, 1);
      y = top;
    }
    // avionics bay(s)
    for (let i = 0; i < q.v; i++) {
      const top = y - 6;
      g.fillStyle = K.k; g.fillRect(left - 1, top - 1, q.bw + 2, 8);
      g.fillStyle = K.mid; g.fillRect(left, top, q.bw, 6);
      g.fillStyle = K.hi; g.fillRect(left, top, Math.ceil(q.bw / 3), 6);
      g.fillStyle = K.win; g.fillRect(left + Math.floor(q.bw / 2) - 1, top + 1, 3, 3);
      g.fillStyle = K.lo; g.fillRect(left, top + 5, q.bw, 1);
      y = top;
    }
    // nose
    for (let i = 0; i < q.noseH; i++) {
      const w = Math.max(1, Math.round(q.bw * (1 - Math.pow(i / q.noseH, 1.6))));
      const nx = left + Math.floor((q.bw - w) / 2);
      g.fillStyle = K.k; g.fillRect(nx - 1, y - i - 1, w + 2, 1);
      g.fillStyle = i < 2 ? K.red : K.redLo; g.fillRect(nx, y - i - 1, w, 1);
      if (w > 2) { g.fillStyle = K.red; g.fillRect(nx, y - i - 1, Math.ceil(w / 3), 1); }
    }
    g.restore();
    // landing legs
    if (o.legs) {
      g.fillStyle = K.k;
      const ly = yb - q.engH - 1;
      for (const s of [-1, 1]) { for (let i = 0; i < 6; i++) g.fillRect(Math.round(x + s * (q.bw / 2 + 1 + i * 0.9)) - (s > 0 ? 0 : 0), ly + i, 1, 1); g.fillRect(Math.round(x + s * (q.bw / 2 + 6)) - 1, ly + 6, 3, 1); }
      g.fillStyle = K.steel;
      for (const s of [-1, 1]) for (let i = 0; i < 5; i++) g.fillRect(Math.round(x + s * (q.bw / 2 + 1 + i * 0.9)), ly + i, 1, 1);
    }
    return { top: yb - q.h * clamp(frac, 0, 1), h: q.h, w: q.bw, geom: q };
  }
  // a simple three-layer flame for a tilted rocket (FX.plume cannot be rotated)
  function flameLocal(g, x, y, w, len, thr, tt) {
    len = Math.max(3, Math.round(len * (0.5 + 0.5 * thr)));
    for (let k = 0; k < len; k++) {
      const u = k / len, hw = Math.max(0.6, (w / 2) * (1 - u * 0.9)), fl = Math.round(Math.sin(tt * 40 + k * 1.7) * 0.6 * u);
      g.fillStyle = u > 0.6 ? '#e8571f' : '#ff8f3d'; g.fillRect(Math.round(x - hw + fl), y + k, Math.max(1, Math.round(hw * 2)), 1);
      if (u < 0.6) { g.fillStyle = u < 0.3 ? '#ffffff' : '#ffd866'; g.fillRect(Math.round(x - hw * 0.5 + fl), y + k, Math.max(1, Math.round(hw)), 1); }
    }
  }

  // =====================================================================
  // flight paths. q = 0..1 across the flight (after the hold). Returns altitude h (px above the pad) and sideways x.
  // =====================================================================
  function flightAt(ti, q, G) {
    const Hmax = G.padTop + 50;
    let h = 0, x = 0, thr = 1, phase = 'ASCENT', vis = true, legs = false, lift = 0;
    if (ti === 0) {
      const A0 = Math.min(G.padTop * 0.46, 58);
      if (q < 0.32) { h = A0 * ease(q / 0.32); phase = 'ASCENT'; }
      else if (q < 0.55) { h = A0 + Math.sin(q * 30) * 0.6; thr = 0.62; phase = 'HOVER'; }
      else { const u = (q - 0.55) / 0.45; h = A0 * (1 - ease(u)); thr = 0.55 + 0.25 * u; phase = u > 0.8 ? 'TOUCHDOWN' : 'LANDING BURN'; lift = u; }
      legs = true;
    } else if (ti === 1) {
      const X1 = 0.62, s = q / X1;
      if (s > 1) { vis = false; h = Hmax; phase = 'COAST'; } else { h = Hmax * Math.pow(s, 2); x = 22 * Math.pow(s, 3); phase = s < 0.45 ? 'ASCENT' : 'MAX-Q PASSED'; }
    } else {
      const X1 = ti === 2 ? 0.7 : 0.42, s = q / X1;
      if (q <= X1) { h = Hmax * Math.pow(s, 2.1); x = 58 * Math.pow(s, 3.3); phase = s < 0.5 ? 'ASCENT' : s < 0.85 ? 'GRAVITY TURN' : 'STAGE SEPARATION'; }
      else if (ti === 2 || q < 0.7) { vis = false; h = Hmax; phase = ti === 2 ? 'ORBIT' : 'ORBIT / DEORBIT'; }
      else { const u = (q - 0.7) / 0.3; h = Hmax * Math.pow(1 - u, 1.7); x = 14 * (1 - u); thr = u < 0.45 ? 0.2 : 0.5 + 0.5 * u; phase = u < 0.5 ? 'ENTRY' : u > 0.9 ? 'TOUCHDOWN' : 'LANDING BURN'; legs = true; lift = u; }
    }
    return { h, x, thr, phase, vis, legs, lift };
  }
  const flightAng = (ti, q, G) => {
    const a = flightAt(ti, q, G), b = flightAt(ti, Math.min(1, q + 0.012), G);
    const dx = b.x - a.x, dh = b.h - a.h;
    return Math.abs(dx) + Math.abs(dh) < 0.01 ? 0 : clamp(Math.atan2(dx, dh), -1.3, 1.3);
  };
  const altKm = (ti, q) => [0.1, 112, 420, 420][ti] * (ti === 0 ? Math.sin(clamp(q, 0, 1) * Math.PI) : ti === 1 ? Math.sin(clamp(q, 0, 1) * Math.PI) : ti === 2 ? 1 - Math.pow(1 - clamp(q / 0.7, 0, 1), 2) : q < 0.7 ? 1 - Math.pow(1 - clamp(q / 0.42, 0, 1), 2) : 1 - ease((q - 0.7) / 0.3));

  // =====================================================================
  // events
  // =====================================================================
  SC.proEvent = function (kind, p) {
    const G = A.last;
    if (kind === 'proClick' && G) {
      A.spark++;
      for (let i = 0; i < (p.mode === 'hand' ? 2 : 1); i++) FX.repair('launch', G.doorX + (Math.random() - 0.5) * 8, G.doorY - 2 - Math.random() * 3);
    }
    if (kind === 'proStaticFire' && p.boom && G) {
      FX.explosion('launch', G.standX, G.nozY - 6, 0.85, 80);
      A.stand.boom = 4; A.scorch = Math.max(A.scorch, 0.5);
    }
    if (kind === 'proJobStart' && p.kind === 'assemble') A.scorch = 0;
    if (kind === 'proAttemptResult' && G) {
      const T = TIERS.find((t) => t.id === p.tier), ti = TIERS.indexOf(T);
      if (!p.ok) {
        const a = p.attempt, qf = clamp(((p.at * a.T) - HOLD) / (a.T - HOLD), 0, 1), f = flightAt(ti, qf, G);
        const ex = G.padX + f.x, ey = Math.max(16, G.padTop - f.h - rocketGeom(ti).h / 2);
        FX.explosion('launch', ex, ey, 1.1 + ti * 0.18, 70);
        if (f.h < 14) A.scorch = 1;
        A.banner = { text: 'VEHICLE LOST', col: '#ff6b6b', t: 0 };
      } else {
        A.banner = { text: T.name.toUpperCase() + ' COMPLETE', col: '#6be08a', t: 0 };
        if (ti === 0) A.ghost = { t: 0, ti };
      }
    }
  };

  // =====================================================================
  // main draw
  // =====================================================================
  SC.proDraw = function (c) {
    const g = c.g, W = c.W, H = c.H, dt = c.dt, t = c.t, dark = c.dark, S = E.S, P = S.pro;
    if (!P) return;
    const K = palette(dark);
    const x0 = c.seaW + 16, x1 = W - 16, span = x1 - x0;
    const apronY = c.apronY, horizon = c.horizon;
    const G = { standX: Math.round(x0 + span * 0.13), hangX: Math.round(x0 + span * 0.45), padX: Math.round(x0 + span * 0.76), padTop: apronY - 3, ground: apronY - 2, apronY, horizon };
    // feature progress, eased (a loaded save starts complete)
    const want = {
      scaf: P.made.airframe + P.made.engine + P.made.avionics >= 1 && !P.unlocked.launch ? 1 : 0,
      stand: P.unlocked.stand ? 1 : 0,
      gantry: P.unlocked.launch ? 1 : 0,
      pad: P.cleared.hop ? 1 : 0,
      dish: P.cleared.orbit ? 1 : 0,
    };
    if (!A.feat) A.feat = Object.assign({}, want);
    for (const k in want) A.feat[k] += clamp(want[k] - A.feat[k], -dt * 0.9, dt * 0.9);
    const F = A.feat;

    // ---- the lot: fence along the back
    const fy = horizon + 9;
    g.fillStyle = dark ? '#262a3a' : '#7a7a8a';
    for (let x = x0 - 8; x < W; x += 10) g.fillRect(x, fy - 5, 1, 6);
    g.fillRect(x0 - 8, fy - 4, W, 1); g.fillRect(x0 - 8, fy - 1, W, 1);

    // ---- hangar (leased: it is a shed)
    const hw = 58, hh = 22, hb = Math.round(horizon + (apronY - horizon) * 0.62), hl = G.hangX - hw / 2;
    G.doorX = G.hangX; G.doorY = hb - 5;
    const working = !!P.hand || P.jobs.some((j) => j.kind === 'fab' || j.kind === 'assemble');
    g.fillStyle = K.k; g.fillRect(hl - 1, hb - hh - 1, hw + 2, hh + 2);
    g.fillStyle = dark ? '#1e2230' : '#9aa0b4'; g.fillRect(hl, hb - hh, hw, hh);
    g.fillStyle = dark ? '#14161e' : '#7a8098'; for (let x = hl + 3; x < hl + hw; x += 4) g.fillRect(x, hb - hh, 1, hh);
    for (let i = 0; i < 8; i++) { g.fillStyle = K.k; g.fillRect(hl - 1 + i, hb - hh - 1 - i * 1, hw + 2 - i * 2, 1); g.fillStyle = dark ? '#2a2e3e' : '#6a7090'; g.fillRect(hl + i, hb - hh - 1 - i, hw - i * 2, 1); }
    const dw = 22, dx = G.hangX - dw / 2, dh = 15;
    g.fillStyle = K.k; g.fillRect(dx - 1, hb - dh - 1, dw + 2, dh + 1);
    const flick = working ? 0.75 + 0.25 * Math.sin(t * 30 + Math.sin(t * 7) * 3) : 0.12;
    g.fillStyle = working ? `rgba(255,${190 + Math.round(40 * flick)},${90 + Math.round(40 * flick)},${0.55 + 0.35 * flick})` : (dark ? '#10131c' : '#2a2f44');
    g.fillRect(dx, hb - dh, dw, dh);
    // lathe silhouette inside the door
    g.fillStyle = K.k; g.fillRect(dx + 3, hb - 6, 15, 2); g.fillRect(dx + 3, hb - 9, 2, 3); g.fillRect(dx + 15, hb - 10, 3, 4);
    if (working) { g.fillStyle = '#fff2b0'; g.fillRect(dx + 8 + (Math.floor(t * 9) % 3), hb - 7, 1, 1); if (Math.random() < 0.25 && !AT.reducedMotion) FX.repair('launch', dx + 9, hb - 7); }
    R.text(g, 'HANGAR 3', G.hangX - R.textWidth('HANGAR 3', 's') / 2, hb - hh - 16, dark ? '#5a6496' : '#2a2e3a', null, 's');
    if (F.dish > 0.02) { // tracking dish on the roof
      const d = F.dish, rx = hl + hw - 8;
      g.fillStyle = K.k; g.fillRect(rx, hb - hh - 10 * d, 1, 10 * d);
      if (d > 0.6) { g.fillStyle = K.hi; g.fillRect(rx - 3, hb - hh - 12, 7, 2); g.fillStyle = K.k; g.fillRect(rx - 3, hb - hh - 13, 7, 1); if (Math.sin(t * 3) > 0.4) { g.fillStyle = '#6be08a'; g.fillRect(rx + 4, hb - hh - 14, 1, 1); } }
    }
    // barrels
    g.fillStyle = K.k; for (const bx of [hl - 7, hl - 4]) g.fillRect(bx, hb - 5, 3, 5);
    g.fillStyle = dark ? '#5a2a2a' : '#c85a3a'; g.fillRect(hl - 6, hb - 4, 1, 3); g.fillRect(hl - 3, hb - 4, 1, 3);

    // ---- the bench: the part being machined
    const bx = G.hangX, bY = apronY - 4;
    if (P.hand) {
      const pc = partCanvas(P.hand.type);
      if (pc) { const hh2 = Math.max(1, Math.round(12 * P.hand.p)); g.globalAlpha = 0.35; g.drawImage(pc, bx - 6, bY - 12); g.globalAlpha = 1; g.drawImage(pc, 0, 12 - hh2, 12, hh2, bx - 6, bY - hh2, 12, hh2); }
    }

    // ---- parts on the shelf (apron)
    const shelfY = apronY - 3;
    let sx = G.hangX - 24;
    for (const s of PRO.partOrder) {
      const n = P.parts[s], pc = partCanvas(s);
      for (let i = 0; i < Math.min(n, 4) && pc; i++) g.drawImage(pc, Math.round(sx + i * 6), shelfY - 12 - (i % 2));
      if (n > 4) R.text(g, '+' + (n - 4), Math.round(sx + 26), shelfY - 7, '#e8ecff', '#000', 's');
      sx += 34;
    }
    if (P.parts.airframe + P.parts.engine + P.parts.avionics === 0 && E.proMade() === 0) R.text(g, 'NO PARTS', G.hangX - 20, shelfY - 6, dark ? '#5a6496' : '#4a4e5a', null, 's');

    // ---- test stand
    const sGround = G.ground, nozY = sGround - 21;
    G.nozY = nozY;
    if (F.stand > 0.02) {
      const st = F.stand, sx0 = G.standX, h = Math.round(46 * st);
      g.fillStyle = K.k; g.fillRect(sx0 - 18, sGround - 2, 37, 4);
      g.fillStyle = K.conc; g.fillRect(sx0 - 17, sGround - 2, 35, 2);
      g.fillStyle = '#12121a'; g.fillRect(sx0 - 6, sGround - 3, 13, 3); // trench
      if (A.stand.boom > 0) { g.fillStyle = '#05050a'; g.fillRect(sx0 - 11, sGround - 3, 23, 2); }
      lattice(g, sx0 - 13, sGround - h, sGround - 2, 5, K.rust);
      lattice(g, sx0 + 9, sGround - h, sGround - 2, 5, K.rust);
      if (st > 0.7) { g.fillStyle = K.k; g.fillRect(sx0 - 14, sGround - 46, 29, 4); g.fillStyle = K.steel; g.fillRect(sx0 - 13, sGround - 46, 27, 1); g.fillStyle = K.steelLo; g.fillRect(sx0 - 2, sGround - 42, 5, 14); }
    }
    // static fire
    const fire = P.jobs.find((j) => j.kind === 'fire');
    A.stand.boom = Math.max(0, A.stand.boom - dt);
    if (fire && F.stand > 0.9) {
      if (A.fireId !== fire.id) { A.fireId = fire.id; A.fireT = 0; FX.ignition(G.standX, sGround, dark); A.pfy = nozY; }
      A.fireT += dt;
      const thr = clamp(A.fireT / 1.6, 0.2, 1) * (fire.T - fire.t < 1.2 ? clamp((fire.T - fire.t) / 1.2, 0.3, 1) : 1);
      // engine hanging on the thrust frame
      const ex = G.standX, et = nozY - 14;
      g.fillStyle = K.k; g.fillRect(ex - 5, et - 1, 11, 17); g.fillRect(ex - 2, et - 6, 5, 6);
      g.fillStyle = K.eng; g.fillRect(ex - 4, et, 9, 4); g.fillStyle = K.bell; g.fillRect(ex - 3, et + 4, 7, 6); g.fillRect(ex - 4, et + 10, 9, 4);
      g.fillStyle = K.engLo; g.fillRect(ex + 2, et + 4, 2, 10);
      FX.shimmer(g, ex, sGround, 0, thr, t);
      FX.plume(g, ex, nozY + 1, 6, 9 + thr * 9 + Math.random() * 2, thr, t);
      FX.exhaust(ex, nozY, A.pfy, sGround, 0, thr, dt, dark, 6); A.pfy = nozY;
    } else if (!fire) A.fireId = 0;
    if (A.stand.boom <= 0 && !fire && F.stand > 0.9 && P.parts.engine > 0) { // an engine waits in the cradle
      const pc = partCanvas('engine'); if (pc) g.drawImage(pc, G.standX - 6, sGround - 15);
    }

    // ---- the pad
    const px = G.padX, slabY = apronY - 4;
    g.fillStyle = K.k; g.fillRect(px - 23, slabY, 47, 5);
    g.fillStyle = K.conc; g.fillRect(px - 22, slabY, 45, 3);
    g.fillStyle = K.concLo; g.fillRect(px - 22, slabY + 2, 45, 1);
    g.fillStyle = '#1a1a22'; g.fillRect(px - 7, slabY + 3, 15, 2);
    if (A.scorch > 0) { g.fillStyle = 'rgba(8,8,12,0.55)'; g.fillRect(px - 10, slabY, 21, 3); g.fillStyle = 'rgba(8,8,12,0.4)'; g.fillRect(px - 14, slabY + 1, 29, 2); }
    if (F.pad < 1) { // unfinished: formwork, stakes and tape
      g.fillStyle = dark ? '#6a5a2a' : '#c8a040';
      for (const sx2 of [px - 23, px - 8, px + 8, px + 23]) { g.fillRect(sx2, slabY - 4, 1, 4); g.fillRect(sx2 - 1, slabY - 5, 3, 1); }
      for (let x = px - 23; x < px + 23; x += 4) if (((x - px) >> 2) % 2 === 0) g.fillRect(x, slabY - 3, 3, 1);
      R.text(g, 'PAD 1', px - 9, slabY - 13, dark ? '#5a6496' : '#4a4e5a', null, 's');
      R.text(g, 'PLANNED', px - 14, slabY + 7, dark ? '#5a6496' : '#4a4e5a', null, 's');
    }
    if (F.pad > 0.02) { // finished: edge striping, numeral, floodlights, windsock
      const f = F.pad;
      g.fillStyle = K.yel; for (let x = px - 22; x < px + 23; x += 4) g.fillRect(x, slabY, 2, 1);
      R.text(g, '1', px - 21, slabY + 5, dark ? '#5a6496' : '#e8ecff', null, 's');
      for (const sx2 of [px - 26, px + 27]) { g.fillStyle = K.steelLo; g.fillRect(sx2, slabY - 9 * f, 1, 9 * f); if (f > 0.9) { g.fillStyle = dark ? '#fff2b0' : '#e8ecff'; g.fillRect(sx2 - 1, slabY - 10, 3, 1); } }
      if (f > 0.9) { const wag = Math.sin(t * 1.5) * 1.5; g.fillStyle = K.k; g.fillRect(px - 31, slabY - 12, 1, 12); g.fillStyle = '#ff8f3d'; g.fillRect(px - 30, slabY - 12, 4, 2); g.fillRect(px - 29 - Math.round(wag), slabY - 10, 3, 1); }
    }

    // scaffolding, then the gantry
    const gx = px + 20;
    const att = P.attempt;
    if (F.scaf > 0.02 && F.gantry < 0.98) {
      const sh = Math.round(30 * F.scaf * (1 - F.gantry));
      if (sh > 1) { lattice(g, gx, slabY - sh, slabY, 5, dark ? '#6a5a2a' : '#c8a040'); g.fillStyle = dark ? '#6a5a2a' : '#c8a040'; for (let y = slabY - sh + 3; y < slabY; y += 6) g.fillRect(gx - 3, y, 3, 1); }
    }
    let gh = Math.round(84 * F.gantry);
    if (gh > 1) {
      lattice(g, gx, slabY - gh, slabY, 5, dark ? K.rustDark : K.rust);
      const armLen = att && att.t > HOLD - 0.4 ? Math.max(0, 6 - (att.t - HOLD + 0.4) * 14) : 6;
      g.fillStyle = dark ? K.rustDark : K.rust;
      if (armLen > 0.5) { g.fillRect(gx - Math.round(armLen), slabY - gh + 10, Math.round(armLen), 1); g.fillRect(gx - Math.round(armLen), slabY - Math.round(gh * 0.55), Math.round(armLen), 1); }
      g.fillStyle = dark ? '#2a2e3a' : '#e8e8e8'; g.fillRect(gx + 1, slabY - gh - 4, 3, 4);
      if (F.gantry > 0.95 && Math.sin(t * 2) > 0.3) { g.fillStyle = '#ff6b6b'; g.fillRect(gx + 2, slabY - gh - 5, 1, 1); }
    }

    // ---- the vehicle
    const padTop = slabY + 1;
    G.padTop = padTop;
    A.last = G;
    const asm = P.jobs.find((j) => j.kind === 'assemble');
    if (asm) {
      const ti = asm.tier, fr = asm.t / asm.T;
      const r = drawRocket(g, px, padTop, ti, fr, K, { legs: false });
      A.weld += dt;
      if (A.weld > 0.12 && !AT.reducedMotion) { A.weld = 0; FX.repair('launch', px + (Math.random() - 0.5) * r.w, r.top); }
    } else if (P.rocket && !att) {
      const r = drawRocket(g, px, padTop, P.rocket.tier, 1, K, { legs: P.rocket.tier === 0 || (P.rocket.tier === 3 && E.proFx().legs) });
      if (Math.random() < 0.05 && !dark) FX.glintAt('launch', px + (Math.random() - 0.5) * r.w, r.top + Math.random() * 8, 1);
    }
    if (A.ghost) { // a recovered hop vehicle stays on the pad a moment
      A.ghost.t += dt;
      if (A.ghost.t < 1.8 && !P.rocket && !att) drawRocket(g, px, padTop, A.ghost.ti, 1, K, { legs: true });
      else if (A.ghost.t >= 1.8) A.ghost = null;
    }
    if (att) drawAttempt(g, att, G, K, dt, t, dark, c);
    else A.att = null;

    // ---- banner & night lights
    if (A.banner) {
      const b = A.banner; b.t += dt;
      if (b.t < 4) {
        const tw = R.textWidth(b.text), a = b.t < 0.3 ? b.t / 0.3 : b.t > 3.4 ? (4 - b.t) / 0.6 : 1;
        g.globalAlpha = a; g.fillStyle = '#05070fcc'; g.fillRect(Math.round(W / 2 - tw / 2) - 4, 14, tw + 8, R.textH() + 4);
        R.text(g, b.text, Math.round(W / 2 - tw / 2), 16, b.col, '#000'); g.globalAlpha = 1;
      } else A.banner = null;
    }
    if (dark) {
      g.fillStyle = '#fff2b0';
      if (F.pad > 0.9) { g.fillRect(px - 27, slabY - 10, 3, 1); g.fillRect(px + 26, slabY - 10, 3, 1); }
      g.fillRect(G.hangX - 25, hb - 3, 1, 1);
    }
    R.text(g, 'ASTROTECH - HANGAR 3', 4, H - 8, dark ? '#5a6496' : '#2a2e3a');
  };

  // flight overlay + rocket + exhaust for the running attempt
  function drawAttempt(g, att, G, K, dt, t, dark, c) {
    const ti = att.tier, T = TIERS[ti], q = clamp((att.t - HOLD) / (att.T - HOLD), 0, 1);
    const geom = rocketGeom(ti), px = G.padX;
    if (!A.att || A.attId !== att.id) { A.attId = att.id; A.att = { pfy: 0, lift: false, touched: false, ign: false }; }
    const a = A.att;
    const ground = G.padTop - 1;
    if (!a.ign) { a.ign = true; FX.ignition(px, ground, dark); }
    let fl;
    if (att.t < HOLD) { fl = { h: 0, x: 0, thr: 0.25 + 0.75 * Math.pow(att.t / HOLD, 2), phase: 'IGNITION', vis: true, legs: ti === 0 || (ti === 3 && E.proFx().legs), lift: 0 }; }
    else fl = flightAt(ti, q, G);
    if (att.t >= HOLD && !a.lift) { a.lift = true; FX.liftoff(px, ground, dark); }
    const legs = fl.legs && (ti === 0 || E.proFx().legs || ti < 3);
    const yb = G.padTop - fl.h;                   // nozzle bottom
    const ang = fl.vis && att.t >= HOLD ? flightAng(ti, q, G) : 0;
    if (fl.vis) {
      const cx = px + fl.x, cy = yb - geom.h / 2;
      const tilted = Math.abs(ang) > 0.1;
      const nozX = cx - Math.sin(ang) * geom.h / 2, nozY = cy + Math.cos(ang) * geom.h / 2;
      if (att.t < HOLD || fl.h < 70) FX.shimmer(g, px, ground, fl.h, fl.thr, t);
      if (tilted) {
        g.save(); g.translate(Math.round(cx), Math.round(cy)); g.rotate(ang);
        flameLocal(g, 0, Math.round(geom.h / 2) + 1, geom.bw * 0.7, 8 + fl.thr * 12 + Math.random() * 3, fl.thr, t);
        drawRocket(g, 0, Math.round(geom.h / 2), ti, 1, K, { legs: false });
        g.restore();
      } else {
        FX.plume(g, cx, nozY + 1, Math.max(3, geom.bw * 0.6), 7 + fl.thr * (7 + Math.min(10, fl.h / 12)) + Math.random() * 3, fl.thr, t);
        drawRocket(g, Math.round(cx), Math.round(nozY), ti, 1, K, { legs });
      }
      if (fl.lift === 0) FX.exhaust(nozX, nozY, a.pfy || nozY, ground, fl.h, fl.thr, dt, dark, Math.max(3, geom.bw * 0.6));
      else FX.landing(cx, nozY, ground, clamp(fl.lift, 0, 1), dt, dark, false);
      a.pfy = nozY;
      if (ti === 0 || ti === 3) { if (fl.lift >= 0.995 && !a.touched) { a.touched = true; FX.touchdown(px, ground, dark); } }
    }
    // telemetry (top-left): reads like a launch-control readout
    const km = altKm(ti, q), th = R.textH() + 1;
    const lines = [`T+${String(Math.floor(att.t)).padStart(2, '0')}s  ${T.name.toUpperCase()}`, `ALT ${km < 1 ? (km * 1000).toFixed(0) + ' M' : km.toFixed(0) + ' KM'}`, fl.phase];
    g.fillStyle = '#05070fcc'; g.fillRect(3, 3, Math.max(...lines.map((l) => R.textWidth(l))) + 6, lines.length * th + 3);
    lines.forEach((l, i) => R.text(g, l, 6, 5 + i * th, i === 2 ? (fl.vis ? '#ffd866' : '#86c3ee') : '#e8ecff'));
    // when the vehicle is off the top of the screen, mark its track
    if (!fl.vis) {
      const o = (Math.sin(t * 6) > 0 ? 1 : 0.6);
      g.globalAlpha = o; R.text(g, 'DOWNRANGE', Math.round(c.W / 2 - R.textWidth('DOWNRANGE') / 2), 10 + th * 3, '#86c3ee', '#000'); g.globalAlpha = 1;
      R.ellipse(g, c.W * 0.62, 26 + th * 3, 28, 7, '#2a3a6a', 3);
      const oa = t * 1.2; g.fillStyle = '#ffd866'; g.fillRect(Math.round(c.W * 0.62 + Math.cos(oa) * 28), Math.round(26 + th * 3 + Math.sin(oa) * 7), 2, 2);
    }
  }
})(window.AT = window.AT || {});

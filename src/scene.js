// AstroTech — the main viewport: System Map, Launch Complex, Close-up.
(function (AT) {
  'use strict';
  const SC = AT.scene = {};
  const R = AT.R, SPR = AT.SPR;
  let cv, g, W = 384, H = 216, scale = 2;
  let view = 'map', mapRegion = 0, t = 0;
  let hover = null, mouse = null;
  let stars = [], parts = [], clouds = [], hills = [];
  let launches = [], landings = [], booms = [];
  let padOf = {};
  const cb = {};
  SC.cb = cb;

  // =====================================================================
  // SETUP
  // =====================================================================
  SC.init = function (canvasEl) {
    cv = canvasEl;
    g = cv.getContext('2d', { willReadFrequently: true });
    SC.resize();
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', () => { mouse = null; hover = null; cv.style.cursor = ''; });
    cv.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', () => SC.resize());
  };
  SC.resize = function () {
    if (!cv) return;
    const cssW = cv.parentElement.clientWidth || 768;
    scale = cssW >= 1150 ? 3 : cssW >= 360 ? 2 : 1;
    W = Math.max(200, Math.round(cssW / scale));
    H = Math.round(W * 9 / 16);
    cv.width = W; cv.height = H;
    g.imageSmoothingEnabled = false;
    const rand = SPR.rng(7);
    stars = [];
    for (let i = 0; i < Math.floor(W * H / 300); i++) stars.push({ x: rand() * W, y: rand() * H, z: 1 + Math.floor(rand() * 3), tw: rand() * 6 });
    clouds = [];
    for (let i = 0; i < 7; i++) clouds.push({ x: rand() * W, y: H * (0.08 + rand() * 0.35), w: 18 + rand() * 40, v: 1 + rand() * 3 });
    hills = [];
    for (let x = 0; x <= W; x++) hills.push(R.fbm3(x / 40, 0, 0, 5, 4));
  };
  SC.setView = function (v) { view = v; };
  SC.getView = function () { return view; };
  SC.setMapRegion = function (r) { mapRegion = r; };
  SC.getMapRegion = function () { return mapRegion; };
  SC.size = function () { return { W, H }; };

  function toLocal(e) {
    const b = cv.getBoundingClientRect();
    return { x: (e.clientX - b.left) / b.width * W, y: (e.clientY - b.top) / b.height * H };
  }
  function onMove(e) {
    mouse = toLocal(e);
    hover = view === 'map' ? pickTarget(mouse) : null;
    cv.style.cursor = hover ? `url("${SPR.cursor('target')}") 9 9, pointer` : '';
  }
  function onDown(e) {
    AT.audio && AT.audio.unlock();
    const p = toLocal(e);
    if (view === 'map') {
      const tg = pickTarget(p);
      if (tg && cb.select) cb.select(tg.id);
    } else if (view === 'target') {
      if (cb.closeupClick) cb.closeupClick();
    }
  }

  // =====================================================================
  // PARTICLES
  // =====================================================================
  function spawn(x, y, n, opts) {
    for (let i = 0; i < n; i++) {
      const a = (opts.dir !== undefined ? opts.dir : Math.random() * Math.PI * 2) + (Math.random() - 0.5) * (opts.spread || Math.PI * 2);
      const s = (opts.speed || 20) * (0.3 + Math.random() * 0.7);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: (opts.life || 1) * (0.5 + Math.random() * 0.5), max: opts.life || 1,
        c: opts.colors[Math.floor(Math.random() * opts.colors.length)], size: opts.size || 1, grow: opts.grow || 0, drag: opts.drag || 0.96, g: opts.gravity || 0, view: opts.view || view });
    }
    if (parts.length > 900) parts.splice(0, parts.length - 900);
  }
  function drawParts(dt, which) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.view !== which) continue;
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt;
      const sz = Math.max(1, Math.round(p.size + p.grow * (1 - p.life / p.max)));
      g.fillStyle = p.c;
      if (sz <= 1) g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      else if ((p.life / p.max) > 0.3 || ((Math.round(p.x) + Math.round(p.y)) & 1)) R.disc(g, Math.round(p.x), Math.round(p.y), Math.floor(sz / 2), p.c);
    }
  }

  // =====================================================================
  // EVENTS FROM THE ENGINE
  // =====================================================================
  SC.onLaunch = function (m, ship, tg) {
    if (padOf[ship.id] === undefined) { const used = new Set(Object.values(padOf)); let k = 0; while (used.has(k) && k < 3) k++; padOf[ship.id] = k; }
    const pad = padOf[ship.id];
    launches.push({ pad, hull: ship.hull, t: 0, y: 0, v: 0, id: ship.id });
    if (launches.length > 12) launches.shift();
  };
  SC.onResolve = function (m, ship, tg, outcome) {
    if (outcome === 'lost') {
      if (tg) booms.push({ target: tg.id, region: tg.region, t: 0 });
      return;
    }
    if (ship && ship.state !== 'mission') { delete padOf[ship.id]; landings.push({ id: ship.id, hull: ship.hull, t: 0 }); }
    if (landings.length > 8) landings.shift();
  };
  SC.burst = function () {
    spawn(W / 2, H / 2, 260, { speed: 160, life: 1.6, colors: ['#ffd866', '#e8ecff', '#86c3ee', '#ff8f3d'], drag: 0.97, view });
  };

  // =====================================================================
  // FRAME
  // =====================================================================
  SC.frame = function (dt) {
    const S = AT.E.S;
    if (!g || !S) return;
    t += dt;
    if (view === 'map') drawMap(S, dt);
    else if (view === 'launch') drawLaunch(S, dt);
    else drawCloseup(S, dt);
    drawParts(dt, view);
    // tick down animations even when their view is hidden
    for (const L of launches) L.t += view === 'launch' ? 0 : dt;
    launches = launches.filter((L) => L.t < 7);
    for (const L of landings) L.t += view === 'launch' ? 0 : dt;
    landings = landings.filter((L) => L.t < 4);
    for (const b of booms) b.t += view === 'map' ? 0 : dt;
    booms = booms.filter((b) => b.t < 2);
  };

  function starfield(dt, dim, drift) {
    for (const s of stars) {
      if (drift) { s.x -= s.z * drift * dt; if (s.x < 0) s.x += W; }
      const tw = Math.sin(t * 2 + s.tw) > 0.9;
      if (dim && s.z < 3 && Math.random() < dim) continue;
      g.fillStyle = s.z === 3 ? '#e8ecff' : s.z === 2 ? '#8b97c9' : '#3d4677';
      g.fillRect(s.x | 0, s.y | 0, 1, 1);
      if (tw && s.z === 3) { g.fillRect((s.x | 0) - 1, s.y | 0, 3, 1); g.fillRect(s.x | 0, (s.y | 0) - 1, 1, 3); }
    }
  }
  function fillBg(c0, c1) {
    g.fillStyle = c0; g.fillRect(0, 0, W, H);
    g.fillStyle = c1;
    for (let y = Math.floor(H * 0.5); y < H; y++) {
      const p = (y - H * 0.5) / (H * 0.5);
      for (let x = y & 1; x < W; x += 2) if (((x * 13 + y * 7) % 10) / 10 < p * 0.8) g.fillRect(x, y, 1, 1);
    }
  }

  // =====================================================================
  // SYSTEM MAP
  // =====================================================================
  const MAP_BG = [['#070918', '#0d1230'], ['#05081a', '#0b1630'], ['#04050f', '#0a0c1f'], ['#0b0414', '#170a24'], ['#020204', '#0a0614']];
  function mapCenter() { return { x: W * 0.5, y: H * 0.54 }; }
  function earthPos() {
    const c = mapCenter(), rE = H * 0.22, a = t * 0.02 + 2.2;
    return { x: c.x + Math.cos(a) * rE * 1.6, y: c.y + Math.sin(a) * rE * 0.62 };
  }
  function regionRange(r, d) {
    // map distance to a radius in pixels for each map scale
    if (r === 0) return H * 0.18 + clamp01((d - 6) / 36) * H * 0.34;
    if (r === 1) return H * 0.34 + clamp01((d - 120) / 190) * H * 0.18;
    if (r === 2) return H * 0.2 + clamp01((d - 2500) / 6800) * H * 0.3;
    if (r === 3) return H * 0.12 + clamp01((d - 9e4) / 3.2e5) * H * 0.38;
    return H * 0.18 + clamp01((d - 2e7) / 1.25e8) * H * 0.32;
  }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  SC.targetPos = function (tg) {
    const c = mapCenter();
    const rr = regionRange(tg.region, tg.dist);
    const sq = tg.region >= 2 ? 0.85 : 0.62;
    const a = tg.ang + (tg.region === 0 ? t * 0.004 : 0);
    return { x: c.x + Math.cos(a) * rr * 1.6, y: c.y + Math.sin(a) * rr * sq };
  };
  function originPos(region) {
    if (region === 0) return earthPos();
    return mapCenter();
  }
  function pickTarget(p) {
    const S = AT.E.S;
    let best = null, bd = 9;
    for (const tg of S.targets) {
      if (tg.region !== mapRegion) continue;
      const q = SC.targetPos(tg);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) { bd = d; best = tg; }
    }
    return best;
  }
  function drawMap(S, dt) {
    const [c0, c1] = MAP_BG[mapRegion];
    fillBg(c0, c1);
    starfield(dt, 0, 0);
    const c = mapCenter();
    const r = mapRegion;
    if (r === 0) {
      // orbits: Mercury, Venus, Earth, Mars, Jupiter
      const orb = [[0.07, '#2a3366'], [0.13, '#2a3366'], [0.22, '#3d4f9a'], [0.3, '#4a2a3a'], [0.62, '#3a3050']];
      for (const [k, col] of orb) R.ellipse(g, c.x, c.y, H * k * 1.6, H * k * 0.62, col, 2);
      // main belt
      const rand = SPR.rng(3);
      for (let i = 0; i < 520; i++) {
        const a = rand() * Math.PI * 2 + t * 0.003, rr = H * (0.4 + rand() * 0.11);
        g.fillStyle = rand() < 0.3 ? '#5a5070' : '#3a3550';
        g.fillRect(Math.round(c.x + Math.cos(a) * rr * 1.6), Math.round(c.y + Math.sin(a) * rr * 0.62), 1, 1);
      }
      R.drawStar(g, c.x, c.y, 6, '#ffd866', t, { corona: 0.6 });
      const e = earthPos();
      R.drawBody(g, e.x, e.y, 3.5, null, { kind: 'earth', tex: R.earthTexture(), rot: t * 0.5, cloudRot: t * 0.2, light: [c.x - e.x, c.y - e.y, 2] });
      R.text(g, 'EARTH', e.x - 9, e.y + 6, '#86c3ee', '#000');
      const ma = t * 0.012 + 4, mr = H * 0.3;
      R.disc(g, c.x + Math.cos(ma) * mr * 1.6, c.y + Math.sin(ma) * mr * 0.62, 2, '#c4471c');
      const ja = t * 0.004 + 1, jr = H * 0.62;
      const jx = c.x + Math.cos(ja) * jr * 1.6, jy = c.y + Math.sin(ja) * jr * 0.62;
      if (jx > -10 && jx < W + 10 && jy > -10 && jy < H + 10) R.drawBody(g, jx, jy, 6, ['#3a2a1a', '#9a6a3a', '#d9b07a', '#f0d8b0'], { kind: 'band', tex: R.bandTexture(4), rot: t * 0.3, light: [c.x - jx, c.y - jy, 2] });
    } else if (r === 1) {
      const pl = [[0.08, '#d9b07a'], [0.14, '#e8d090'], [0.21, '#86c3ee'], [0.27, '#4f6ad6']];
      for (const [k] of pl) R.ellipse(g, c.x, c.y, H * k * 1.6, H * k * 0.62, '#26305a', 2);
      pl.forEach(([k, col], i) => {
        const a = t * (0.01 / (i + 1)) + i * 1.7;
        R.disc(g, c.x + Math.cos(a) * H * k * 1.6, c.y + Math.sin(a) * H * k * 0.62, i < 2 ? 2 : 1, col);
      });
      const rand = SPR.rng(5);
      for (let i = 0; i < 700; i++) {
        const a = rand() * Math.PI * 2 + t * 0.001, rr = H * (0.33 + rand() * 0.2);
        g.fillStyle = rand() < 0.3 ? '#4a5a8a' : '#2a3460';
        g.fillRect(Math.round(c.x + Math.cos(a) * rr * 1.6), Math.round(c.y + Math.sin(a) * rr * 0.62), 1, 1);
      }
      R.drawStar(g, c.x, c.y, 2, '#fff2b0', t, { corona: 0.8 });
      R.text(g, 'NEPTUNE', c.x + H * 0.27 * 1.6 - 12, c.y + 6, '#4f6ad6', '#000');
    } else if (r === 2) {
      const rand = SPR.rng(9);
      for (let i = 0; i < 1100; i++) {
        const a = rand() * Math.PI * 2, rr = H * (0.16 + Math.pow(rand(), 0.6) * 0.36);
        g.fillStyle = rand() < 0.2 ? '#3a4a5a' : '#1c2434';
        g.fillRect(Math.round(c.x + Math.cos(a) * rr * 1.6), Math.round(c.y + Math.sin(a) * rr * 0.85), 1, 1);
      }
      R.ellipse(g, c.x, c.y, H * 0.06 * 1.6, H * 0.06 * 0.62, '#2a3460', 2);
      g.fillStyle = '#fffbe6'; g.fillRect(Math.round(c.x), Math.round(c.y), 1, 1);
      R.text(g, 'SOL', c.x - 5, c.y + 4, '#8b97c9', '#000');
    } else if (r === 3) {
      R.drawStar(g, c.x, c.y, 2.5, '#ffd866', t, { corona: 0.6 });
      R.text(g, 'SOL', c.x - 5, c.y + 6, '#ffd866', '#000');
      for (let k = 1; k <= 3; k++) R.ellipse(g, c.x, c.y, H * 0.15 * k * 1.6, H * 0.15 * k * 0.85, '#2a1a3a', 3);
    } else {
      R.drawGalaxy(g, c.x, c.y, H * 0.13, '#a898ff', t, 77, 'galaxy', 0.5);
      R.text(g, 'MILKY WAY', c.x - 17, c.y + H * 0.08, '#a898ff', '#000');
    }
    // targets
    for (const tg of S.targets) {
      if (tg.region !== r) continue;
      const p = SC.targetPos(tg);
      const cls = AT.CLASSES[tg.cls];
      const left = AT.E.targetLeft(tg) / (tg.size * (AT.E.mults().flags.deep ? 100 : 1));
      if (tg.story) {
        const blink = Math.sin(t * 5) > 0;
        R.text(g, '*', p.x - 1, p.y - 2, blink ? '#ffd866' : '#ff8f3d', '#000');
      } else if (cls.kind === 'star' || cls.kind === 'pulsar') {
        R.disc(g, p.x, p.y, 2, cls.tint); g.fillStyle = '#fff'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      } else if (cls.kind === 'galaxy' || cls.kind === 'elliptical' || cls.kind === 'quasar') {
        R.drawGalaxy(g, p.x, p.y, 5, cls.tint, t, tg.seed, cls.kind === 'galaxy' ? 'galaxy' : 'elliptical', 0.5);
      } else {
        g.fillStyle = '#05070f'; g.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 1, 4, 3); g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 2, 2, 5);
        g.fillStyle = tg.surveyed ? cls.tint : '#6a6f8a';
        g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
        if (cls.kind === 'comet') { g.fillStyle = '#4a6a8a'; for (let k = 2; k < 7; k++) if (k % 2) g.fillRect(Math.round(p.x + k), Math.round(p.y - k * 0.3), 1, 1); }
      }
      if (tg.outpost) { g.fillStyle = '#6be08a'; g.fillRect(Math.round(p.x) + 2, Math.round(p.y) - 4, 2, 2); }
      if (left < 0.25 && !tg.story) { g.fillStyle = '#ff6b6b'; g.fillRect(Math.round(p.x) - 2, Math.round(p.y) + 3, 1, 1); }
      if (S.builds.some((b) => b.target === tg.id) && Math.sin(t * 6) > 0) { g.fillStyle = '#ffd866'; g.fillRect(Math.round(p.x) + 2, Math.round(p.y) - 4, 2, 2); }
      if (tg.id === S.selTarget) bracket(p.x, p.y, 5 + Math.round(Math.sin(t * 4)), '#ffd866');
    }
    // surveys
    for (const sv of S.surveys) {
      const tg = AT.E.targetById(sv.target);
      if (!tg || tg.region !== r) continue;
      const o = originPos(r), p = SC.targetPos(tg), f = sv.t / sv.T;
      g.fillStyle = Math.sin(t * 12) > 0 ? '#6be08a' : '#2f8a4a';
      g.fillRect(Math.round(o.x + (p.x - o.x) * f), Math.round(o.y + (p.y - o.y) * f), 1, 1);
    }
    // missions
    for (const m of S.missions) {
      const tg = AT.E.targetById(m.target), ship = AT.E.shipById(m.ship);
      if (!tg || !ship || tg.region !== r) continue;
      const o = originPos(r), p = SC.targetPos(tg);
      let f, dir = 1, mining = false;
      if (m.t < m.out) f = m.t / m.out;
      else if (m.t < m.out + m.mine) { f = 1; mining = true; }
      else { f = 1 - (m.t - m.out - m.mine) / m.out; dir = -1; }
      const pos = bez(o, p, f, m.id);
      // trail
      for (let k = 1; k < 6; k++) {
        const q = bez(o, p, Math.max(0, Math.min(1, f - dir * k * 0.015)), m.id);
        g.fillStyle = k < 3 ? '#ff8f3d' : '#7a3a1a';
        if (!mining) g.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
      }
      let x = pos.x, y = pos.y;
      if (mining) { x += Math.cos(t * 2 + m.id) * 4; y += Math.sin(t * 2 + m.id) * 2; }
      const danger = m.outcome === 'lost' && m.failAt - m.t < 2.5;
      if (danger && Math.sin(t * 20) > 0) { g.fillStyle = '#ff6b6b'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5); }
      const img = SPR.mapShip(ship.hull, (p.x - o.x) * dir >= 0 ? 1 : -1);
      g.drawImage(img, Math.round(x) - 2, Math.round(y) - 2);
      if (mining && Math.random() < 0.3) spawn(p.x, p.y, 1, { speed: 8, life: 0.5, colors: ['#ffd866', '#fff2b0'], view: 'map' });
    }
    // explosions
    for (const b of booms) {
      if (b.region !== r) continue;
      const tg = AT.E.targetById(b.target);
      if (!tg) continue;
      if (b.t === 0) { const p = SC.targetPos(tg); spawn(p.x, p.y, 40, { speed: 30, life: 0.9, colors: ['#ff6b6b', '#ffd866', '#ff8f3d', '#e8ecff'], view: 'map' }); }
      b.t += dt;
    }
    // hover label
    const hl = hover || (S.selTarget && AT.E.targetById(S.selTarget));
    if (hl && hl.region === r) {
      const p = SC.targetPos(hl);
      const label = hl.name.length > 26 ? hl.name.slice(0, 26) : hl.name;
      const w = R.textWidth(label) + 4;
      let lx = Math.round(p.x + 7), ly = Math.round(p.y - 10);
      if (lx + w > W - 2) lx = Math.round(p.x - 7 - w);
      if (ly < 2) ly = Math.round(p.y + 6);
      // keep clear of the EARTH label box (drawn above); try the other sides of the target
      const ep = r === 0 ? earthPos() : null;
      const ex = ep ? Math.round(ep.x) - 9 : 0, ey = ep ? Math.round(ep.y) + 6 : 0;
      const hits = (x, y) => ep && x - 1 < ex + 21 && ex - 1 < x + w && y - 1 < ey + 7 && ey - 1 < y + 7;
      if (hits(lx, ly)) {
        const alt = [[p.x + 7, p.y + 6], [p.x - 7 - w, p.y - 10], [p.x - 7 - w, p.y + 6]];
        const free = alt.map(([x, y]) => [Math.round(Math.min(Math.max(x, 2), W - 2 - w)), Math.round(Math.min(Math.max(y, 2), H - 9))]).find(([x, y]) => !hits(x, y));
        if (free) [lx, ly] = free;
      }
      g.fillStyle = '#05070fcc'; g.fillRect(lx - 1, ly - 1, w, 8);
      R.text(g, label, lx + 1, ly + 1, hl.story ? '#ffd866' : '#e8ecff');
    }
    // legend
    R.text(g, AT.REGIONS[r].name, 4, H - 8, '#5a6496');
  }
  function bez(o, p, f, seed) {
    const mx = (o.x + p.x) / 2, my = (o.y + p.y) / 2;
    const nx = -(p.y - o.y), ny = p.x - o.x;
    const l = Math.hypot(nx, ny) || 1;
    const bend = (((seed * 7919) % 7) - 3) * 0.06 + 0.15;
    const cx = mx + nx / l * l * bend, cy = my + ny / l * l * bend;
    const u = 1 - f;
    return { x: u * u * o.x + 2 * u * f * cx + f * f * p.x, y: u * u * o.y + 2 * u * f * cy + f * f * p.y };
  }
  function bracket(x, y, s, col) {
    g.fillStyle = col;
    x = Math.round(x); y = Math.round(y);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.fillRect(x + dx * s - (dx > 0 ? 2 : 0), y + dy * s, 3, 1);
      g.fillRect(x + dx * s, y + dy * s - (dy > 0 ? 2 : 0), 1, 3);
    }
  }

  // =====================================================================
  // LAUNCH COMPLEX
  // =====================================================================
  const SKY = {
    night: ['#060819', '#0e1638'], dawn: ['#2a2350', '#ff8f6a'], day: ['#3d6ac8', '#a8d8f4'], dusk: ['#3a2858', '#ff7a4a'],
  };
  function skyColors(phase, S) {
    // phase 0..1: 0 midnight, 0.25 dawn, 0.5 noon, 0.75 dusk
    const keys = [[0, 'night'], [0.2, 'night'], [0.28, 'dawn'], [0.36, 'day'], [0.64, 'day'], [0.72, 'dusk'], [0.8, 'night'], [1, 'night']];
    let a = keys[0], b = keys[1];
    for (let i = 0; i < keys.length - 1; i++) if (phase >= keys[i][0] && phase <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
    const f = (phase - a[0]) / Math.max(1e-6, b[0] - a[0]);
    let top = R.mix(R.rgb(SKY[a[1]][0]), R.rgb(SKY[b[1]][0]), f), bot = R.mix(R.rgb(SKY[a[1]][1]), R.rgb(SKY[b[1]][1]), f);
    if (S.projects.p_sun) { top = R.mix(top, [40, 10, 10], 0.35); bot = R.mix(bot, [120, 40, 20], 0.35); }
    if (S.projects.p_earth) { bot = R.mix(bot, [70, 50, 40], 0.35); }
    return { top, bot, dark: phase < 0.27 || phase > 0.76 ? 1 : (phase < 0.36 ? (0.36 - phase) / 0.09 : phase > 0.66 ? (phase - 0.66) / 0.1 : 0) };
  }
  function drawLaunch(S, dt) {
    const phase = (S.stats.totalTime / 300 + 0.4) % 1;
    const sky = skyColors(phase, S);
    const horizon = Math.round(H * 0.7);
    // sky bands with dithering
    const bands = 10;
    for (let i = 0; i < bands; i++) {
      const y0 = Math.floor(horizon * i / bands), y1 = Math.floor(horizon * (i + 1) / bands);
      const c = R.mix(sky.top, sky.bot, i / (bands - 1));
      const c2 = R.mix(sky.top, sky.bot, Math.min(1, (i + 1) / (bands - 1)));
      g.fillStyle = R.hex(c); g.fillRect(0, y0, W, y1 - y0);
      g.fillStyle = R.hex(c2);
      for (let y = y0; y < y1; y++) for (let x = (y & 1); x < W; x += 2) if (((y - y0) / (y1 - y0)) > 0.6 && ((x + y) % 4 === 0)) g.fillRect(x, y, 1, 1);
    }
    // stars at night
    if (sky.dark > 0.3 && !S.projects.p_milkyway) {
      for (const s of stars) if (s.y < horizon - 4 && Math.random() < sky.dark) { g.fillStyle = s.z === 3 ? '#e8ecff' : '#6a74a8'; g.fillRect(s.x | 0, s.y | 0, 1, 1); }
    }
    // sun & moon
    const sa = (phase - 0.25) * Math.PI * 2;
    const sx = W * 0.5 - Math.cos(sa) * W * 0.42, sy = horizon - Math.sin(sa) * horizon * 0.85;
    if (sy < horizon + 8) {
      const sunCol = S.projects.p_sun ? '#ff7a4a' : '#ffe9a0';
      R.drawStar(g, sx, sy, S.projects.p_sun ? 5 : 7, sunCol, t, { corona: 0.4 });
    }
    const my = horizon + Math.sin(sa) * horizon * 0.8, mx = W * 0.5 + Math.cos(sa) * W * 0.42;
    if (my < horizon) { R.disc(g, mx, my, 4, '#d8dce8'); R.disc(g, mx + 2, my - 1, 3, R.hex(sky.top)); }
    // orbital megastructure in later regions
    if (S.region >= 2) {
      g.fillStyle = sky.dark > 0.5 ? '#3a4a7a' : '#c8d0e8';
      for (let x = 0; x < W; x++) { const y = Math.round(H * 0.12 + Math.pow((x - W / 2) / W, 2) * H * 0.4); if ((x + Math.floor(t * 4)) % 3) g.fillRect(x, y, 1, 1); }
    }
    // clouds
    for (const c of clouds) {
      c.x -= c.v * dt; if (c.x < -c.w) c.x = W + c.w;
      const col = sky.dark > 0.5 ? '#1a2244' : '#e8f0ff';
      const shadow = sky.dark > 0.5 ? '#121a36' : '#b8c8e8';
      for (let k = 0; k < 4; k++) { R.disc(g, c.x + k * c.w / 4, c.y + (k % 2), Math.round(c.w / 6), shadow); R.disc(g, c.x + k * c.w / 4, c.y - 1 + (k % 2), Math.round(c.w / 7), col); }
    }
    // mountains
    const mtn = R.hex(R.mix(sky.top, [20, 22, 40], 0.6)), mtn2 = R.hex(R.mix(sky.bot, [20, 22, 40], 0.65));
    for (let x = 0; x < W; x++) {
      const h1 = Math.round(horizon - 6 - hills[x] * H * 0.18);
      g.fillStyle = mtn; g.fillRect(x, h1, 1, horizon - h1);
      const h2 = Math.round(horizon - 2 - hills[(x * 3 + 50) % hills.length] * H * 0.08);
      g.fillStyle = mtn2; g.fillRect(x, h2, 1, horizon - h2);
    }
    if (S.projects.p_earth) {
      // a billboard on the ridge
      const bx = Math.round(W * 0.72), by = Math.round(horizon - H * 0.17);
      g.fillStyle = '#0a0f26'; g.fillRect(bx - 1, by - 1, 46, 10); g.fillRect(bx + 10, by + 8, 2, 10); g.fillRect(bx + 32, by + 8, 2, 10);
      g.fillStyle = '#ffd866'; g.fillRect(bx, by, 44, 8);
      R.text(g, 'ASTROTECH', bx + 4, by + 2, '#0a0f26');
    }
    // sea and land
    const seaW = Math.round(W * 0.22);
    for (let y = horizon; y < H; y++) {
      g.fillStyle = R.hex(R.mix(sky.bot, [10, 30, 70], 0.6 + (y - horizon) / (H - horizon) * 0.3));
      g.fillRect(0, y, seaW + (y - horizon), 1);
      g.fillStyle = sky.dark > 0.5 ? '#14161e' : '#5a5a4a';
      g.fillRect(seaW + (y - horizon), y, W, 1);
    }
    for (let i = 0; i < 12; i++) { // sea glints
      const gx = Math.floor((i * 37 + t * 6) % seaW), gy = horizon + 2 + (i * 7) % (H - horizon - 4);
      g.fillStyle = sky.dark > 0.5 ? '#2a3a6a' : '#e8f8ff'; g.fillRect(gx, gy, 2, 1);
    }
    // apron
    const apronY = Math.round(H * 0.84);
    g.fillStyle = sky.dark > 0.5 ? '#262a36' : '#8a8a80'; g.fillRect(seaW + 10, apronY, W, H - apronY);
    g.fillStyle = sky.dark > 0.5 ? '#1c1f28' : '#6a6a62';
    for (let x = seaW + 12; x < W; x += 9) g.fillRect(x, apronY + 1, 1, H - apronY);
    // fuel farm and the company building
    const tx0 = Math.round(W * 0.8);
    for (let k = 0; k < 2; k++) { R.disc(g, tx0 + k * 12, horizon + 7, 5, '#0a0f26'); R.disc(g, tx0 + k * 12, horizon + 7, 4, sky.dark > 0.5 ? '#3a3e4a' : '#e8e8e8'); g.fillStyle = sky.dark > 0.5 ? '#2a2e38' : '#b8b8c0'; g.fillRect(tx0 + k * 12 + 1, horizon + 6, 3, 4); }
    const hx = Math.round(W * 0.62), hy = horizon + 2;
    g.fillStyle = '#0a0f26'; g.fillRect(hx - 1, hy - 1, 30, 12);
    g.fillStyle = sky.dark > 0.5 ? '#1e2230' : '#c8ccd8'; g.fillRect(hx, hy, 28, 10);
    for (let k = 0; k < 6; k++) { g.fillStyle = sky.dark > 0.5 ? (Math.sin(k * 3.1 + Math.floor(t)) > 0 ? '#ffd866' : '#3a3e4a') : '#5a72c4'; g.fillRect(hx + 2 + k * 4, hy + 2, 2, 2); g.fillRect(hx + 2 + k * 4, hy + 6, 2, 2); }
    g.fillStyle = '#ffd866'; g.fillRect(hx + 9, hy - 4, 10, 3); R.text(g, 'AT', hx + 11, hy - 4, '#0a0f26');
    // refinery towers in the back
    const towers = Math.min(6, 1 + S.region + Math.floor(S.ships.length / 5));
    for (let i = 0; i < towers; i++) {
      const tx = Math.round(W * 0.93 - i * 9), th = 14 + (i * 7) % 12;
      g.fillStyle = sky.dark > 0.5 ? '#1a1e2c' : '#5a5e70'; g.fillRect(tx, horizon - th, 4, th + 2);
      if (sky.dark > 0.3 && Math.sin(t * 3 + i) > 0.6) { g.fillStyle = '#ff6b6b'; g.fillRect(tx + 1, horizon - th - 1, 2, 1); }
    }
    // pads
    const nPads = Math.min(S.pads, 4);
    const padX = (i) => Math.round(seaW + 26 + (W - seaW - 46) * (nPads === 1 ? 0.45 : i / (nPads - 1)) * 0.92);
    const flying = new Set(launches.filter((L) => L.t < 3.5).map((L) => L.id));
    const landingIds = new Set(landings.map((L) => L.id));
    // stable pad assignment: a ship keeps its pad until it has left
    const keep = {};
    for (const id in padOf) {
      const sh = AT.E.shipById(+id);
      if (padOf[id] < nPads && sh && (sh.state !== 'mission' || flying.has(sh.id))) keep[id] = padOf[id];
    }
    padOf = keep;
    const used = new Set(Object.values(padOf));
    for (const sh of S.ships) {
      if (sh.state === 'mission' || padOf[sh.id] !== undefined) continue;
      let k = 0; while (used.has(k) && k < nPads) k++;
      if (k >= nPads) break;
      padOf[sh.id] = k; used.add(k);
    }
    const onPad = S.ships.filter((sh) => padOf[sh.id] !== undefined && sh.state !== 'mission');
    for (let i = 0; i < nPads; i++) {
      const x = padX(i);
      // slab and trench
      g.fillStyle = '#0a0f26'; g.fillRect(x - 18, apronY - 4, 37, 5);
      g.fillStyle = sky.dark > 0.5 ? '#3a3e4a' : '#b4b4a8'; g.fillRect(x - 17, apronY - 4, 35, 3);
      g.fillStyle = sky.dark > 0.5 ? '#2a2e38' : '#9a9a90'; g.fillRect(x - 17, apronY - 2, 35, 1);
      g.fillStyle = '#1a1a22'; g.fillRect(x - 6, apronY - 1, 13, 3);
      // pad number
      R.text(g, String(i + 1), x - 16, apronY + 3, sky.dark > 0.5 ? '#5a6496' : '#3a3e4a');
      // gantry sized to the tallest rocket on the field
      const gh = 70;
      const gx = x + 14;
      g.fillStyle = sky.dark > 0.5 ? '#5a2a2a' : '#a83a3a';
      g.fillRect(gx, apronY - gh, 1, gh); g.fillRect(gx + 4, apronY - gh, 1, gh);
      for (let y = apronY - gh; y < apronY; y += 4) { g.fillRect(gx, y, 5, 1); g.fillRect(gx + ((y / 4) % 2 ? 1 : 3), y + 2, 1, 1); }
      g.fillRect(gx - 6, apronY - gh + 10, 6, 1); g.fillRect(gx - 6, apronY - Math.round(gh * 0.55), 6, 1);
      g.fillStyle = sky.dark > 0.5 ? '#2a2e3a' : '#e8e8e8'; g.fillRect(gx + 1, apronY - gh - 4, 3, 4);
      if (Math.sin(t * 2 + i) > 0.3) { g.fillStyle = '#ff6b6b'; g.fillRect(gx + 2, apronY - gh - 5, 1, 1); }
    }
    // rockets standing on pads
    onPad.forEach((s) => {
      if (landingIds.has(s.id)) return;
      const img = sky.dark > 0.5 ? SPR.rocketDim(s.hull, true) : SPR.rocket(s.hull, true);
      const x = padX(padOf[s.id]);
      g.drawImage(img, Math.round(x - img.width / 2), apronY - 4 - img.height + 1);
      if (s.state === 'repair') {
        if (Math.random() < 0.4) spawn(x + (Math.random() - 0.5) * img.width, apronY - 3 - Math.random() * img.height, 2, { speed: 14, life: 0.4, colors: ['#ffd866', '#ffffff'], gravity: 40, view: 'launch' });
        R.text(g, 'REPAIR', x - 11, apronY + 3, '#ffd866', '#000');
      }
    });
    if (S.pads > nPads) R.text(g, '+' + (S.pads - nPads) + ' PADS', W - 34, apronY + 6, '#e8ecff', '#000');
    // launches
    for (const L of launches) {
      L.t += dt;
      const img = SPR.rocket(L.hull, true);
      const x = padX(Math.min(L.pad, nPads - 1));
      if (L.t > 1.2) { L.v += 40 * dt * (1 + L.t); L.y += L.v * dt; }
      const ry = apronY - 4 - img.height + 1 - L.y;
      if (ry + img.height < -20) continue;
      // flame
      const fy = ry + img.height - 1;
      const fl = 4 + Math.random() * 6 + (L.t > 1.2 ? 8 : 0);
      for (let k = 0; k < fl; k++) {
        const w = Math.max(1, Math.round((img.nozzleW || 3) * (1 - k / fl)));
        g.fillStyle = k < 2 ? '#ffffff' : k < fl * 0.5 ? '#ffd866' : '#ff8f3d';
        g.fillRect(Math.round(x - w / 2), Math.round(fy + k), w, 1);
      }
      // smoke
      const smoke = sky.dark > 0.5 ? ['#3a3e4e', '#2a2e3a', '#4a4e5e'] : ['#e8e8e8', '#c8c8d0', '#a8a8b4'];
      if (L.t < 2.5) spawn(x, apronY - 2, 3, { dir: Math.random() < 0.5 ? 0 : Math.PI, spread: 0.8, speed: 30, life: 2.2, colors: smoke, size: 3, grow: 6, drag: 0.94, view: 'launch' });
      else if (Math.random() < 0.6) spawn(x, fy + fl, 1, { dir: Math.PI / 2, spread: 0.6, speed: 6, life: 1.5, colors: smoke, size: 2, grow: 3, view: 'launch' });
      g.drawImage(img, Math.round(x - img.width / 2), Math.round(ry));
      if (L.t < 0.05) AT.audio && AT.audio.play('launch');
    }
    // landings (returning ships descend onto their pad)
    for (const L of landings) {
      L.t += dt;
      const i = padOf[L.id];
      if (i === undefined) continue;
      const img = SPR.rocket(L.hull, true);
      const x = padX(i);
      const f = Math.min(1, L.t / 3);
      const ease = 1 - Math.pow(1 - f, 3);
      const ry = (apronY - 4 - img.height + 1) - (1 - ease) * H;
      const fy = ry + img.height - 1;
      if (f < 1) for (let k = 0; k < 3 + Math.random() * 3; k++) { g.fillStyle = k < 1 ? '#ffffff' : '#ffd866'; g.fillRect(Math.round(x - 1), Math.round(fy + k), 2, 1); }
      if (f > 0.85 && f < 1) spawn(x, apronY - 2, 2, { dir: Math.random() < 0.5 ? 0 : Math.PI, spread: 0.6, speed: 20, life: 1, colors: ['#c8c8d0', '#a8a8b4'], size: 2, grow: 3, view: 'launch' });
      g.drawImage(img, Math.round(x - img.width / 2), Math.round(ry));
    }
    // floodlights at night
    if (sky.dark > 0.5) for (let i = 0; i < nPads; i++) { g.fillStyle = '#fff2b0'; g.fillRect(padX(i) - 12, apronY - 4, 1, 1); }
    R.text(g, 'LAUNCH COMPLEX 1', 4, H - 8, sky.dark > 0.5 ? '#5a6496' : '#2a2e3a');
  }

  // =====================================================================
  // CLOSE-UP
  // =====================================================================
  SC.focus = function () {
    const S = AT.E.S;
    if (S.selTarget) { const tg = AT.E.targetById(S.selTarget); if (tg) return tg; }
    return null;
  };
  function domPal(tg) {
    const top = Object.entries(tg.comp).sort((a, b) => b[1] - a[1]);
    const p0 = AT.ORES[top[0][0]].pal, p1 = top[1] ? AT.ORES[top[1][0]].pal : p0;
    return { body: ['#0e1120', p0[0], p0[1], p0[2], p0[3]], ore: [p1[3], top[2] ? AT.ORES[top[2][0]].pal[3] : '#ffd866'] };
  }
  function drawCloseup(S, dt) {
    const tg = SC.focus();
    const reg = tg ? tg.region : 0;
    const bgs = [['#05060f', '#0b0e22'], ['#04060f', '#0a1428'], ['#030409', '#0a0c18'], ['#0a0410', '#1a0a1e'], ['#010103', '#08050f']];
    fillBg(bgs[reg][0], bgs[reg][1]);
    starfield(dt, 0, 2);
    const cx = W * 0.42, cy = H * 0.52;
    if (!tg) { drawHome(S, cx, cy); return; }
    const cls = AT.CLASSES[tg.cls];
    const rad = Math.round(H * (cls.kind === 'galaxy' || cls.kind === 'elliptical' || cls.kind === 'quasar' ? 0.42 : 0.3));
    const rot = t * 0.12;
    if (reg <= 2) { // distant sun
      const sr = [10, 3, 1][reg];
      R.drawStar(g, W - 26, 22, sr, '#ffe9a0', t, { corona: 0.6 });
    }
    const pal = domPal(tg);
    const light = [W - 26 - cx, 22 - cy, 60];
    if (cls.kind === 'star' || cls.kind === 'pulsar') {
      R.drawStar(g, cx, cy, rad, cls.tint, t, { corona: 0.45 });
      if (cls.kind === 'pulsar') {
        const a = t * 3;
        for (let k = rad; k < H; k++) {
          for (const s of [1, -1]) { g.fillStyle = k % 3 ? '#e8ecff' : '#9ca6ff'; g.fillRect(Math.round(cx + Math.cos(a) * k * s), Math.round(cy + Math.sin(a) * k * s * 0.5), 1, 1); }
        }
      }
      if (tg.outpost) dyson(cx, cy, rad, tg.outpost.lvl);
    } else if (cls.kind === 'galaxy' || cls.kind === 'elliptical' || cls.kind === 'quasar') {
      R.drawGalaxy(g, cx, cy, rad, cls.tint, t * 4, tg.seed, cls.kind, 0.55);
      if (tg.outpost) for (let k = 0; k < 4; k++) { const a = t * 0.3 + k * 1.57; R.line(g, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.55, cx, cy, '#6be08a', 4); }
    } else if (cls.kind === 'beacon') {
      beacon(cx, cy, rad, pal);
    } else {
      const tex = R.rockTexture(tg.seed % 5000, { icy: cls.kind !== 'rock' });
      if (cls.kind === 'comet') {
        for (let k = 0; k < 3; k++) spawn(cx - rad * 0.6, cy + (Math.random() - 0.5) * rad, 1, { dir: Math.PI + 0.25, spread: 0.3, speed: 30, life: 2.4, colors: ['#86c3ee', '#3d79a8', '#c8e8ff'], view: 'target' });
      }
      if (cls.kind === 'binary') {
        R.drawBody(g, cx - rad * 0.45, cy, rad * 0.62, pal.body, { tex, rot, light, ore: pal.ore });
        R.drawBody(g, cx + rad * 0.5, cy + 2, rad * 0.5, pal.body, { tex: R.rockTexture((tg.seed + 7) % 5000, { icy: true }), rot: rot * 1.1, light, ore: pal.ore });
      } else {
        R.drawBody(g, cx, cy, rad, pal.body, { tex, rot, light, ore: pal.ore });
      }
      if (tg.outpost) outpostOnBody(cx, cy, rad, rot, tg);
    }
    // ships working this target
    const here = S.missions.filter((m) => m.target === tg.id);
    here.forEach((m, i) => {
      const ship = AT.E.shipById(m.ship);
      if (!ship) return;
      const mining = m.t >= m.out && m.t < m.out + m.mine;
      if (!mining) return;
      const a = -0.9 + i * 0.55 + Math.sin(t * 0.5 + i) * 0.05;
      const ox = cx + Math.cos(a) * (rad + 16), oy = cy + Math.sin(a) * (rad + 16) * 0.9;
      const img = SPR.rocket(ship.hull);
      g.save(); g.translate(Math.round(ox), Math.round(oy)); g.rotate(a - Math.PI / 2); g.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2)); g.restore();
      if (Math.sin(t * 7 + i) > -0.2) {
        const tx = cx + Math.cos(a) * rad * 0.85, ty = cy + Math.sin(a) * rad * 0.8;
        R.line(g, ox - Math.cos(a) * 6, oy - Math.sin(a) * 6, tx, ty, Math.random() < 0.5 ? '#ffd866' : '#fff2b0');
        if (Math.random() < 0.5) spawn(tx, ty, 2, { speed: 25, life: 0.6, colors: [pal.body[3], pal.body[4], '#ffd866'], view: 'target' });
      }
    });
    // overlay
    const left = AT.E.targetLeft(tg), size = tg.size * (AT.E.mults().flags.deep ? 100 : 1);
    R.text(g, tg.name, 5, 5, tg.story ? '#ffd866' : '#e8ecff', '#000');
    R.text(g, cls.long + (tg.rich && tg.surveyed ? '  RICH ' + AT.ORES[tg.rich].name : ''), 5, 12, '#8b97c9', '#000');
    if (!tg.story) {
      R.text(g, 'RESERVE', 5, 20, '#5a6496', '#000');
      g.fillStyle = '#1d2a63'; g.fillRect(36, 20, 50, 5);
      g.fillStyle = left / size < 0.25 ? '#ff6b6b' : '#6be08a'; g.fillRect(36, 20, Math.round(50 * Math.max(0, left / size)), 5);
    } else R.text(g, 'EXPEDITION TARGET', 5, 20, '#ffd866', '#000');
    R.text(g, 'HAZARD ' + Math.round((tg.surveyed ? tg.haz : tg.hazEst) * 100) + '%' + (tg.surveyed ? '' : ' (EST)'), 5, 28, '#ff8f3d', '#000');
    if (tg.outpost) R.text(g, AT.OUTPOST.names[tg.region].toUpperCase() + ' LV ' + tg.outpost.lvl, 5, 36, '#6be08a', '#000');
    if (here.length) R.text(g, here.length + ' SHIP' + (here.length > 1 ? 'S' : '') + ' ASSIGNED', 5, H - 8, '#ffd866', '#000');
  }
  function drawHome(S, cx, cy) {
    const rad = Math.round(H * 0.32);
    R.drawStar(g, W - 22, 20, 8, S.projects.p_sun ? '#ff7a4a' : '#ffe9a0', t, { corona: 0.6 });
    R.drawBody(g, cx, cy, rad, null, { kind: 'earth', tex: R.earthTexture(), rot: t * 0.05, cloudRot: t * 0.02, light: [W - 22 - cx, 20 - cy, 80], atmo: '#86c3ee', cityLights: S.projects.p_earth ? 0.55 : 0.8 });
    const ma = t * 0.08;
    const mx = cx + Math.cos(ma) * rad * 1.7, my = cy + Math.sin(ma) * rad * 0.35;
    if (Math.sin(ma) > -0.2 || Math.abs(mx - cx) > rad) R.drawBody(g, mx, my, Math.max(4, rad * 0.22), ['#0e1120', '#3a3a44', '#6a6a78', '#a8a8b8', '#d8d8e0'], { tex: R.rockTexture(31), rot: ma, light: [W - 22 - mx, 20 - my, 80] });
    // ships in low orbit
    S.missions.slice(0, 8).forEach((m, i) => {
      const a = t * (0.3 + i * 0.05) + i;
      const x = cx + Math.cos(a) * (rad + 8 + i * 3), y = cy + Math.sin(a) * (rad + 8 + i * 3) * 0.3;
      if (Math.sin(a) < 0 && Math.abs(x - cx) < rad) return;
      g.fillStyle = '#ffd866'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    });
    R.text(g, 'EARTH  -  HOME OFFICE', 5, 5, '#e8ecff', '#000');
    R.text(g, 'SELECT A TARGET TO INSPECT IT', 5, 12, '#8b97c9', '#000');
  }
  function outpostOnBody(cx, cy, rad, rot, tg) {
    const n = Math.min(6, 2 + Math.floor(tg.outpost.lvl / 10));
    const rand = SPR.rng(tg.seed + 1);
    for (let i = 0; i < n; i++) {
      const lat = (rand() - 0.5) * 1.6, lon = rand() * Math.PI * 2;
      const p = R.surfacePoint(cx, cy, rad * 0.95, lat, lon, -rot, 0.25);
      if (!p) continue;
      const kind = i % 3;
      const X = Math.round(p.x), Y = Math.round(p.y);
      if (kind === 0) { R.disc(g, X, Y - 1, 4, '#0a0f26'); R.disc(g, X, Y - 1, 3, '#c8d0e8'); g.fillStyle = '#86c3ee'; g.fillRect(X - 2, Y - 3, 2, 1); g.fillStyle = '#ffd866'; g.fillRect(X + 1, Y - 1, 1, 1); }
      else if (kind === 1) { g.fillStyle = '#0a0f26'; g.fillRect(X - 1, Y - 11, 4, 11); g.fillStyle = '#8a90a8'; g.fillRect(X, Y - 10, 2, 10); g.fillStyle = '#c8d0e8'; g.fillRect(X, Y - 10, 1, 10); if (Math.sin(t * 4 + i) > 0) { g.fillStyle = '#ff6b6b'; g.fillRect(X, Y - 12, 2, 1); } }
      else {
        g.fillStyle = '#0a0f26'; g.fillRect(X - 3, Y - 3, 7, 5); g.fillStyle = '#ffd866'; g.fillRect(X - 2, Y - 2, 5, 3); g.fillStyle = '#a8841f'; g.fillRect(X - 2, Y, 5, 1);
        if (Math.random() < 0.15) spawn(p.x, p.y, 1, { dir: Math.atan2(p.y - cy, p.x - cx), spread: 0.1, speed: 70, life: 1.2, colors: ['#ffd866', '#fff2b0'], drag: 1, view: 'target' });
      }
    }
  }
  function dyson(cx, cy, rad, lvl) {
    const n = Math.min(240, 40 + lvl * 4);
    for (let i = 0; i < n; i++) {
      const ring = i % 3, a = t * (0.4 + ring * 0.15) + i * 0.7;
      const rr = rad * (1.25 + ring * 0.18), tilt = [0.35, -0.5, 0.8][ring];
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * tilt;
      if (Math.sin(a) * tilt < 0 && Math.hypot(x - cx, y - cy) < rad) continue;
      g.fillStyle = i % 5 ? '#ffd866' : '#fff2b0'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  function beacon(cx, cy, rad, pal) {
    const a = t * 0.4;
    const verts = [];
    for (const [x, y, z] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const rx = x * Math.cos(a) - z * Math.sin(a), rz = x * Math.sin(a) + z * Math.cos(a);
      const ry = y * Math.cos(a * 0.6) - rz * Math.sin(a * 0.6);
      verts.push({ x: cx + rx * rad, y: cy + ry * rad * 0.9 });
    }
    const edges = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]];
    for (const [i, j] of edges) R.line(g, verts[i].x, verts[i].y, verts[j].x, verts[j].y, '#4fe0c0');
    const pulse = (Math.sin(t * 2) + 1) / 2;
    R.disc(g, cx, cy, Math.round(3 + pulse * 3), pulse > 0.5 ? '#e8fff8' : '#4fe0c0');
    if (Math.random() < 0.2) spawn(cx, cy, 2, { speed: 40, life: 1, colors: ['#4fe0c0', '#e8fff8'], view: 'target' });
  }
})(window.AT = window.AT || {});

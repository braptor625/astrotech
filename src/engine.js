// AstroTech v2 — engine. Pure game logic, no DOM. Runs in the browser and in Node.
(function (AT) {
  'use strict';
  const E = AT.E = {};
  AT.hooks = AT.hooks || {};
  ['log', 'ach', 'event', 'launch', 'resolve', 'card'].forEach((k) => { if (!AT.hooks[k]) AT.hooks[k] = () => {}; });

  const SAVE_VERSION = 2;
  const QUARTER = 90;
  const ORE_IDS = Object.keys(AT.ORES);
  const BASE_DIST = [10, 150, 3000, 1.2e5, 4e7];
  const DEPTH_BASE = [25, 1e3, 1e4, 1e5, 1e6];
  const HULL = Object.fromEntries(AT.HULLS.map((h) => [h.id, h]));
  const RES = Object.fromEntries(AT.RESEARCH.map((r) => [r.id, r]));
  const EXP = Object.fromEntries(AT.EXPEDITIONS.map((x) => [x.id, x]));
  E.HULL = HULL; E.RES = RES; E.EXP = EXP; E.BASE_DIST = BASE_DIST;
  const rnd = Math.random;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const logLerp = (a, b, t) => Math.exp(lerp(Math.log(a), Math.log(b), t));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // =====================================================================
  // STATE
  // =====================================================================
  function freshMarket() {
    const m = {};
    for (const id of ORE_IDS) m[id] = { d: 1, t: 1, inflow: 0, hist: [] };
    return m;
  }
  function freshShares() {
    return { total: 1e6, owned: 1e6, conf: 1, qT: 0, qEarn: 0, lastQ: 0, streak: 0, cd: 0, lastResult: null };
  }
  function freshRun() {
    return { launched: 0, missions: 0, sold: 0, surveyed: 0, contracts: 0, losses: 0, cls: {}, reg: {}, pilotsHired: 0, clean: 0 };
  }
  E.newState = function () {
    return {
      v: SAVE_VERSION, time: 0, runT: 0, saved: Date.now(), uid: 1,
      money: 0, earnedRun: 0, earnedTotal: 0, capex: 0, incomeEMA: 0, peakEquity: 0,
      ores: Object.fromEntries(ORE_IDS.map((k) => [k, 0])), market: freshMarket(),
      pads: 1, obs: 1, probes: 1, focus: 'auto',
      ships: [], hullsBought: {}, modules: {},
      pilots: [], candidates: [], candT: 0,
      staff: Object.fromEntries(AT.STAFF.map((c) => [c.id, 0])),
      targets: [], discT: 0, surveys: [], missions: [], builds: [],
      rp: 0, research: {}, projects: {}, projSeen: {},
      contracts: [], contractT: 30, rep: 0,
      cards: [], incT: 0, incSeen: {}, buffs: [], salaryRun: 1,
      shares: freshShares(),
      autosell: 'off', autorepair: true, fleetAI: false, aiRisk: 0.2, autobuy: { pads: false, ships: false, modules: false }, autohire: false, strikeT: 0,
      region: 0, layers: AT.LAYERS.map(() => ({ cur: 0, total: 0, runs: 0, upg: {}, lastGain: 0, auto: true, autoMode: 'smart', t: 0, bestRate: 0, bestTime: null })),
      challenge: null, chDone: {},
      artifacts: {}, expDone: {}, dirIdx: 0,
      run: freshRun(), memorial: [],
      story: {}, log: [], strike: false,
      stats: { missions: 0, launched: 0, losses: 0, deaths: 0, contracts: 0, incidents: 0, totalTime: 0, oreMined: 0, oreSold: 0, surveyed: 0 },
      ach: {}, ended: false, ngPlus: 0,
      settings: { notation: 'short', sound: true, scanlines: true, buyAmt: 1, noConfirm: false },
      reveal: {}, selTarget: null, selShip: null,
    };
  };

  E.load = function (json) {
    let s;
    try { s = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return null; }
    if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION) return null;
    const base = E.newState();
    const merged = Object.assign(base, s);
    merged.market = Object.assign(freshMarket(), s.market || {});
    merged.ores = Object.assign(E.newState().ores, s.ores || {});
    merged.shares = Object.assign(freshShares(), s.shares || {});
    merged.settings = Object.assign(E.newState().settings, s.settings || {});
    merged.stats = Object.assign(E.newState().stats, s.stats || {});
    merged.staff = Object.assign(E.newState().staff, s.staff || {});
    merged.run = Object.assign(freshRun(), s.run || {});
    merged.autobuy = Object.assign(E.newState().autobuy, s.autobuy || {});
    merged.layers = AT.LAYERS.map((l, i) => Object.assign(E.newState().layers[i], (s.layers || [])[i] || {}));
    return merged;
  };
  E.save = function () { E.S.saved = Date.now(); return JSON.stringify(E.S); };
  E.uid = function () { return E.S.uid++; };

  // =====================================================================
  // LOG / STORY / ACHIEVEMENTS
  // =====================================================================
  E.log = function (text, kind) {
    const S = E.S;
    const entry = { t: S.stats.totalTime, text, kind: kind || 'info' };
    S.log.push(entry);
    if (S.log.length > 120) S.log.shift();
    AT.hooks.log(entry);
  };
  E.say = function (key) {
    const S = E.S;
    if (S.story[key]) return;
    S.story[key] = 1;
    E.log(AT.STORY[key], 'story');
  };
  E.unlockAch = function (id) {
    const S = E.S;
    if (S.ach[id]) return;
    S.ach[id] = 1;
    const a = AT.ACHIEVEMENTS.find((x) => x.id === id);
    if (a) { E.log('ACHIEVEMENT: ' + a.name + '. ' + a.desc, 'ach'); AT.hooks.ach(id, a); }
  };

  // =====================================================================
  // MULTIPLIERS (cached until something changes)
  // =====================================================================
  const MULT = ['value', 'cargo', 'speed', 'drill', 'risk', 'rp', 'depth', 'recovery', 'salary', 'hire', 'shipCost', 'moduleCost', 'padCost', 'discovery',
    'surveyTime', 'surveyCost', 'repair', 'outpost', 'outpostCost', 'contract', 'xp', 'gain0', 'gain1', 'gain2', 'gain3', 'gainAll', 'artifactChance', 'all',
    'insurance', 'mrisk', 'rep', 'valuation', 'dist', 'launchCost'];
  const ADD = ['padsStart', 'targetCap', 'contractSlots', 'offline'];
  let Mcache = null;
  E.touch = function () { Mcache = null; };
  function applyFx(M, fx, lvl, layerIdx) {
    for (const k in fx) {
      const v = fx[k];
      if (MULT.includes(k)) M[k] *= Math.pow(v, lvl);
      else if (ADD.includes(k)) M[k] += v * lvl;
      else if (k === 'startCash' || k === 'startObs') M[k] = Math.max(M[k], k === 'startCash' ? lvl : v);
      else if (k === 'resonance') M.all *= Math.pow(1 + E.S.layers[layerIdx].total, v);
      else M.flags[k] = true;
    }
  }
  E.mults = function () {
    if (Mcache) return Mcache;
    const S = E.S;
    const M = { flags: {}, startCash: 0, startObs: 1 };
    for (const k of MULT) M[k] = 1;
    for (const k of ADD) M[k] = 0;
    const rules = S.challenge ? E.challengeDef(S.challenge).rules : {};
    M.rules = rules;
    for (const r of AT.RESEARCH) if (S.research[r.id]) applyFx(M, r.fx, 1);
    for (const p of AT.PROJECTS) if (S.projects[p.id]) applyFx(M, p.fx, 1);
    for (const id in S.artifacts) { const a = AT.ARTIFACTS[id]; if (a) applyFx(M, a.fx, 1); }
    AT.LAYERS.forEach((L, li) => {
      const st = S.layers[li];
      if (!rules['noLayer' + li]) for (const u of L.upgrades) if (st.upg[u.id]) applyFx(M, u.fx, st.upg[u.id], li);
      const all = E.milestoneAll(li);
      for (const ms of L.milestones) if (all || st.runs >= ms.n) applyFx(M, ms.fx, 1, li);
      for (const c of L.challenges) if (S.chDone[c.id]) applyFx(M, c.rfx, 1, li);
    });
    for (const k of ['value', 'risk', 'dist', 'shipCost']) if (rules[k]) M[k] *= rules[k];
    for (const b of S.buffs) if (MULT.includes(b.k)) M[b.k] *= b.m;
    if (S.ngPlus) M.all *= Math.pow(3, S.ngPlus);
    M.repLevel = E.repLevel();
    M.value *= Math.pow(AT.REP_VALUE, M.repLevel);
    M.salary *= S.salaryRun;
    const st = S.strike ? { engineer: 0, trader: 0, scientist: 0, analyst: 0 } : S.staff;
    M.engRepair = 1 + 0.15 * st.engineer;
    M.moduleCost *= Math.max(0.5, Math.pow(0.98, st.engineer));
    M.depth *= 1 + 0.12 * st.trader;
    M.recovery *= 1 + 0.06 * st.trader;
    M.contract *= 1 + 0.03 * st.trader;
    M.discovery *= 1 + 0.12 * st.analyst;
    M.surveyTime *= Math.max(0.25, Math.pow(0.95, st.analyst));
    M.scientists = st.scientist;
    M.incorp = !!M.flags.incorp;
    M.auto = !rules.noAuto;
    Mcache = M;
    return M;
  };
  E.milestoneAll = function (li) {
    // a higher layer milestone can mark all of this layer's milestones complete
    const S = E.S;
    for (let j = li + 1; j < AT.LAYERS.length; j++) {
      for (const ms of AT.LAYERS[j].milestones) if (ms.fx['allMilestones' + li] && S.layers[j].runs >= ms.n) return true;
    }
    return false;
  };
  E.challengeDef = function (ch) {
    const L = AT.LAYERS[ch.layer];
    return L.challenges.find((c) => c.id === ch.id);
  };

  // =====================================================================
  // HELPERS
  // =====================================================================
  E.price = function (id, M) { M = M || E.mults(); return AT.ORES[id].price * M.value * M.all * E.S.market[id].d; };
  E.basePrice = function (id, M) { M = M || E.mults(); return AT.ORES[id].price * M.value * M.all; };
  E.depth = function (id, M) {
    const m = E.S.market[id];
    return Math.max(DEPTH_BASE[AT.ORES[id].region], m.inflow * 90) * M.depth;
  };
  E.repLevel = function () {
    let l = 0;
    for (let i = 0; i < AT.REP_LEVELS.length; i++) if (E.S.rep >= AT.REP_LEVELS[i]) l = i;
    return l;
  };
  E.targetLeft = function (t, M) {
    M = M || E.mults();
    return Math.max(0, t.size * (M.flags.deep ? 100 : 1) - t.mined);
  };
  E.hullUnlocked = function (h, M) {
    const S = E.S;
    if (h.region > S.region) return false;
    return !h.unlock || !!S.research[h.unlock];
  };
  E.shipPrice = function (hullId, M) {
    M = M || E.mults();
    const h = HULL[hullId];
    return h.cost * Math.pow(AT.HULL_COST_GROWTH, E.S.hullsBought[hullId] || 0) * M.shipCost;
  };
  E.moduleLevel = function (hullId, modId) { const m = E.S.modules[hullId]; return (m && m[modId]) || 0; };
  E.moduleMax = function (mod) { return mod.max; };
  E.moduleCost = function (hullId, mod, M) {
    M = M || E.mults();
    return HULL[hullId].cost * mod.base * Math.pow(mod.growth, E.moduleLevel(hullId, mod.id)) * M.moduleCost;
  };
  E.maxPads = function (M) { return (M || E.mults()).rules.maxPads || (12 + 6 * E.S.region); };
  E.padCost = function (M) { M = M || E.mults(); return AT.PADS.cost * Math.pow(AT.PADS.growth, E.S.pads - 1) * M.padCost; };
  E.obsCost = function (M) { M = M || E.mults(); return AT.OBS.cost * Math.pow(AT.OBS.growth, E.S.obs - 1); };
  E.probeCost = function (M) { return AT.PROBE.cost * Math.pow(AT.PROBE.growth, E.S.probes - 1); };
  E.targetCap = function (M) { M = M || E.mults(); return AT.OBS.cap + E.S.obs * AT.OBS.capPer + M.targetCap; };
  E.discoveryInterval = function (M) {
    M = M || E.mults();
    return AT.OBS.interval / Math.pow(1.15, E.S.obs - 1) / M.discovery;
  };
  E.inFlight = function () { return E.S.missions.length; };
  E.padsFree = function () { return E.S.pads - E.S.missions.length; };
  E.staffSalary = function (M) {
    const S = E.S;
    let s = 0;
    for (const c of AT.STAFF) {
      const n = S.staff[c.id];
      if (n > 0) s += c.cost * (Math.pow(c.growth, n) - 1) / (c.growth - 1);
    }
    return s * AT.SALARY_RATE * M.salary * M.hire;
  };
  E.pilotSalary = function (p, M) {
    return p.paid * AT.SALARY_RATE * Math.pow(1.08, p.level - 1) * (p.trait === 'greedy' ? 2 : 1) * M.salary;
  };
  E.salaryRate = function (M) {
    M = M || E.mults();
    let s = E.staffSalary(M);
    for (const p of E.S.pilots) s += E.pilotSalary(p, M);
    return s;
  };
  E.hireCost = function (role, M) {
    M = M || E.mults();
    const c = AT.STAFF.find((x) => x.id === role);
    return c.cost * Math.pow(c.growth, E.S.staff[role]) * M.hire;
  };
  E.rpRate = function (M) {
    M = M || E.mults();
    if (E.S.strike || M.rules.noResearch) return 0;
    return 0.25 * M.scientists * M.rp * Math.pow(Math.max(1, E.S.incomeEMA), 0.09);
  };
  E.shipById = function (id) { return E.S.ships.find((s) => s.id === id); };
  E.targetById = function (id) { return E.S.targets.find((t) => t.id === id); };
  E.pilotById = function (id) { return E.S.pilots.find((p) => p.id === id); };
  E.ownedOutposts = function (region) {
    return E.S.targets.filter((t) => t.outpost && (region === undefined || t.region === region)).length;
  };
  E.compValue = function (t, M) { // $ per tonne of this target at current prices
    let v = 0;
    for (const id in t.comp) v += t.comp[id] * E.price(id, M);
    return v;
  };
  E.compBaseValue = function (t, M) {
    let v = 0;
    for (const id in t.comp) v += t.comp[id] * E.basePrice(id, M);
    return v;
  };
  E.shownComp = function (t) { return t.surveyed ? t.comp : t.est; };

  // =====================================================================
  // TARGETS
  // =====================================================================
  function nameFor(region, cls) {
    const S = E.S;
    const L = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';
    const yr = 2187 + Math.floor(S.stats.totalTime / 3600);
    if (region === 0) return yr + ' ' + pick(L) + pick(L) + (10 + Math.floor(rnd() * 89)) + ' ' + pick(AT.TARGET_NAMES[0]);
    if (region === 1) return '(' + (500000 + Math.floor(rnd() * 400000)) + ') ' + pick(AT.TARGET_NAMES[1]);
    if (region === 2) {
      if (cls === 'OB') return 'Beacon ' + pick(L) + '-' + (1 + Math.floor(rnd() * 99));
      return 'C/' + yr + ' ' + pick(L) + (1 + Math.floor(rnd() * 9)) + ' (' + pick(AT.LAST_NAMES) + ')';
    }
    if (region === 3) return 'AT-' + (1000 + Math.floor(rnd() * 8999)) + ' ' + pick(AT.TARGET_NAMES[3]);
    return 'AT-G ' + (100 + Math.floor(rnd() * 899)) + ' ' + pick(AT.TARGET_NAMES[4]);
  }
  function normalize(o) {
    let s = 0;
    for (const k in o) s += o[k];
    const r = {};
    for (const k in o) r[k] = o[k] / s;
    return r;
  }
  E.genTarget = function (region, clsId, opts) {
    opts = opts || {};
    const S = E.S;
    let cls;
    if (clsId) cls = AT.CLASSES[clsId];
    else {
      const pool = Object.entries(AT.CLASSES).filter(([, c]) => c.region === region && (!c.needs || S.research[c.needs]));
      let tot = pool.reduce((a, [, c]) => a + c.w, 0), r = rnd() * tot;
      for (const [id, c] of pool) { r -= c.w; if (r <= 0) { clsId = id; cls = c; break; } }
      if (!cls) { clsId = pool[0][0]; cls = pool[0][1]; }
    }
    const comp = {};
    for (const k in cls.comp) comp[k] = cls.comp[k] * (0.55 + rnd() * 0.9);
    let rich = null;
    if (rnd() < 0.1) { const ks = Object.keys(comp); rich = ks[ks.length - 1 - Math.floor(rnd() * Math.min(2, ks.length))]; comp[rich] *= 3; }
    const t = {
      id: E.uid(), cls: clsId, region, name: opts.name || nameFor(region, clsId),
      dist: opts.dist || lerp(cls.dist[0], cls.dist[1], rnd()),
      haz: opts.haz !== undefined ? opts.haz : lerp(cls.haz[0], cls.haz[1], rnd()),
      size: opts.size || logLerp(cls.size[0], cls.size[1], rnd()),
      mined: 0, comp: normalize(comp), est: normalize(cls.comp), rich,
      surveyed: !!opts.surveyed, seed: Math.floor(rnd() * 1e9), ang: rnd() * Math.PI * 2,
      outpost: null, story: opts.story || null, found: S.time,
    };
    // the estimate for an unsurveyed target hides the rich vein and the true hazard
    t.hazEst = clamp(t.haz + (rnd() - 0.5) * 0.25, 0.02, 0.95);
    return t;
  };
  E.discover = function (region) {
    const S = E.S;
    const t = E.genTarget(region);
    S.targets.push(t);
    AT.hooks.event('discover', t);
    return t;
  };
  E.dropTarget = function (id) {
    const S = E.S, t = E.targetById(id);
    if (!t || t.outpost || t.story) return false;
    if (S.missions.some((m) => m.target === id) || S.surveys.some((s) => s.target === id) || S.builds.some((b) => b.target === id)) return false;
    S.targets = S.targets.filter((x) => x.id !== id);
    if (S.selTarget === id) S.selTarget = null;
    return true;
  };
  function discoveryRegion() {
    const S = E.S;
    if (S.focus !== 'auto' && +S.focus <= S.region) return +S.focus;
    const counts = [];
    for (let r = 0; r <= S.region; r++) counts[r] = S.targets.filter((t) => t.region === r && !t.story).length;
    // favour regions with fewer tracked targets, newest region slightly
    let best = 0, bestScore = Infinity;
    for (let r = 0; r <= S.region; r++) {
      const score = counts[r] - (r === S.region ? 0.5 : 0) + rnd() * 1.5;
      if (score < bestScore) { bestScore = score; best = r; }
    }
    return best;
  }
  function trackedCount() { return E.S.targets.filter((t) => !t.story && !t.outpost).length; }

  // =====================================================================
  // MISSION PLANNING
  // =====================================================================
  E.relDist = function (t) { return t.dist / BASE_DIST[t.region]; };
  E.effDist = function (t, M) {
    let d = t.dist * M.dist;
    if (t.region === 1 && M.flags.staging && E.ownedOutposts(0) > 0) d *= 0.6;
    return d;
  };
  E.plan = function (ship, t, M) {
    M = M || E.mults();
    const S = E.S, h = HULL[ship.hull];
    const lv = (id) => E.moduleLevel(h.id, id);
    const mod = (id) => AT.MODULES.find((m) => m.id === id).per;
    const pilot = ship.pilot ? E.pilotById(ship.pilot) : null;
    const trait = pilot ? pilot.trait : null;
    let speed = h.speed * Math.pow(mod('engine'), lv('engine')) * M.speed * (trait === 'daredevil' ? 1.2 : 1);
    let cargo = h.cargo * Math.pow(mod('cargo'), lv('cargo')) * M.cargo * (trait === 'greedy' ? 1.18 : 1);
    const drill = h.drill * Math.pow(mod('drill'), lv('drill')) * M.drill;
    const left = E.targetLeft(t, M) - (t._reserved || 0);
    const exp = t.story ? EXP[t.story] : null;
    if (!exp) cargo = Math.max(0, Math.min(cargo, left));
    const d = E.effDist(t, M);
    const out = d / speed;
    const mine = exp ? exp.mine : cargo / drill;
    const T = 2 * out + mine;
    const haz = t.surveyed ? t.haz : t.hazEst;
    let hazEff = t.haz * Math.pow(mod('nav'), lv('nav'));
    if ((t.cls === 'M' || t.cls === 'V') && M.mrisk) hazEff *= M.mrisk;
    const fd = 1 + 0.35 * Math.log(1 + E.relDist(t) * 1.25);
    let risk = (1 - h.rel) * (0.4 + 2.2 * hazEff) * fd;
    if (!t.surveyed) risk *= M.flags.surveyRisk ? 1.25 : 1.5;
    if (t.region > h.region) risk *= Math.pow(3, t.region - h.region);
    if (pilot) risk *= Math.pow(0.94, pilot.level - 1) * (trait === 'steady' ? 0.88 : trait === 'daredevil' ? 1.1 : 1);
    else risk *= M.flags.aipilots ? 0.8 : 1.6;
    risk *= Math.pow(mod('plating'), lv('plating'));
    risk *= 1 + 2 * (1 - ship.cond);
    risk *= M.risk;
    risk = clamp(risk, 0.01, 0.97);
    // displayed risk for unsurveyed targets uses the estimate
    let shownRisk = risk;
    if (!t.surveyed) shownRisk = clamp(risk * (0.4 + 2.2 * haz * Math.pow(mod('nav'), lv('nav'))) / (0.4 + 2.2 * hazEff), 0.01, 0.97);
    const perT = t.surveyed ? E.compValue(t, M) : E.compValueEst(t, M);
    const valMult = trait === 'eye' ? 1.12 : 1;
    const value = cargo * perT * valMult;
    const launch = h.cost * 0.015 * Math.sqrt(E.relDist(t) + 0.5) * M.launchCost;
    return { T, out, mine, cargo, risk, shownRisk, value, launch, speed, perT, valMult, ev: (value * (1 - risk * 0.8) - launch) / T };
  };
  E.compValueEst = function (t, M) {
    let v = 0;
    for (const id in t.est) v += t.est[id] * E.price(id, M);
    return v;
  };
  E.canFly = function (ship, M) {
    M = M || E.mults();
    if (ship.state !== 'idle') return false;
    if (!ship.pilot && !M.flags.autopilot && !M.flags.aipilots) return false;
    return true;
  };
  E.launchBlock = function (ship, t, M) {
    M = M || E.mults();
    const S = E.S;
    if (!ship) return 'No ship selected';
    if (ship.state === 'mission') return 'Ship is on a mission';
    if (ship.state === 'repair') return 'Ship is in repair';
    if (!ship.pilot && !M.flags.autopilot && !M.flags.aipilots) return 'Ship needs a pilot';
    if (E.padsFree() <= 0) return 'All launch pads busy';
    if (!t.story && E.targetLeft(t, M) - (t._reserved || 0) <= 0) return 'Target is mined out';
    if (t.story && S.missions.some((m) => m.target === t.id)) return 'Expedition already under way';
    return null;
  };
  E.launch = function (shipId, targetId) {
    const S = E.S, M = E.mults();
    const ship = E.shipById(shipId), t = E.targetById(targetId);
    if (!ship || !t || E.launchBlock(ship, t, M)) return false;
    const p = E.plan(ship, t, M);
    S.money = Math.max(0, S.money - p.launch); // fees are financed if the account is short
    // roll the outcome now; reveal it when it happens
    const pilot = ship.pilot ? E.pilotById(ship.pilot) : null;
    let outcome = 'ok', got = p.cargo, wear = 0.03 + rnd() * 0.05, failAt = null;
    if (rnd() < p.risk) {
      const hazEff = t.haz;
      let lostChance = M.rules.allLost ? 1 : clamp(0.12 + 0.35 * hazEff, 0.1, 0.6);
      if (pilot && pilot.trait === 'lucky') lostChance = 0;
      const r = rnd();
      if (r < lostChance) { outcome = 'lost'; got = 0; failAt = p.out + rnd() * p.mine; }
      else if (r < lostChance + 0.5) { outcome = 'partial'; got = p.cargo * (0.25 + rnd() * 0.35); wear = 0.25 + rnd() * 0.15; }
      else { outcome = 'failed'; got = 0; wear = 0.4 + rnd() * 0.2; }
    }
    if (pilot && pilot.trait === 'tinker') wear *= 0.5;
    if (!t.story) t._reserved = (t._reserved || 0) + p.cargo;
    const m = {
      id: E.uid(), ship: ship.id, target: t.id, t: 0, T: p.T, out: p.out, mine: p.mine,
      outcome, got, plan: p.cargo, wear, failAt, risk: p.risk, value: p.value, kind: t.story ? 'exp' : 'mine', revealed: false,
    };
    S.missions.push(m);
    ship.state = 'mission'; ship.lastTarget = t.id;
    S.run.launched++; S.stats.launched++;
    E.say('firstLaunch'); E.unlockAch('ACH_FIRST_LAUNCH');
    AT.hooks.launch(m, ship, t);
    E.touch();
    return m;
  };
  function finishMission(m, M) {
    const S = E.S;
    const ship = E.shipById(m.ship), t = E.targetById(m.target);
    S.missions = S.missions.filter((x) => x !== m);
    if (t && !t.story) t._reserved = Math.max(0, (t._reserved || 0) - m.plan);
    if (!ship) return;
    const pilot = ship.pilot ? E.pilotById(ship.pilot) : null;
    if (m.outcome === 'lost') {
      loseShip(ship, t, pilot, M);
      AT.hooks.resolve(m, ship, t, 'lost');
      return;
    }
    // cargo
    if (m.got > 0 && t) {
      const comp = t.comp;
      for (const id in comp) {
        const q = m.got * comp[id];
        S.ores[id] += q;
        S.market[id].inflow += q / 60;
      }
      t.mined += m.got;
      S.stats.oreMined += m.got;
      S.run.cls[t.cls] = (S.run.cls[t.cls] || 0) + 1;
      S.run.reg[t.region] = (S.run.reg[t.region] || 0) + 1;
      if (!S.story.firstReturn) E.say('firstReturn');
    }
    ship.cond = Math.max(0, ship.cond - m.wear);
    ship.missions++;
    if (ship.cond < 0.6 && !ship.wornWarned && !M.flags.autorepair) { ship.wornWarned = true; E.log(`${ship.name} is down to ${Math.round(ship.cond * 100)}% hull. Worn hulls fail more often. Repair it in the Fleet console.`, 'warn'); }
    if (ship.cond >= 0.85) ship.wornWarned = false;
    ship.state = 'idle';
    S.run.missions++; S.stats.missions++;
    if (m.outcome === 'ok') S.run.clean++; else S.run.clean = 0;
    if (pilot) gainXp(pilot, m.outcome === 'ok' ? 1 : 0.4, M);
    for (const c of S.contracts) {
      if (c.type === 'class' && t && t.cls === c.cls && m.got > 0) c.prog++;
      if (c.type === 'clean') c.prog = Math.min(c.n, S.run.clean);
    }
    // rare artifact finds
    if (t && m.outcome === 'ok') {
      const pool = Object.entries(AT.ARTIFACTS).filter(([id, a]) => a.find === t.region && !S.artifacts[id]);
      if (pool.length) {
        const ch = AT.ARTIFACT_FIND_CHANCE * M.artifactChance * (pilot && pilot.trait === 'lucky' ? 3 : 1) * (t.region + 1);
        if (rnd() < ch) { const [id] = pick(pool); grantArtifact(id, ship.name + ' found it in the cargo hold.'); }
      }
    }
    if (m.outcome === 'partial') E.log(`${ship.name} returned damaged from ${t ? t.name : 'its target'} with ${AT.fmt(m.got)}t, part of the haul.`, 'warn');
    else if (m.outcome === 'failed') E.log(`${ship.name} aborted at ${t ? t.name : 'its target'} and limped home empty.`, 'warn');
    if (t && m.kind === 'exp') {
      if (m.outcome === 'ok') {
        S.targets = S.targets.filter((x) => x !== t);
        if (S.selTarget === t.id) S.selTarget = null;
        pushCard({ type: 'exp', id: t.story });
      } else E.log(`The ${t.name} expedition failed. It can be attempted again.`, 'warn');
    }
    if (t && !t.story && E.targetLeft(t, M) <= 0) depleteTarget(t);
    // repairs and relaunch
    if (ship.cond < 0.7 && S.autorepair && M.flags.autorepair && M.auto) E.repair(ship.id);
    AT.hooks.resolve(m, ship, t, m.outcome);
    if (ship.state === 'idle' && M.auto) {
      if (ship.repeat && M.flags.flight && t && E.targetById(t.id) && !t.story) E.launch(ship.id, t.id);
    }
    if (S.run.missions >= 100) E.say('hundred');
    if (S.stats.missions >= 100) E.unlockAch('ACH_MISSIONS_100');
    if (S.stats.missions >= 1000) E.unlockAch('ACH_MISSIONS_1K');
    if (S.stats.missions >= 10000) E.unlockAch('ACH_MISSIONS_10K');
  }
  function loseShip(ship, t, pilot, M) {
    const S = E.S;
    const refund = (ship.paid || 0) * Math.min(0.9, 0.3 * M.insurance);
    S.money += refund;
    S.ships = S.ships.filter((x) => x !== ship);
    if (S.selShip === ship.id) S.selShip = null;
    S.run.losses++; S.stats.losses++;
    S.lastLost = ship.name;
    E.say('firstLoss'); E.unlockAch('ACH_FIRST_LOSS');
    let msg = `Contact lost with ${ship.name} near ${t ? t.name : 'its target'}.`;
    if (pilot) {
      if (M.flags.pods) {
        pilot.ship = null; pilot.injured = S.time + 300;
        msg += ` ${pilot.name} ejected and is recovering.`;
      } else {
        S.pilots = S.pilots.filter((p) => p !== pilot);
        S.memorial.push({ name: pilot.name, ship: ship.name, target: t ? t.name : '', level: pilot.level, t: S.stats.totalTime });
        S.stats.deaths++;
        msg += ` ${pilot.name} did not survive.`;
        E.say('firstDeath');
        if (S.stats.deaths >= 10) E.unlockAch('ACH_DEATHS_10');
      }
    }
    if (refund > 0) msg += ` Insurance paid $${AT.fmt(refund)}.`;
    E.log(msg, 'down');
    if (t && t.story) E.log(`The ${t.name} expedition failed. It can be attempted again.`, 'warn');
    E.touch();
  }
  function depleteTarget(t) {
    const S = E.S;
    E.say('depleted');
    E.unlockAch('ACH_DEPLETE');
    E.log(`${t.name} has been mined out.`, 'info');
    if (!t.outpost && !S.missions.some((m) => m.target === t.id)) {
      S.targets = S.targets.filter((x) => x !== t);
      if (S.selTarget === t.id) S.selTarget = null;
    }
  }
  function gainXp(p, x, M) {
    const v = x * M.xp * (p.trait === 'veteran' ? 1.6 : 1);
    p.xp += v;
    while (p.level < AT.PILOT.maxLevel && p.xp >= E.xpNeed(p)) {
      p.xp -= E.xpNeed(p); p.level++;
      E.log(`${p.name} reached pilot level ${p.level}.`, 'up');
      if (p.level >= 10) E.unlockAch('ACH_PILOT_10');
      if (p.level >= 20) E.unlockAch('ACH_PILOT_20');
    }
    E.touch();
  }
  E.xpNeed = function (p) { return AT.PILOT.xpBase * Math.pow(AT.PILOT.xpGrowth, p.level - 1); };

  // repairs
  E.repairTime = function (ship, M) {
    M = M || E.mults();
    return (1 - ship.cond) * 90 / (M.repair * M.engRepair);
  };
  E.rushCost = function (ship, M) {
    return (ship.paid || HULL[ship.hull].cost) * 0.25 * (1 - ship.cond);
  };
  E.repair = function (shipId) {
    const ship = E.shipById(shipId);
    if (!ship || ship.state !== 'idle' || ship.cond >= 0.999) return false;
    ship.state = 'repair'; ship.repairT = E.repairTime(ship);
    return true;
  };
  E.rush = function (shipId) {
    const S = E.S, ship = E.shipById(shipId);
    if (!ship || ship.cond >= 0.999 || ship.state === 'mission') return false;
    const c = E.rushCost(ship);
    if (S.money < c) return false;
    S.money -= c; ship.cond = 1; ship.state = 'idle'; ship.repairT = 0;
    return true;
  };
  E.toggleRepeat = function (shipId) {
    const ship = E.shipById(shipId);
    if (ship) ship.repeat = !ship.repeat;
  };

  // =====================================================================
  // FLEET / PADS / OBSERVATORY / PROBES
  // =====================================================================
  E.buyShip = function (hullId) {
    const S = E.S, M = E.mults(), h = HULL[hullId];
    if (!h || !E.hullUnlocked(h, M)) return false;
    const c = E.shipPrice(hullId, M);
    if (S.money < c) return false;
    S.money -= c; S.capex += c;
    S.hullsBought[hullId] = (S.hullsBought[hullId] || 0) + 1;
    const ship = addShip(hullId, c);
    E.say('firstShip');
    if (S.ships.length >= 10) E.unlockAch('ACH_FLEET_10');
    E.touch();
    return ship;
  };
  function addShip(hullId, paid) {
    const S = E.S;
    const used = new Set(S.ships.map((s) => s.name));
    let name = 'ATS ' + pick(AT.SHIP_NAMES);
    for (let i = 0; i < 20 && used.has(name); i++) name = 'ATS ' + pick(AT.SHIP_NAMES);
    if (used.has(name)) name += ' ' + ['II', 'III', 'IV', 'V', 'VI'][Math.floor(rnd() * 5)];
    const ship = { id: E.uid(), name, hull: hullId, cond: 1, state: 'idle', repairT: 0, pilot: null, repeat: true, missions: 0, paid, lastTarget: null };
    S.ships.push(ship);
    assignPilots();
    return ship;
  }
  E.scrapShip = function (shipId) {
    const S = E.S, ship = E.shipById(shipId);
    if (!ship || ship.state === 'mission') return false;
    const p = ship.pilot ? E.pilotById(ship.pilot) : null;
    if (p) p.ship = null;
    S.money += (ship.paid || 0) * 0.25;
    S.ships = S.ships.filter((x) => x !== ship);
    if (S.selShip === shipId) S.selShip = null;
    assignPilots();
    return true;
  };
  E.buyModule = function (hullId, modId) {
    const S = E.S, M = E.mults();
    const mod = AT.MODULES.find((m) => m.id === modId);
    if (E.moduleLevel(hullId, modId) >= E.moduleMax(mod)) return false;
    const c = E.moduleCost(hullId, mod, M);
    if (S.money < c) return false;
    S.money -= c; S.capex += c;
    S.modules[hullId] = S.modules[hullId] || {};
    S.modules[hullId][modId] = (S.modules[hullId][modId] || 0) + 1;
    E.touch();
    return true;
  };
  E.buyPad = function () {
    const S = E.S, M = E.mults();
    if (S.pads >= E.maxPads(M)) return false;
    const c = E.padCost(M);
    if (S.money < c) return false;
    S.money -= c; S.capex += c; S.pads++;
    if (S.pads >= 6) E.unlockAch('ACH_PADS_6');
    AT.hooks.event('pad', S.pads);
    return true;
  };
  E.buyObs = function () {
    const S = E.S;
    if (S.obs >= AT.OBS.max) return false;
    const c = E.obsCost();
    if (S.money < c) return false;
    S.money -= c; S.capex += c; S.obs++;
    E.touch();
    return true;
  };
  E.buyProbe = function () {
    const S = E.S;
    if (S.probes >= AT.PROBE.max) return false;
    const c = E.probeCost();
    if (S.money < c) return false;
    S.money -= c; S.capex += c; S.probes++;
    return true;
  };
  E.surveyCost = function (t, M) {
    M = M || E.mults();
    return AT.PROBE.surveyCost * [1, 3e5, 5e8, 5e11, 5e14][t.region] * (1 + E.relDist(t)) * M.surveyCost;
  };
  E.surveyTime = function (t, M) {
    M = M || E.mults();
    return AT.PROBE.surveyBase * (0.6 + E.relDist(t) * 0.4) * M.surveyTime;
  };
  E.surveyBlock = function (t, M) {
    M = M || E.mults();
    const S = E.S;
    if (M.rules.noSurvey) return 'Surveys are disabled in this challenge';
    if (t.surveyed) return 'Already surveyed';
    if (S.surveys.some((s) => s.target === t.id)) return 'Probe en route';
    if (S.surveys.length >= S.probes) return 'All probes busy';
    if (S.money < E.surveyCost(t, M)) return 'Not enough cash';
    return null;
  };
  E.survey = function (targetId) {
    const S = E.S, M = E.mults(), t = E.targetById(targetId);
    if (!t || E.surveyBlock(t, M)) return false;
    S.money -= E.surveyCost(t, M);
    S.surveys.push({ target: t.id, t: 0, T: Math.max(0.5, E.surveyTime(t, M)) });
    return true;
  };
  function finishSurvey(sv) {
    const S = E.S;
    const t = E.targetById(sv.target);
    S.surveys = S.surveys.filter((x) => x !== sv);
    if (!t) return;
    t.surveyed = true;
    S.run.surveyed++; S.stats.surveyed++;
    for (const c of S.contracts) if (c.type === 'survey') c.prog++;
    E.say('firstSurvey'); E.unlockAch('ACH_SURVEY');
    let msg = `Survey complete: ${t.name}. Hazard ${Math.round(t.haz * 100)}%.`;
    if (t.rich) msg += ` Rich ${AT.ORES[t.rich].name} vein found!`;
    E.log(msg, t.rich ? 'up' : 'info');
    AT.hooks.event('survey', t);
  }

  // =====================================================================
  // CREW: pilots & staff
  // =====================================================================
  function newCandidate() {
    const S = E.S;
    const lvl = 1 + (rnd() < 0.25 ? 1 : 0) + (rnd() < 0.08 ? 2 : 0) + Math.floor(S.run.missions / 150);
    return {
      id: E.uid(), name: pick(AT.FIRST_NAMES) + ' ' + pick(AT.LAST_NAMES), level: Math.min(8, lvl), xp: 0,
      trait: pick(AT.TRAITS).id, face: Math.floor(rnd() * 1e9), ship: null, injured: 0, missions: 0,
    };
  }
  E.pilotCost = function (c, M) {
    M = M || E.mults();
    const n = E.S.pilots.filter((p) => !p.founder).length;
    return AT.PILOT.cost * Math.pow(AT.PILOT.growth, n) * (1 + 0.6 * (c.level - 1)) * M.hire;
  };
  E.refreshCandidates = function (paid) {
    const S = E.S;
    if (paid) {
      const c = E.pilotCost({ level: 1 }) * 0.2;
      if (S.money < c) return false;
      S.money -= c;
    }
    S.candidates = [newCandidate(), newCandidate(), newCandidate()];
    S.candT = 0;
    return true;
  };
  E.hirePilot = function (candId) {
    const S = E.S, M = E.mults();
    const c = S.candidates.find((x) => x.id === candId);
    if (!c) return false;
    const cost = E.pilotCost(c, M);
    if (S.money < cost) return false;
    S.money -= cost;
    c.paid = cost;
    S.pilots.push(c);
    S.candidates = S.candidates.filter((x) => x !== c);
    S.candidates.push(newCandidate());
    S.run.pilotsHired++;
    assignPilots();
    E.touch();
    return c;
  };
  E.firePilot = function (pid) {
    const S = E.S, p = E.pilotById(pid);
    if (!p) return false;
    const ship = p.ship ? E.shipById(p.ship) : null;
    if (ship && ship.state === 'mission') return false;
    if (ship) ship.pilot = null;
    S.pilots = S.pilots.filter((x) => x !== p);
    assignPilots();
    E.touch();
    return true;
  };
  function assignPilots() {
    const S = E.S;
    for (const p of S.pilots) {
      if (p.ship && !E.shipById(p.ship)) p.ship = null;
      if (p.ship || (p.injured && p.injured > S.time)) continue;
      // put the best free pilot in the most valuable pilotless ship
      const ship = S.ships.filter((s) => !s.pilot && s.state !== 'mission').sort((a, b) => HULL[b.hull].cost - HULL[a.hull].cost)[0];
      if (ship) { ship.pilot = p.id; p.ship = ship.id; }
    }
  }
  E.assignPilots = assignPilots;
  E.hire = function (role) {
    const S = E.S, M = E.mults();
    if (M.rules.noStaff) return false;
    const c = E.hireCost(role, M);
    if (S.money < c) return false;
    S.money -= c; S.staff[role]++;
    if (role === 'scientist') E.say('research');
    E.touch();
    return true;
  };
  E.fire = function (role) { if (E.S.staff[role] > 0) { E.S.staff[role]--; E.touch(); return true; } return false; };

  // =====================================================================
  // MARKET
  // =====================================================================
  E.sell = function (id, frac, M) {
    const S = E.S;
    M = M || E.mults();
    const q = S.ores[id] * frac;
    if (q <= 0) return 0;
    const m = S.market[id];
    const depth = E.depth(id, M);
    const k = Math.exp(-q / depth);
    const rev = E.basePrice(id, M) * m.d * depth * (1 - k);
    m.d *= k;
    S.ores[id] -= q;
    if (S.ores[id] < 1e-9) S.ores[id] = 0;
    E.earn(rev);
    S.stats.oreSold += q; S.run.sold++;
    if (m.d < 0.1) E.unlockAch('ACH_CRASH');
    if (!S.story.firstSale) { E.say('firstSale'); E.unlockAch('ACH_FIRST_SALE'); }
    return rev;
  };
  E.sellEstimate = function (id, frac, M) {
    M = M || E.mults();
    const q = E.S.ores[id] * frac;
    if (q <= 0) return 0;
    const depth = E.depth(id, M);
    return E.basePrice(id, M) * E.S.market[id].d * depth * (1 - Math.exp(-q / depth));
  };
  E.sellAll = function () {
    const M = E.mults(); let t = 0;
    for (const id of ORE_IDS) t += E.sell(id, 1, M);
    return t;
  };
  E.earn = function (x) {
    const S = E.S;
    S.money += x; S.earnedRun += x; S.earnedTotal += x; S.shares.qEarn += x;
    S._earnTick = (S._earnTick || 0) + x;
  };

  // =====================================================================
  // CONTRACTS & REPUTATION
  // =====================================================================
  E.contractSlots = function (M) {
    M = M || E.mults();
    const lvl = M.repLevel;
    return 2 + M.contractSlots + (lvl >= 3 ? 1 : 0) + (lvl >= 6 ? 1 : 0);
  };
  function incomeRef() { return Math.max(E.S.incomeEMA, 15); }
  function newContract() {
    const S = E.S, M = E.mults();
    const region = Math.min(S.region, Math.floor(rnd() * (S.region + 1)));
    const client = pick(AT.CLIENTS[Math.min(region, AT.CLIENTS.length - 1)]);
    const types = ['deliver', 'deliver', 'class', 'survey', 'clean'];
    let type = pick(types);
    const produced = ORE_IDS.filter((id) => S.market[id].inflow > 0.001 || S.ores[id] > 0);
    if (type === 'deliver' && !produced.length) type = 'class';
    if (type === 'survey' && M.rules.noSurvey) type = 'clean';
    const dl = (6 + rnd() * 8) * 60;
    const c = { id: E.uid(), type, client, prog: 0, expires: S.time + dl, dur: dl };
    if (type === 'deliver') {
      const ore = pick(produced);
      const rate = Math.max(S.market[ore].inflow, (S.ores[ore] || 1) / 120);
      c.ore = ore;
      c.n = Math.max(3, rate * (90 + rnd() * 240));
      c.reward = c.n * E.basePrice(ore, M) * (2.5 + rnd() * 1.5) * M.contract;
      c.rep = 2 + Math.floor(rnd() * 3);
    } else if (type === 'class') {
      const seen = Object.keys(AT.CLASSES).filter((k) => AT.CLASSES[k].region <= S.region && AT.CLASSES[k].kind !== 'beacon' && S.targets.some((t) => t.cls === k));
      c.cls = seen.length ? pick(seen) : 'S';
      c.n = 2 + Math.floor(rnd() * 3);
      c.reward = incomeRef() * 70 * Math.pow(c.n, 0.8) * M.contract;
      c.rep = 2 + Math.floor(c.n / 2);
    } else if (type === 'survey') {
      c.n = 1 + Math.floor(rnd() * 3);
      c.reward = incomeRef() * 50 * c.n * M.contract;
      c.rep = 1 + c.n;
    } else {
      c.n = 3 + Math.floor(rnd() * 6);
      c.reward = incomeRef() * 60 * Math.pow(c.n, 0.7) * M.contract;
      c.rep = 2 + Math.floor(c.n / 3);
    }
    S.contracts.push(c);
  }
  E.contractText = function (c) {
    if (c.type === 'deliver') return `Deliver ${AT.fmt(c.n)}t of ${AT.ORES[c.ore].name}`;
    if (c.type === 'class') return `Bring back ${c.n} cargo loads from ${AT.CLASSES[c.cls].name} targets`;
    if (c.type === 'survey') return `Survey ${c.n} new target${c.n > 1 ? 's' : ''}`;
    return `Complete ${c.n} missions in a row without a failure`;
  };
  E.contractReady = function (c) {
    if (c.type === 'deliver') return E.S.ores[c.ore] >= c.n;
    return c.prog >= c.n;
  };
  E.deliverContract = function (id) {
    const S = E.S, M = E.mults();
    const c = S.contracts.find((x) => x.id === id);
    if (!c || !E.contractReady(c)) return false;
    if (c.type === 'deliver') S.ores[c.ore] -= c.n;
    E.earn(c.reward);
    const lvl0 = E.repLevel();
    S.rep += c.rep * M.rep;
    S.contracts = S.contracts.filter((x) => x !== c);
    S.run.contracts++; S.stats.contracts++;
    E.say('contract');
    if (S.stats.contracts >= 25) E.unlockAch('ACH_CONTRACTS_25');
    if (E.repLevel() > lvl0) repUp();
    E.touch();
    return c.reward;
  };
  E.dismissContract = function (id) {
    const S = E.S;
    const c = S.contracts.find((x) => x.id === id);
    if (!c) return false;
    S.contracts = S.contracts.filter((x) => x !== c);
    S.rep = Math.max(0, S.rep - 1);
    E.touch();
    return true;
  };
  function repUp() {
    const l = E.repLevel();
    E.log(`Reputation rose to level ${l}. Clients pay ${Math.round((Math.pow(AT.REP_VALUE, l) - 1) * 100)}% more for our ore.`, 'up');
    if (l >= AT.REP_LEVELS.length - 1) E.unlockAch('ACH_REP_MAX');
  }
  E.addRep = function (n, M) {
    const S = E.S;
    M = M || E.mults();
    const l0 = E.repLevel();
    S.rep = Math.max(0, S.rep + (n > 0 ? n * M.rep : n));
    if (E.repLevel() > l0) repUp();
    E.touch();
  };

  // =====================================================================
  // DECISION CARDS: incidents & expedition results
  // =====================================================================
  function pushCard(card) {
    E.S.cards.push(card);
    AT.hooks.card(card);
  }
  function incidentCtx() {
    const S = E.S;
    const alive = S.pilots.filter((p) => !p.injured || p.injured < S.time);
    const flying = S.ships.filter((s) => s.missions > 0);
    const tg = S.targets.filter((t) => !t.story);
    return {
      pilot: alive.length ? pick(alive).name : null,
      pilotId: null,
      ship: flying.length ? pick(flying).name : (S.ships[0] && S.ships[0].name),
      target: tg.length ? pick(tg).name : 'the belt',
      lostship: S.lastLost || null,
    };
  }
  function maybeIncident() {
    const S = E.S, M = E.mults();
    if (S.cards.some((c) => c.type === 'inc')) return;
    const ctx = incidentCtx();
    const ok = AT.INCIDENTS.filter((i) => {
      if (i.min > S.region) return false;
      if ((S.incSeen[i.id] || 0) > S.stats.incidents / AT.INCIDENTS.length + 1) return false;
      if (i.need === 'pilot') return !!ctx.pilot;
      if (i.need === 'loss') return !!ctx.lostship;
      if (i.need === 'staff') return Object.values(S.staff).reduce((a, b) => a + b, 0) >= 3;
      if (i.need === 'survey') return S.run.surveyed >= 2;
      if (i.need === 'incorp') return M.incorp;
      if (i.need === 'death') return S.memorial.length > 0;
      return S.run.missions >= 5;
    });
    if (!ok.length) return;
    const inc = pick(ok);
    if (inc.need === 'pilot') { const p = S.pilots.find((x) => x.name === ctx.pilot); ctx.pilotId = p && p.id; }
    S.incSeen[inc.id] = (S.incSeen[inc.id] || 0) + 1;
    pushCard({ type: 'inc', id: inc.id, ctx, expires: S.time + 150 });
  }
  E.fill = function (text, ctx) {
    return text.replace(/\{(\w+)\}/g, (_, k) => (ctx && ctx[k]) || 'someone');
  };
  E.resolveCard = function (idx, choice) {
    const S = E.S, M = E.mults();
    const card = S.cards[idx];
    if (!card) return false;
    S.cards.splice(idx, 1);
    if (card.type === 'inc') {
      const inc = AT.INCIDENTS.find((i) => i.id === card.id);
      const opt = inc[choice];
      applyIncident(opt.fx, card.ctx, M);
      E.log(E.fill(opt.log, card.ctx), 'story');
      S.stats.incidents++;
      if (S.stats.incidents >= 25) E.unlockAch('ACH_INCIDENTS_25');
    } else if (card.type === 'exp') {
      const x = EXP[card.id];
      const opt = x[choice];
      S.expDone[x.id] = choice;
      E.log(opt.log, 'story');
      grantArtifact(opt.art);
      E.unlockAch('ACH_EXPEDITION');
      if (AT.EXPEDITIONS.every((e) => S.expDone[e.id])) E.unlockAch('ACH_EXP_ALL');
    }
    E.touch();
    return true;
  };
  function applyIncident(fx, ctx, M) {
    const S = E.S;
    if (fx.cash) {
      const amt = fx.cash * incomeRef();
      if (amt > 0) E.earn(amt); else S.money = Math.max(0, S.money + amt);
    }
    if (fx.rep) E.addRep(fx.rep, M);
    if (fx.rp) S.rp += fx.rp * Math.max(E.rpRate(M), 0.5);
    for (const b of [fx.buff, fx.buff2]) if (b) S.buffs.push({ k: b[0], m: b[1], until: S.time + b[2] });
    if (fx.salaryRun) S.salaryRun *= fx.salaryRun;
    const p = ctx.pilotId ? E.pilotById(ctx.pilotId) : null;
    if (p && fx.injure) {
      const sh = p.ship ? E.shipById(p.ship) : null;
      if (sh && sh.state !== 'mission') { sh.pilot = null; p.ship = null; }
      p.injured = S.time + fx.injure;
      assignPilots();
    }
    if (p && fx.xp) gainXp(p, fx.xp, M);
    E.touch();
  }
  function grantArtifact(id, how) {
    const S = E.S, a = AT.ARTIFACTS[id];
    if (!a || S.artifacts[id]) return;
    S.artifacts[id] = 1;
    E.log(`ARTIFACT RECOVERED: ${a.name}. ${a.desc}${how ? ' ' + how : ''}`, 'ach');
    AT.hooks.event('artifact', id);
    const n = Object.keys(S.artifacts).length;
    if (n >= 10) E.unlockAch('ACH_ART_10');
    if (n >= Object.keys(AT.ARTIFACTS).length) E.unlockAch('ACH_ART_ALL');
    E.touch();
  }
  E.grantArtifact = grantArtifact;

  // expeditions become available targets
  function expeditionReady(x) {
    const S = E.S, w = x.when;
    if (S.expDone[x.id]) return false;
    if (x.region > S.region) return false;
    if (w.region !== undefined && S.region < w.region) return false;
    if (w.missions !== undefined && S.run.missions < w.missions) return false;
    if (w.earned !== undefined && S.earnedRun < w.earned) return false;
    if (w.research !== undefined && !S.research[w.research]) return false;
    return true;
  }
  function checkExpeditions() {
    const S = E.S;
    for (const x of AT.EXPEDITIONS) {
      if (!expeditionReady(x) || S.targets.some((t) => t.story === x.id) || S.cards.some((c) => c.type === 'exp' && c.id === x.id)) continue;
      const t = E.genTarget(x.region, x.cls, { name: x.name, dist: x.dist, haz: x.haz, surveyed: true, story: x.id, size: 1e30 });
      S.targets.unshift(t);
      S.expSeen = S.expSeen || {};
      if (!S.expSeen[x.id]) { S.expSeen[x.id] = 1; E.log(`EXPEDITION AVAILABLE: ${x.name}. ${x.intro}`, 'prestige'); }
      AT.hooks.event('expedition', x.id);
    }
  }

  // =====================================================================
  // RESEARCH & PROJECTS
  // =====================================================================
  E.researchAvailable = function (r) {
    const S = E.S;
    if (S.research[r.id] || S.region < r.region) return false;
    return r.req.every((q) => S.research[q]);
  };
  E.buyResearch = function (id) {
    const S = E.S, M = E.mults();
    const r = RES[id];
    if (!r || M.rules.noResearch || !E.researchAvailable(r) || S.rp < r.cost) return false;
    S.rp -= r.cost; S.research[id] = 1;
    if (id === 'r_incorp') { E.say('incorp'); E.unlockAch('ACH_IPO'); }
    if (id === 'r_flight') E.say('flight');
    if (id === 'r_autopilot') E.say('autopilot');
    if (id === 'r_fleetai') { E.say('fleetai'); S.fleetAI = true; }
    if (id === 'r_outposts') E.say('outpost');
    if (id === 'r_aipilots') E.say('aipilots');
    if (AT.RESEARCH.every((x) => S.research[x.id])) E.unlockAch('ACH_ALL_RESEARCH');
    E.touch();
    return true;
  };
  E.projectVisible = function (p) {
    const S = E.S;
    if (S.projects[p.id]) return false;
    if (S.projSeen[p.id]) return true;
    const c = p.show;
    if (c.region !== undefined && S.region < c.region) return false;
    if (c.earned !== undefined && S.earnedRun < c.earned) return false;
    if (c.missions !== undefined && S.run.missions < c.missions) return false;
    if (c.losses !== undefined && S.stats.losses < c.losses) return false;
    if (c.staff !== undefined && Object.values(S.staff).reduce((a, b) => a + b, 0) < c.staff) return false;
    S.projSeen[p.id] = 1;
    return true;
  };
  E.buyProject = function (id) {
    const S = E.S;
    const p = AT.PROJECTS.find((x) => x.id === id);
    if (!p || S.projects[id] || S.money < p.cost) return false;
    S.money -= p.cost; S.projects[id] = 1;
    if (p.log) E.log(p.log, 'story');
    if (id === 'p_interlock') E.unlockAch('ACH_INTERLOCK');
    if (id === 'p_earth') E.unlockAch('ACH_EARTH');
    AT.hooks.event('project', id);
    E.touch();
    return true;
  };

  // =====================================================================
  // OUTPOSTS
  // =====================================================================
  E.outpostCost = function (t, M) {
    M = M || E.mults();
    const n = E.ownedOutposts(t.region) + E.S.builds.filter((b) => { const x = E.targetById(b.target); return x && x.region === t.region; }).length;
    return AT.OUTPOST.cost[t.region] * Math.pow(AT.OUTPOST.costGrowth, n) * M.outpostCost;
  };
  E.outpostBlock = function (t, M) {
    M = M || E.mults();
    const S = E.S;
    if (!M.flags.outposts) return 'Research Orbital Habitats first';
    if (M.rules.noOutposts) return 'Outposts are disabled in this challenge';
    if (t.story) return 'Expedition targets cannot host outposts';
    if (t.outpost) return 'Outpost already built';
    if (!t.surveyed) return 'Survey the target first';
    if (S.builds.some((b) => b.target === t.id)) return 'Under construction';
    if (E.ownedOutposts(t.region) + S.builds.length >= AT.OUTPOST.perRegion) return `Limit of ${AT.OUTPOST.perRegion} per region reached`;
    if (E.targetLeft(t, M) <= 0) return 'Target is mined out';
    if (S.money < E.outpostCost(t, M)) return 'Not enough cash';
    return null;
  };
  E.buildOutpost = function (targetId) {
    const S = E.S, M = E.mults(), t = E.targetById(targetId);
    if (!t || E.outpostBlock(t, M)) return false;
    const c = E.outpostCost(t, M);
    S.money -= c; S.capex += c;
    S.builds.push({ target: t.id, t: 0, T: AT.OUTPOST.buildTime[t.region], cost: c });
    AT.hooks.event('build', t);
    return true;
  };
  E.outpostRate = function (t, M) {
    M = M || E.mults();
    if (!t.outpost) return 0;
    const l = t.outpost.lvl;
    return AT.OUTPOST.rate[t.region] * l * Math.pow(1.5, Math.floor(l / 25)) * M.outpost;
  };
  E.outpostUpCost = function (t, M) {
    M = M || E.mults();
    return AT.OUTPOST.cost[t.region] * AT.OUTPOST.lvlCost * Math.pow(AT.OUTPOST.lvlGrowth, t.outpost.lvl) * M.outpostCost;
  };
  E.upgradeOutpost = function (targetId) {
    const S = E.S, M = E.mults(), t = E.targetById(targetId);
    if (!t || !t.outpost || t.outpost.lvl >= AT.OUTPOST.maxLevel) return false;
    const c = E.outpostUpCost(t, M);
    if (S.money < c) return false;
    S.money -= c; S.capex += c; t.outpost.lvl++;
    return true;
  };

  // =====================================================================
  // COMPANY: valuation, shares
  // =====================================================================
  E.valuation = function (M) {
    M = M || E.mults();
    const S = E.S;
    let v = S.earnedRun * 0.25 + S.incomeEMA * 240;
    if (M.incorp) v *= 1.5 * (M.rules.conf || S.shares.conf);
    return v * M.valuation;
  };
  E.ownership = function () { return E.S.shares.owned / E.S.shares.total; };
  E.equity = function (M) { return E.valuation(M) * E.ownership(); };
  E.sharePrice = function (M) { return E.valuation(M) / E.S.shares.total; };
  E.confFloor = function (M) { return M.flags.confFloor ? 1 : 0.25; };
  E.issueShares = function () {
    const S = E.S, M = E.mults();
    if (!M.incorp || S.shares.cd > 0) return false;
    const sh = S.shares;
    const cash = E.sharePrice(M) * sh.total * 0.1 * 0.9;
    sh.total *= 1.1;
    S.money += cash;
    if (!M.flags.noDilutePenalty) sh.conf = Math.max(E.confFloor(M), sh.conf - 0.1);
    sh.cd = 60;
    E.say('dilute');
    if (E.ownership() < 0.5) E.say('lowOwn');
    E.touch();
    return cash;
  };
  E.buybackInfo = function (M) {
    const sh = E.S.shares;
    const pub = sh.total - sh.owned;
    const n = Math.min(pub, sh.total * 0.05);
    return { n, cost: n * E.sharePrice(M) * 1.1 };
  };
  E.buyback = function () {
    const S = E.S, M = E.mults();
    if (!M.incorp) return false;
    const info = E.buybackInfo(M);
    if (info.n <= 0 || S.money < info.cost) return false;
    S.money -= info.cost;
    S.shares.total -= info.n;
    S.shares.conf = Math.min(3, S.shares.conf + 0.05);
    E.touch();
    return true;
  };

  // =====================================================================
  // PRESTIGE, MILESTONES, CHALLENGES
  // =====================================================================
  E.gainMult = function (i, M) { return (M['gain' + i] || 1) * M.gainAll; };
  E.pendingGain = function (i, M) {
    M = M || E.mults();
    const S = E.S, L = AT.LAYERS[i];
    if (S.region < i || S.peakEquity < L.req) return 0;
    if (S.challenge && S.challenge.layer < i) return 0;
    return Math.floor(Math.pow(S.peakEquity / L.req, L.exp) * E.gainMult(i, M));
  };
  E.nextGainAt = function (i, M) {
    const L = AT.LAYERS[i];
    const g = E.pendingGain(i, M) + 1;
    return L.req * Math.pow(g / E.gainMult(i, M), 1 / L.exp);
  };
  E.layerUpCost = function (li, u) {
    const lvl = E.S.layers[li].upg[u.id] || 0;
    return Math.ceil(u.base * Math.pow(u.growth, lvl));
  };
  E.buyLayerUp = function (li, uid) {
    const S = E.S, L = AT.LAYERS[li];
    const u = L.upgrades.find((x) => x.id === uid);
    const lvl = S.layers[li].upg[uid] || 0;
    if (!u || lvl >= u.max) return false;
    const c = E.layerUpCost(li, u);
    if (S.layers[li].cur < c) return false;
    S.layers[li].cur -= c;
    S.layers[li].upg[uid] = lvl + 1;
    E.touch();
    return true;
  };
  E.prestige = function (i, auto) {
    const S = E.S, M = E.mults();
    const g = E.pendingGain(i, M);
    if (g < 1) return false;
    const L = S.layers[i];
    const first = L.runs === 0;
    L.cur += g; L.total += g; L.runs++; L.lastGain = g;
    if (L.bestTime === null || L.t < L.bestTime) L.bestTime = L.t;
    for (let j = 0; j <= i; j++) { S.layers[j].t = 0; S.layers[j].bestRate = 0; }
    // lower layers lose their currency (and upgrades unless kept)
    for (let j = 0; j < i; j++) {
      S.layers[j].cur = 0; S.layers[j].lastGain = 0;
      if (!M.flags['keepLayer' + j]) S.layers[j].upg = {};
    }
    const prevRegion = S.region;
    S.region = Math.max(S.region, i + 1);
    if (S.challenge && S.challenge.layer <= i) S.challenge = null;
    E.resetRun(i, M);
    if (S.region > prevRegion) {
      E.say(AT.REGIONS[S.region].id);
      AT.hooks.event('region', S.region);
    }
    if (first) E.unlockAch(['ACH_KUIPER', 'ACH_OORT', 'ACH_STARS', 'ACH_GALAXY'][i]);
    if (!auto) E.log(`${AT.LAYERS[i].name} complete: +${AT.fmt(g)} ${AT.LAYERS[i].cur}.`, 'prestige');
    AT.hooks.event('prestige', i);
    return g;
  };
  E.startChallenge = function (layer, id) {
    const S = E.S, M = E.mults();
    if (S.challenge) return false;
    const L = AT.LAYERS[layer];
    if (!L.challenges.find((c) => c.id === id) || S.chDone[id]) return false;
    if (!M.flags['challenges' + layer]) return false;
    // entering a challenge resets like that layer, with no gain
    for (let j = 0; j < layer; j++) { S.layers[j].cur = 0; if (!M.flags['keepLayer' + j]) S.layers[j].upg = {}; }
    S.challenge = { layer, id };
    E.touch();
    E.resetRun(layer, E.mults());
    E.log(`CHALLENGE STARTED: ${E.challengeDef(S.challenge).name}. Reach ${'$' + AT.fmt(L.req)} equity to complete it.`, 'prestige');
    AT.hooks.event('prestige', layer);
    return true;
  };
  E.abandonChallenge = function () {
    const S = E.S;
    if (!S.challenge) return false;
    const layer = S.challenge.layer;
    S.challenge = null;
    E.touch();
    E.resetRun(layer, E.mults());
    E.log('Challenge abandoned.', 'warn');
    return true;
  };
  function checkChallenge(M) {
    const S = E.S;
    if (!S.challenge) return;
    const L = AT.LAYERS[S.challenge.layer];
    if (S.peakEquity < L.req) return;
    const c = E.challengeDef(S.challenge);
    S.chDone[c.id] = 1;
    S.challenge = null;
    E.log(`CHALLENGE COMPLETE: ${c.name}. ${c.reward}`, 'prestige');
    E.unlockAch('ACH_CHALLENGE');
    const all = AT.LAYERS.every((l) => l.challenges.every((x) => S.chDone[x.id]));
    if (all) E.unlockAch('ACH_CHALLENGE_ALL');
    AT.hooks.event('challenge', c.id);
    E.touch();
  }
  E.resetRun = function (layer, Mold) {
    const S = E.S;
    const keepProj = (Mold.flags.keepProjects) || (layer === 0 && Mold.flags.keepProjects0);
    const keep = {};
    for (const r of AT.RESEARCH) {
      if (!S.research[r.id]) continue;
      if (r.region > layer + 1) keep[r.id] = 1; // a reset only wipes research of the regions it leaves behind
      else if (Mold.flags.keepResearchAll && layer <= 2) keep[r.id] = 1;
      else if (r.region === 0 && Mold.flags.keepResearch0 && layer === 0) keep[r.id] = 1;
      else if (r.region === 1 && Mold.flags.keepResearch1) keep[r.id] = 1;
      else if (Mold.flags.keepBiz && layer === 0 && ['r_incorp', 'r_guidance', 'r_buyback', 'r_analytics', 'r_relations', 'r_autosell'].includes(r.id)) keep[r.id] = 1;
    }
    S.research = keep;
    if (!keepProj) { S.projects = {}; S.projSeen = {}; }
    S.money = 0; S.earnedRun = 0; S.capex = 0; S.incomeEMA = 0; S.peakEquity = 0; S.runT = 0;
    for (const id of ORE_IDS) S.ores[id] = 0;
    S.market = freshMarket();
    S.ships = []; S.hullsBought = {}; S.modules = {};
    S.pilots = []; S.candidates = []; S.candT = 0;
    S.staff = Object.fromEntries(AT.STAFF.map((c) => [c.id, 0]));
    S.targets = []; S.surveys = []; S.missions = []; S.builds = []; S.discT = 0;
    S.rp = 0; S.contracts = []; S.contractT = 30; S.rep = 0;
    S.cards = S.cards.filter((c) => c.type === 'exp'); S.buffs = []; S.salaryRun = 1;
    S.shares = freshShares(); S.strike = false; S.run = freshRun();
    S.selTarget = null; S.selShip = null;
    E.touch();
    const M = E.mults();
    if (M.flags.startResearch) for (const id of ['r_autosell', 'r_flight', 'r_autopilot', 'r_repair', 'r_orbits']) S.research[id] = 1;
    if (M.flags.startFleetAI) { for (const id of ['r_drill1', 'r_spectro', 'r_drill2', 'r_fleetai']) S.research[id] = 1; }
    E.touch();
    const M2 = E.mults();
    S.pads = Math.min(E.maxPads(M2), 1 + M2.padsStart);
    S.obs = Math.max(1, M2.startObs); S.probes = 1;
    S.money = [1000, 5e3, 1e5, 3e6, 1e8][M2.startCash] || 1000;
    if (!M2.flags.autosell) S.autosell = 'off';
    S.fleetAI = !!M2.flags.fleetai;
    startingAssets(M2);
  };
  function startingAssets(M) {
    const S = E.S;
    // founding pilot
    const founder = newCandidate();
    founder.level = 2; founder.paid = 0; founder.founder = true;
    S.pilots.push(founder);
    S.candidates = [newCandidate(), newCandidate(), newCandidate()];
    if (M.flags.startHauler) addShip('hauler', HULL.hauler.cost);
    if (M.flags.startIce && S.region >= 1) addShip('icebreaker', HULL.icebreaker.cost);
    if (M.flags.startRunner && S.region >= 2) addShip('runner', HULL.runner.cost);
    // a first, easy, already-surveyed prospect and a couple of unknowns
    S.targets.push(E.genTarget(0, 'S', { surveyed: true, dist: 8, haz: 0.1 }));
    S.targets.push(E.genTarget(0, 'C', { dist: 11 }));
    S.targets.push(E.genTarget(0, 'M', { dist: 20 }));
    for (let r = 1; r <= S.region; r++) S.targets.push(E.genTarget(r));
    // open on the safe, surveyed prospect so the first launch is not a coin flip
    const safe = S.targets.find((t) => t.surveyed && !t.story);
    if (safe && !S.selTarget) S.selTarget = safe.id;
    checkExpeditions();
    E.touch();
  }
  E.newGame = function () {
    E.S = E.newState();
    E.resetRun(0, E.mults());
    E.say('start');
  };
  E.canEnd = function () { return E.S.region >= 4 && E.S.peakEquity >= AT.FINAL_REQ && !E.S.ended; };
  E.end = function () {
    if (!E.canEnd()) return false;
    E.S.ended = true;
    E.unlockAch('ACH_END');
    AT.hooks.event('ending');
    return true;
  };
  E.newGamePlus = function () {
    const old = E.S;
    E.S = E.newState();
    const S = E.S;
    S.ngPlus = (old.ngPlus || 0) + 1;
    for (const k of ['ach', 'settings', 'stats', 'artifacts', 'memorial', 'dirIdx']) S[k] = old[k];
    S.dirIdx = 0;
    E.resetRun(0, E.mults());
    E.unlockAch('ACH_NGPLUS');
    E.say('start');
    E.log(`Universe ${S.ngPlus + 1}. The ledger remembers. Everything x${Math.pow(3, S.ngPlus)}. Artifacts carried over.`, 'prestige');
  };

  // =====================================================================
  // DIRECTIVES
  // =====================================================================
  E.directive = function () { return AT.DIRECTIVES[E.S.dirIdx] || null; };
  E.directiveDone = function (d) {
    const S = E.S;
    const [type, v] = d.cond;
    const count = (pred) => S.targets.filter(pred).length;
    switch (type) {
      case 'ships': return S.ships.length >= v;
      case 'launched': return S.run.launched >= v;
      case 'sold': return S.run.sold >= v;
      case 'pilots': return S.pilots.filter((p) => !p.founder).length >= v;
      case 'surveyed': return S.run.surveyed >= v;
      case 'missions': return S.run.missions >= v;
      case 'pads': return S.pads >= v;
      case 'research': return !!S.research[v];
      case 'contracts': return S.run.contracts >= v;
      case 'earned': return S.earnedRun >= v;
      case 'rep': return E.repLevel() >= v;
      case 'exp': return !!S.expDone[v];
      case 'outposts': return count((t) => t.outpost) >= v;
      case 'artifacts': return Object.keys(S.artifacts).length >= v;
      case 'ended': return S.ended;
    }
    if (type.startsWith('staff_')) return S.staff[type.slice(6)] >= v;
    if (type.startsWith('class_')) return (S.run.cls[type.slice(6)] || 0) >= v;
    if (type.startsWith('hull_')) return S.ships.some((s) => s.hull === type.slice(5));
    if (type.startsWith('layer')) return S.layers[+type.slice(5)].runs >= v;
    if (type.startsWith('region_')) return (S.run.reg[+type.slice(7)] || 0) >= v;
    if (type.startsWith('challenges')) { const L = AT.LAYERS[+type.slice(10)]; return L.challenges.filter((c) => S.chDone[c.id]).length >= v; }
    if (type.startsWith('outposts_')) return count((t) => t.outpost && t.region === +type.slice(9)) >= v;
    return false;
  };
  function checkDirective() {
    const S = E.S;
    const d = E.directive();
    if (!d || !E.directiveDone(d)) return;
    let msg = 'DIRECTIVE COMPLETE: ' + d.text;
    if (d.reward) {
      const cash = Math.max(d.reward.min || 0, (d.reward.cash || 0) * S.incomeEMA);
      if (cash > 0) { E.earn(cash); msg += ` +$${AT.fmt(cash)}`; }
      if (d.reward.rp) { const rp = d.reward.rp * Math.max(E.rpRate(), 0.5); S.rp += rp; msg += ` +${AT.fmt(rp)} RP`; }
    }
    S.dirIdx++;
    E.log(msg, 'up');
    AT.hooks.event('directive', S.dirIdx);
  }

  // =====================================================================
  // AUTOMATION — Fleet AI, procurement, daemons
  // =====================================================================
  E.bestTarget = function (ship, M, maxRisk) {
    const S = E.S;
    let best = null, bestEv = 0;
    for (const t of S.targets) {
      if (t.story) continue;
      if (E.targetLeft(t, M) - (t._reserved || 0) <= 0) continue;
      const p = E.plan(ship, t, M);
      if (p.cargo <= 0 || p.shownRisk > maxRisk) continue;
      if (p.ev > bestEv) { bestEv = p.ev; best = t; }
    }
    return best;
  };
  E.fleetAITick = function (M) {
    const S = E.S;
    for (const ship of S.ships) {
      if (E.padsFree() <= 0) break;
      if (!E.canFly(ship, M)) continue;
      if (ship.cond < 0.7) { E.repair(ship.id); continue; }
      const t = E.bestTarget(ship, M, S.aiRisk);
      if (t) E.launch(ship.id, t.id);
    }
    // surveys: most valuable-looking unsurveyed target first
    if (!M.rules.noSurvey) {
      const cands = S.targets.filter((t) => !t.surveyed && !S.surveys.some((s) => s.target === t.id))
        .sort((a, b) => E.compValueEst(b, M) - E.compValueEst(a, M));
      for (const t of cands) { if (E.surveyBlock(t, M)) break; E.survey(t.id); }
    }
    // drop mined-out targets
    for (const t of S.targets.slice()) if (!t.story && !t.outpost && E.targetLeft(t, M) <= 0) E.dropTarget(t.id);
  };
  E.procurementTick = function (M) {
    const S = E.S, A = S.autobuy;
    const reserve = E.salaryRate(M) * 30;
    const spend = (c) => S.money - reserve >= c;
    if (A.pads) { let g = 0; while (S.pads < E.maxPads(M) && spend(E.padCost(M)) && g++ < 5) E.buyPad(); }
    if (A.ships) {
      // buy the best unlocked hull while there are more pads than ships
      const hulls = AT.HULLS.filter((h) => E.hullUnlocked(h, M)).reverse();
      let g = 0;
      while (S.ships.length < S.pads + 1 && g++ < 5) {
        const h = hulls.find((x) => spend(E.shipPrice(x.id, M)));
        if (!h || !E.buyShip(h.id)) break;
      }
    }
    if (A.modules) {
      const owned = [...new Set(S.ships.map((s) => s.hull))];
      for (const hid of owned) for (const mod of AT.MODULES) {
        if (E.moduleLevel(hid, mod.id) < mod.max && spend(E.moduleCost(hid, mod, M) * 3)) E.buyModule(hid, mod.id);
      }
    }
  };
  E.trackRates = function (M) {
    const S = E.S;
    for (let j = 0; j < AT.LAYERS.length; j++) {
      const L = S.layers[j];
      if (L.t < 1) continue;
      const r = E.pendingGain(j, M) / L.t;
      if (r > L.bestRate) L.bestRate = r;
    }
  };
  E.shouldPrestige = function (j, M, mode) {
    const S = E.S, L = S.layers[j];
    const g = E.pendingGain(j, M);
    if (g < 1) return false;
    if (mode === 'smart') {
      if (L.runs === 0) return true;
      return L.t > 20 && g / L.t < L.bestRate * 0.92;
    }
    return g >= Math.max(1, L.lastGain * mode);
  };
  function daemons(M) {
    const S = E.S;
    if (!M.auto || S.challenge) return;
    for (let j = AT.LAYERS.length - 2; j >= 0; j--) {
      if (!M.flags['autoLayer' + j] || !S.layers[j].auto) continue;
      if (E.shouldPrestige(j, M, S.layers[j].autoMode)) { E.prestige(j, true); return; }
    }
  }

  // =====================================================================
  // TICK
  // =====================================================================
  const acc = { hist: 0, sec: 0, auto: 0 };
  E.tick = function (dt) {
    const S = E.S;
    if (!(dt > 0)) return;
    S.time += dt; S.runT += dt; S.stats.totalTime += dt;
    for (const L of S.layers) L.t += dt;
    let M = E.mults();
    S._earnTick = 0;

    // buffs expire
    if (S.buffs.length && S.buffs.some((b) => b.until <= S.time)) { S.buffs = S.buffs.filter((b) => b.until > S.time); E.touch(); M = E.mults(); }

    // payroll / strike
    const sal = E.salaryRate(M) * dt;
    if (sal > 0) {
      if (S.money >= sal) { S.money -= sal; if (S.strike) { S.strike = false; E.log('Payroll restored. Work has resumed.', 'warn'); E.touch(); M = E.mults(); } }
      else {
        S.money = 0;
        if (!S.strike) { S.strike = true; S.strikeT = 0; E.say('strike'); E.log('STRIKE: payroll missed. Staff bonuses and research halted.', 'warn'); E.touch(); M = E.mults(); }
        // unpaid staff eventually walk out, which lets payroll recover
        S.strikeT = (S.strikeT || 0) + dt;
        if (S.strikeT > 45) {
          S.strikeT = 30;
          const role = AT.STAFF.slice().sort((a, b) => S.staff[b.id] - S.staff[a.id])[0];
          if (S.staff[role.id] > 0) { S.staff[role.id]--; E.log(`An unpaid ${role.name.toLowerCase()} quit.`, 'down'); E.touch(); M = E.mults(); }
          else { const p = S.pilots.filter((x) => !x.founder && !(x.ship && E.shipById(x.ship) && E.shipById(x.ship).state === 'mission')).pop(); if (p) { E.firePilot(p.id); E.log(`${p.name} quit over unpaid wages.`, 'down'); } }
        }
      }
    } else if (S.strike) { S.strike = false; E.touch(); M = E.mults(); }

    // missions
    for (const m of S.missions.slice()) {
      m.t += dt;
      if (m.outcome === 'lost' && m.t >= m.failAt) { finishMission(m, M); continue; }
      if (m.t >= m.T) finishMission(m, M);
    }
    // repairs
    for (const ship of S.ships) {
      if (ship.state !== 'repair') continue;
      ship.repairT -= dt;
      if (ship.repairT <= 0) { ship.cond = 1; ship.state = 'idle'; ship.repairT = 0; }
    }
    // surveys
    for (const sv of S.surveys.slice()) { sv.t += dt; if (sv.t >= sv.T) finishSurvey(sv); }
    // construction
    for (const b of S.builds.slice()) {
      b.t += dt;
      if (b.t >= b.T) {
        S.builds = S.builds.filter((x) => x !== b);
        const t = E.targetById(b.target);
        if (t) {
          t.outpost = { lvl: 1 };
          E.log(`${AT.OUTPOST.names[t.region]} online at ${t.name}.`, 'up');
          E.unlockAch('ACH_OUTPOST');
          if (E.ownedOutposts() >= 10) E.unlockAch('ACH_OUTPOSTS_10');
          AT.hooks.event('outpost', t);
        }
      }
    }
    // outposts produce
    for (const t of S.targets) {
      if (!t.outpost) continue;
      const left = E.targetLeft(t, M);
      if (left <= 0) continue;
      const q = Math.min(left, E.outpostRate(t, M) * dt);
      t.mined += q;
      for (const id in t.comp) { S.ores[id] += q * t.comp[id]; S.market[id].inflow += q * t.comp[id] / 60; }
      S.stats.oreMined += q;
      if (E.targetLeft(t, M) <= 0) depleteTarget(t);
    }

    // discovery
    S.discT += dt;
    const iv = E.discoveryInterval(M);
    if (S.discT >= iv) {
      S.discT = trackedCount() >= E.targetCap(M) ? iv : 0;
      if (trackedCount() < E.targetCap(M)) E.discover(discoveryRegion());
    }
    // pilot candidates
    S.candT += dt;
    if (S.candT >= 180) E.refreshCandidates(false);

    // market: inflow decay, drift, recovery
    const inflowK = Math.exp(-dt / 60);
    const rec = 1 - Math.exp(-0.04 * M.recovery * dt);
    for (const id of ORE_IDS) {
      const m = S.market[id];
      m.inflow *= inflowK;
      const unlocked = AT.ORES[id].region <= S.region;
      m.t += gauss() * 0.035 * Math.sqrt(dt) + (1 - m.t) * 0.01 * dt;
      if (unlocked && rnd() < dt / 900) {
        const boom = rnd() < 0.55;
        m.t = boom ? 1.4 + rnd() * 0.3 : 0.45 + rnd() * 0.15;
        if (S.reveal.market) E.log(`MARKET: ${AT.ORES[id].name} demand ${boom ? 'surges' : 'collapses'}.`, boom ? 'up' : 'down');
      }
      m.t = clamp(m.t, 0.4, 1.8);
      m.d += (m.t - m.d) * rec;
    }
    // autosell
    if (M.flags.autosell && S.autosell !== 'off' && M.auto) {
      const thr = S.autosell === 'always' ? 0 : S.autosell === '80' ? 0.8 : 1.0;
      for (const id of ORE_IDS) if (S.ores[id] > 0 && S.market[id].d >= thr) E.sell(id, 1, M);
    }

    // research
    S.rp += E.rpRate(M) * dt;

    // income EMA
    const inst = S._earnTick / dt;
    S.incomeEMA += (inst - S.incomeEMA) * (1 - Math.exp(-dt / 30));

    // contracts
    if (S.reveal.contracts || S.run.sold > 0) {
      S.contractT -= dt;
      if (S.contractT <= 0) {
        S.contractT = 75;
        if (S.contracts.length < E.contractSlots(M)) newContract();
      }
      for (const c of S.contracts.slice()) {
        if (c.expires <= S.time) {
          S.contracts = S.contracts.filter((x) => x !== c);
          S.rep = Math.max(0, S.rep - 1);
          E.log(`Contract expired: ${c.client} went elsewhere.`, 'down');
          E.touch();
        }
      }
    }
    // incidents
    if (S.run.missions >= 5) {
      S.incT += dt;
      if (S.incT >= 300) { S.incT = rnd() * 120; maybeIncident(); }
    }
    for (let i = S.cards.length - 1; i >= 0; i--) {
      const c = S.cards[i];
      if (c.expires && c.expires <= S.time) E.resolveCard(i, 'b');
    }

    // quarters
    const sh = S.shares;
    if (sh.cd > 0) sh.cd -= dt;
    if (M.incorp) {
      sh.qT += dt;
      if (sh.qT >= QUARTER) {
        sh.qT -= QUARTER;
        const earned = sh.qEarn;
        if (sh.lastQ > 0) {
          const target = sh.lastQ * (M.flags.guidance ? 1.1 : 1.2);
          const beat = earned >= target;
          if (beat) { sh.conf = Math.min(3, sh.conf + 0.1); sh.streak++; E.say('qBeat'); }
          else { sh.conf = Math.max(E.confFloor(M), sh.conf - 0.25); sh.streak = 0; E.say('qMiss'); }
          sh.lastResult = { earned, target, beat };
          E.log(`QUARTERLY: earned $${AT.fmt(earned)} vs target $${AT.fmt(target)}. ${beat ? 'BEAT' : 'MISS'}`, beat ? 'up' : 'down');
          if (sh.streak >= 5) E.unlockAch('ACH_QUARTER_5');
        } else {
          sh.lastResult = { earned, target: 0, beat: true };
          E.log(`QUARTERLY: first report filed. $${AT.fmt(earned)} is now the baseline.`, 'info');
        }
        sh.lastQ = Math.max(earned, 1);
        sh.qEarn = 0;
        E.touch();
      }
    }
    if (sh.conf < E.confFloor(M)) sh.conf = E.confFloor(M);

    // equity
    const eq = E.equity(M);
    if (eq > S.peakEquity) S.peakEquity = eq;

    acc.sec += dt; acc.hist += dt; acc.auto += dt;
    if (acc.hist >= 2) {
      acc.hist = 0;
      for (const id of ORE_IDS) { const h = S.market[id].hist; h.push(+S.market[id].d.toFixed(3)); if (h.length > 90) h.shift(); }
    }
    if (acc.auto >= 1) {
      acc.auto = 0;
      M = E.mults();
      if (M.auto) {
        if (S.fleetAI && M.flags.fleetai) E.fleetAITick(M);
        if (M.flags.autobuy) E.procurementTick(M);
        if (M.flags.autohire && S.autohire) {
          for (const c of AT.STAFF) { let g = 0; while (!M.rules.noStaff && E.hireCost(c.id, M) <= S.money * 0.04 && g++ < 20) E.hire(c.id); }
        }
        // idle ships with repeat set relaunch when a pad frees up
        if (M.flags.flight) for (const ship of S.ships) {
          if (E.padsFree() <= 0) break;
          if (ship.repeat && E.canFly(ship, M) && ship.lastTarget) {
            const t = E.targetById(ship.lastTarget);
            if (t && !t.story && !E.launchBlock(ship, t, M)) E.launch(ship.id, t.id);
          }
        }
      }
      if (S.ships.some((s) => !s.pilot)) assignPilots();
      // safety net: never leave the player with no way to earn
      const flyable = S.ships.some((s) => s.pilot || M.flags.autopilot || M.flags.aipilots);
      const earning = S.missions.length || S.targets.some((t) => t.outpost && E.targetLeft(t, M) > 0) || Object.values(S.ores).some((q) => q >= 1);
      if (!earning && S.runT > 10) {
        if (!S.ships.length && S.money < E.shipPrice('prospector', M)) {
          S.money = E.shipPrice('prospector', M) + 100;
          E.log('The board approved an emergency loan. Buy a ship.', 'warn');
        } else if (S.ships.length && !flyable && !S.pilots.some((p) => !p.ship)) {
          const c = S.candidates.slice().sort((a, b) => E.pilotCost(a, M) - E.pilotCost(b, M))[0];
          if (c && S.money < E.pilotCost(c, M)) { S.money = E.pilotCost(c, M) + 50; E.log('The board approved an emergency loan. Hire a pilot.', 'warn'); }
        }
      }
      E.trackRates(M);
      daemons(M);
      checkExpeditions();
      checkChallenge(M);
      checkDirective();
      milestones(M);
    }
  };
  function milestones(M) {
    const S = E.S;
    if (S.earnedRun >= 1e6) E.unlockAch('ACH_MILLION');
    if (S.earnedRun >= 1e9) E.unlockAch('ACH_BILLION');
    if (S.region === 0 && S.peakEquity >= AT.LAYERS[0].req * 0.2) E.say('canJump');
    if (S.region === 4 && S.peakEquity >= AT.FINAL_REQ * 1e-12) E.say('nearEnd');
  }

  E.simulate = function (seconds) {
    const steps = Math.min(4000, Math.max(1, Math.ceil(seconds / 0.5)));
    const dt = seconds / steps;
    const eb = E.S.earnedTotal, mb = E.S.stats.missions;
    for (let i = 0; i < steps; i++) E.tick(dt);
    return { earned: E.S.earnedTotal - eb, missions: E.S.stats.missions - mb };
  };
  E.offlineCap = function () { return (8 + E.mults().offline) * 3600; };

  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // =====================================================================
  // FORMATTING
  // =====================================================================
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  AT.fmt = function (n, dec) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    if (!isFinite(n)) return 'INF';
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (n < 1000) {
      if (dec === 0 || n >= 100) s = String(Math.floor(n));
      else if (n >= 10) s = (Math.floor(n * 10) / 10).toFixed(n % 1 === 0 ? 0 : 1);
      else s = (Math.floor(n * 100) / 100).toFixed(n % 1 === 0 ? 0 : n * 10 % 1 === 0 ? 1 : 2);
    } else {
      const e = Math.floor(Math.log10(n) + 1e-9);
      const notation = (E.S && E.S.settings && E.S.settings.notation) || 'short';
      const tier = Math.floor(e / 3);
      if (notation === 'sci' || tier >= SUF.length) s = (n / Math.pow(10, e)).toFixed(2) + 'e' + e;
      else { const m = n / Math.pow(10, tier * 3); s = (m >= 100 ? m.toFixed(1) : m.toFixed(2)) + SUF[tier]; }
    }
    return (neg ? '-' : '') + s;
  };
  AT.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + String(x).padStart(2, '0') + 's';
    return x + 's';
  };
  AT.fmtPct = function (p) { return (p * 100 < 10 ? (p * 100).toFixed(1) : Math.round(p * 100)) + '%'; };
})(typeof window !== 'undefined' ? (window.AT = window.AT || {}) : (globalThis.AT = globalThis.AT || {}));

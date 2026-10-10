// Headless balance sim v2: an attentive "perfect player" bot.
// usage: node tools/sim.js [hours] [v] [seed-ignored]
const path = require('path');
globalThis.AT = {};
require(path.join(__dirname, '../src/data.js'));
require(path.join(__dirname, '../src/engine.js'));
const AT = globalThis.AT, E = AT.E;
const HOURS = +(process.argv[2] || 4);
const VERBOSE = process.argv[3] === 'v';
const CHALL = process.argv.includes('ch');
E.newGame();
const marks = {};
const out = (s) => console.log(s);
function mark(k) { if (!marks[k]) { marks[k] = E.S.stats.totalTime; out(`${AT.fmtTime(E.S.stats.totalTime).padStart(9)}  ${k}`); } }
AT.hooks.log = (e) => { if (VERBOSE && (e.kind === 'prestige')) out(`          [${AT.fmtTime(E.S.stats.totalTime)}] ${e.text}`); };

function bot() {
  const S = E.S;
  let M = E.mults();
  // cards
  while (S.cards.length) E.resolveCard(0, 'a');
  // expeditions first: a player would hold a pad for them
  for (const t of S.targets.filter((x) => x.story)) {
    if (S.missions.some((m) => m.target === t.id)) continue;
    let best = null, br = 1;
    for (const sh of S.ships.filter((s) => E.canFly(s, M))) { const p = E.plan(sh, t, M); if (p.risk < br) { br = p.risk; best = sh; } }
    if (best && br < 0.45 && E.padsFree() > 0) E.launch(best.id, t.id);
  }
  // fleet ops (a perfect player behaves like Fleet AI)
  S.aiRisk = 0.2;
  E.fleetAITick(M);
  if (!S.missions.length) { S.aiRisk = 0.4; E.fleetAITick(M); S.aiRisk = 0.2; }
  // expeditions
  for (const t of S.targets.filter((x) => x.story)) {
    if (S.missions.some((m) => m.target === t.id)) continue;
    const ships = S.ships.filter((s) => E.canFly(s, M));
    let best = null, br = 1;
    for (const sh of ships) { const p = E.plan(sh, t, M); if (p.risk < br) { br = p.risk; best = sh; } }
    if (best && br < 0.45 && E.padsFree() > 0) E.launch(best.id, t.id);
  }
  // selling
  if (M.flags.autosell) S.autosell = '80';
  else for (const id in S.ores) if (S.ores[id] > 0 && S.market[id].d >= 0.85) E.sell(id, 1, M);
  // contracts
  for (const c of S.contracts.slice()) if (E.contractReady(c)) E.deliverContract(c.id);
  // research
  const avail = AT.RESEARCH.filter((r) => E.researchAvailable(r)).sort((a, b) => a.cost - b.cost);
  for (const r of avail) E.buyResearch(r.id);
  // projects
  for (const p of AT.PROJECTS) if (E.projectVisible(p) && p.cost < S.money * 0.7 && E.buyProject(p.id)) mark('proj ' + p.id);
  M = E.mults();
  // staff
  const inc = Math.max(S.incomeEMA, 5);
  if (!S.ships.length && S.money >= E.shipPrice('prospector', M)) E.buyShip('prospector');
  if (S.ships.length && S.staff.scientist < 1 && S.money >= E.hireCost('scientist', M) + 200) E.hire('scientist');
  for (const c of AT.STAFF) {
    let g = 0;
    while (E.hireCost(c.id, M) < S.money * 0.08 && E.salaryRate(M) < inc * 0.25 && g++ < 10) { if (!E.hire(c.id)) break; M = E.mults(); }
  }
  // pilots: fill pilotless ships unless AI pilots
  if (!M.flags.aipilots) {
    const need = S.ships.filter((s) => !s.pilot).length - S.pilots.filter((p) => !p.ship).length;
    if (need > 0) {
      const c = S.candidates.slice().sort((a, b) => b.level - a.level)[0];
      if (c && (E.pilotCost(c, M) < S.money * 0.5 || (!S.pilots.some((p) => p.ship) && !M.flags.autopilot))) E.hirePilot(c.id);
    }
  }
  // fleet purchases
  const hulls = AT.HULLS.filter((h) => E.hullUnlocked(h, M));
  if (S.ships.length < S.pads + 1) {
    // best affordable hull by cargo per cost
    const h = hulls.slice().reverse().find((x) => E.shipPrice(x.id, M) < S.money * 0.6);
    if (h) E.buyShip(h.id);
  } else {
    // upgrade: replace weakest ship if a much better hull is affordable
    const best = hulls[hulls.length - 1];
    const weakest = S.ships.filter((s) => s.state === 'idle').sort((a, b) => E.HULL[a.hull].cost - E.HULL[b.hull].cost)[0];
    if (weakest && E.HULL[weakest.hull].cost * 20 < best.cost && E.shipPrice(best.id, M) < S.money * 0.5) { E.scrapShip(weakest.id); E.buyShip(best.id); }
  }
  if (S.ships.length >= S.pads && E.padCost(M) < S.money * 0.5) E.buyPad();
  const owned = [...new Set(S.ships.map((s) => s.hull))];
  for (const hid of owned) for (const mod of AT.MODULES) if (E.moduleLevel(hid, mod.id) < mod.max && E.moduleCost(hid, mod, M) < S.money * 0.15) E.buyModule(hid, mod.id);
  if (E.obsCost(M) < S.money * 0.1) E.buyObs();
  if (S.probes < AT.PROBE.max && E.probeCost(M) < S.money * 0.08) E.buyProbe();
  // outposts
  if (M.flags.outposts) {
    const cands = S.targets.filter((t) => !E.outpostBlock(t, M)).sort((a, b) => E.compValue(b, M) * Math.pow(10, b.region) - E.compValue(a, M) * Math.pow(10, a.region));
    if (cands[0] && E.outpostCost(cands[0], M) < S.money * 0.5) E.buildOutpost(cands[0].id);
    for (const t of S.targets) if (t.outpost && E.outpostUpCost(t, M) < S.money * 0.2) E.upgradeOutpost(t.id);
  }
  if (M.flags.autohire) S.autohire = true;
  if (M.flags.autobuy) S.autobuy = { pads: true, ships: true, modules: true };
  // prestige: push the run while equity keeps growing, then take the best reset
  for (const L of S.layers) L.auto = false;
  if (S.peakEquity > (bot.lastPeak || 0) * 1.5) { bot.lastPeak = S.peakEquity; bot.peakT = S.runT; }
  if (S.runT < 5) { bot.lastPeak = 0; bot.peakT = 0; }
  const stalled = S.runT - (bot.peakT || 0) > 240 || S.runT > 5400;
  if (stalled || (S.layers[0].runs === 0 && E.pendingGain(0, M) >= 1)) {
    bot.since = bot.since || [0, 0, 0, 0];
    for (let j = Math.min(S.region, AT.LAYERS.length - 1); j >= 0; j--) {
      const L = S.layers[j], g = E.pendingGain(j, M);
      if (g >= 1 && (L.runs === 0 || g >= bot.since[j] || j === 0)) {
        bot.since[j] += g; for (let k = 0; k < j; k++) bot.since[k] = 0;
        mark(`${AT.LAYERS[j].name} #${L.runs + 1} (gain ${AT.fmt(g)}, run ${AT.fmtTime(S.runT)})`);
        E.prestige(j, true);
        bot.lastPeak = 0; bot.peakT = 0;
        spendLayers();
        break;
      }
    }
  }
  spendLayers();
  if (CHALL && !S.challenge) {
    for (let li = 0; li < AT.LAYERS.length; li++) {
      if (!E.mults().flags['challenges' + li]) continue;
      const c = AT.LAYERS[li].challenges.find((x) => !S.chDone[x.id]);
      if (c && S.runT > 600 && S.peakEquity < AT.LAYERS[li].req * 1e-3) { E.startChallenge(li, c.id); mark(`challenge start ${c.id}`); break; }
    }
  }
  if (E.canEnd()) { mark('ENDING'); E.end(); }
}
function spendLayers() {
  const S = E.S;
  for (let li = 0; li < AT.LAYERS.length; li++) {
    let bought = true;
    while (bought) {
      bought = false;
      const ups = AT.LAYERS[li].upgrades.filter((u) => (S.layers[li].upg[u.id] || 0) < u.max).sort((a, b) => E.layerUpCost(li, a) - E.layerUpCost(li, b));
      for (const u of ups) if (E.buyLayerUp(li, u.id)) { bought = true; break; }
    }
  }
}
let last = 0;
const end = HOURS * 3600;
const t0 = Date.now();
let idle=0;
while (E.S.stats.totalTime < end && !E.S.ended) {
  if (E.S.incomeEMA < 1 && E.S.runT > 600) idle++; else idle=0;
  if (process.env.DBG && idle > 1800) { const S=E.S, M=E.mults(); console.log(JSON.stringify({money:S.money, strike:S.strike, ships:S.ships.map(s=>({h:s.hull,st:s.state,p:s.pilot,c:s.cond.toFixed(2)})), pilots:S.pilots.map(p=>({n:p.name,ship:p.ship,inj:p.injured>S.time})), tg:S.targets.map(t=>({c:t.cls,r:t.region,left:E.targetLeft(t,M),sv:t.surveyed,st:t.story})), pads:S.pads, miss:S.missions.length, ap:!!M.flags.autopilot, ai:!!M.flags.aipilots, salary:E.salaryRate(M), staff:S.staff, ores:Object.entries(S.ores).filter(([k,v])=>v>0)}, null, 0)); const sh=S.ships[0]; for (const t of S.targets) { const p=E.plan(sh,t,M); console.log(t.cls, t.region, 'risk',p.risk.toFixed(2),'shown',p.shownRisk.toFixed(2),'ev',p.ev.toFixed(2),'block',E.launchBlock(sh,t,M)); } process.exit(0); }
  E.tick(1);
  bot();
  const S = E.S;
  if (S.run.launched > 0) mark('first launch');
  if (S.research.r_flight) mark('flight director');
  if (S.research.r_incorp) mark('incorporated');
  if (S.ships.some((s) => s.hull === 'excavator')) mark('excavator');
  if (S.research.r_fleetai) mark('fleet AI');
  if (E.ownedOutposts() > 0) mark('first outpost');
  if (S.peakEquity >= 1e6) mark('equity 1e6');
  if (S.peakEquity >= 1e9) mark('equity 1e9');
  for (const x of AT.EXPEDITIONS) if (S.expDone[x.id]) mark('exp ' + x.id);
  for (const id in S.chDone) mark('challenge done ' + id);
  if (Math.floor(S.stats.totalTime / 900) !== Math.floor((S.stats.totalTime - 1) / 900)) {
    const M = E.mults(); const lg = (x) => Math.log10(x).toFixed(1);
    out(`      mults: value*all=${lg(M.value*M.all)} cargo=${lg(M.cargo)} speed=${lg(M.speed)} drill=${lg(M.drill)} outpost=${lg(M.outpost)} rp=${lg(M.rp)} rep=${M.repLevel} CCupg=${JSON.stringify(S.layers[0].upg)} best=${S.ships.map(s=>s.hull).sort().pop()} reg-income? ${Object.entries(S.run.reg).map(([k,v])=>k+':'+v).join(',')}`);
  }
  if (Math.floor(S.stats.totalTime / 1800) !== Math.floor((S.stats.totalTime - 1) / 1800)) {
    out(`   --- ${AT.fmtTime(S.stats.totalTime)} reg ${S.region} run ${AT.fmtTime(S.runT)} log(eq)=${Math.log10(S.peakEquity + 1).toFixed(1)} inc=${AT.fmt(S.incomeEMA)} ships=${S.ships.length}[${[...new Set(S.ships.map((s) => s.hull))].join(',')}] pads=${S.pads} out=${E.ownedOutposts()} res=${Object.keys(S.research).length} rp=${AT.fmt(S.rp)} L=${S.layers.map((l) => l.runs + ':' + AT.fmt(l.cur)).join(' ')} art=${Object.keys(S.artifacts).length} dir=${S.dirIdx} loss=${S.stats.losses}`);
  }
  if (VERBOSE && S.stats.totalTime - last >= 300) {
    last = S.stats.totalTime;
    out(`   t=${AT.fmtTime(S.stats.totalTime)} $${AT.fmt(S.money)} inc=${AT.fmt(S.incomeEMA)}/s eq=${AT.fmt(S.peakEquity)} ships=${S.ships.map((s) => s.hull[0]).join('')} pads=${S.pads} fly=${S.missions.length} tg=${S.targets.length} staff=${Object.values(S.staff).join('/')} pil=${S.pilots.length} rp=${AT.fmt(S.rp)} res=${Object.keys(S.research).length} out=${E.ownedOutposts()} rep=${E.repLevel()} loss=${S.stats.losses}`);
  }
}
out(`--- final ${AT.fmtTime(E.S.stats.totalTime)} region ${E.S.region} layers ${E.S.layers.map((l) => l.runs).join('/')} artifacts ${Object.keys(E.S.artifacts).length} dir ${E.S.dirIdx} (${((Date.now() - t0) / 1000).toFixed(0)}s wall)`);

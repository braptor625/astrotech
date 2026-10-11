// Prologue engine test (Node, no DOM). usage: node tools/prologue_test.js
const path = require('path');
const assert = require('assert');
globalThis.AT = {};
require(path.join(__dirname, '../src/data.js'));
require(path.join(__dirname, '../src/engine.js'));
const AT_ = globalThis.AT, E = AT_.E, PRO = AT_.PROLOGUE;
const events = [];
AT_.hooks.event = (k, a) => events.push([k, a]);
const seen = (k) => events.filter((e) => e[0] === k);
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const run = (sec) => { for (let i = 0; i < sec; i++) E.tick(1); };
const fresh = (opts) => { events.length = 0; E.rng = null; E.proDevice(false); E.newGame(opts); return E.S; };
const clickAll = () => { let g = 0; while (E.proMade() < 3 && g++ < 200) E.proClick(); };

test('a new game starts in the prologue, mining is inert', () => {
  const S = fresh();
  assert(E.proActive() && !S.prologueDone && S.pro);
  assert.strictEqual(S.money, PRO.loan);
  assert.strictEqual(S.ships.length, 0);
  const targets = S.targets.length;
  run(600);
  assert.strictEqual(S.targets.length, targets, 'no target discovery during the prologue');
  assert.strictEqual(E.buyShip('prospector'), false, 'mining actions are closed');
  assert.strictEqual(S.dirIdx, 0);
  assert(E.proGoal().text.includes('Machine'));
});

test('hand-machining: clicks build the parts', () => {
  const S = fresh();
  const cost = PRO.parts.airframe.cost;
  for (let i = 0; i < PRO.parts.airframe.clicks - 1; i++) E.proClick('airframe');
  assert.strictEqual(S.pro.parts.airframe, 0);
  assert(S.pro.hand && S.pro.hand.p > 0.8);
  E.proClick('airframe');
  assert.strictEqual(S.pro.parts.airframe, 1);
  assert.strictEqual(S.money, PRO.loan - cost);
  assert(S.ach.ACH_PRO_PART);
  clickAll();
  assert.strictEqual(E.proMade(), 3);
  assert(SUBS_OK(S.pro.parts));
});
function SUBS_OK(p) { return p.airframe >= 1 && p.engine >= 1 && p.avionics >= 1; }

test('hiring a machinist: fab jobs run on their own and complete', () => {
  const S = fresh();
  assert.strictEqual(E.proHire('machinist'), false, 'locked before the first part');
  E.proClick('airframe');
  assert.strictEqual(E.proHire('machinist'), false, 'still locked');
  for (let i = 0; i < 12; i++) E.proClick('airframe');
  assert(E.proHire('machinist'));
  const m0 = S.money;
  run(2);
  assert(S.pro.jobs.length >= 1, 'the machinist starts a job');
  assert(seen('proJobStart').length >= 1);
  run(120);
  assert(S.pro.parts.engine >= 1 && S.pro.parts.avionics >= 1, 'jobs completed');
  assert(seen('proJobDone').length >= 2);
  assert(S.money < m0, 'materials and salary cost cash');
  // clicking speeds a job
  S.pro.stock = { airframe: 4, engine: 0, avionics: 0 };
  run(1);
  const job = S.pro.jobs[0];
  const t0 = job.t;
  assert.strictEqual(E.proClick('airframe'), 'job');
  assert(job.t > t0);
});

test('static fire: a job that yields Data (and can destroy the engine)', () => {
  const S = fresh();
  clickAll();
  E.rng = () => 0.99; // never explodes
  assert(E.proStaticFire());
  assert.strictEqual(S.pro.parts.engine, 0, 'the engine is on the stand');
  run(PRO.fire.T + 1);
  assert.strictEqual(S.pro.parts.engine, 1);
  assert.strictEqual(S.pro.data, PRO.fire.data);
  assert(seen('proStaticFire')[0][1].ok);
  assert(S.pro.unlocked.rd && S.ach.ACH_PRO_FIRE);
  E.rng = () => 0.0; // always explodes
  assert(E.proStaticFire());
  run(PRO.fire.T + 1);
  assert.strictEqual(S.pro.parts.engine, 0, 'engine destroyed');
  assert(seen('proStaticFire')[1][1].boom);
  assert(S.ach.ACH_PRO_RUD);
});

test('R&D spends Data and raises reliability; staff and bays', () => {
  const S = fresh();
  const P = S.pro;
  const r0 = E.proRel('engine');
  P.data = 100;
  assert(E.proBuyRD('r_turbo'));
  assert(E.proRel('engine') > r0);
  assert.strictEqual(E.proBuyRD('r_turbo'), false);
  assert.strictEqual(E.proBuyRD('r_turbo2') && E.proBuyRD('r_turbo2'), false);
  assert.strictEqual(E.proFx().bays, 1);
  assert(E.proBuyRD('r_bay'));
  assert.strictEqual(E.proFx().bays, 2);
});

test('a failed attempt loses the rocket and gives Data', () => {
  const S = fresh();
  clickAll();
  assert(E.proAssemble('hop'));
  run(PRO.tiers[0].assembleT + 1);
  assert(S.pro.rocket && S.pro.rocket.tier === 0);
  E.rng = () => 0.999; // roll above any odds: failure
  assert(E.proAttempt('hop'));
  assert(seen('proAttemptStart').length === 1);
  const d0 = S.pro.data;
  run(PRO.tiers[0].flightT + 1);
  const res = seen('proAttemptResult')[0][1];
  assert(!res.ok && res.explosion && res.cause);
  assert.strictEqual(S.pro.rocket, null, 'rocket lost');
  assert.strictEqual(S.pro.parts.airframe + S.pro.parts.engine + S.pro.parts.avionics, 0, 'parts are gone too');
  assert(S.pro.data - d0 >= PRO.tiers[0].failData);
  assert.strictEqual(S.pro.stats.fails, 1);
  assert(S.ach.ACH_PRO_RUD);
  assert(!S.pro.cleared.hop);
});

test('a successful hop returns the parts, pays, unlocks funding and queues a pitch', () => {
  const S = fresh();
  clickAll();
  E.proAssemble('hop'); run(15);
  E.rng = () => 0.0;
  E.proAttempt('hop'); run(PRO.tiers[0].flightT + 1);
  assert(S.pro.cleared.hop && S.pro.parts.engine === 1 && S.ach.ACH_PRO_HOP);
  assert(S.pro.unlocked.funding);
  assert.strictEqual(S.pro.cards.length, 1);
  const m = S.money;
  assert(E.proResolvePitch(0, 'a'));
  assert(S.money > m && S.pro.pressure === 1);
  assert(E.proClaimGrant('g_state'));
  assert.strictEqual(E.proClaimGrant('g_state'), false);
  assert.strictEqual(E.proTierBlock('sub'), null);
  assert(E.proTierBlock('orbit'));
});

function playToCertification(rngValue) {
  const S = fresh();
  E.rng = () => rngValue;
  S.pro.data = 500; S.money = 20000;
  for (const r of PRO.rd) { S.pro.rd[r.id] = 1; }
  S.pro.cleared = { hop: 1, sub: 1, orbit: 1 };
  S.pro.data = 77;
  S.pro.ore = 1;
  S.pro.stats.fails = 2;
  S.pro.parts = { airframe: 2, engine: 3, avionics: 2 };
  assert(E.proAssemble('recover'));
  run(PRO.tiers[3].assembleT + 1);
  assert(E.proAttempt('recover'));
  run(PRO.tiers[3].flightT + 1);
  return S;
}

test('certification: the rocket becomes the first Prospector, with carry-over', () => {
  const S = playToCertification(0.0);
  assert(S.prologueDone && !E.proActive());
  assert.strictEqual(seen('certified').length, 1);
  const c = seen('certified')[0][1];
  assert.strictEqual(S.ships.length, 1);
  assert.strictEqual(S.ships[0].hull, 'prospector');
  assert.strictEqual(S.ships[0].name, PRO.carry.rocketName);
  const founder = S.pilots.find((p) => p.founder);
  assert(founder && S.ships[0].pilot === founder.id, 'founding pilot flies it');
  assert.strictEqual(c.pilot, founder.name);
  assert(S.proBonus > 0 && S.proBonus <= PRO.carry.bonusMax);
  assert.strictEqual(S.rp, Math.min(PRO.carry.rpCap, 77 * PRO.carry.rpPerData + PRO.carry.rpPerOre));
  assert(S.money >= PRO.carry.cash && S.money <= PRO.carry.cash + PRO.carry.cashCap);
  assert(S.ach.ACH_PRO_RETURNED && !S.ach.ACH_PRO_CLEAN);
  assert.strictEqual(E.proDevice(), true, 'device flag raised for the UI to persist');
  assert.strictEqual(E.directive().cond[0], 'launched');
  assert(/first mining mission/.test(E.directive().text));
  assert.strictEqual(S.tutorial, 0);
  assert(E.proRename('ATS Hello') && S.ships[0].name === 'ATS Hello');
  // mining is live: launch, and the Prospector bonus lowers its risk
  const t = S.targets.find((x) => x.surveyed && !x.story);
  const risk = E.plan(S.ships[0], t).risk;
  S.proBonus = 0;
  assert(risk < E.plan(S.ships[0], t).risk, 'bonus lowers risk');
  S.proBonus = c.bonus;
  assert(E.launch(S.ships[0].id, t.id), 'the first mining mission launches');
  const t0 = S.targets.length;
  run(900);
  assert(S.targets.length >= t0 && S.run.launched === 1);
});

test('a failed recover attempt does not certify', () => {
  const S = playToCertification(0.999);
  assert(E.proActive() && !S.pro.certified && S.ships.length === 0);
});

test('skip grants the baseline carry-over', () => {
  const S = fresh();
  assert(!E.proCanSkip(), 'not offered on a device that has not finished it');
  E.proDevice(true);
  assert(E.proCanSkip());
  assert(E.proSkip());
  assert(S.prologueDone && S.ships.length === 1 && S.ships[0].hull === 'prospector');
  assert(S.proBonus > 0 && S.rp > 0);
  assert.strictEqual(seen('proSkip').length, 1);
  assert.strictEqual(E.proSkip(), false);
  const S2 = fresh({ skipPrologue: true });
  assert(S2.prologueDone && !E.proActive() && S2.ships.length === 1);
  assert(E.buyShip('prospector') === false || S2.money > 0); // mining is open
  run(60);
  assert(S2.targets.length >= 3);
});

test('old saves (no prologue fields) load as done; mid-prologue saves resume', () => {
  fresh({ skipPrologue: true });
  const j = JSON.parse(E.save());
  delete j.pro; delete j.prologueDone; delete j.proBonus;
  const old = E.load(JSON.stringify(j));
  assert(old && old.prologueDone === true && old.pro === null);
  E.S = old; E.touch(); run(30);
  assert(!E.proActive());
  const S = fresh();
  clickAll(); E.proHire('machinist'); run(30);
  const re = E.load(E.save());
  assert(re && re.prologueDone === false && re.pro.staff.machinist === 1 && re.pro.parts.airframe === S.pro.parts.airframe);
  E.S = re; E.touch(); run(10);
  assert(E.proActive());
});

test('prestige and New Game+ never replay the prologue', () => {
  const S = playToCertification(0.0);
  S.layers[0].cur = 0;
  S.peakEquity = 1e12; S.earnedRun = 1e12;
  S.money = 1e12;
  const M = E.mults();
  const g = E.pendingGain(0, M);
  assert(g >= 1, "test setup: a Kuiper Jump is available");
  E.prestige(0, true); assert(!E.proActive() && S.prologueDone);
  E.S.ended = true;
  E.newGamePlus();
  assert(E.S.prologueDone && !E.proActive() && E.S.pro === null);
  assert(E.S.proBonus >= 0);
  run(10);
});

console.log(`\n${n} prologue tests passed`);

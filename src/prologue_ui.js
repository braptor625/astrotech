// AstroTech: the prologue UI. Its own nav rail, five consoles (Workshop, Test Stand, R&D, Launch, Funding), the monitor's job list and
// pitch cards, the event handler for the engine's pro* hook events, and the certification beat. ui.js delegates here while E.proActive().
// Engine API: E.pro* (src/engine.js). Data: AT.PROLOGUE (src/data.js). Layout rules: docs/ui-redesign.md.
(function (AT) {
  'use strict';
  const E = AT.E, UI = AT.ui, C = UI.core, PRO = AT.PROLOGUE, SPR = AT.SPR, fmt = AT.fmt;
  const { esc, money, btn, apply, conHead, sect } = C;
  const PX = AT.proUI = {};
  const SUBS = PRO.partOrder, TIERS = PRO.tiers;
  const $ = (s, r) => (r || document).querySelector(s);
  const pct0 = (x) => Math.round(x * 100) + '%';
  const tm = (s) => AT.fmtTime(s);
  const audio = (n) => { if (AT.audio) AT.audio.play(n); };
  const SHORT = { airframe: 'AIR', engine: 'ENG', avionics: 'AVI' };
  let proPick = null; // part the lathe makes; null = whatever the stock targets need next

  // =====================================================================
  // PIXEL ART: part icons (12x12)
  // =====================================================================
  const PART_ART = {
    airframe: ['...kkkkkk...', '..kwwWWSSk..', '.kwwwWWSSSk.', '.kwwwWWSSSk.', '.kkkkkkkkkk.', '.krrrrrrrRk.', '.kkkkkkkkkk.', '.kwwwWWSSSk.', '.kwwwWWSSSk.', '.kwwwWWSSSk.', '..kSSSSSSk..', '...kkkkkk...'],
    engine: ['...kkkkkk...', '..kSSssSSk..', '..kSsssSSk..', '...kSssSk...', '...kssssk...', '..kSsssSSk..', '.kSSssssSSk.', '.kSsssssssk.', 'kSSssooosSSk', 'kSsoooyyoosk', 'kkkkkkkkkkkk', '..oo.yy.oo..'],
    avionics: ['kkkkkkkkkkkk', 'kddddddddddk', 'kdbbbddggddk', 'kdbkbddgGddk', 'kdbbbdddddek', 'kddddkkkkddk', 'kdeddkcccdkk', 'kdddddkccdck', 'kdrdddkkkdck', 'kdddddddddck', 'kddgGdddddek', 'kkkkkkkkkkkk'],
  };
  const artCache = {};
  function partIcon(type, scale) {
    const k = type + (scale || 1);
    if (!artCache[k]) artCache[k] = SPR.make(PART_ART[type], SPR.PAL, scale || 1).toDataURL();
    return artCache[k];
  }
  const pimg = (type, cls, scale) => `<img class="pico ${cls || ''}" src="${partIcon(type, scale || 2)}" alt="" draggable="false">`;
  PX.partIcon = partIcon;
  const canvasCache = {};
  PX.partCanvas = (type) => canvasCache[type] || (canvasCache[type] = SPR.make(PART_ART[type], SPR.PAL, 1));

  // =====================================================================
  // NAV
  // =====================================================================
  const TABDEFS = [
    { id: 'pro_workshop', label: 'Workshop', short: 'Shop', icon: 'hammer', group: 'Prologue', key: 'workshop' },
    { id: 'pro_stand', label: 'Test Stand', short: 'Stand', icon: 'flame', group: 'Prologue', key: 'stand' },
    { id: 'pro_rd', label: 'R&D', short: 'R&D', icon: 'research', group: 'Prologue', key: 'rd' },
    { id: 'pro_launch', label: 'Launch', short: 'Launch', icon: 'rocket', group: 'Prologue', key: 'launch' },
    { id: 'pro_funding', label: 'Funding', short: 'Funds', icon: 'money', group: 'Prologue', key: 'funding' },
  ];
  function visible(id) {
    const P = E.S.pro;
    if (!P || !E.proActive()) return false;
    if (id === 'pro_workshop') return true;
    if (id === 'pro_stand') return !!P.unlocked.stand;
    if (id === 'pro_rd') return !!P.unlocked.rd;
    if (id === 'pro_funding') return !!P.unlocked.funding;
    if (id === 'pro_launch') return !!P.unlocked.launch || SUBS.every((s) => P.made[s] >= 1); // the first rocket is assembled from here
    return false;
  }
  PX.has = (id) => TABDEFS.some((t) => t.id === id) && visible(id);
  PX.visible = PX.has;
  // A console that shows up for the first time gets a dot in the rail and a toast. The first call after a page load only records what is already there.
  let revealInit = false;
  function syncReveal() {
    const R = E.S.reveal;
    for (const t of TABDEFS) {
      if (!visible(t.id) || R['seen_' + t.id]) continue;
      R['seen_' + t.id] = 1;
      if (revealInit && t.id !== 'pro_workshop') { R['new_' + t.id] = 1; C.toast(t.icon, 'NEW CONSOLE', t.label.toUpperCase()); audio('tab'); }
    }
    revealInit = true;
  }
  PX.tabs = () => { syncReveal(); return TABDEFS.filter((t) => visible(t.id)); };

  // What needs the player, per console (same shape as navBadges in ui.js)
  PX.badges = function () {
    const S = E.S, P = S.pro, b = {};
    if (!E.proActive()) return b;
    if (!P.staff.machinist && E.proMade() >= 1 && !E.proHireBlock('machinist')) b.pro_workshop = { dot: 1, tip: 'You can afford a machinist' };
    if (visible('pro_stand') && !E.proFireBlock() && !P.jobs.some((j) => j.kind === 'fire') && !(P.staff.tester && P.fireAuto)) b.pro_stand = { dot: 1, tip: 'An engine is ready for a static fire' };
    if (visible('pro_rd')) {
      const n = PRO.rd.filter((r) => E.proRdAvailable(r.id) && P.data >= r.cost).length;
      if (n) b.pro_rd = { n, tip: n + ' R&D node' + (n > 1 ? 's' : '') + ' you can afford' };
    }
    if (visible('pro_launch')) {
      const i = P.rocket ? P.rocket.tier : E.proNextTier();
      if (P.rocket && !P.attempt && !E.proAttemptBlock(P.rocket.tier)) b.pro_launch = { dot: 1, kind: 'warn', tip: 'A ' + TIERS[P.rocket.tier].name + ' vehicle is on the pad and ready to fly' };
      else if (!P.rocket && !P.attempt && !E.proAssembleBlock(i)) b.pro_launch = { dot: 1, tip: 'Parts are ready to assemble: ' + TIERS[i].name };
    }
    if (visible('pro_funding')) {
      const n = P.cards.length + PRO.grants.filter((g) => E.proGrantReady(g)).length + PRO.contracts.filter((c) => E.proContractOffered(c) && !PRO.contracts.some((x) => x.tier === c.tier && P.contracts[x.id] === 'accepted')).length;
      if (n) b.pro_funding = { n, kind: P.cards.length ? 'warn' : '', tip: (P.cards.length ? 'An investor is waiting. ' : '') + n + ' item' + (n > 1 ? 's' : '') + ' need a decision' };
    }
    return b;
  };
  // which rail item pulses: where the Board's order leads, if there is something to do there
  PX.hint = function () {
    const P = E.S.pro;
    if (!E.proActive()) return null;
    if (P.cards.length) return 'pro_funding';
    const g = E.proGoal(), t = goalTab(g), b = PX.badges();
    if (t === 'pro_workshop') return E.proMade() < 1 || b.pro_workshop ? t : null;
    return b[t] ? t : null;
  };
  function goalTab(g) {
    if (!g) return 'pro_launch';
    const t = g.cond[0];
    if (t === 'made' || t === 'madeAll') return 'pro_workshop';
    if (t === 'fires') return visible('pro_stand') ? 'pro_stand' : 'pro_workshop';
    return visible('pro_launch') ? 'pro_launch' : 'pro_workshop';
  }
  PX.directive = function () {
    const g = E.proGoal(), n = PRO.goals.length, i = g ? PRO.goals.indexOf(g) : n;
    const html = `<span class="dp-k">BOARD ORDER</span><b class="dp-n">${Math.min(n, i + 1)}/${n}</b><span class="dp-t">${esc(g ? g.text : 'License pending.')}</span><span class="dp-bar"><i style="width:${Math.round(i / n * 100)}%"></i></span>`;
    return { html, tab: goalTab(g), tip: g ? `Board order ${i + 1} of ${n}: ${g.text.replace(/"/g, '')} Click to go there.` : 'The Board is considering your license.' };
  };

  // =====================================================================
  // SMALL HELPERS
  // =====================================================================
  const gate = (block, ok) => ({ dis: !!block, tip: 'txt:' + (block || ok || '') });
  const bar = (k, cls) => `<div class="bar ${cls || ''}"><i data-k="${k}"></i></div>`;
  const kv = (label, k, cls) => `<div class="row" style="--cols:minmax(0,1fr) auto"><span class="dim">${label}</span><b class="num ${cls || ''}" data-k="${k}"></b></div>`;
  const tierName = (i) => TIERS[i].name;
  const partName = (s) => PRO.parts[s].name;
  const jobTitle = (j) => (j.kind === 'fab' ? 'Fabricate ' + partName(j.type).toLowerCase() : j.kind === 'fire' ? 'Static fire' : 'Assemble ' + tierName(j.tier));
  const jobIcon = (j) => (j.kind === 'fab' ? pimg(j.type, '', 2) : j.kind === 'fire' ? pimg('engine', 'fire', 2) : `<img class="pico" src="${SPR.icon('rocket')}" alt="">`);
  const confirmAt = {};

  // =====================================================================
  // WORKSHOP
  // =====================================================================
  const WS = {
    sig(S) {
      const P = S.pro;
      return [E.proCanSkip() ? 1 : 0, E.proMade() >= 1 ? 1 : 0, P.staff.machinist, proPick, P.jobs.map((j) => j.id).join(), E.proFx().bays, P.stock ? 1 : 0, P.auto ? 1 : 0, C.isCollapsed('workshop:lathe'), C.isCollapsed('workshop:parts'), C.isCollapsed('workshop:bays')].join('|');
    },
    build(S) {
      const P = S.pro, m = PRO.staff.machinist;
      let h = conHead('Workshop', 'Hangar 3, leased by the month. One lathe. Parts are made here.', E.proCanSkip() ? btn('pro-skip', 0, 'ghost tiny', 'w_skip') : '');
      h += sect('workshop:lathe', 'Lathe', {}, `<div class="lathe">
        <button class="mach" data-act="pro-click" data-rep="1" data-coach="click" data-k="w_mach"></button>
        <div class="lathe-side"><div class="seg" role="group" aria-label="Part to machine">${['auto', ...SUBS].map((p) => btn('pro-pick', p, 'tiny', 'w_pick_' + p)).join('')}</div>
        <p class="note" data-k="w_note"></p></div></div>`);
      let staff;
      if (P.staff.machinist) staff = `<div class="row" style="--cols:minmax(0,1fr) auto"><span><b>Machinist</b> <span class="dim">${esc(m.desc)}</span></span><span class="num dim">on payroll · ${money(m.salary)}/s</span></div>`;
      else if (E.proMade() < 1) staff = '<p class="empty">Machine your first part to unlock hiring.</p>';
      else staff = `<div class="row" style="--cols:minmax(0,1fr) auto auto"><span><b>Machinist</b> <span class="dim">${esc(m.desc)}</span></span><span class="num dim">${money(m.cost)} · ${money(m.salary)}/s</span>${btn('pro-hire', 'machinist', '', 'w_hire', 'data-coach="hire"')}</div>`;
      h += sect('workshop:staff', 'Staff', {}, staff);
      if (E.proMade() >= 1) {
        const rows = SUBS.map((s) => `<div class="row part-row" style="--cols:26px minmax(0,1fr) auto auto auto">${pimg(s, '', 2)}<span><b>${partName(s)}</b> <span class="dim">${esc(PRO.parts[s].desc)}</span><br><span class="dim">on hand <b class="ink" data-k="w_have_${s}"></b> · target <b class="ink" data-k="w_tgt_${s}"></b></span></span>
          <span class="step">${btn('pro-stock', s + ':-1', 'tiny ghost', 'w_dn_' + s, 'aria-label="Lower the ' + s + ' target"')}${btn('pro-stock', s + ':1', 'tiny ghost', 'w_up_' + s, 'aria-label="Raise the ' + s + ' target"')}</span>
          <span class="num dim">${money(PRO.parts[s].cost)}</span>${btn('pro-fab', s, '', 'w_fab_' + s)}</div>`).join('');
        const ctl = P.staff.machinist ? btn('pro-auto', 0, 'tiny ghost', 'w_auto') + btn('pro-stockreset', 0, 'tiny ghost', 'w_reset') : '';
        h += sect('workshop:parts', 'Parts', { ctl }, rows);
        const bays = E.proFx().bays;
        let jr = P.jobs.map((j) => `<div class="row job" style="--cols:26px minmax(0,1fr) 64px">${jobIcon(j)}<span>${jobTitle(j)}${bar('w_jb_' + j.id, 'thin')}</span><span class="num dim" data-k="w_jt_${j.id}"></span></div>`).join('');
        for (let i = P.jobs.length; i < bays; i++) jr += '<div class="row job idle" style="--cols:minmax(0,1fr)"><span class="dim">Bay idle</span></div>';
        h += sect('workshop:bays', 'Bays', { count: `<span data-k="w_baycount"></span>` }, jr);
      }
      return h;
    },
    update(S) {
      const P = S.pro, v = {};
      const hand = P.hand;
      // the lathe button
      let type, prog = 0, reason = null, label = 'MACHINE PART', sub = '';
      const fab = P.jobs.find((j) => j.kind === 'fab' && (proPick ? j.type === proPick : !hand));
      if (fab) { type = fab.type; prog = fab.t / fab.T; label = 'SPEED UP'; sub = `${partName(type)} · ${tm(fab.T - fab.t)} left · each click shaves ${PRO.click.boost}s`; }
      else {
        type = hand ? hand.type : proPick || E.proNextType();
        if (type) {
          const cost = PRO.parts[type].cost;
          prog = hand ? hand.p : 0;
          if (!hand && S.money < cost) reason = `Needs ${money(cost)} in materials`;
          sub = `${partName(type)} · ${Math.round(prog * 100)}% · ${money(cost)} in materials`;
        } else if (P.jobs[0]) { const j = P.jobs[0]; type = j.type || 'engine'; prog = j.t / j.T; label = 'SPEED UP'; sub = `${jobTitle(j)} · ${tm(j.T - j.t)} left`; }
        else { type = 'engine'; reason = 'Every stock target is met. Raise a target in Parts, or assemble a rocket.'; sub = 'Nothing to make right now'; }
      }
      v.w_mach = { h: `<span class="mach-art">${pimg(type, '', 5)}</span><span class="mach-txt"><b>${label}</b><small>${esc(sub)}</small></span><span class="mach-bar"><i style="width:${Math.round(prog * 100)}%"></i></span>`, dis: !!reason, tip: 'txt:' + (reason || 'Click to machine the part by hand. Hold to keep going.') };
      for (const p of ['auto', ...SUBS]) v['w_pick_' + p] = { t: p === 'auto' ? 'AUTO' : SHORT[p], cls: { on: (proPick || 'auto') === p }, dis: !!hand && (p === 'auto' || hand.type !== p), tip: 'txt:' + (hand && hand.type !== p ? 'Finish the part on the lathe first' : p === 'auto' ? 'Make whatever the stock targets need next' : 'Always machine ' + partName(p).toLowerCase()) };
      v.w_note = P.staff.machinist ? 'Clicking speeds up the running job. It is never required.' : 'Each part takes about ten clicks by hand. Hold the button to keep going. A machinist takes over once you can pay one.';
      v.w_skip = { t: 'SKIP PROLOGUE', tip: 'txt:Skip the prologue and start mining with a baseline rocket. Available because you finished it before.' };
      // staff
      const hb = E.proHireBlock('machinist');
      v.w_hire = { t: 'HIRE', dis: !!hb, tip: 'txt:' + (hb || 'Hire a machinist. She keeps parts in stock.'), cls: { gold: !hb } };
      // parts
      const stock = E.proStock(), F = E.proFx();
      for (const s of SUBS) {
        const pend = E.proPending(s) + (s === 'engine' ? P.jobs.filter((j) => j.kind === 'fire').length : 0);
        v['w_have_' + s] = { t: String(P.parts[s]) + (pend ? ` (+${pend} in work)` : '') };
        v['w_tgt_' + s] = { t: String(stock[s]) };
        v['w_dn_' + s] = { t: '−', dis: !P.staff.machinist || stock[s] <= 0, tip: 'txt:' + (P.staff.machinist ? 'Keep fewer in stock' : 'Hire a machinist to keep a stock') };
        v['w_up_' + s] = { t: '+', dis: !P.staff.machinist || stock[s] >= 6, tip: 'txt:' + (P.staff.machinist ? 'Keep more in stock' : 'Hire a machinist to keep a stock') };
        const fb = E.proFabBlock(s);
        v['w_fab_' + s] = Object.assign({ t: 'FAB' }, gate(fb, `Start a fabrication job: ${partName(s).toLowerCase()}, ${tm(E.proJobTime('fab', s))}`));
      }
      v.w_auto = { t: P.auto ? 'AUTO-STOCK: ON' : 'AUTO-STOCK: OFF', cls: { on: !!P.auto }, tip: 'txt:The machinist fills the stock targets on their own' };
      v.w_reset = { t: 'DEFAULT TARGETS', hide: !P.stock, tip: 'txt:Go back to stocking exactly what the next tier needs' };
      v.w_baycount = `${P.jobs.length}/${F.bays} BUSY`;
      for (const j of P.jobs) { v['w_jb_' + j.id] = { w: j.t / j.T * 100 }; v['w_jt_' + j.id] = tm(j.T - j.t); }
      return v;
    },
  };

  // =====================================================================
  // TEST STAND
  // =====================================================================
  const ST = {
    sig(S) { const P = S.pro; return [P.staff.tester, P.rd.r_tester ? 1 : 0, P.fireAuto ? 1 : 0, P.stats.fires > 0 ? 1 : 0, C.isCollapsed('stand:fire'), C.isCollapsed('stand:eng'), C.isCollapsed('stand:rec')].join('|'); },
    build(S) {
      const P = S.pro, F = PRO.fire, t = PRO.staff.tester;
      let h = conHead('Test Stand', 'Burn an engine. Collect what is left.', btn('pro-fire', 0, 'gold', 's_fire', 'data-coach="fire"'));
      h += sect('stand:fire', 'Static fire', {}, `<p class="note">Bolt an engine to the stand and run it for ${F.T} seconds. A good burn teaches the team. A bad one teaches them more.</p>
        ${kv('Engines on hand', 's_eng')}${kv('Burn time', 's_time')}${kv('Cost per burn', 's_cost')}${kv('Data, nominal burn', 's_dok', 'd-up')}${kv('Data, engine lost', 's_dboom', 'd-mid')}${kv('Chance the engine is destroyed', 's_kill', 'd-down')}
        <div class="stand-run"><span class="dim" data-k="s_state"></span>${bar('s_bar', 'tall')}</div>`);
      let eng;
      if (!P.rd.r_tester) eng = '<p class="empty">Research the Test Engineer in R&amp;D (8 Data) to run static fires unattended.</p>';
      else if (!P.staff.tester) eng = `<div class="row" style="--cols:minmax(0,1fr) auto auto"><span><b>${t.name}</b> <span class="dim">${esc(t.desc)}</span></span><span class="num dim">${money(t.cost)} · ${money(t.salary)}/s</span>${btn('pro-hire', 'tester', '', 's_hire')}</div>`;
      else eng = `<div class="row" style="--cols:minmax(0,1fr) auto"><span><b>${t.name}</b> <span class="dim">on payroll · ${money(t.salary)}/s</span></span>${btn('pro-fireauto', 0, 'tiny', 's_auto')}</div><p class="note">Auto fire uses spare engines only. Turn it off while you are saving engines for an assembly.</p>`;
      h += sect('stand:eng', 'Test Engineer', {}, eng);
      h += sect('stand:rec', 'Record', {}, `${kv('Static fires', 's_fires')}${kv('Engines lost on the stand', 's_lost')}${kv('Data collected, total', 's_dtotal')}`);
      return h;
    },
    update(S) {
      const P = S.pro, F = PRO.fire, fx = E.proFx(), v = {};
      const job = P.jobs.find((j) => j.kind === 'fire'), blk = E.proFireBlock();
      v.s_fire = Object.assign({ t: 'STATIC FIRE' }, gate(blk, `Run an engine for ${F.T}s. ${money(F.cost)}.`));
      v.s_eng = String(P.parts.engine);
      v.s_time = F.T + 's';
      v.s_cost = money(F.cost);
      v.s_dok = '+' + fmt(F.data * fx.dataMult);
      v.s_dboom = '+' + fmt(F.dataBoom * fx.dataMult);
      v.s_kill = pct0(E.proFireKill());
      v.s_state = job ? `BURNING · ${tm(job.T - job.t)} left` : blk ? blk : 'Stand is clear';
      v.s_bar = { w: job ? job.t / job.T * 100 : 0 };
      v.s_hire = Object.assign({ t: 'HIRE' }, gate(E.proHireBlock('tester'), 'Hire the Test Engineer'));
      v.s_auto = { t: P.fireAuto ? 'AUTO FIRE: ON' : 'AUTO FIRE: OFF', cls: { on: !!P.fireAuto }, tip: 'txt:Runs a static fire whenever a spare engine and a free bay exist' };
      v.s_fires = String(P.stats.fires);
      v.s_lost = String(P.stats.boomFires);
      v.s_dtotal = fmt(P.dataTotal);
      return v;
    },
  };

  // =====================================================================
  // R&D
  // =====================================================================
  const RD = {
    sig(S) { const P = S.pro; return [Object.keys(P.rd).join(), C.isCollapsed('rd:rel'), C.isCollapsed('rd:done'), C.isCollapsed('rd:locked')].join('|'); },
    build(S) {
      const P = S.pro;
      let h = conHead('R&D', 'Spend Data on reliability and tooling. Every test also teaches the team for free.', `<span class="rd-data"><span class="dim">DATA</span> <b data-k="r_data"></b></span>`);
      const rel = SUBS.map((s) => `<div class="row rel-row" style="--cols:84px minmax(0,1fr) 54px"><span>${pimg(s, '', 1)} ${partName(s)}</span><div class="bar tall"><i data-k="r_bar_${s}"></i></div><b class="num" data-k="r_rel_${s}"></b></div>
        <div class="rel-note dim" data-k="r_note_${s}"></div>`).join('');
      h += sect('rd:rel', 'Reliability', { ctl: '<span class="dim" data-k="r_weak"></span>' }, rel + `<p class="note" data-k="r_next"></p>`);
      const node = (r) => {
        const reqs = r.req.filter((q) => !P.rd[q]).map((q) => PRO.rd.find((x) => x.id === q).name);
        const done = !!P.rd[r.id];
        return `<div class="row rd-row ${done ? 'done' : ''}" style="--cols:minmax(0,1fr) 66px auto"><span><b>${esc(r.name)}</b><br><span class="dim">${esc(r.desc)}${reqs.length ? ` <span class="need">Needs ${esc(reqs.join(', '))}.</span>` : ''}</span></span><span class="num">${done ? '' : r.cost + ' DATA'}</span>${done ? '<span class="num dim">DONE</span>' : btn('pro-rd', r.id, '', 'r_buy_' + r.id)}</div>`;
      };
      const avail = PRO.rd.filter((r) => !P.rd[r.id] && E.proRdAvailable(r.id)), locked = PRO.rd.filter((r) => !P.rd[r.id] && !E.proRdAvailable(r.id)), done = PRO.rd.filter((r) => P.rd[r.id]);
      h += sect('rd:avail', 'Available', { count: avail.length }, avail.length ? avail.map(node).join('') : '<p class="empty">Nothing available. Everything else needs a node you do not have yet.</p>');
      if (locked.length) h += sect('rd:locked', 'Locked', { count: locked.length }, locked.map(node).join(''));
      if (done.length) h += sect('rd:done', 'Completed', { count: done.length }, done.map(node).join(''));
      return h;
    },
    update(S) {
      const P = S.pro, fx = E.proFx(), v = {};
      v.r_data = fmt(P.data);
      let weak = SUBS[0];
      for (const s of SUBS) {
        const r = E.proRel(s);
        if (r < E.proRel(weak)) weak = s;
        const learn = Math.min(PRO.rel.learnCap, P.learn[s]);
        v['r_bar_' + s] = { w: r * 100 };
        v['r_rel_' + s] = pct0(r);
        v['r_note_' + s] = `${pct0(PRO.rel.base[s])} base${fx.rel[s] ? ` + ${pct0(fx.rel[s])} R&D` : ''} + ${(learn * 100).toFixed(1)}% learned (cap ${pct0(PRO.rel.learnCap)})`;
      }
      v.r_weak = 'weakest: ' + partName(weak).toLowerCase();
      const i = E.proNextTier();
      v.r_next = `Next tier, ${tierName(i)}: ${pct0(E.proOdds(i))} success. The odds are the product of the reliabilities of every part on the vehicle${P.pressure ? `, times ${P.pressure} point${P.pressure > 1 ? 's' : ''} of Board pressure` : ''}.`;
      for (const r of PRO.rd) {
        if (P.rd[r.id]) continue;
        const av = E.proRdAvailable(r.id), short = r.cost - P.data;
        v['r_buy_' + r.id] = { t: 'BUY', dis: !av || short > 0, cls: { gold: av && short <= 0 }, tip: 'txt:' + (!av ? 'Needs an earlier node first' : short > 0 ? `Needs ${fmt(short)} more Data` : r.desc) };
      }
      return v;
    },
  };

  // =====================================================================
  // LAUNCH
  // =====================================================================
  const partChips = (T) => SUBS.filter((s) => T.parts[s]).map((s) => { const ok = E.S.pro.parts[s] >= T.parts[s]; return `<span class="chip-p ${ok ? 'ok' : 'no'}">${SHORT[s]} ${E.S.pro.parts[s]}/${T.parts[s]}</span>`; }).join(' ');
  const LA = {
    sig(S) {
      const P = S.pro, asm = P.jobs.find((j) => j.kind === 'assemble');
      return [P.rocket ? P.rocket.tier : -1, asm ? asm.id : 0, P.attempt ? P.attempt.id : 0, Object.keys(P.cleared).join(), P.rd.r_legs ? 1 : 0, Object.values(P.contracts).join(), C.isCollapsed('launch:pad'), C.isCollapsed('launch:tiers')].join('|');
    },
    build(S) {
      const P = S.pro, asm = P.jobs.find((j) => j.kind === 'assemble');
      const cur = P.rocket ? P.rocket.tier : asm ? asm.tier : E.proNextTier();
      let main;
      if (P.attempt) main = btn('pro-att', TIERS[P.attempt.tier].id, 'gold', 'l_main');
      else if (P.rocket) main = btn('pro-att', TIERS[P.rocket.tier].id, 'gold', 'l_main', 'data-coach="launch"');
      else main = btn('pro-asm', TIERS[cur].id, 'gold', 'l_main', 'data-coach="launch"');
      let h = conHead('Launch Complex', 'One pad. Four tiers. Assemble a vehicle, then fly it.', main);
      h += sect('launch:pad', 'Pad 1', {}, `<div class="padstat"><b data-k="l_stat"></b><span class="dim" data-k="l_sub"></span></div>${bar('l_bar', 'tall')}<p class="note" data-k="l_note"></p>`);
      const rows = TIERS.map((T, i) => {
        const c = PRO.contracts.find((x) => x.tier === i);
        return `<div class="row tier-row" style="--cols:minmax(0,1fr) 54px auto">
          <span><b>${T.name}</b> <span class="tag" data-k="l_tag_${i}"></span><br><span class="dim">${esc(T.goal)}</span><br><span data-k="l_parts_${i}"></span>${c ? `<br><span class="dim" data-k="l_con_${i}"></span>` : ''}</span>
          <span class="num"><b data-k="l_odds_${i}"></b><br><span class="dim">odds</span></span>
          <span class="tier-act">${btn('pro-asm', T.id, '', 'l_asm_' + i)}${btn('pro-att', T.id, 'gold', 'l_att_' + i)}</span>
          <span class="dim tier-eco" data-k="l_eco_${i}"></span></div>`;
      }).join('');
      h += sect('launch:tiers', 'Tiers', {}, rows);
      return h;
    },
    update(S) {
      const P = S.pro, v = {}, asm = P.jobs.find((j) => j.kind === 'assemble'), att = P.attempt;
      const cur = att ? att.tier : P.rocket ? P.rocket.tier : asm ? asm.tier : E.proNextTier();
      // header action
      if (att) v.l_main = { t: 'IN FLIGHT', dis: true, tip: 'txt:The vehicle is flying' };
      else if (P.rocket) { const b = E.proAttemptBlock(P.rocket.tier); v.l_main = Object.assign({ t: 'LAUNCH ' + tierName(P.rocket.tier).toUpperCase() }, gate(b, `Fly it. Odds ${pct0(E.proOdds(P.rocket.tier))}. Launch fee ${money(TIERS[P.rocket.tier].fee)}.`)); }
      else { const b = E.proAssembleBlock(cur); v.l_main = Object.assign({ t: (asm ? 'ASSEMBLING ' : 'ASSEMBLE ') + tierName(cur).toUpperCase() }, asm ? { dis: true, tip: 'txt:Assembly in progress' } : gate(b, `Assemble the ${tierName(cur)} vehicle, ${tm(E.proJobTime('assemble', null, cur))}.`)); }
      // pad status
      if (att) { const T = TIERS[att.tier]; v.l_stat = 'FLIGHT: ' + T.name.toUpperCase(); v.l_sub = `T+${Math.floor(att.t)}s of ${att.T}s · odds ${pct0(att.p)}`; v.l_bar = { w: att.t / att.T * 100 }; v.l_note = 'Nothing to do now. Watch the pad.'; }
      else if (asm) { v.l_stat = 'ASSEMBLING: ' + tierName(asm.tier).toUpperCase(); v.l_sub = tm(asm.T - asm.t) + ' left'; v.l_bar = { w: asm.t / asm.T * 100 }; v.l_note = 'Clicking MACHINE PART in the Workshop also speeds this up.'; }
      else if (P.rocket) { v.l_stat = 'ON THE PAD: ' + tierName(P.rocket.tier).toUpperCase(); v.l_sub = `odds ${pct0(E.proOdds(P.rocket.tier))} · fee ${money(TIERS[P.rocket.tier].fee)}`; v.l_bar = { w: 100 }; v.l_note = 'A failure destroys the vehicle. Its parts are not refunded.'; }
      else { v.l_stat = 'PAD EMPTY'; v.l_sub = 'next: ' + tierName(cur); v.l_bar = { w: 0 }; v.l_note = 'Assembling takes the parts off the shelf and uses a bay.'; }
      for (let i = 0; i < TIERS.length; i++) {
        const T = TIERS[i], cleared = P.cleared[T.id] || 0, tb = E.proTierBlock(i);
        v['l_tag_' + i] = cleared ? `CLEARED${cleared > 1 ? ' x' + cleared : ''}` : tb ? 'LOCKED' : i === E.proNextTier() ? 'NEXT' : '';
        v['l_parts_' + i] = { h: partChips(T) };
        v['l_odds_' + i] = pct0(E.proOdds(i));
        v['l_eco_' + i] = `fee ${money(T.fee)} · pays ${money(T.reward.cash)} · +${T.data || '?'} Data on success, +${T.failData} on failure`;
        v['l_asm_' + i] = Object.assign({ t: 'ASSEMBLE', hide: !!(P.rocket && P.rocket.tier === i) }, gate(E.proAssembleBlock(i), `Assemble: ${T.name}`));
        v['l_att_' + i] = Object.assign({ t: 'LAUNCH', hide: !(P.rocket && P.rocket.tier === i) }, att ? { dis: true, tip: 'txt:The vehicle is flying' } : gate(E.proAttemptBlock(i), `Fly the ${T.name}`));
        const c = PRO.contracts.find((x) => x.tier === i);
        if (c) { const st = P.contracts[c.id]; v['l_con_' + i] = st === 'accepted' ? `Contract: ${c.name} for ${c.client}, ${money(c.reward)} on success.` : st === 'done' ? `Contract delivered: ${c.name}.` : E.proContractOffered(c) ? `A contract is waiting in Funding: ${c.name}, ${money(c.reward)}.` : ''; }
      }
      return v;
    },
  };

  // =====================================================================
  // FUNDING
  // =====================================================================
  const FU = {
    sig(S) { const P = S.pro; return [P.cards.map((c) => c.id).join(), JSON.stringify(P.contracts), JSON.stringify(P.grants), Object.keys(P.cleared).join(), P.unlocked.launch ? 1 : 0, C.isCollapsed('funding:cards'), C.isCollapsed('funding:contracts'), C.isCollapsed('funding:grants')].join('|'); },
    build(S) {
      const P = S.pro;
      let h = conHead('Funding', 'Contracts, grants and investors. The Board has opinions about all three.');
      if (P.cards.length) {
        h += sect('funding:cards', 'Investors', { count: P.cards.length }, P.cards.map((cd) => { const c = PRO.pitches.find((x) => x.id === cd.id); return `<div class="pitch"><h4>${esc(c.title)}</h4><p>${esc(c.text)}</p><div class="flex">${btn('pro-pitch', 'a', 'gold', 'f_pa').replace('></button>', `>${esc(c.a.label)}</button>`)}${btn('pro-pitch', 'b', '', 'f_pb').replace('></button>', `>${esc(c.b.label)}</button>`)}</div></div>`; }).join(''));
      }
      const offered = PRO.contracts.filter((c) => E.proContractOffered(c) || P.contracts[c.id]);
      h += sect('funding:contracts', 'Contracts', { count: offered.length }, offered.length ? offered.map((c) => {
        const st = P.contracts[c.id];
        return `<div class="row" style="--cols:minmax(0,1fr) 70px auto"><span><b>${esc(c.name)}</b> <span class="dim">${esc(c.client)} · rides on ${tierName(c.tier)}</span><br><span class="dim">${esc(c.text)}</span></span><span class="num d-up">${money(c.reward)}</span>${st === 'done' ? '<span class="num dim">PAID</span>' : st === 'accepted' ? '<span class="num dim">ACCEPTED</span>' : btn('pro-contract', c.id, '', 'f_c_' + c.id)}</div>`;
      }).join('') : '<p class="empty">No contracts on the board. Clients call once you have something that flies.</p>');
      h += sect('funding:grants', 'Grants', { count: PRO.grants.filter((g) => P.grants[g.id]).length + '/' + PRO.grants.length }, PRO.grants.map((g) => {
        const done = !!P.grants[g.id], cond = g.cond[0] === 'tier' ? `Clear ${TIERS.find((t) => t.id === g.cond[1]).name}` : `Collect ${g.cond[1]} Data`;
        return `<div class="row" style="--cols:minmax(0,1fr) 70px auto"><span><b>${esc(g.name)}</b><br><span class="dim">${esc(g.text)}</span></span><span class="num d-up">${money(g.cash)}</span>${done ? '<span class="num dim">CLAIMED</span>' : btn('pro-grant', g.id, '', 'f_g_' + g.id)}<span class="dim need-line" data-k="f_gp_${g.id}"></span></div>`;
      }).join(''));
      h += sect('funding:board', 'The Board', {}, `<p class="note" data-k="f_board"></p>`);
      return h;
    },
    update(S) {
      const P = S.pro, v = {};
      for (const c of PRO.contracts) {
        const taken = PRO.contracts.some((x) => x.tier === c.tier && P.contracts[x.id] === 'accepted');
        v['f_c_' + c.id] = { t: 'ACCEPT', dis: taken, cls: { gold: !taken }, tip: 'txt:' + (taken ? 'Another contract already rides on this tier' : `Rides on the next ${tierName(c.tier)} attempt and pays ${money(c.reward)} on success. A failure forfeits it.`) };
      }
      for (const g of PRO.grants) {
        const ok = E.proGrantReady(g), prog = g.cond[0] === 'data' ? `${fmt(Math.min(P.dataTotal, g.cond[1]))}/${g.cond[1]} Data` : '';
        v['f_g_' + g.id] = { t: 'CLAIM', dis: !ok, cls: { gold: ok }, tip: 'txt:' + (ok ? `Claim ${money(g.cash)}` : g.cond[0] === 'tier' ? `Clear ${TIERS.find((t) => t.id === g.cond[1]).name} first` : `Collect ${g.cond[1]} Data in total first`) };
        v['f_gp_' + g.id] = ok ? '' : prog;
      }
      v.f_board = P.pressure || P.ore ? `${P.pressure ? `Board pressure ${P.pressure}: every launch has ${P.pressure * 3}% worse odds. ` : ''}${P.ore ? `Ore promises: ${P.ore}. They become starting research when mining begins.` : ''}` : 'No promises made yet. Investors will ask for some.';
      return v;
    },
  };

  PX.start = function () {
    const P = UI.PANELS;
    P.pro_workshop = WS; P.pro_stand = ST; P.pro_rd = RD; P.pro_launch = LA; P.pro_funding = FU;
  };
  PX.start();

  // =====================================================================
  // ACTIONS
  // =====================================================================
  PX.act = function (name, arg, el) {
    const S = E.S, P = S.pro;
    let ok = true;
    switch (name) {
      case 'pro-pick': proPick = arg === 'auto' ? null : arg; C.resetSig(); audio('select'); return true;
      case 'pro-click': {
        const hand = P.hand;
        const r = E.proClick(hand ? hand.type : proPick || undefined);
        if (!r) audio('deny');
        return !!r;
      }
      case 'pro-fab': ok = !!E.proFab(arg); audio(ok ? 'buy' : 'deny'); break;
      case 'pro-hire': ok = E.proHire(arg); audio(ok ? 'buy' : 'deny'); break;
      case 'pro-fire': ok = !!E.proStaticFire(); audio(ok ? 'buy' : 'deny'); break;
      case 'pro-asm': ok = !!E.proAssemble(arg); audio(ok ? 'buy' : 'deny'); break;
      case 'pro-att': ok = !!E.proAttempt(arg); if (!ok) audio('deny'); break;
      case 'pro-rd': ok = E.proBuyRD(arg); audio(ok ? 'research' : 'deny'); break;
      case 'pro-contract': ok = E.proAcceptContract(arg); audio(ok ? 'buy' : 'deny'); break;
      case 'pro-grant': ok = E.proClaimGrant(arg); if (ok) { audio('sell'); if (el) C.floatAt(el, '+' + money(PRO.grants.find((g) => g.id === arg).cash)); } else audio('deny'); break;
      case 'pro-pitch': ok = E.proResolvePitch(0, arg); C.resetCard(); audio(ok ? 'research' : 'deny'); break;
      case 'pro-stock': { const [s, d] = arg.split(':'); ok = E.proSetStock(s, E.proStock()[s] + +d); audio('select'); break; }
      case 'pro-stockreset': E.proClearStock(); audio('select'); break;
      case 'pro-auto': E.proSetAuto(!P.auto); break;
      case 'pro-fireauto': E.proSetFireAuto(!P.fireAuto); break;
      case 'pro-skip': {
        const now = performance.now();
        if (!(confirmAt.skip > now)) { confirmAt.skip = now + 3000; if (el) el.textContent = 'SURE? CLICK AGAIN'; return 'quiet'; }
        confirmAt.skip = 0; E.proSkip(); return true;
      }
      case 'pro-begin': return beginOperations();
    }
    return ok;
  };

  // =====================================================================
  // MONITOR: JOB LIST (Flight Deck slot)
  // =====================================================================
  let deckStruct = '', deckHtml = '', opsAt = 0;
  const NEXT_BTN = { pro_workshop: 'WORKSHOP', pro_stand: 'TEST STAND', pro_launch: 'LAUNCH' };
  PX.renderDeck = function (box) {
    const S = E.S, P = S.pro;
    const rows = P.jobs.map((j) => ({ id: 'j' + j.id, j }));
    if (P.hand) rows.push({ id: 'hand', hand: P.hand });
    if (P.attempt) rows.push({ id: 'a' + P.attempt.id, a: P.attempt });
    if (!rows.length) {
      const now = performance.now();
      if (deckStruct !== 'ops') { deckStruct = 'ops'; opsAt = 0; }
      if (now - opsAt < 400) return;
      opsAt = now;
      const g = E.proGoal(), t = goalTab(g);
      const h = `<div class="ops panel"><div class="deck-head"><h3>HANGAR OPS</h3><span class="tog">NOTHING RUNNING</span></div>
        <div class="ops-stats"><span>BAYS <b>${E.proFx().bays - P.jobs.length}/${E.proFx().bays}</b> FREE</span><span>PARTS <b>${SUBS.map((s) => SHORT[s] + ' ' + P.parts[s]).join(' · ')}</b></span></div>
        <p class="ops-order"><span class="dim">BOARD ORDER</span><br>${esc(g ? g.text : 'Await certification.')}</p>
        <div class="flex"><button class="btn gold" data-act="tab" data-arg="${t}">GO TO ${(NEXT_BTN[t] || 'CONSOLE')}</button></div></div>`;
      if (h !== deckHtml) { deckHtml = h; box.innerHTML = h; }
      return;
    }
    const struct = 'r|' + rows.map((r) => r.id).join();
    if (struct !== deckStruct) {
      deckStruct = struct; deckHtml = '';
      let h = `<div class="deck panel"><div class="deck-head"><h3>${P.attempt ? 'FLIGHT DECK' : 'BAYS'}</h3><span class="tog">${E.proFx().bays - P.jobs.length}/${E.proFx().bays} FREE</span></div><div class="deck-rows">`;
      for (const r of rows) {
        const ico = r.j ? jobIcon(r.j) : r.hand ? pimg(r.hand.type, '', 2) : `<img class="pico" src="${SPR.icon('rocket')}" alt="">`;
        h += `<div class="frow pro"><span class="fico">${ico}</span><div class="fmain"><div class="fname" data-pt="${r.id}"></div><div class="bar thin ${r.a ? '' : 'good'}"><i data-pb="${r.id}"></i></div></div><div class="fstate" data-ps="${r.id}"></div></div>`;
      }
      h += `</div><div class="deck-foot"><span>Cash <b class="gold">${money(S.money)}</b></span><button class="btn tiny" data-act="tab" data-arg="${goalTab(E.proGoal())}">${P.attempt ? 'LAUNCH CONSOLE' : 'OPEN CONSOLE'}</button></div></div>`;
      box.innerHTML = h;
    }
    for (const r of rows) {
      const t = box.querySelector(`[data-pt="${r.id}"]`), b = box.querySelector(`[data-pb="${r.id}"]`), s = box.querySelector(`[data-ps="${r.id}"]`);
      if (!t) continue;
      let name, f, st;
      if (r.j) { name = jobTitle(r.j); f = r.j.t / r.j.T; st = tm(r.j.T - r.j.t); }
      else if (r.hand) { name = 'Hand-machining ' + partName(r.hand.type).toLowerCase(); f = r.hand.p; st = Math.round(f * 100) + '%'; }
      else { const T = TIERS[r.a.tier]; name = `LAUNCH · ${T.name} · odds ${pct0(r.a.p)}`; f = r.a.t / r.a.T; st = 'T+' + Math.floor(r.a.t) + 's'; }
      if (t.textContent !== name) t.textContent = name;
      if (b) b.style.width = Math.min(100, f * 100) + '%';
      if (s && s.textContent !== st) s.textContent = st;
    }
  };

  // =====================================================================
  // MONITOR: INVESTOR CARDS (the same card as the mining incidents)
  // =====================================================================
  let cardSig = null;
  PX.renderCard = function (box) {
    const P = E.S.pro, cd = P.cards[0];
    const s = cd ? cd.id + P.cards.length : '';
    if (s === cardSig) return;
    cardSig = s;
    if (!cd) { box.hidden = true; box.innerHTML = ''; return; }
    const c = PRO.pitches.find((x) => x.id === cd.id);
    box.innerHTML = `<div class="dcard panel pitch-card"><div class="spread"><span class="tog">INVESTOR${P.cards.length > 1 ? ' · ' + P.cards.length + ' PENDING' : ''}</span><span class="tog">NO DEADLINE</span></div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p>
      <div class="flex"><button class="btn gold" data-act="pro-pitch" data-arg="a" data-tip="txt:${esc(fxText(c.a.fx))}">${esc(c.a.label)}</button><button class="btn" data-act="pro-pitch" data-arg="b" data-tip="txt:${esc(fxText(c.b.fx))}">${esc(c.b.label)}</button></div></div>`;
    box.hidden = false;
  };
  PX.resetCard = () => { cardSig = null; };
  const origReset = C.resetCard;
  C.resetCard = function () { cardSig = null; origReset(); };
  function fxText(fx) {
    const o = [];
    if (fx.cash) o.push('+' + money(fx.cash));
    if (fx.data) o.push('+' + fx.data + ' Data');
    if (fx.pressure) o.push('Board pressure +' + fx.pressure + ' (launch odds worse)');
    if (fx.ore) o.push('ore promise (starting research later)');
    if (fx.learn) o.push('the team learns a little');
    return o.join(', ');
  }

  // =====================================================================
  // EVENTS
  // =====================================================================
  PX.event = function (kind, p) {
    const sc = AT.scene;
    if (sc && sc.proEvent) sc.proEvent(kind, p);
    switch (kind) {
      case 'proClick': {
        audio(p.mode === 'hand' ? 'mine' : 'tab');
        if (p.mode === 'hand' && p.p >= 0.999) { audio('sell'); const b = $('.mach'); if (b) C.floatAt(b, PRO.parts[p.type].name.toUpperCase() + ' DONE'); }
        break;
      }
      case 'proJobStart': if (p.kind === 'assemble') audio('tab'); break;
      case 'proJobDone':
        if (p.kind === 'fab') audio('buy');
        if (p.kind === 'assemble') { audio('research'); C.toast('rocket', 'VEHICLE READY', TIERS[p.tier].name + ' vehicle assembled on the pad.'); }
        break;
      case 'proStaticFire':
        if (p.boom) { audio('lost'); C.toast('warn', 'ENGINE LOST', 'It came apart on the stand. +' + fmt(p.data) + ' Data.'); }
        else { audio('return'); C.toast('flame', 'STATIC FIRE', 'Nominal burn. +' + fmt(p.data) + ' Data.'); }
        break;
      case 'proAttemptStart': audio('launch'); break;
      case 'proAttemptResult':
        if (p.ok) { audio('return'); C.toast('star', TIERS.find((t) => t.id === p.tier).name.toUpperCase() + ' COMPLETE', '+' + money(p.cash) + ', +' + fmt(p.data) + ' Data.'); }
        else { audio('lost'); C.toast('warn', 'VEHICLE LOST', `${partName(p.cause)} failure at ${Math.round(p.at * 100)}% of the flight. +${fmt(p.data)} Data.`); }
        break;
      case 'proTier': audio('ach'); if (sc && sc.burst && (p.tier === 'orbit' || p.tier === 'recover')) sc.burst(); break;
      case 'proPitch': audio('card'); PX.resetCard(); break;
      case 'certified': showCert(p); break;
      case 'proSkip': {
        C.shellChanged(); C.saveGame();
        C.toast('trophy', 'PROLOGUE WAIVED', 'The Board had already seen one.');
        break;
      }
    }
  };

  // =====================================================================
  // CERTIFICATION
  // =====================================================================
  function showCert(sum) {
    const old = $('#ending'); if (old) old.remove();
    C.shellChanged(); C.saveGame();
    const d = document.createElement('div');
    d.id = 'ending'; d.className = 'cert';
    let i = 0;
    const L = (txt, cls) => `<p class="${cls || ''}" style="animation-delay:${(1 + i++ * 1.6).toFixed(1)}s">${txt}</p>`;
    const rel = Object.keys(sum.rel).map((s) => `${partName(s)} ${pct0(sum.rel[s])}`).join(' · ');
    const lines = [
      L(esc(PRO.story.pro_license), 'story'),
      L('AstroTech Mining Co. Est. 2187.', 'brand'),
      L(`Time to license <b>${tm(sum.time)}</b> · Rockets lost <b>${sum.fails}</b> of <b>${sum.attempts}</b> attempts`, 'sum'),
      L(`Reliability <b>${pct0(sum.relAvg)}</b> (${esc(rel)})`, 'sum'),
      L(`<b>${fmt(sum.dataLeft)}</b> Data became <b>${fmt(sum.rp)}</b> RP${sum.bonus > 0.0005 ? ` · Prospector risk <b>-${Math.round(sum.bonus * 100)}%</b>` : ''}`, 'sum'),
    ];
    const delay = (1 + i * 1.6).toFixed(1);
    d.innerHTML = `<div class="lines">${lines.join('')}
      <div class="cert-name" style="animation-delay:${delay}s"><label for="cert-name">Name the vehicle</label><input id="cert-name" type="text" maxlength="28" value="${esc(sum.name || PRO.carry.rocketName)}" autocomplete="off" spellcheck="false"></div>
      <div class="flex" style="animation-delay:${(+delay + 0.6).toFixed(1)}s;opacity:0;animation-name:fadein;animation-duration:1s;animation-timing-function:steps(4);animation-fill-mode:forwards"><button class="btn gold big" data-act="pro-begin">BEGIN OPERATIONS<small>the full company opens up</small></button></div></div>`;
    document.body.appendChild(d);
    audio('prestige');
    const inp = $('#cert-name', d);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); beginOperations(); } });
    setTimeout(() => { if (document.body.contains(inp) && document.activeElement === document.body) { try { inp.focus({ preventScroll: true }); inp.select(); } catch (e) { /* no focus */ } } }, (+delay + 1) * 1000);
  }
  function beginOperations() {
    const d = $('#ending.cert'), inp = $('#cert-name');
    if (inp && inp.value.trim()) E.proRename(inp.value);
    if (d) d.remove();
    C.resetMonitor(); C.resetSig(); C.saveGame();
    audio('ach');
    return true;
  }
  PX.showCert = showCert;
})(window.AT = window.AT || {});

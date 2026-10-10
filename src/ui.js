// AstroTech v2 — UI controller: consoles, flight board, decision cards, tooltips, saving, main loop.
(function (AT) {
  'use strict';
  const E = AT.E, SPR = AT.SPR, fmt = AT.fmt;
  const UI = AT.ui = {};
  const SAVE_KEY = 'astrotech.save.v2';
  const native = window.astrotechNative || null;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const money = (x) => '$' + fmt(x);
  const pct = (x) => AT.fmtPct(x);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let tab = 'missions', sig = null, refs = [], tipEl, tipKey = null, tipX = 0, tipY = 0;
  let lowTab = 'flights', lowSig = null, cardSig = null, resPage = 0;
  const confirmUntil = {};
  const cache = new WeakMap();

  // =====================================================================
  // TABS
  // =====================================================================
  const TABS = [
    { id: 'missions', label: 'Missions', icon: 'mission' },
    { id: 'fleet', label: 'Fleet', icon: 'rocket' },
    { id: 'crew', label: 'Crew', icon: 'crew' },
    { id: 'market', label: 'Market', icon: 'market' },
    { id: 'outposts', label: 'Outposts', icon: 'outpost' },
    { id: 'research', label: 'Research', icon: 'research' },
    { id: 'projects', label: 'Projects', icon: 'projects' },
    { id: 'company', label: 'Company', icon: 'company' },
    { id: 'expansion', label: 'Expansion', icon: 'expansion' },
    { id: 'archive', label: 'Archive', icon: 'stats' },
  ];
  function updateReveal() {
    const S = E.S, R = S.reveal, M = E.mults();
    const rev = (id, cond) => {
      if (!R[id] && cond) {
        R[id] = 1;
        if (!['missions', 'fleet', 'archive'].includes(id)) { R['new_' + id] = 1; E.log('New console online: ' + TABS.find((t) => t.id === id).label.toUpperCase() + '.', 'info'); }
      }
    };
    rev('missions', true); rev('fleet', true); rev('archive', true);
    rev('crew', S.ships.length > 0 || S.region > 0);
    rev('market', S.stats.oreMined > 0 || S.region > 0);
    rev('research', S.earnedTotal >= 150 || S.region > 0);
    rev('projects', AT.PROJECTS.some((p) => E.projectVisible(p)) || S.region > 0);
    rev('outposts', !!M.flags.outposts || E.ownedOutposts() > 0);
    rev('company', S.earnedTotal >= 1500 || S.region > 0);
    rev('expansion', S.peakEquity >= 2e7 || S.region > 0);
    if (S.run.sold > 0) R.contracts = 1;
  }
  function directiveTab() {
    const d = E.directive();
    if (!d) return null;
    const t = d.cond[0];
    if (t === 'ships' || t === 'pads' || t.startsWith('hull_')) return 'fleet';
    if (t === 'launched' || t === 'surveyed' || t === 'missions' || t.startsWith('class_') || t.startsWith('region_') || t === 'exp') return 'missions';
    if (t === 'sold' || t === 'contracts' || t === 'rep') return 'market';
    if (t === 'pilots' || t.startsWith('staff_')) return 'crew';
    if (t === 'research') return 'research';
    if (t.startsWith('outposts')) return 'outposts';
    if (t.startsWith('layer') || t.startsWith('challenges') || t === 'ended') return 'expansion';
    if (t === 'artifacts') return 'archive';
    return null;
  }
  function renderTabs() {
    const S = E.S, hint = directiveTab();
    const html = TABS.filter((t) => S.reveal[t.id]).map((t) =>
      `<button class="btn tab ${t.id === tab ? 'active' : ''} ${S.reveal['new_' + t.id] ? 'new' : ''} ${hint === t.id && t.id !== tab ? 'hint' : ''}" data-act="tab" data-arg="${t.id}"><img src="${SPR.icon(t.icon)}" alt="" class="pixel">${t.label}<span class="dot"></span></button>`).join('');
    const nav = $('#tabs');
    if (nav._html !== html) { nav.innerHTML = html; nav._html = html; }
  }

  // =====================================================================
  // BINDER
  // =====================================================================
  function apply(vals, list) {
    for (const el of list) {
      const v = vals[el.dataset.k];
      if (v === undefined) continue;
      let c = cache.get(el);
      if (!c) { c = {}; cache.set(el, c); }
      if (typeof v === 'string' || typeof v === 'number') { if (c.t !== v) { el.textContent = v; c.t = v; } continue; }
      if (v.t !== undefined && c.t !== v.t) { el.textContent = v.t; c.t = v.t; }
      if (v.h !== undefined && c.h !== v.h) { el.innerHTML = v.h; c.h = v.h; }
      if (v.dis !== undefined && c.dis !== v.dis) { el.disabled = v.dis; c.dis = v.dis; }
      if (v.w !== undefined && c.w !== v.w) { el.style.width = Math.max(0, Math.min(100, v.w)) + '%'; c.w = v.w; }
      if (v.tip !== undefined && c.tip !== v.tip) { el.dataset.tip = v.tip; c.tip = v.tip; }
      if (v.cls) for (const k in v.cls) el.classList.toggle(k, !!v.cls[k]);
      if (v.hide !== undefined) el.hidden = !!v.hide;
    }
  }
  function render() {
    const S = E.S, M = E.mults();
    if (!S.reveal[tab]) tab = 'missions';
    const T = PANELS[tab];
    const s = tab + '|' + T.sig(S, M);
    const body = $('#tabbody');
    if (s !== sig) {
      const st = body.scrollTop;
      body.innerHTML = T.build(S, M);
      refs = $$('[data-k]', body);
      sig = s;
      body.scrollTop = st;
      if (T.after) T.after(body, S, M);
    }
    apply(T.update(S, M), refs);
    if (T.draw) T.draw(body, S, M);
  }
  const btn = (act, arg, cls, k, extra) => `<button class="btn ${cls || ''}" data-act="${act}" data-arg="${arg}" ${k ? `data-k="${k}"` : ''} ${extra || ''}></button>`;
  const LAYER_ICON = ['cc', 'cs', 'ss', 'dm'];
  function rk(hull, maxH, cls) {
    const c = SPR.rocket(hull);
    const sc = Math.max(1, Math.floor(maxH / c.height));
    return `<img class="rk ${cls || ''}" src="${SPR.rocketURL(hull)}" width="${c.width * sc}" height="${c.height * sc}" alt="">`;
  }
  const RISKCOL = (r) => (r < 0.15 ? 'd-up' : r < 0.35 ? 'd-mid' : 'd-down');

  // =====================================================================
  // PANELS
  // =====================================================================
  const PANELS = {};

  // ----------------------------- MISSIONS -----------------------------
  function bestFor(t, M) {
    const S = E.S;
    const pool = S.ships.filter((s) => E.canFly(s, M));
    const list = pool.length ? pool : S.ships;
    let best = null;
    for (const sh of list) { const p = E.plan(sh, t, M); if (!best || p.ev > best.p.ev) best = { sh, p }; }
    return best;
  }
  function sortedTargets(S, M) {
    const list = S.targets.slice();
    const mode = S.settings.sort || 'value';
    const key = (t) => {
      if (t.story) return -Infinity;
      if (mode === 'dist') return t.dist;
      const b = bestFor(t, M);
      if (!b) return 0;
      if (mode === 'risk') return b.p.shownRisk;
      return -b.p.ev;
    };
    const k = new Map(list.map((t) => [t, key(t)]));
    return list.sort((a, b) => (a.region - b.region) * 0 + k.get(a) - k.get(b));
  }
  PANELS.missions = {
    sig(S, M) {
      const ids = S.targets.map((t) => t.id + (t.surveyed ? 's' : '') + (t.outpost ? 'o' : '')).join(',');
      return ids + '|' + S.selTarget + '|' + S.ships.map((s) => s.id).join(',') + '|' + (S.settings.sort || 'value') + '|' + S.focus + '|' + S.region + (M.flags.outposts ? 'O' : '') + (M.flags.flight ? 'F' : '') + (M.flags.fleetai ? 'A' : '') + (S._sortTick || 0);
    },
    build(S, M) {
      let h = `<div class="tabhead"><h2>Mission Control</h2><div class="seg">
        <span class="tog">SORT</span>${['value', 'risk', 'dist'].map((m) => `<button class="btn" data-act="sort" data-arg="${m}" data-k="sort_${m}">${m === 'value' ? '$/MIN' : m === 'risk' ? 'RISK' : 'DIST'}</button>`).join('')}</div></div>
        <div class="mc-status slot"><span data-k="padsfree"></span><span data-k="tracking"></span><span data-k="nextfind"></span>
        ${M.flags.flight ? btn('dispatch', 0, 'gold', 'dispatch', 'data-tip="txt:Send every idle ship to its best target under your risk limit."') : ''}</div>`;
      if (S.region > 0) h += `<div class="seg focus"><span class="tog">TELESCOPE FOCUS</span>${['auto', ...Array.from({ length: S.region + 1 }, (_, i) => String(i))].map((f) => `<button class="btn" data-act="focus" data-arg="${f}" data-k="focus_${f}">${f === 'auto' ? 'AUTO' : AT.REGIONS[+f].short}</button>`).join('')}</div>`;
      const sel = S.selTarget && E.targetById(S.selTarget);
      if (sel) h += targetCard(sel, S, M);
      else h += `<div class="slot teaser">CLICK A TARGET BELOW OR ON THE SYSTEM MAP TO PLAN A MISSION.</div>`;
      h += `<h3 class="section-h">TRACKED TARGETS</h3><div class="tlist">`;
      for (const t of sortedTargets(S, M)) {
        const cls = AT.CLASSES[t.cls];
        h += `<div class="trow slot ${t.id === S.selTarget ? 'sel' : ''} ${t.story ? 'story' : ''}" data-act="seltarget" data-arg="${t.id}" data-tip="tgt:${t.id}">
          <img class="tico" src="${SPR.bodyIcon(t)}" alt="">
          <div class="tmain"><div class="tname">${t.story ? '<span class="star">★</span> ' : ''}${esc(t.name)}</div>
            <div class="tsub"><span class="chip-c" style="--c:${cls.tint}">${cls.name}</span> ${AT.REGIONS[t.region].short} ${t.surveyed ? '' : '<span class="unk">UNSURVEYED</span>'}${t.rich && t.surveyed ? ' <span class="rich">RICH</span>' : ''}${t.outpost ? ' <span class="opst">OUTPOST</span>' : ''}</div>
            ${t.story ? '' : `<div class="bar thin"><i data-k="tres_${t.id}"></i></div>`}</div>
          <div class="tnum"><b data-k="tval_${t.id}"></b><span data-k="ttime_${t.id}"></span></div>
          <div class="trisk" data-k="trisk_${t.id}"></div></div>`;
      }
      h += '</div>';
      return h;
    },
    update(S, M) {
      const v = {};
      for (const m of ['value', 'risk', 'dist']) v['sort_' + m] = { cls: { on: (S.settings.sort || 'value') === m } };
      v.padsfree = `PADS ${E.padsFree()}/${S.pads} FREE`;
      const tracked = S.targets.filter((t) => !t.story && !t.outpost).length;
      v.tracking = `TRACKING ${tracked}/${E.targetCap(M)}`;
      v.nextfind = tracked >= E.targetCap(M) ? 'TELESCOPE FULL' : `NEXT FIND ${Math.ceil(Math.max(0, E.discoveryInterval(M) - S.discT))}s`;
      if (M.flags.flight) v.dispatch = { t: 'DISPATCH IDLE', dis: !S.ships.some((s) => E.canFly(s, M)) || E.padsFree() <= 0 };
      v['focus_' + 'auto'] = { cls: { on: S.focus === 'auto' } };
      for (let i = 0; i <= S.region; i++) v['focus_' + i] = { cls: { on: S.focus === String(i) } };
      for (const t of S.targets) {
        if (!t.story) {
          const size = t.size * (M.flags.deep ? 100 : 1);
          v['tres_' + t.id] = { w: E.targetLeft(t, M) / size * 100 };
        }
        const b = bestFor(t, M);
        if (b) {
          v['tval_' + t.id] = t.story ? 'EXPEDITION' : money(b.p.value * b.p.valMult) + '/trip';
          v['ttime_' + t.id] = AT.fmtTime(b.p.T) + ' · ' + money(b.p.ev * 60) + '/min';
          v['trisk_' + t.id] = { t: pct(b.p.shownRisk), cls: { 'd-up': b.p.shownRisk < 0.15, 'd-mid': b.p.shownRisk >= 0.15 && b.p.shownRisk < 0.35, 'd-down': b.p.shownRisk >= 0.35 } };
        } else { v['tval_' + t.id] = '—'; v['ttime_' + t.id] = 'no ships'; v['trisk_' + t.id] = { t: '', cls: {} }; }
      }
      const sel = S.selTarget && E.targetById(S.selTarget);
      if (sel) Object.assign(v, targetCardUpdate(sel, S, M));
      return v;
    },
  };
  function compBar(t) {
    const comp = E.shownComp(t);
    const parts = Object.entries(comp).sort((a, b) => b[1] - a[1]);
    const bar = parts.map(([id, f]) => `<i style="width:${(f * 100).toFixed(1)}%;background:${AT.ORES[id].pal[2]}"></i>`).join('');
    const legend = parts.map(([id, f]) => `<span>${SPR.oreImg(id)}${AT.ORES[id].name} <b>${Math.round(f * 100)}%</b></span>`).join('');
    return `<div class="comp">${bar}</div><div class="legend">${legend}${t.surveyed ? '' : '<span class="unk">ESTIMATED</span>'}</div>`;
  }
  function targetCard(t, S, M) {
    const cls = AT.CLASSES[t.cls];
    const x = t.story ? E.EXP[t.story] : null;
    let h = `<div class="tcard slot ${t.story ? 'story' : ''}">
      <div class="spread"><div class="flex"><img class="tico lg" src="${SPR.bodyIcon(t)}" alt=""><div><h3>${esc(t.name)}</h3><div class="tsub"><span class="chip-c" style="--c:${cls.tint}">${cls.long}</span> · ${AT.REGIONS[t.region].name}</div></div></div>
      <div class="flex"><button class="btn ghost" data-act="closeup" data-arg="${t.id}" data-tip="txt:Show this target in the viewport close-up.">CLOSE-UP</button>${t.story || t.outpost ? '' : btn('drop', t.id, 'ghost', 'drop')}</div></div>`;
    if (x) h += `<p class="note story-text">${esc(x.intro)}</p>`;
    else h += compBar(t);
    h += `<div class="facts"><span data-k="tc_dist"></span><span data-k="tc_haz"></span><span data-k="tc_res"></span><span data-k="tc_out"></span></div>`;
    if (!t.story) h += `<div class="flex acts">${btn('survey', t.id, '', 'tc_survey')}${M.flags.outposts ? btn('outpost', t.id, '', 'tc_outpost') : ''}${t.outpost ? btn('upout', t.id, 'gold', 'tc_upout', 'data-rep="1"') : ''}</div>`;
    h += `<h4 class="section-h">ASSIGN A SHIP</h4><div class="shiplist">`;
    if (!S.ships.length) h += `<div class="teaser">NO SHIPS YET. BUY ONE IN THE FLEET CONSOLE.</div>`;
    for (const sh of S.ships) {
      h += `<div class="srow" data-tip="ship:${sh.id}">${rk(sh.hull, 34)}
        <div class="smain"><div class="sname">${esc(sh.name)} <span class="hull">${E.HULL[sh.hull].name}</span></div><div class="ssub" data-k="sp_${sh.id}"></div></div>
        <div class="snum" data-k="sn_${sh.id}"></div>
        ${btn('launch', sh.id + ':' + t.id, 'gold', 'sl_' + sh.id)}</div>`;
    }
    return h + '</div></div>';
  }
  function targetCardUpdate(t, S, M) {
    const v = {};
    const sz = t.size * (M.flags.deep ? 100 : 1);
    v.tc_dist = `DIST ${fmt(t.dist * AT.DIST_SCALE[t.region])} ${AT.DIST_UNIT[t.region]}`;
    v.tc_haz = `HAZARD ${Math.round((t.surveyed ? t.haz : t.hazEst) * 100)}%${t.surveyed ? '' : ' (EST)'}`;
    v.tc_res = t.story ? 'ONE-TIME EXPEDITION' : `RESERVE ${fmt(E.targetLeft(t, M))}t (${Math.round(E.targetLeft(t, M) / sz * 100)}%)`;
    v.tc_out = t.outpost ? `${AT.OUTPOST.names[t.region].toUpperCase()} LV ${t.outpost.lvl} · ${fmt(E.outpostRate(t, M))}t/s` : '';
    if (!t.story) {
      const sb = E.surveyBlock(t, M);
      const sv = S.surveys.find((x) => x.target === t.id);
      v.tc_survey = { h: t.surveyed ? 'SURVEYED<small>exact data</small>' : sv ? `PROBE EN ROUTE<small>${Math.ceil(sv.T - sv.t)}s</small>` : `SURVEY<small>${money(E.surveyCost(t, M))}</small>`, dis: !!sb, tip: 'txt:' + (sb || 'Send a probe. Reveals exact composition and hazard, lowers mission risk, and may find a rich vein.') };
      if (M.flags.outposts) {
        const ob = E.outpostBlock(t, M);
        const bd = S.builds.find((b) => b.target === t.id);
        v.tc_outpost = { h: t.outpost ? 'OUTPOST ONLINE<small>see Outposts</small>' : bd ? `BUILDING<small>${Math.ceil(bd.T - bd.t)}s</small>` : `BUILD ${AT.OUTPOST.names[t.region].toUpperCase()}<small>${money(E.outpostCost(t, M))}</small>`, dis: !!ob, tip: 'txt:' + (ob || 'Build a permanent mining base. It ships ore continuously until the reserve runs out.') };
      }
      if (t.outpost) { const c = E.outpostUpCost(t, M); v.tc_upout = { h: `UPGRADE<small>${money(c)}</small>`, dis: S.money < c || t.outpost.lvl >= AT.OUTPOST.maxLevel }; }
      v.drop = { t: 'DROP', tip: 'txt:Stop tracking this target. Frees a telescope slot.' };
    }
    for (const sh of S.ships) {
      const p = E.plan(sh, t, M);
      const pilot = sh.pilot ? E.pilotById(sh.pilot) : null;
      const st = sh.state === 'mission' ? 'ON MISSION' : sh.state === 'repair' ? `REPAIR ${Math.ceil(sh.repairT)}s` : 'READY';
      v['sp_' + sh.id] = `${pilot ? pilot.name + ' L' + pilot.level : (M.flags.aipilots ? 'AI pilot' : M.flags.autopilot ? 'Autopilot' : 'NO PILOT')} · hull ${Math.round(sh.cond * 100)}% · ${st}`;
      v['sn_' + sh.id] = { h: `<b>${money(p.value * p.valMult)}</b><span>${AT.fmtTime(p.T)} · <em class="${RISKCOL(p.shownRisk)}">${pct(p.shownRisk)} risk</em></span>` };
      const block = E.launchBlock(sh, t, M);
      v['sl_' + sh.id] = { h: block ? 'LAUNCH<small>—</small>' : `LAUNCH<small>${money(p.launch)} fee</small>`, dis: !!block, tip: 'txt:' + (block || 'Launch fee ' + money(p.launch) + '. Outcome is rolled at launch: success, partial, failure, or lost.') };
    }
    return v;
  }

  // ----------------------------- FLEET -----------------------------
  PANELS.fleet = {
    sig(S, M) {
      return S.ships.map((s) => s.id + s.hull).join(',') + '|' + AT.HULLS.filter((h) => E.hullUnlocked(h, M)).length + '|' + [...new Set(S.ships.map((s) => s.hull))].join() + (M.flags.flight ? 'F' : '') + (M.flags.autobuy ? 'B' : '') + (M.flags.autorepair ? 'R' : '') + S.region;
    },
    build(S, M) {
      let h = `<div class="tabhead"><h2>Fleet & Infrastructure</h2>${M.flags.autobuy ? `<div class="seg"><span class="tog">AUTO-BUY</span>${btn('autobuy', 'pads', '', 'ab_pads')}${btn('autobuy', 'ships', '', 'ab_ships')}${btn('autobuy', 'modules', '', 'ab_modules')}</div>` : ''}</div>
        <div class="cards three">
          <div class="card slot"><h4>${SPR.img('pad')} Launch Pads</h4><p data-k="pad_txt"></p>${btn('pad', 0, 'gold', 'pad_btn')}</div>
          <div class="card slot"><h4>${SPR.img('scope')} Observatory</h4><p data-k="obs_txt"></p>${btn('obs', 0, '', 'obs_btn')}</div>
          <div class="card slot"><h4>${SPR.img('probe')} Survey Probes</h4><p data-k="probe_txt"></p>${btn('probe', 0, '', 'probe_btn')}</div>
        </div>
        <h3 class="section-h">SHIPYARD</h3><div class="cards">`;
      let shownLocked = 0;
      for (const hl of AT.HULLS) {
        if (hl.region > S.region) continue;
        const un = E.hullUnlocked(hl, M);
        if (!un) { if (shownLocked++ >= 1) continue; }
        h += `<div class="card slot hullcard ${un ? '' : 'locked'}" data-tip="hull:${hl.id}"><div class="flex">${rk(hl.id, 52, 'lg')}<div><h4>${hl.name}</h4><p>${hl.desc}</p></div></div>
          <div class="hstats"><span>CARGO <b>${fmt(hl.cargo)}t</b></span><span>SPEED <b>${hl.speed}</b></span><span>RELIAB. <b>${Math.round(hl.rel * 100)}%</b></span><span>DRILL <b>${fmt(hl.drill)}t/s</b></span></div>
          ${un ? btn('buyship', hl.id, 'gold', 'bs_' + hl.id) : `<div class="teaser">RESEARCH ${E.RES[hl.unlock] ? E.RES[hl.unlock].name.toUpperCase() : ''}</div>`}</div>`;
      }
      h += '</div>';
      const owned = [...new Set(S.ships.map((s) => s.hull))];
      if (owned.length) {
        h += `<h3 class="section-h">FLEET UPGRADES <span class="sub">apply to every ship of that hull</span></h3><div class="list">`;
        for (const hid of owned) {
          h += `<div class="slot modrow"><div class="flex">${rk(hid, 28)}<b>${E.HULL[hid].name}</b></div><div class="seg">`;
          for (const mod of AT.MODULES) h += btn('mod', hid + ':' + mod.id, '', `md_${hid}_${mod.id}`, `data-tip="mod:${hid}:${mod.id}" data-rep="1"`);
          h += '</div></div>';
        }
        h += '</div>';
      }
      h += `<h3 class="section-h">SHIPS <span class="sub" data-k="shipcount"></span></h3><div class="list">`;
      for (const sh of S.ships) {
        h += `<div class="shiprow slot" data-tip="ship:${sh.id}">${rk(sh.hull, 34)}
          <div class="smain"><div class="sname">${esc(sh.name)} <span class="hull">${E.HULL[sh.hull].name}</span></div>
          <div class="ssub" data-k="fs_${sh.id}"></div><div class="bar thin cond"><i data-k="fc_${sh.id}"></i></div></div>
          <div class="seg">${M.flags.flight ? btn('repeat', sh.id, '', 'fr_' + sh.id, 'data-tip="txt:When on, this ship relaunches to its last target as soon as it returns."') : ''}${btn('repair', sh.id, '', 'fp_' + sh.id)}${btn('scrap', sh.id, 'ghost', 'fx_' + sh.id)}</div></div>`;
      }
      if (!S.ships.length) h += '<div class="slot teaser">BUY A PROSPECTOR TO START FLYING MISSIONS.</div>';
      return h + '</div>';
    },
    update(S, M) {
      const v = {};
      const mp = E.maxPads(M);
      v.pad_txt = `${S.pads} built (max ${mp}). Each pad lets one more mission fly at the same time. ${E.padsFree()} free now.`;
      v.pad_btn = { h: S.pads >= mp ? 'MAXED<small>—</small>' : `BUILD PAD<small>${money(E.padCost(M))}</small>`, dis: S.pads >= mp || S.money < E.padCost(M) };
      v.obs_txt = `Level ${S.obs}. Finds a target every ${AT.fmtTime(E.discoveryInterval(M))}. Tracks up to ${E.targetCap(M)}.`;
      v.obs_btn = { h: S.obs >= AT.OBS.max ? 'MAXED<small>—</small>' : `UPGRADE<small>${money(E.obsCost(M))}</small>`, dis: S.obs >= AT.OBS.max || S.money < E.obsCost(M) };
      v.probe_txt = `${S.probes} probe${S.probes > 1 ? 's' : ''}. ${S.surveys.length} surveying now. More probes run more surveys at once.`;
      v.probe_btn = { h: S.probes >= AT.PROBE.max ? 'MAXED<small>—</small>' : `BUY PROBE<small>${money(E.probeCost(M))}</small>`, dis: S.probes >= AT.PROBE.max || S.money < E.probeCost(M) };
      if (M.flags.autobuy) for (const k of ['pads', 'ships', 'modules']) v['ab_' + k] = { t: k.toUpperCase(), cls: { on: S.autobuy[k] } };
      for (const hl of AT.HULLS) if (E.hullUnlocked(hl, M)) { const c = E.shipPrice(hl.id, M); v['bs_' + hl.id] = { h: `BUY<small>${money(c)}</small>`, dis: S.money < c }; }
      for (const hid of new Set(S.ships.map((s) => s.hull))) for (const mod of AT.MODULES) {
        const lv = E.moduleLevel(hid, mod.id), mx = E.moduleMax(mod), c = E.moduleCost(hid, mod, M);
        v[`md_${hid}_${mod.id}`] = { h: `${mod.name.split(' ')[0].toUpperCase()} ${lv}/${mx}<small>${lv >= mx ? 'MAX' : money(c)}</small>`, dis: lv >= mx || S.money < c };
      }
      v.shipcount = `${S.ships.length} owned · ${S.missions.length} flying`;
      for (const sh of S.ships) {
        const pilot = sh.pilot ? E.pilotById(sh.pilot) : null;
        const st = sh.state === 'mission' ? 'ON MISSION' : sh.state === 'repair' ? `IN REPAIR ${Math.ceil(sh.repairT)}s` : 'READY';
        const tgt = sh.lastTarget && E.targetById(sh.lastTarget);
        v['fs_' + sh.id] = `${st} · ${pilot ? pilot.name + ' (L' + pilot.level + ')' : M.flags.aipilots ? 'AI pilot' : M.flags.autopilot ? 'Autopilot' : 'NO PILOT'} · ${sh.missions} missions${tgt ? ' · last: ' + tgt.name : ''}`;
        v['fc_' + sh.id] = { w: sh.cond * 100, cls: { bad: sh.cond < 0.5 } };
        if (M.flags.flight) v['fr_' + sh.id] = { t: sh.repeat ? 'REPEAT ON' : 'REPEAT OFF', cls: { on: sh.repeat } };
        const rc = E.rushCost(sh, M);
        v['fp_' + sh.id] = sh.state === 'repair' ? { h: `RUSH<small>${money(rc)}</small>`, dis: S.money < rc } : { h: `REPAIR<small>${sh.cond >= 0.999 ? 'OK' : AT.fmtTime(E.repairTime(sh, M))}</small>`, dis: sh.cond >= 0.999 || sh.state !== 'idle' };
        v['fx_' + sh.id] = { h: `SCRAP<small>+${money((sh.paid || 0) * 0.25)}</small>`, dis: sh.state === 'mission' };
      }
      return v;
    },
  };

  // ----------------------------- CREW -----------------------------
  PANELS.crew = {
    sig(S, M) { return S.pilots.map((p) => p.id + ':' + p.ship).join(',') + '|' + S.candidates.map((c) => c.id).join(',') + (M.flags.autohire ? 'A' : '') + (M.rules.noStaff ? 'X' : '') + (M.flags.aipilots ? 'I' : ''); },
    build(S, M) {
      let h = `<div class="tabhead"><h2>Crew</h2><span class="tog" data-k="payroll"></span></div>
        <h3 class="section-h">PILOTS <span class="sub">${M.flags.aipilots ? 'optional now. AI pilots fly any empty ship' : 'every ship needs one until you research Autopilot'}</span></h3><div class="list">`;
      for (const p of S.pilots) {
        const tr = AT.TRAITS.find((x) => x.id === p.trait);
        h += `<div class="prow slot" data-tip="pilot:${p.id}"><img class="face" src="${SPR.portrait(p)}" alt="">
          <div class="smain"><div class="sname">${esc(p.name)} ${p.founder ? '<span class="hull">FOUNDER</span>' : ''} <span class="lvl" data-k="pl_${p.id}"></span></div>
          <div class="ssub"><span class="trait">${tr.name}</span> · <span data-k="ps_${p.id}"></span></div><div class="bar thin xp"><i data-k="px_${p.id}"></i></div></div>
          ${p.founder ? '' : btn('firepilot', p.id, 'ghost', 'pf_' + p.id)}</div>`;
      }
      h += `</div><h3 class="section-h">CANDIDATES <span class="sub" data-k="candt"></span></h3><div class="cards three">`;
      for (const c of S.candidates) {
        const tr = AT.TRAITS.find((x) => x.id === c.trait);
        h += `<div class="card slot cand" data-tip="trait:${c.trait}"><div class="flex"><img class="face lg" src="${SPR.portrait(c)}" alt=""><div><h4>${esc(c.name)}</h4><p>Level ${c.level} · <span class="trait">${tr.name}</span></p></div></div><p>${tr.desc}</p>${btn('hirepilot', c.id, 'gold', 'hc_' + c.id)}</div>`;
      }
      h += `</div><div class="flex" style="margin:6px 0 4px">${btn('refreshcand', 0, '', 'refreshcand')}</div>
        <h3 class="section-h">STAFF ${M.flags.autohire ? btn('autohire', 0, '', 'autohire') : ''}</h3><div class="list">`;
      for (const c of AT.STAFF) {
        h += `<div class="row slot" data-tip="staff:${c.id}"><div class="art"><img src="${SPR.icon(c.id === 'scientist' ? 'research' : c.id === 'trader' ? 'market' : c.id === 'analyst' ? 'scope' : 'crew')}" alt="" style="width:30px;height:30px"></div>
          <div class="meta"><div class="name">${c.name}s <span class="own" data-k="c_${c.id}_n"></span></div><div class="line" data-k="c_${c.id}_fx"></div></div>
          <div class="acts">${btn('fire', c.id, 'ghost', 'c_' + c.id + '_fire')}${btn('hire', c.id, 'gold', 'c_' + c.id + '_hire', 'data-rep="1"')}</div></div>`;
      }
      return h + '</div>';
    },
    update(S, M) {
      const v = {};
      const pay = E.salaryRate(M);
      v.payroll = { t: S.strike ? `STRIKE: PAYROLL ${money(pay)}/s UNPAID` : `PAYROLL ${money(pay)}/s`, cls: { 'd-down': S.strike } };
      for (const p of S.pilots) {
        const sh = p.ship ? E.shipById(p.ship) : null;
        v['pl_' + p.id] = 'L' + p.level;
        v['ps_' + p.id] = `${sh ? 'flies ' + sh.name : p.injured > S.time ? `recovering ${Math.ceil(p.injured - S.time)}s` : 'waiting for a ship'} · risk -${Math.round((1 - Math.pow(0.94, p.level - 1)) * 100)}% · ${money(E.pilotSalary(p, M))}/s`;
        v['px_' + p.id] = { w: p.level >= AT.PILOT.maxLevel ? 100 : p.xp / E.xpNeed(p) * 100 };
        if (!p.founder) v['pf_' + p.id] = { h: 'FIRE<small>—</small>', dis: !!(sh && sh.state === 'mission') };
      }
      v.candt = `new candidates in ${Math.ceil(180 - S.candT)}s`;
      for (const c of S.candidates) { const cost = E.pilotCost(c, M); v['hc_' + c.id] = { h: `HIRE<small>${money(cost)}</small>`, dis: S.money < cost }; }
      const rc = E.pilotCost({ level: 1 }, M) * 0.2;
      v.refreshcand = { h: `NEW CANDIDATES<small>${money(rc)}</small>`, dis: S.money < rc };
      for (const c of AT.STAFF) {
        const n = S.staff[c.id];
        v[`c_${c.id}_n`] = String(n);
        let fx = '';
        if (c.id === 'engineer') fx = `Repairs +${n * 15}% faster · upgrades -${Math.round((1 - Math.max(0.5, Math.pow(0.98, n))) * 100)}%`;
        if (c.id === 'trader') fx = `Market depth +${n * 12}% · recovery +${n * 6}% · contracts +${n * 3}%`;
        if (c.id === 'scientist') fx = `${fmt(E.rpRate(M))} research/s total`;
        if (c.id === 'analyst') fx = `Discovery +${n * 12}% · surveys ${Math.round((1 - Math.max(0.25, Math.pow(0.95, n))) * 100)}% faster`;
        v[`c_${c.id}_fx`] = fx;
        const cost = E.hireCost(c.id, M);
        v[`c_${c.id}_hire`] = { h: M.rules.noStaff ? 'BLOCKED<small>challenge</small>' : `HIRE<small>${money(cost)}</small>`, dis: M.rules.noStaff || S.money < cost };
        v[`c_${c.id}_fire`] = { h: 'FIRE<small>-1</small>', dis: n <= 0 };
      }
      if (M.flags.autohire) v.autohire = { t: S.autohire ? 'AUTO-HIRE ON' : 'AUTO-HIRE OFF', cls: { on: S.autohire } };
      return v;
    },
  };

  // ----------------------------- MARKET -----------------------------
  PANELS.market = {
    ores(S) { return Object.keys(AT.ORES).filter((id) => AT.ORES[id].region <= S.region && (S.ores[id] > 0 || S.market[id].inflow > 0 || AT.ORES[id].region === S.region || id === 'iron')); },
    sig(S, M) { return this.ores(S).join() + '|' + S.contracts.map((c) => c.id).join() + (M.flags.autosell ? 'A' : '') + (M.flags.analytics ? 'N' : ''); },
    build(S, M) {
      let h = `<div class="tabhead"><h2>Market & Contracts</h2>${btn('sellall', 0, 'gold big', 'sellall')}</div>`;
      h += `<h3 class="section-h">${SPR.img('contract')} CLIENT CONTRACTS <span class="sub" data-k="repline"></span></h3><div class="bar rep"><i data-k="repbar"></i></div><div class="cards contracts">`;
      if (!S.contracts.length) h += `<div class="slot teaser" style="grid-column:1/-1">NO CONTRACTS ON THE BOARD. NEW CLIENTS CALL EVERY FEW MINUTES.</div>`;
      for (const c of S.contracts) {
        h += `<div class="card slot contract"><div class="spread"><h4>${esc(c.client)}</h4>${btn('dismiss', c.id, 'ghost tiny', '', 'data-tip="txt:Decline this contract. Costs 1 reputation."')}</div>
          <p>${E.contractText(c)}</p><div class="bar"><i data-k="cp_${c.id}"></i></div>
          <div class="spread"><span data-k="ct_${c.id}"></span><span class="gold">${money(c.reward)} · +${c.rep} REP</span></div>${btn('deliver', c.id, 'gold', 'cd_' + c.id)}</div>`;
      }
      h += `</div><h3 class="section-h">${SPR.img('market')} ORE EXCHANGE</h3><p class="note">Big sales flood the market and push that ore's price down. Prices recover over time. Selling into strong demand pays best.</p>`;
      if (M.flags.autosell) h += `<div class="slot spread" style="margin-bottom:8px"><span class="tog">AUTO-SELL</span><div class="seg">${[['off', 'OFF'], ['always', 'ALWAYS'], ['80', 'DEMAND ≥ 80%'], ['100', 'DEMAND ≥ 100%']].map(([m, l]) => `<button class="btn" data-act="autosell" data-arg="${m}" data-k="as_${m}">${l}</button>`).join('')}</div></div>`;
      h += '<div class="list">';
      for (const id of this.ores(S)) {
        h += `<div class="mrow slot" data-tip="ore:${id}"><img class="ico lg pixel" src="${SPR.oreIcon(id)}" alt="">
          <div><div class="nm">${AT.ORES[id].name}</div><div class="held" data-k="h_${id}"></div></div>
          <div class="px-col"><div data-k="p_${id}"></div><div class="held" data-k="d_${id}"></div></div>
          <canvas width="48" height="14" class="px" data-spark="${id}"></canvas>
          <div class="seg">${btn('sell', id + ':0.25', '', 's25_' + id)}${btn('sell', id + ':1', 'gold', 'sall_' + id)}</div></div>`;
      }
      return h + '</div>';
    },
    update(S, M) {
      const v = {};
      let total = 0;
      for (const id of this.ores(S)) {
        const m = S.market[id], q = S.ores[id];
        const est = E.sellEstimate(id, 1, M);
        total += est;
        v['h_' + id] = 'Hold: ' + fmt(q) + 't';
        v['p_' + id] = money(E.price(id, M)) + '/t';
        let trend = '';
        if (M.flags.analytics) { const d = m.t - m.d; trend = d > 0.03 ? ' ↑' : d < -0.03 ? ' ↓' : ' →'; }
        v['d_' + id] = { t: 'Demand ' + Math.round(m.d * 100) + '%' + trend, cls: { 'd-up': m.d > 1.05, 'd-down': m.d < 0.85 } };
        v['s25_' + id] = { t: '25%', dis: q <= 0 };
        v['sall_' + id] = { h: `ALL<small>${money(est)}</small>`, dis: q <= 0 };
      }
      v.sellall = { h: `SELL EVERYTHING<small>≈ ${money(total)}</small>`, dis: total <= 0 };
      for (const m of ['off', 'always', '80', '100']) v['as_' + m] = { cls: { on: S.autosell === m } };
      const lvl = E.repLevel(), next = AT.REP_LEVELS[lvl + 1];
      v.repline = `REPUTATION LEVEL ${lvl}${next ? ` · ${fmt(S.rep)}/${next}` : ' · MAX'} · ore prices +${Math.round((Math.pow(AT.REP_VALUE, lvl) - 1) * 100)}% · ${E.contractSlots(M)} slots`;
      v.repbar = { w: next ? (S.rep - AT.REP_LEVELS[lvl]) / (next - AT.REP_LEVELS[lvl]) * 100 : 100 };
      for (const c of S.contracts) {
        const have = c.type === 'deliver' ? S.ores[c.ore] : c.prog;
        v['cp_' + c.id] = { w: Math.min(1, have / c.n) * 100 };
        v['ct_' + c.id] = `${fmt(Math.min(have, c.n))}/${fmt(c.n)} · ${AT.fmtTime(c.expires - S.time)} left`;
        v['cd_' + c.id] = { h: E.contractReady(c) ? 'DELIVER<small>collect reward</small>' : 'IN PROGRESS<small>—</small>', dis: !E.contractReady(c) };
      }
      return v;
    },
    draw(body, S) {
      for (const c of $$('canvas[data-spark]', body)) {
        const h = S.market[c.dataset.spark].hist, g = c.getContext('2d');
        g.clearRect(0, 0, 48, 14);
        g.fillStyle = '#34459a';
        for (let x = 0; x < 48; x += 2) g.fillRect(x, 7, 1, 1);
        const pts = h.slice(-48);
        for (let k = 0; k < pts.length; k++) {
          const y = Math.round(13 - Math.min(1.8, pts[k]) / 1.8 * 12);
          g.fillStyle = pts[k] >= 1 ? '#6be08a' : pts[k] < 0.85 ? '#ff6b6b' : '#ffd866';
          g.fillRect(48 - pts.length + k, y, 1, 1);
        }
      }
    },
  };

  // ----------------------------- OUTPOSTS -----------------------------
  PANELS.outposts = {
    sig(S) { return S.targets.filter((t) => t.outpost).map((t) => t.id).join() + '|' + S.builds.map((b) => b.target).join(); },
    build(S, M) {
      let h = `<div class="tabhead"><h2>Outposts</h2><span class="tog" data-k="optotal"></span></div>
        <p class="note">Permanent bases on surveyed targets. Build one from a target's card in Mission Control. Up to ${AT.OUTPOST.perRegion} per region; levels go to ${AT.OUTPOST.maxLevel}.</p><div class="list">`;
      for (const b of S.builds) { const t = E.targetById(b.target); if (t) h += `<div class="slot oprow"><img class="tico" src="${SPR.bodyIcon(t)}" alt=""><div class="smain"><div class="sname">${esc(t.name)}</div><div class="ssub">UNDER CONSTRUCTION</div><div class="bar thin"><i data-k="ob_${t.id}"></i></div></div></div>`; }
      const ops = S.targets.filter((t) => t.outpost);
      if (!ops.length && !S.builds.length) h += `<div class="slot teaser">NO OUTPOSTS YET. SURVEY A RICH TARGET, THEN BUILD FROM ITS MISSION CARD.</div>`;
      for (const t of ops) {
        h += `<div class="slot oprow" data-act="seltarget" data-arg="${t.id}"><img class="tico" src="${SPR.bodyIcon(t)}" alt=""><div class="smain"><div class="sname">${esc(t.name)} <span class="hull">${AT.OUTPOST.names[t.region]}</span> <span class="lvl" data-k="ol_${t.id}"></span></div>
          <div class="ssub" data-k="os_${t.id}"></div><div class="bar thin"><i data-k="or_${t.id}"></i></div></div>
          <div class="seg">${btn('upout', t.id, 'gold', 'ou_' + t.id, 'data-rep="1"')}${btn('upout10', t.id, '', 'oux_' + t.id)}</div></div>`;
      }
      return h + '</div>';
    },
    update(S, M) {
      const v = {};
      let tot = 0;
      for (const b of S.builds) v['ob_' + b.target] = { w: b.t / b.T * 100 };
      for (const t of S.targets.filter((x) => x.outpost)) {
        const r = E.outpostRate(t, M), val = r * E.compValue(t, M);
        tot += E.targetLeft(t, M) > 0 ? val : 0;
        const sz = t.size * (M.flags.deep ? 100 : 1);
        v['ol_' + t.id] = 'LV ' + t.outpost.lvl;
        v['os_' + t.id] = E.targetLeft(t, M) > 0 ? `${fmt(r)}t/s · ≈${money(val)}/s at today's prices · ${AT.REGIONS[t.region].short}` : 'RESERVE EXHAUSTED. Research Deep Core Drilling or let it go.';
        v['or_' + t.id] = { w: E.targetLeft(t, M) / sz * 100 };
        const c = E.outpostUpCost(t, M);
        const mx = t.outpost.lvl >= AT.OUTPOST.maxLevel;
        v['ou_' + t.id] = { h: mx ? 'MAX LEVEL<small>—</small>' : `+1 LEVEL<small>${money(c)}</small>`, dis: mx || S.money < c };
        let c10 = 0, l = t.outpost.lvl;
        for (let i = 0; i < 10 && l < AT.OUTPOST.maxLevel; i++, l++) c10 += AT.OUTPOST.cost[t.region] * AT.OUTPOST.lvlCost * Math.pow(AT.OUTPOST.lvlGrowth, l) * M.outpostCost;
        v['oux_' + t.id] = { h: `+10<small>${money(c10)}</small>`, dis: mx || S.money < c10 };
      }
      v.optotal = `≈${money(tot)}/s FROM ${E.ownedOutposts()} OUTPOSTS`;
      return v;
    },
  };

  // ----------------------------- RESEARCH -----------------------------
  PANELS.research = {
    sig(S) { return resPage + '|' + S.region + '|' + AT.RESEARCH.filter((r) => r.region === resPage).map((r) => (S.research[r.id] ? 1 : 0)).join(''); },
    build(S, M) {
      if (resPage > S.region) resPage = 0;
      let h = `<div class="tabhead"><h2>Research</h2><div class="chip slot rp"><img class="ico pixel" src="${SPR.icon('rp')}" alt=""><b data-k="rp"></b><span class="sub" data-k="rprate"></span></div></div>`;
      if (S.region > 0) h += `<div class="seg" style="margin-bottom:8px">${Array.from({ length: S.region + 1 }, (_, i) => `<button class="btn ${i === resPage ? 'on' : ''}" data-act="respage" data-arg="${i}">${AT.REGIONS[i].short}</button>`).join('')}</div>`;
      h += `<p class="note" data-k="rpnote"></p><div class="tree-wrap"><div class="tree" id="tree"><svg id="tree-svg"></svg>`;
      for (const r of AT.RESEARCH.filter((x) => x.region === resPage)) h += `<button class="btn node" style="grid-column:${r.col + 1};grid-row:${r.row + 1}" data-act="res" data-arg="${r.id}" data-tip="res:${r.id}" data-k="n_${r.id}" id="node-${r.id}"></button>`;
      return h + '</div></div>';
    },
    after(body, S) {
      requestAnimationFrame(() => {
        const svg = $('#tree-svg', body), tree = $('#tree', body);
        if (!svg || !tree) return;
        let lines = '';
        for (const r of AT.RESEARCH.filter((x) => x.region === resPage)) {
          const b = $('#node-' + r.id, body);
          for (const q of r.req) {
            const a = $('#node-' + q, body);
            if (!a || !b) continue;
            const x1 = a.offsetLeft + a.offsetWidth, y1 = a.offsetTop + a.offsetHeight / 2, x2 = b.offsetLeft, y2 = b.offsetTop + b.offsetHeight / 2;
            const mx = Math.round(x1 + (x2 - x1) / 2);
            const col = S.research[q] && S.research[r.id] ? '#ffd866' : S.research[q] ? '#8fa6ff' : '#34459a';
            lines += `<path d="M${x1} ${y1}H${mx}V${y2}H${x2}" fill="none" stroke="${col}" stroke-width="3" shape-rendering="crispEdges"/>`;
          }
        }
        svg.setAttribute('width', tree.scrollWidth); svg.setAttribute('height', tree.scrollHeight);
        svg.innerHTML = lines;
      });
    },
    update(S, M) {
      const v = { rp: fmt(S.rp) + ' RP', rprate: '+' + fmt(E.rpRate(M)) + '/s' };
      v.rpnote = M.rules.noResearch ? 'Research is disabled in this challenge.' : M.scientists > 0 ? 'Scientists produce research. Output grows with revenue. Click a node to research it.' : 'Hire Scientists in the Crew console to start producing research.';
      for (const r of AT.RESEARCH.filter((x) => x.region === resPage)) {
        const done = !!S.research[r.id], avail = E.researchAvailable(r);
        v['n_' + r.id] = { h: `${r.name}<small>${done ? 'DONE' : avail ? fmt(r.cost) + ' RP' : 'LOCKED'}</small>`, dis: !done && !(avail && S.rp >= r.cost), cls: { done, lockd: !done && !avail } };
      }
      return v;
    },
  };

  // ----------------------------- PROJECTS -----------------------------
  PANELS.projects = {
    vis(S) { return AT.PROJECTS.filter((p) => E.projectVisible(p)); },
    sig(S) { return this.vis(S).map((p) => p.id).join() + '|' + Object.keys(S.projects).length; },
    build(S) {
      const vis = this.vis(S);
      let h = `<div class="tabhead"><h2>Projects</h2><span class="tog" data-k="pdone"></span></div><p class="note">One-time company initiatives. New ones appear as AstroTech grows.</p>`;
      if (!vis.length) h += '<div class="slot teaser">NO PROJECTS PENDING. KEEP GROWING.</div>';
      h += '<div class="cards">';
      for (const p of vis) h += `<div class="card slot" data-tip="proj:${p.id}"><h4>${p.name}</h4><p>${p.desc}</p>${btn('proj', p.id, 'gold', 'pr_' + p.id)}</div>`;
      h += '</div>';
      const done = AT.PROJECTS.filter((p) => S.projects[p.id]);
      if (done.length) h += `<h3 class="section-h">COMPLETED</h3><div class="note">${done.map((p) => p.name).join(' · ')}</div>`;
      return h;
    },
    update(S) {
      const v = { pdone: Object.keys(S.projects).length + ' COMPLETED' };
      for (const p of this.vis(S)) v['pr_' + p.id] = { h: `FUND<small>${money(p.cost)}</small>`, dis: S.money < p.cost };
      return v;
    },
  };

  // ----------------------------- COMPANY -----------------------------
  PANELS.company = {
    sig(S, M) { return 'co' + (M.incorp ? 1 : 0); },
    build(S, M) {
      let h = `<div class="tabhead"><h2>AstroTech Mining Co.</h2><span class="tog" data-k="status"></span></div>
        <div class="kpis"><div class="kpi slot"><div class="k">VALUATION</div><div class="v" data-k="val"></div></div><div class="kpi slot"><div class="k">YOUR STAKE</div><div class="v" data-k="own"></div></div>
        <div class="kpi slot"><div class="k">YOUR EQUITY</div><div class="v good" data-k="eq"></div></div><div class="kpi slot"><div class="k">PEAK EQUITY THIS RUN</div><div class="v gold" data-k="peak"></div></div></div>
        <div class="slot" style="margin-bottom:10px"><div class="note" style="margin:0" data-k="breakdown"></div></div>`;
      if (!M.incorp) h += `<div class="slot teaser">PRIVATE COMPANY. RESEARCH INCORPORATION TO GO PUBLIC, ISSUE SHARES AND FACE THE QUARTERLY MARKET.</div>`;
      else h += `<div class="kpis"><div class="kpi slot"><div class="k">SHARE PRICE</div><div class="v gold" data-k="sp"></div></div><div class="kpi slot"><div class="k">SHARES OUTSTANDING</div><div class="v" data-k="so"></div></div></div>
          <div class="slot" style="margin-bottom:10px"><div class="spread"><span class="tog">INVESTOR CONFIDENCE</span><span data-k="conf"></span></div><div class="bar tall good"><i data-k="confbar"></i></div>
          <div class="spread" style="margin-top:10px"><span class="tog">THIS QUARTER</span><span data-k="qtxt"></span></div><div class="bar tall ice"><i data-k="qbar"></i></div><div class="note" style="margin:8px 0 0" data-k="qlast"></div></div>
          <div class="cards"><div class="card slot"><h4>Issue New Shares</h4><p>Sell 10% more shares for cash now. Your stake shrinks and confidence dips.</p>${btn('issue', 0, 'gold', 'issue')}</div>
          <div class="card slot"><h4>Share Buyback</h4><p>Retire up to 5% of shares from the public. Your stake grows and confidence rises.</p>${btn('buyback', 0, '', 'buyback')}</div></div>`;
      return h + `<p class="note" style="margin-top:10px">Expansion rewards are based on peak equity this run: valuation times your stake. Valuation tracks revenue, not cash on hand.</p>`;
    },
    update(S, M) {
      const val = E.valuation(M), own = E.ownership();
      const v = { status: M.incorp ? 'PUBLIC · ' + ((M.rules.conf || S.shares.conf) >= 1 ? 'INVESTORS CONTENT' : 'INVESTORS RESTLESS') : 'PRIVATE', val: money(val), own: (own * 100).toFixed(1) + '%', eq: money(val * own), peak: money(S.peakEquity) };
      v.breakdown = `25% of revenue this run ${money(S.earnedRun * 0.25)} + 4 minutes of current revenue ${money(S.incomeEMA * 240)}` + (M.incorp ? `, then x1.5 public premium x${(M.rules.conf || S.shares.conf).toFixed(2)} confidence.` : '.') + (M.valuation > 1 ? ` x${fmt(M.valuation)} challenge bonus.` : '');
      if (M.incorp) {
        const sh = S.shares;
        v.sp = money(E.sharePrice(M)); v.so = fmt(sh.total);
        v.conf = (M.rules.conf || sh.conf).toFixed(2) + ' / 3.00';
        v.confbar = { w: ((M.rules.conf || sh.conf) - 0.25) / 2.75 * 100 };
        const target = sh.lastQ > 0 ? sh.lastQ * (M.flags.guidance ? 1.1 : 1.2) : 0;
        v.qtxt = `${money(sh.qEarn)}${target ? ' of ' + money(target) + ' target' : ' (baseline quarter)'} · ${Math.ceil(90 - sh.qT)}s left`;
        v.qbar = { w: target ? sh.qEarn / target * 100 : sh.qT / 90 * 100 };
        v.qlast = sh.lastResult ? (sh.lastResult.target ? `Last quarter: ${money(sh.lastResult.earned)} vs ${money(sh.lastResult.target)} target, ${sh.lastResult.beat ? 'BEAT' : 'MISSED'}. Beat streak: ${sh.streak}.` : 'Last quarter set the baseline.') : 'Quarterly reports every 90 seconds. Beat the growth target to raise confidence.';
        const cash = E.sharePrice(M) * sh.total * 0.1 * 0.9;
        v.issue = { h: sh.cd > 0 ? `COOLDOWN<small>${Math.ceil(sh.cd)}s</small>` : `ISSUE 10%<small>+${money(cash)}</small>`, dis: sh.cd > 0 };
        const bb = E.buybackInfo(M);
        v.buyback = { h: bb.n > 0 ? `BUY BACK<small>${money(bb.cost)}</small>` : 'NO PUBLIC FLOAT<small>—</small>', dis: bb.n <= 0 || S.money < bb.cost };
      }
      return v;
    },
  };

  // ----------------------------- EXPANSION -----------------------------
  PANELS.expansion = {
    sig(S, M) {
      let s = S.region + '|' + (S.challenge ? S.challenge.id : '-') + '|' + Object.keys(S.chDone).length + '|';
      for (let i = 0; i < AT.LAYERS.length; i++) s += (S.layers[i].runs > 0 || S.layers[i].cur > 0 ? 'r' : '-') + (M.flags['autoLayer' + i] ? 'a' : '') + (M.flags['challenges' + i] ? 'c' : '') + AT.LAYERS[i].milestones.filter((m) => S.layers[i].runs >= m.n).length;
      return s + (E.canEnd() ? 'E' : '');
    },
    build(S, M) {
      let h = `<div class="tabhead"><h2>Expansion</h2><span class="tog">PRESTIGE: RESET FOR PERMANENT POWER</span></div>`;
      if (S.challenge) {
        const c = E.challengeDef(S.challenge);
        h += `<div class="slot challenge-on"><div class="spread"><h3>CHALLENGE: ${c.name}</h3>${btn('abandon', 0, 'bad', 'abandon')}</div><p class="note">${c.desc} Goal: reach ${money(AT.LAYERS[S.challenge.layer].req)} equity. Reward: ${c.reward}</p><div class="bar tall steps"><i data-k="chbar"></i></div></div>`;
      }
      if (S.region >= 4) h += `<div class="layer slot"><h3 style="color:#e8ecff">The Last Transaction</h3><p class="flav">Reach ${money(AT.FINAL_REQ)} in equity. There will be nothing left to buy.</p><div class="bar tall steps"><i data-k="endbar"></i></div><div class="spread" style="margin-top:8px"><span data-k="endtxt"></span>${btn('end', 0, 'gold big', 'endbtn')}</div></div>`;
      for (let i = AT.LAYERS.length - 1; i >= 0; i--) {
        if (S.region < i) continue;
        const L = AT.LAYERS[i], st = S.layers[i];
        h += `<div class="layer slot"><div class="spread"><h3 style="color:${L.color}"><img class="ico pixel" src="${SPR.icon(LAYER_ICON[i])}" alt=""> ${L.name}</h3><span class="cur" data-k="l${i}cur"></span></div>
          <p class="flav">${L.flavor}</p><div class="bar tall steps"><i data-k="l${i}bar"></i></div>
          <div class="spread" style="margin-top:8px"><span data-k="l${i}txt"></span>${btn('prestige', i, 'gold big', 'l' + i + 'btn')}</div>`;
        if (M.flags['autoLayer' + i]) h += `<div class="spread" style="margin-top:10px"><span class="tog">AUTOMATION</span><div class="seg">${btn('daemon', i, '', 'l' + i + 'auto')}${['smart', 1, 2, 5].map((m) => `<button class="btn" data-act="dmode" data-arg="${i}:${m}" data-k="l${i}m${m}" data-tip="txt:${m === 'smart' ? 'Reset when the gain per second starts falling.' : 'Reset when the gain is at least x' + m + ' the previous one.'}">${m === 'smart' ? 'SMART' : 'x' + m + ' LAST'}</button>`).join('')}</div></div>`;
        if (st.runs > 0 || st.cur > 0) {
          h += '<div class="cards" style="margin-top:10px">';
          for (const u of L.upgrades) h += `<div class="card slot sub" data-tip="lup:${i}:${u.id}" data-k="lc_${u.id}"><h4>${u.name} <span class="lvl" data-k="lv_${u.id}"></span></h4><p>${u.desc}</p>${btn('lup', i + ':' + u.id, '', 'lb_' + u.id, 'data-rep="1"')}</div>`;
          h += '</div><h4 class="section-h" style="margin-top:10px">MILESTONES</h4><div class="miles">';
          const all = E.milestoneAll(i);
          for (const ms of L.milestones) h += `<div class="mile ${all || st.runs >= ms.n ? 'got' : ''}"><b>${ms.n}</b><span>${ms.text}</span></div>`;
          h += '</div>';
          if (M.flags['challenges' + i]) {
            h += `<h4 class="section-h" style="margin-top:10px">CHALLENGES <span class="sub">reach ${money(L.req)} equity under a restriction</span></h4><div class="cards">`;
            for (const c of L.challenges) h += `<div class="card slot sub ${S.chDone[c.id] ? 'maxed' : ''}"><h4>${c.name}</h4><p>${c.desc}</p><p class="gold">${c.reward}</p>${S.chDone[c.id] ? '<div class="teaser">COMPLETED</div>' : btn('challenge', i + ':' + c.id, '', 'ch_' + c.id)}</div>`;
            h += '</div>';
          }
        }
        h += '</div>';
      }
      if (S.region < AT.LAYERS.length && S.layers[S.region] && S.layers[S.region].runs === 0 && S.region < 4) h += `<div class="slot teaser">THE ${AT.REGIONS[S.region + 1].name.toUpperCase()} AWAITS.</div>`;
      return h;
    },
    update(S, M) {
      const v = {};
      const now = performance.now();
      if (S.challenge) { v.chbar = { w: Math.log10(Math.max(1, S.peakEquity)) / Math.log10(AT.LAYERS[S.challenge.layer].req) * 100 }; v.abandon = { h: 'ABANDON<small>resets the run</small>' }; }
      for (let i = 0; i < AT.LAYERS.length; i++) {
        if (S.region < i) continue;
        const L = AT.LAYERS[i], st = S.layers[i];
        const g = E.pendingGain(i, M);
        v[`l${i}cur`] = fmt(st.cur) + ' ' + L.sym;
        if (g < 1) { v[`l${i}bar`] = { w: Math.log10(Math.max(1, S.peakEquity)) / Math.log10(L.req) * 100 }; v[`l${i}txt`] = `Peak equity ${money(S.peakEquity)} of ${money(L.req)} needed`; }
        else { v[`l${i}bar`] = { w: 100 }; v[`l${i}txt`] = `+${fmt(g)} ${L.cur} · next at ${money(E.nextGainAt(i, M))} · ${st.runs} done`; }
        const conf = confirmUntil[i] && confirmUntil[i] > now;
        v[`l${i}btn`] = { h: conf ? 'CLICK AGAIN TO CONFIRM<small>this resets your run</small>' : `${L.verb}<small>+${fmt(g)} ${L.sym}</small>`, dis: g < 1, cls: { confirm: conf } };
        if (M.flags['autoLayer' + i]) { v[`l${i}auto`] = { t: st.auto ? 'ON' : 'OFF', cls: { on: st.auto } }; for (const m of ['smart', 1, 2, 5]) v[`l${i}m${m}`] = { cls: { on: String(st.autoMode) === String(m) } }; }
        for (const u of L.upgrades) {
          const lvl = st.upg[u.id] || 0, mx = lvl >= u.max, cost = E.layerUpCost(i, u);
          v['lv_' + u.id] = u.max > 1 ? `${lvl}/${u.max}` : lvl ? 'OWNED' : '';
          v['lb_' + u.id] = { h: mx ? 'MAXED' : `BUY<small>${fmt(cost)} ${L.sym}</small>`, dis: mx || st.cur < cost };
          v['lc_' + u.id] = { cls: { maxed: mx } };
        }
        for (const c of L.challenges) if (!S.chDone[c.id]) v['ch_' + c.id] = { h: S.challenge && S.challenge.id === c.id ? 'IN PROGRESS<small>—</small>' : 'START<small>resets the run</small>', dis: !!S.challenge };
      }
      if (S.region >= 4) { v.endbar = { w: Math.log10(Math.max(1, S.peakEquity)) / Math.log10(AT.FINAL_REQ) * 100 }; v.endtxt = `Peak equity ${money(S.peakEquity)}`; v.endbtn = { h: 'CLOSE THE LEDGER<small>end the game</small>', dis: !E.canEnd() }; }
      return v;
    },
  };

  // ----------------------------- ARCHIVE -----------------------------
  PANELS.archive = {
    sig(S) { return Object.keys(S.ach).length + '|' + Object.keys(S.artifacts).length + '|' + S.memorial.length + '|' + S.dirIdx; },
    build(S) {
      let h = `<div class="tabhead"><h2>Archive</h2></div>
        <h3 class="section-h">${SPR.img('mission')} BOARD DIRECTIVES <span class="sub">${S.dirIdx}/${AT.DIRECTIVES.length}</span></h3><div class="dirs">`;
      AT.DIRECTIVES.forEach((d, i) => { if (i <= S.dirIdx + 2) h += `<div class="dir ${i < S.dirIdx ? 'got' : i === S.dirIdx ? 'cur' : ''}"><b>${i + 1}</b><span>${i <= S.dirIdx ? d.text : 'Classified.'}</span></div>`; });
      h += `</div><h3 class="section-h">${SPR.img('gem')} ARTIFACTS <span class="sub">${Object.keys(S.artifacts).length}/${Object.keys(AT.ARTIFACTS).length} · kept through every reset</span></h3><div class="arts">`;
      for (const [id, a] of Object.entries(AT.ARTIFACTS)) {
        const got = S.artifacts[id];
        h += `<div class="art slot ${got ? '' : 'locked'}" data-tip="${got ? 'art:' + id : 'txt:Undiscovered. ' + (a.find !== undefined ? 'A rare find on ordinary missions in the ' + AT.REGIONS[a.find].name + '.' : 'Recovered on an expedition.')}"><img class="ico lg pixel" src="${SPR.icon(got ? a.icon : 'lock')}" alt=""><span>${got ? a.name : '???'}</span></div>`;
      }
      h += `</div><h3 class="section-h">${SPR.img('trophy')} ACHIEVEMENTS <span class="sub">${Object.keys(S.ach).length}/${AT.ACHIEVEMENTS.length}</span></h3><div class="achs">`;
      for (const a of AT.ACHIEVEMENTS) { const got = !!S.ach[a.id]; h += `<div class="ach slot ${got ? '' : 'locked'}"><img class="ico lg pixel" src="${SPR.icon(got ? 'trophy' : 'lock')}" alt=""><div><b>${a.name}</b><span>${a.desc}</span></div></div>`; }
      h += `</div><h3 class="section-h">${SPR.img('skull')} MEMORIAL WALL <span class="sub">${S.memorial.length} names</span></h3>`;
      if (!S.memorial.length) h += '<div class="slot teaser">NO NAMES YET.</div>';
      else h += `<div class="memorial slot">${S.memorial.slice().reverse().map((m) => `<div><b>${esc(m.name)}</b> · L${m.level} · ${esc(m.ship)} · ${esc(m.target)}</div>`).join('')}</div>`;
      h += `<h3 class="section-h">${SPR.img('stats')} RECORDS</h3><table class="stats-t"><tbody>
        ${[['Time played', 'tp'], ['This run', 'tr'], ['Total revenue', 'te'], ['Revenue this run', 'ter'], ['Missions flown', 'tm'], ['Ships lost', 'tl'], ['Pilots lost', 'td'], ['Contracts delivered', 'tc'], ['Surveys', 'ts'], ['Ore mined', 'to'],
          ['Kuiper Jumps', 'r0'], ['Oort Exoduses', 'r1'], ['Stellar Ignitions', 'r2'], ['Galactic Ascents', 'r3'], ['Universe', 'ng']].map(([l, k]) => `<tr><td>${l}</td><td data-k="${k}"></td></tr>`).join('')}</tbody></table>
        <h3 class="section-h">SETTINGS</h3><div class="list">
          <div class="slot spread"><span>Number format</span><div class="seg">${btn('set', 'notation:short', '', 'set_short')}${btn('set', 'notation:sci', '', 'set_sci')}</div></div>
          <div class="slot spread"><span>Sound effects</span><div class="seg">${btn('set', 'sound', '', 'set_sound')}</div></div>
          <div class="slot spread"><span>CRT scanlines</span><div class="seg">${btn('set', 'scanlines', '', 'set_scan')}</div></div>
          <div class="slot spread"><span>Ask before resets</span><div class="seg">${btn('set', 'confirm', '', 'set_confirm')}</div></div>
          <div class="slot spread"><span>Fleet AI risk limit</span><div class="seg">${[0.1, 0.2, 0.35, 0.5].map((r) => btn('airisk', r, '', 'air_' + Math.round(r * 100))).join('')}</div></div>
          <div class="slot spread"><span>Display</span><div class="seg">${btn('fullscreen', 0, '', 'set_fs')}</div></div>
          <div class="slot spread"><span>Save data</span><div class="seg">${btn('save', 0, '', 'set_save')}${btn('export', 0, '', 'set_export')}${btn('import', 0, '', 'set_import')}${btn('reset', 0, 'bad', 'set_reset')}</div></div>
          ${native && native.quit ? `<div class="slot spread"><span>Exit to desktop</span>${btn('quit', 0, 'bad', 'set_quit')}</div>` : ''}
        </div><p class="note" style="margin-top:12px">AstroTech saves every 15 seconds${native ? ' and syncs through Steam Cloud' : ' in this browser'}. Fonts: Silkscreen and VT323 (SIL Open Font License).</p>`;
      return h;
    },
    update(S) {
      const st = S.settings;
      const v = { tp: AT.fmtTime(S.stats.totalTime), tr: AT.fmtTime(S.runT), te: money(S.earnedTotal), ter: money(S.earnedRun), tm: fmt(S.stats.missions), tl: fmt(S.stats.losses), td: fmt(S.stats.deaths),
        tc: fmt(S.stats.contracts), ts: fmt(S.stats.surveyed), to: fmt(S.stats.oreMined) + 't', r0: String(S.layers[0].runs), r1: String(S.layers[1].runs), r2: String(S.layers[2].runs), r3: String(S.layers[3].runs), ng: '#' + (S.ngPlus + 1),
        set_short: { t: '1.23M', cls: { on: st.notation === 'short' } }, set_sci: { t: '1.23e6', cls: { on: st.notation === 'sci' } },
        set_sound: { t: st.sound ? 'ON' : 'OFF', cls: { on: st.sound } }, set_scan: { t: st.scanlines ? 'ON' : 'OFF', cls: { on: st.scanlines } },
        set_confirm: { t: st.noConfirm ? 'OFF' : 'ON', cls: { on: !st.noConfirm } }, set_fs: { t: 'FULLSCREEN' }, set_save: { t: 'SAVE NOW' }, set_export: { t: 'EXPORT' }, set_import: { t: 'IMPORT' }, set_reset: { t: 'WIPE SAVE' }, set_quit: { t: 'QUIT' } };
      for (const r of [0.1, 0.2, 0.35, 0.5]) v['air_' + Math.round(r * 100)] = { t: Math.round(r * 100) + '%', cls: { on: Math.abs(S.aiRisk - r) < 0.001 } };
      return v;
    },
  };

  // =====================================================================
  // LOWER-LEFT: flight board & log
  // =====================================================================
  function renderLower() {
    const S = E.S;
    const box = $('#lowbody');
    const s = lowTab + '|' + (lowTab === 'flights' ? S.missions.map((m) => m.id).join() + '|' + S.surveys.map((x) => x.target).join() + '|' + S.builds.map((b) => b.target).join() : '');
    if (lowTab === 'flights') {
      if (s !== lowSig) {
        lowSig = s;
        let h = '';
        for (const m of S.missions) {
          const sh = E.shipById(m.ship), t = E.targetById(m.target);
          if (!sh || !t) continue;
          h += `<div class="frow" data-act="flight" data-arg="${t.id}" data-tip="txt:Click to view ${esc(t.name)} in the close-up.">${rk(sh.hull, 24)}<div class="fmain"><div class="fname">${esc(sh.name)} <span>→ ${esc(t.name)}</span></div><div class="bar thin"><i data-fm="${m.id}"></i></div></div><div class="fstate" data-fs="${m.id}"></div></div>`;
        }
        for (const sv of S.surveys) { const t = E.targetById(sv.target); if (t) h += `<div class="frow probe"><img class="rk" src="${SPR.icon('probe')}" alt=""><div class="fmain"><div class="fname">Survey probe <span>→ ${esc(t.name)}</span></div><div class="bar thin good"><i data-fv="${t.id}"></i></div></div><div class="fstate">SURVEY</div></div>`; }
        for (const b of S.builds) { const t = E.targetById(b.target); if (t) h += `<div class="frow build"><img class="rk" src="${SPR.icon('outpost')}" alt=""><div class="fmain"><div class="fname">Construction <span>→ ${esc(t.name)}</span></div><div class="bar thin ice"><i data-fb="${t.id}"></i></div></div><div class="fstate">BUILD</div></div>`; }
        if (!h) h = '<div class="teaser">NO SHIPS IN FLIGHT. PICK A TARGET IN MISSION CONTROL.</div>';
        box.innerHTML = h;
      }
      for (const m of S.missions) {
        const bar = box.querySelector(`[data-fm="${m.id}"]`), st = box.querySelector(`[data-fs="${m.id}"]`);
        if (!bar) continue;
        bar.style.width = Math.min(100, m.t / m.T * 100) + '%';
        const ph = m.t < m.out ? 'OUTBOUND' : m.t < m.out + m.mine ? (m.kind === 'exp' ? 'ON SITE' : 'MINING') : 'RETURNING';
        const txt = ph + ' ' + AT.fmtTime(m.T - m.t);
        if (st.textContent !== txt) st.textContent = txt;
      }
      for (const sv of S.surveys) { const b = box.querySelector(`[data-fv="${sv.target}"]`); if (b) b.style.width = sv.t / sv.T * 100 + '%'; }
      for (const bd of S.builds) { const b = box.querySelector(`[data-fb="${bd.target}"]`); if (b) b.style.width = bd.t / bd.T * 100 + '%'; }
    } else if (s !== lowSig) {
      lowSig = s;
      box.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (const e of S.log.slice(-60)) frag.appendChild(logEl(e));
      box.appendChild(frag);
      box.scrollTop = box.scrollHeight;
    }
    $('#lt-flights').textContent = `FLIGHTS ${S.missions.length}/${S.pads}`;
    for (const b of $$('.lowtabs .btn')) b.classList.toggle('active', b.dataset.arg === lowTab);
  }
  function logTime(t) { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
  function logEl(entry) {
    const p = document.createElement('p');
    p.className = entry.kind;
    const tm = document.createElement('time'); tm.textContent = logTime(entry.t);
    p.appendChild(tm); p.appendChild(document.createTextNode(entry.text));
    return p;
  }
  function addLog(entry) {
    const tk = $('#ticker');
    if (tk && (entry.kind === 'story' || entry.kind === 'prestige' || entry.kind === 'ach' || entry.kind === 'up' || entry.kind === 'down' || entry.kind === 'warn')) {
      tk.textContent = entry.text; tk.className = 'ticker ' + entry.kind; tk.classList.remove('flash'); void tk.offsetWidth; tk.classList.add('flash');
    }
    if (lowTab !== 'log') { $('#lt-log').classList.add('new'); return; }
    const box = $('#lowbody');
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.appendChild(logEl(entry));
    while (box.children.length > 80) box.firstChild.remove();
    if (near) box.scrollTop = box.scrollHeight;
  }

  // directive strip
  function renderDirective() {
    const d = E.directive(), el = $('#directive');
    const txt = d ? `DIRECTIVE ${E.S.dirIdx + 1}/${AT.DIRECTIVES.length}: ${d.text}` : 'ALL BOARD DIRECTIVES COMPLETE.';
    if (el.textContent !== txt) el.textContent = txt;
  }

  // decision cards
  function renderCard() {
    const S = E.S, box = $('#cardbox');
    const c = S.cards[0];
    const s = c ? c.type + c.id + (c.ctx ? c.ctx.pilot : '') + S.cards.length : '';
    if (s !== cardSig) {
      cardSig = s;
      if (!c) { box.hidden = true; box.innerHTML = ''; return; }
      let title, text, a, b, kind;
      if (c.type === 'inc') {
        const inc = AT.INCIDENTS.find((i) => i.id === c.id);
        title = inc.title; text = E.fill(inc.text, c.ctx); a = inc.a.label; b = inc.b.label; kind = 'INCIDENT';
      } else {
        const x = E.EXP[c.id];
        title = x.name; text = x.text; kind = 'EXPEDITION REPORT';
        a = x.a.label + ' → ' + AT.ARTIFACTS[x.a.art].name; b = x.b.label + ' → ' + AT.ARTIFACTS[x.b.art].name;
      }
      box.innerHTML = `<div class="dcard panel ${c.type}"><div class="spread"><span class="tog">${kind}${S.cards.length > 1 ? ' · ' + S.cards.length + ' PENDING' : ''}</span><span class="tog" data-cd></span></div><h3>${esc(title)}</h3><p>${esc(text)}</p>
        <div class="flex">${c.type === 'exp' ? `<button class="btn gold" data-act="card" data-arg="a" data-tip="art:${E.EXP[c.id].a.art}">${esc(a)}</button><button class="btn gold" data-act="card" data-arg="b" data-tip="art:${E.EXP[c.id].b.art}">${esc(b)}</button>` : `<button class="btn gold" data-act="card" data-arg="a">${esc(a)}</button><button class="btn" data-act="card" data-arg="b">${esc(b)}</button>`}</div>
        ${c.expires ? '<div class="bar thin"><i data-cdb></i></div>' : ''}</div>`;
      box.hidden = false;
      AT.audio.play('card');
    }
    if (c && c.expires) {
      const left = c.expires - S.time;
      const cd = box.querySelector('[data-cd]'), cdb = box.querySelector('[data-cdb]');
      if (cd) cd.textContent = 'AUTO-RESOLVES IN ' + Math.ceil(left) + 's';
      if (cdb) cdb.style.width = Math.max(0, left / 150 * 100) + '%';
    }
  }

  // viewport bar
  function renderViewBar() {
    const S = E.S;
    const v = AT.scene.getView();
    for (const b of $$('#vbar [data-act="view"]')) b.classList.toggle('on', b.dataset.arg === v);
    const regs = $('#vregs');
    const html = v === 'map' && S.region > 0 ? Array.from({ length: S.region + 1 }, (_, i) => `<button class="btn tiny ${AT.scene.getMapRegion() === i ? 'on' : ''}" data-act="mapreg" data-arg="${i}">${AT.REGIONS[i].short}</button>`).join('') : '';
    if (regs._h !== html) { regs.innerHTML = html; regs._h = html; }
  }

  // =====================================================================
  // TOP BAR
  // =====================================================================
  function setText(sel, t) { const el = $(sel); if (el && el.textContent !== t) el.textContent = t; }
  function updateTop() {
    const S = E.S, M = E.mults();
    setText('#st-money', money(S.money));
    const net = S.incomeEMA - E.salaryRate(M);
    setText('#st-income', (net >= 0 ? '+' : '-') + money(Math.abs(net)) + '/s');
    setText('#st-equity', money(E.equity(M)));
    $('#chip-eq').hidden = !S.reveal.company;
    $('#chip-rp').hidden = !S.reveal.research;
    setText('#st-rp', fmt(S.rp));
    $('#chip-rep').hidden = !S.reveal.contracts;
    setText('#st-rep', 'REP ' + E.repLevel());
    let lh = '';
    for (let i = 0; i < AT.LAYERS.length; i++) { const st = S.layers[i]; if (st.runs > 0 || st.cur > 0) lh += `<div class="chip slot" data-tip="layer:${i}"><img class="ico pixel" src="${SPR.icon(LAYER_ICON[i])}" alt=""><b style="color:${AT.LAYERS[i].color}">${fmt(st.cur)}</b><span class="sub">${AT.LAYERS[i].sym}</span></div>`; }
    const lc = $('#st-layers');
    if (lc._h !== lh) { lc.innerHTML = lh; lc._h = lh; }
    $('#btn-sound').innerHTML = `<img class="ico pixel" src="${SPR.icon(S.settings.sound ? 'sound' : 'mute')}" alt="Sound">`;
    $('#strike').hidden = !S.strike;
    $('#challenge-tag').hidden = !S.challenge;
    if (S.challenge) setText('#challenge-tag', 'CHALLENGE: ' + E.challengeDef(S.challenge).name.toUpperCase());
  }

  // =====================================================================
  // TOOLTIPS
  // =====================================================================
  function tipFor(key) {
    const S = E.S, M = E.mults();
    const [kind, a, b] = key.split(':');
    if (kind === 'txt') return `<p class="c">${esc(key.slice(4))}</p>`;
    if (kind === 'tgt') {
      const t = E.targetById(+a); if (!t) return '';
      const cls = AT.CLASSES[t.cls];
      if (t.story) return `<h5>${esc(t.name)}</h5><p class="c">${esc(E.EXP[t.story].intro)}</p><p>One-time expedition. Success gives a choice between two permanent artifacts.</p>`;
      return `<h5>${esc(t.name)}</h5><p class="c">${cls.long}. ${t.surveyed ? 'Surveyed.' : 'Not surveyed: composition and hazard are estimates.'}</p><p>Value ≈ ${money(t.surveyed ? E.compValue(t, M) : E.compValueEst(t, M))}/t at today's prices.</p>`;
    }
    if (kind === 'ship') {
      const sh = E.shipById(+a); if (!sh) return '';
      const h = E.HULL[sh.hull];
      return `<h5>${esc(sh.name)}</h5><p class="c">${h.name}. Hull ${Math.round(sh.cond * 100)}%. ${sh.missions} missions flown.</p><p>Damaged hulls fly with more risk. Repairs are free but take time; rushing costs cash.</p>`;
    }
    if (kind === 'hull') {
      const h = E.HULL[a];
      return `<h5>${h.name}</h5><p class="c">${h.desc}</p><p>Each extra ${h.name} costs ${AT.HULL_COST_GROWTH}x the last. Owned: ${S.hullsBought[a] || 0}.</p>`;
    }
    if (kind === 'mod') {
      const mod = AT.MODULES.find((m) => m.id === b);
      const lv = E.moduleLevel(a, b);
      const eff = mod.per > 1 ? `+${Math.round((mod.per - 1) * 100)}% ${mod.desc.toLowerCase()} per level` : `-${Math.round((1 - mod.per) * 100)}% ${mod.desc.toLowerCase()} per level`;
      return `<h5>${mod.name} · ${E.HULL[a].name}</h5><p class="c">${eff}. Level ${lv}/${mod.max}.</p><p>Applies to every ${E.HULL[a].name} you own or buy this run.</p>`;
    }
    if (kind === 'pilot') {
      const p = E.pilotById(+a); if (!p) return '';
      const tr = AT.TRAITS.find((x) => x.id === p.trait);
      return `<h5>${esc(p.name)} · Level ${p.level}</h5><p class="c">${tr.name}: ${tr.desc}</p><p>${fmt(p.xp)}/${fmt(E.xpNeed(p))} XP to next level. Each level cuts mission risk by 6%.</p>`;
    }
    if (kind === 'trait') { const tr = AT.TRAITS.find((x) => x.id === a); return `<h5>${tr.name}</h5><p class="c">${tr.desc}</p>`; }
    if (kind === 'staff') { const c = AT.STAFF.find((x) => x.id === a); return `<h5>${c.name}</h5><p class="c">${c.desc}</p><p>Next hire ${money(E.hireCost(a, M))}, paid ${money(E.hireCost(a, M) * AT.SALARY_RATE * M.salary)}/s.</p>`; }
    if (kind === 'res') { const r = E.RES[a]; const reqs = r.req.map((q) => E.RES[q].name).join(', '); return `<h5>${r.name}</h5><p class="c">${r.desc}</p><p>Cost ${fmt(r.cost)} RP${reqs ? ' · Requires ' + reqs : ''}</p>`; }
    if (kind === 'proj') { const p = AT.PROJECTS.find((x) => x.id === a); return `<h5>${p.name}</h5><p class="c">${p.desc}</p><p>Cost ${money(p.cost)}</p>`; }
    if (kind === 'lup') { const L = AT.LAYERS[+a], u = L.upgrades.find((x) => x.id === b), lvl = S.layers[+a].upg[b] || 0; return `<h5>${u.name}</h5><p class="c">${u.desc}</p><p>Level ${lvl}/${u.max}${lvl < u.max ? ' · Next ' + fmt(E.layerUpCost(+a, u)) + ' ' + L.sym : ''}</p>`; }
    if (kind === 'ore') { const o = AT.ORES[a], m = S.market[a]; return `<h5>${o.name}</h5><p class="c">Base value ${money(E.basePrice(a, M))}/t · demand ${Math.round(m.d * 100)}%</p><p>Market depth ≈${fmt(E.depth(a, M))}t: selling that much at once cuts the price by about 63%. Found in the ${AT.REGIONS[o.region].name}.</p>`; }
    if (kind === 'art') { const x = AT.ARTIFACTS[a]; return `<h5>${x.name}</h5><p class="c">${x.desc}</p><p>${S.artifacts[a] ? 'In the collection.' : 'Permanent: survives every reset and every universe.'}</p>`; }
    if (kind === 'money') return `<h5>Cash</h5><p class="c">Revenue ${money(S.incomeEMA)}/s · payroll ${money(E.salaryRate(M))}/s</p><p>Earned this run ${money(S.earnedRun)}</p>`;
    if (kind === 'equity') return `<h5>Your Equity</h5><p class="c">Valuation x your stake. Peak this run ${money(S.peakEquity)}.</p><p>Peak equity decides how much an Expansion pays out.</p>`;
    if (kind === 'rp') return `<h5>Research Points</h5><p class="c">${fmt(E.rpRate(M))}/s from ${M.scientists} scientists.</p>`;
    if (kind === 'rep') return `<h5>Reputation</h5><p class="c">Level ${E.repLevel()}. Clients pay ${Math.round((Math.pow(AT.REP_VALUE, E.repLevel()) - 1) * 100)}% more.</p><p>Deliver contracts to raise it. Resets each run.</p>`;
    if (kind === 'layer') { const L = AT.LAYERS[+a]; return `<h5>${L.cur}</h5><p class="c">Spend in the Expansion console.</p><p>Total earned ${fmt(S.layers[+a].total)}.</p>`; }
    return '';
  }
  function placeTip() {
    if (!tipKey) { tipEl.hidden = true; return; }
    const html = tipFor(tipKey);
    if (!html) { tipEl.hidden = true; return; }
    if (tipEl._h !== html) { tipEl.innerHTML = html; tipEl._h = html; }
    tipEl.hidden = false;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = tipX + 16, y = tipY + 18;
    if (x + w > innerWidth - 8) x = tipX - w - 12;
    if (y + h > innerHeight - 8) y = tipY - h - 12;
    tipEl.style.left = Math.max(4, x) + 'px'; tipEl.style.top = Math.max(4, y) + 'px';
  }

  // =====================================================================
  // ACTIONS
  // =====================================================================
  function selectTarget(id, fromMap) {
    const S = E.S;
    S.selTarget = id;
    if (!S.reveal.missions) return;
    if (tab !== 'missions') { tab = 'missions'; S.reveal.new_missions = 0; renderTabs(); }
    sig = null;
    AT.audio.play('select');
    const t = E.targetById(id);
    if (t && fromMap !== 'map') AT.scene.setMapRegion(t.region);
    $('#tabbody').scrollTop = 0;
  }
  UI.selectTarget = selectTarget;
  function act(name, arg, el) {
    const S = E.S;
    AT.audio.unlock();
    let ok = true;
    switch (name) {
      case 'tab': tab = arg; S.reveal['new_' + arg] = 0; sig = null; $('#tabbody').scrollTop = 0; AT.audio.play('tab'); renderTabs(); break;
      case 'view': AT.scene.setView(arg); AT.audio.play('tab'); break;
      case 'mapreg': AT.scene.setMapRegion(+arg); break;
      case 'low': lowTab = arg; lowSig = null; if (arg === 'log') $('#lt-log').classList.remove('new'); break;
      case 'seltarget': selectTarget(+arg); break;
      case 'closeup': S.selTarget = +arg; AT.scene.setView('target'); break;
      case 'flight': S.selTarget = +arg; AT.scene.setView('target'); sig = null; break;
      case 'sort': S.settings.sort = arg; sig = null; break;
      case 'focus': S.focus = arg; break;
      case 'drop': ok = E.dropTarget(+arg); sig = null; break;
      case 'survey': ok = E.survey(+arg); AT.audio.play(ok ? 'buy' : 'deny'); break;
      case 'outpost': ok = E.buildOutpost(+arg); AT.audio.play(ok ? 'research' : 'deny'); break;
      case 'upout': ok = E.upgradeOutpost(+arg); AT.audio.play(ok ? 'buy' : 'deny'); break;
      case 'upout10': { let n = 0; while (n < 10 && E.upgradeOutpost(+arg)) n++; ok = n > 0; AT.audio.play(ok ? 'buy' : 'deny'); break; }
      case 'launch': { const [sid, tid] = arg.split(':').map(Number); ok = !!E.launch(sid, tid); AT.audio.play(ok ? 'buy' : 'deny'); if (ok && AT.scene.getView() !== 'map') AT.scene.setView('launch'); break; }
      case 'dispatch': { const M = E.mults(); for (const sh of S.ships) { if (E.padsFree() <= 0) break; if (!E.canFly(sh, M)) continue; const t = E.bestTarget(sh, M, S.aiRisk); if (t) E.launch(sh.id, t.id); } AT.audio.play('buy'); break; }
      case 'buyship': ok = !!E.buyShip(arg); AT.audio.play(ok ? 'buy' : 'deny'); break;
      case 'mod': { const [h, m] = arg.split(':'); ok = E.buyModule(h, m); AT.audio.play(ok ? 'buy' : 'deny'); break; }
      case 'pad': ok = E.buyPad(); AT.audio.play(ok ? 'buy' : 'deny'); break;
      case 'obs': ok = E.buyObs(); AT.audio.play(ok ? 'buy' : 'deny'); break;
      case 'probe': ok = E.buyProbe(); AT.audio.play(ok ? 'buy' : 'deny'); break;
      case 'repeat': E.toggleRepeat(+arg); break;
      case 'repair': { const sh = E.shipById(+arg); ok = sh && sh.state === 'repair' ? E.rush(+arg) : E.repair(+arg); AT.audio.play(ok ? 'buy' : 'deny'); break; }
      case 'scrap': { const now = performance.now(); if (!(confirmUntil['scrap' + arg] > now)) { confirmUntil['scrap' + arg] = now + 3000; el.innerHTML = 'SURE?<small>click again</small>'; return; } ok = E.scrapShip(+arg); sig = null; break; }
      case 'autobuy': S.autobuy[arg] = !S.autobuy[arg]; break;
      case 'hirepilot': ok = !!E.hirePilot(+arg); AT.audio.play(ok ? 'buy' : 'deny'); break;
      case 'firepilot': ok = E.firePilot(+arg); break;
      case 'refreshcand': ok = E.refreshCandidates(true); AT.audio.play(ok ? 'buy' : 'deny'); break;
      case 'hire': ok = E.hire(arg); AT.audio.play(ok ? 'buy' : 'deny'); break;
      case 'fire': ok = E.fire(arg); break;
      case 'autohire': S.autohire = !S.autohire; break;
      case 'sell': { const [id, f] = arg.split(':'); const r = E.sell(id, +f); if (r > 0) { AT.audio.play('sell'); floatAt(el, '+' + money(r)); } break; }
      case 'sellall': { const r = E.sellAll(); if (r > 0) { AT.audio.play('sell'); floatAt(el, '+' + money(r)); } break; }
      case 'autosell': S.autosell = arg; break;
      case 'deliver': { const r = E.deliverContract(+arg); ok = !!r; if (ok) { AT.audio.play('sell'); floatAt(el, '+' + money(r)); } break; }
      case 'dismiss': E.dismissContract(+arg); break;
      case 'res': ok = E.buyResearch(arg); AT.audio.play(ok ? 'research' : 'deny'); break;
      case 'respage': resPage = +arg; sig = null; break;
      case 'proj': ok = E.buyProject(arg); AT.audio.play(ok ? 'research' : 'deny'); break;
      case 'issue': ok = !!E.issueShares(); AT.audio.play(ok ? 'sell' : 'deny'); break;
      case 'buyback': ok = E.buyback(); AT.audio.play(ok ? 'buy' : 'deny'); break;
      case 'prestige': {
        const i = +arg, now = performance.now();
        if (E.pendingGain(i) < 1) { AT.audio.play('deny'); break; }
        if (!S.settings.noConfirm && !(confirmUntil[i] > now)) { confirmUntil[i] = now + 4000; AT.audio.play('alarm'); break; }
        confirmUntil[i] = 0; E.prestige(i); saveGame(); break;
      }
      case 'lup': { const [li, uid] = arg.split(':'); ok = E.buyLayerUp(+li, uid); AT.audio.play(ok ? 'buy' : 'deny'); break; }
      case 'daemon': S.layers[+arg].auto = !S.layers[+arg].auto; break;
      case 'dmode': { const [li, m] = arg.split(':'); S.layers[+li].autoMode = m === 'smart' ? 'smart' : +m; break; }
      case 'challenge': { const [li, id] = arg.split(':'); const key = 'ch' + id, now = performance.now(); if (!(confirmUntil[key] > now)) { confirmUntil[key] = now + 3000; el.innerHTML = 'SURE?<small>resets the run</small>'; return; } ok = E.startChallenge(+li, id); saveGame(); break; }
      case 'abandon': { const now = performance.now(); if (!(confirmUntil.ab > now)) { confirmUntil.ab = now + 3000; el.innerHTML = 'SURE?<small>click again</small>'; return; } E.abandonChallenge(); break; }
      case 'end': if (E.end()) showEnding(); break;
      case 'card': { E.resolveCard(0, arg); cardSig = null; AT.audio.play('research'); break; }
      case 'airisk': S.aiRisk = +arg; break;
      case 'set': {
        const [k, val] = arg.split(':');
        if (k === 'notation') S.settings.notation = val;
        if (k === 'sound') S.settings.sound = !S.settings.sound;
        if (k === 'scanlines') { S.settings.scanlines = !S.settings.scanlines; applySettings(); }
        if (k === 'confirm') S.settings.noConfirm = !S.settings.noConfirm;
        sig = null; break;
      }
      case 'fullscreen': toggleFullscreen(); break;
      case 'save': saveGame(); toast('stats', 'SAVED', 'Progress saved.'); break;
      case 'export': showExport(); break;
      case 'import': showImport(); break;
      case 'reset': showReset(); break;
      case 'quit': saveGame(); native.quit(); break;
      case 'modal-close': closeModal(); break;
      case 'do-import': doImport(); break;
      case 'do-reset': doReset(); break;
      case 'copy': copyExport(el); break;
      case 'ng': E.newGamePlus(); $('#ending') && $('#ending').remove(); sig = null; saveGame(); break;
      case 'keep': $('#ending') && $('#ending').remove(); break;
      case 'sound-top': S.settings.sound = !S.settings.sound; break;
    }
    render(); updateTop();
    return ok;
  }
  function floatAt(el, txt) {
    if (!el) return;
    const b = el.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'floater'; d.textContent = txt;
    d.style.position = 'fixed'; d.style.left = (b.left + b.width / 2) + 'px'; d.style.top = b.top + 'px'; d.style.zIndex = 40;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }
  let repTimer = null, repDelay = null;
  function stopRep() { clearTimeout(repDelay); clearInterval(repTimer); repTimer = repDelay = null; }

  // =====================================================================
  // TOASTS, MODALS, ENDING
  // =====================================================================
  function toast(icon, title, text) {
    const d = document.createElement('div');
    d.className = 'toast panel';
    d.innerHTML = `<img class="ico lg pixel" src="${SPR.icon(icon)}" alt=""><div><b></b><span></span></div>`;
    d.querySelector('b').textContent = title; d.querySelector('span').textContent = text;
    $('#toasts').appendChild(d);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
    setTimeout(() => d.remove(), 4200);
  }
  UI.toast = toast;
  function modal(html) { const m = $('#modal'); m.innerHTML = `<div class="panel">${html}</div>`; m.hidden = false; }
  function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
  function showExport() {
    let code = '';
    try { code = btoa(unescape(encodeURIComponent(E.save()))); } catch (e) { code = ''; }
    modal(`<h2>Export Save</h2><p class="note">Copy this code somewhere safe. Import it on any device to continue.</p><textarea id="exp" readonly>${code}</textarea><div class="flex"><button class="btn gold" data-act="copy">COPY</button><button class="btn" data-act="modal-close">CLOSE</button></div>`);
  }
  function copyExport(el) {
    const ta = $('#exp');
    try { navigator.clipboard.writeText(ta.value).then(() => { el.textContent = 'COPIED'; }, () => { ta.select(); el.textContent = 'SELECTED: COPY IT'; }); } catch (e) { ta.select(); el.textContent = 'SELECTED: COPY IT'; }
  }
  function showImport() {
    modal(`<h2>Import Save</h2><p class="note">Paste an exported code below (right-click, Paste). This replaces your current game.</p><textarea id="imp"></textarea><p class="note" id="imp-err"></p><div class="flex"><button class="btn gold" data-act="do-import">IMPORT</button><button class="btn" data-act="modal-close">CANCEL</button></div>`);
  }
  function doImport() {
    const raw = ($('#imp').value || '').trim();
    let s = null;
    try { s = E.load(decodeURIComponent(escape(atob(raw)))); } catch (e) { s = null; }
    if (!s) { $('#imp-err').textContent = 'That code could not be read. Check that the whole code was pasted, and that it came from this version.'; return; }
    E.S = s; E.touch(); sig = null; lowSig = null; closeModal(); saveGame(); toast('stats', 'IMPORTED', 'Save loaded.');
  }
  function showReset() { modal(`<h2>Wipe Save?</h2><p class="note">This deletes all progress, including expansions, artifacts and achievements. It cannot be undone.</p><div class="flex"><button class="btn bad" data-act="do-reset">WIPE EVERYTHING</button><button class="btn" data-act="modal-close">KEEP MY GAME</button></div>`); }
  function doReset() { E.newGame(); sig = null; lowSig = null; tab = 'missions'; closeModal(); saveGame(); }
  function showEnding() {
    const S = E.S;
    const d = document.createElement('div');
    d.id = 'ending';
    const lines = AT.ENDING.map((l, i) => `<p style="animation-delay:${1 + i * 2.2}s">${l}</p>`).join('');
    const delay = 1 + AT.ENDING.length * 2.2;
    d.innerHTML = `<div class="lines">${lines}<p style="animation-delay:${delay}s;color:var(--dim);font-size:20px">Time played ${AT.fmtTime(S.stats.totalTime)} · ${fmt(S.stats.missions)} missions · ${S.memorial.length} pilots lost · ${fmt(S.earnedTotal)} dollars earned.</p>
      <div class="flex" style="opacity:0;animation:fadein 1s steps(4) ${delay + 1}s forwards"><button class="btn gold big" data-act="ng">START UNIVERSE ${S.ngPlus + 2}<small>everything x3, keep artifacts and achievements</small></button><button class="btn big" data-act="keep">KEEP PLAYING<small>stay in this universe</small></button></div></div>`;
    document.body.appendChild(d);
    AT.audio.play('prestige');
  }
  function applySettings() { $('.scene-wrap').classList.toggle('scan', !!E.S.settings.scanlines); }
  function toggleFullscreen() {
    if (native && native.toggleFullscreen) { native.toggleFullscreen(); return; }
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => toast('warn', 'FULLSCREEN', 'Fullscreen is not available here.'));
    } catch (e) { /* unavailable */ }
  }

  // =====================================================================
  // SAVING
  // =====================================================================
  function saveGame() {
    const s = E.save();
    try { localStorage.setItem(SAVE_KEY, s); } catch (e) { /* storage unavailable */ }
    if (native && native.save) { try { native.save(s); } catch (e) { /* ignore */ } }
  }
  UI.save = saveGame;
  function loadGame(data) {
    let raw = data && data.save;
    if (!raw && native && native.load) { try { raw = native.load(); } catch (e) { raw = null; } }
    if (!raw) { try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; } }
    return raw ? E.load(raw) : null;
  }

  // =====================================================================
  // BOOT & LOOP
  // =====================================================================
  UI.start = function (data) {
    tipEl = $('#tooltip');
    document.documentElement.style.setProperty('--cur-arrow', `url("${SPR.cursor('arrow')}") 0 0, default`);
    document.documentElement.style.setProperty('--cur-btn', `url("${SPR.cursor('arrow')}") 0 0, pointer`);
    $('#brand-ico').src = SPR.icon('rocket');
    for (const el of $$('[data-ico]')) el.src = SPR.icon(el.dataset.ico);

    AT.hooks.log = () => {};
    AT.hooks.ach = (id, a) => { toast('trophy', 'ACHIEVEMENT', a.name); AT.audio.play('ach'); if (native && native.achievement) native.achievement(id); };
    AT.hooks.launch = (m, ship, t) => { AT.scene.onLaunch(m, ship, t); AT.audio.play('launch'); };
    AT.hooks.resolve = (m, ship, t, outcome) => { AT.scene.onResolve(m, ship, t, outcome); AT.audio.play(outcome === 'lost' ? 'lost' : 'return'); };
    AT.hooks.card = () => {};
    AT.hooks.event = (kind, arg) => {
      if (kind === 'region') toast('expansion', 'NEW SECTOR', AT.REGIONS[arg].name);
      if (kind === 'prestige') { AT.scene.burst(); AT.audio.play('prestige'); sig = null; lowSig = null; }
      if (kind === 'artifact') toast('gem', 'ARTIFACT', AT.ARTIFACTS[arg].name);
      if (kind === 'expedition') toast('star', 'EXPEDITION', E.EXP[arg].name);
      if (kind === 'directive') { AT.audio.play('ach'); }
    };

    const loaded = loadGame(data);
    let away = 0;
    if (loaded) { E.S = loaded; E.touch(); away = (Date.now() - (loaded.saved || Date.now())) / 1000; }
    else E.newGame();
    const tk = $('#ticker'); const last = E.S.log.filter((e) => e.kind === 'story').pop(); if (last) tk.textContent = last.text;
    AT.hooks.log = addLog;
    if (native && native.achievement) for (const id in E.S.ach) native.achievement(id);

    AT.scene.init($('#scene'));
    AT.scene.cb.select = (id) => selectTarget(id, 'map');
    AT.scene.cb.closeupClick = () => {};
    applySettings();
    if (away > 60) {
      const cap = E.offlineCap();
      const secs = Math.min(away, cap);
      const res = E.simulate(secs);
      modal(`<h2>Welcome Back</h2><p class="note">You were away for ${AT.fmtTime(away)}${away > secs ? ` (offline progress caps at ${AT.fmtTime(cap)})` : ''}. Operations continued without you.</p><div class="slot"><div class="spread"><span>Revenue earned</span><b style="color:var(--gold);font-weight:400">${money(res.earned)}</b></div><div class="spread"><span>Missions completed</span><b style="font-weight:400">${fmt(res.missions)}</b></div></div><button class="btn gold" data-act="modal-close">BACK TO WORK</button>`);
    }
    bindEvents();
    updateReveal(); renderTabs(); render(); updateTop(); renderLower(); renderDirective(); renderViewBar();
    const hot = window.claude && window.claude.hot;
    if (hot && hot.snapshot) hot.snapshot(() => ({ save: E.save() }));
    let lastT = performance.now(), uiAcc = 0, saveAcc = 0, lastSeen = performance.now();
    function frame(now) {
      let dt = (now - lastT) / 1000; lastT = now; lastSeen = now;
      if (dt > 5) E.simulate(Math.min(dt, E.offlineCap())); else if (dt > 0) E.tick(Math.min(dt, 1));
      AT.scene.frame(Math.min(dt, 0.1));
      uiAcc += dt; saveAcc += dt;
      if (uiAcc >= 0.1) { uiAcc = 0; updateReveal(); renderTabs(); render(); updateTop(); renderLower(); renderDirective(); renderCard(); renderViewBar(); placeTip(); }
      if (saveAcc >= 15) { saveAcc = 0; saveGame(); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    setInterval(() => {
      const now = performance.now();
      if (now - lastSeen > 1500) { const dt = (now - lastT) / 1000; lastT = now; lastSeen = now; E.simulate(Math.min(dt, E.offlineCap())); }
    }, 1000);
    window.addEventListener('beforeunload', saveGame);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  };
  function bindEvents() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      if (el.dataset.rep && el._repeated) { el._repeated = false; return; }
      e.stopPropagation();
      act(el.dataset.act, el.dataset.arg, el);
    });
    document.addEventListener('pointerdown', (e) => {
      AT.audio.unlock();
      const el = e.target.closest('[data-rep]');
      if (!el || el.disabled || e.button !== 0) return;
      el._repeated = false;
      repDelay = setTimeout(() => {
        repTimer = setInterval(() => {
          if (el.disabled || !document.body.contains(el)) { stopRep(); return; }
          el._repeated = true;
          act(el.dataset.act, el.dataset.arg, el);
        }, 90);
      }, 380);
    });
    document.addEventListener('pointerup', stopRep);
    document.addEventListener('pointercancel', stopRep);
    document.addEventListener('mousemove', (e) => {
      tipX = e.clientX; tipY = e.clientY;
      const t = e.target.closest && e.target.closest('[data-tip]');
      tipKey = t ? t.dataset.tip : null;
      placeTip();
    });
    document.addEventListener('mouseleave', () => { tipKey = null; placeTip(); });
    document.addEventListener('contextmenu', (e) => { if (!e.target.closest('textarea')) e.preventDefault(); });
  }
})(window.AT = window.AT || {});

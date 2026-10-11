// AstroTech v2 — guidance: the quick-start tutorial (coach marks) and feature briefings (+ Field Manual).
// UI-only. State lives in S.tutorial / S.tutBase / S.briefingsSeen / S.settings.showBriefings (all saved).
// ui.js calls start(), tick() every 0.1s, frame() every animation frame, act() for the buttons in here.
(function (AT) {
  'use strict';
  const G = AT.guide = {};
  const E = AT.E, SPR = AT.SPR;
  const DEMO = !!AT.DEMO;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TAB_LABEL = { missions: 'MISSIONS', fleet: 'FLEET', crew: 'CREW', market: 'MARKET', outposts: 'OUTPOSTS', research: 'RESEARCH', projects: 'PROJECTS', company: 'COMPANY', expansion: 'EXPANSION', archive: 'ARCHIVE' };

  // =====================================================================
  // TUTORIAL
  // =====================================================================
  let tutEl = null, tutKey = '', tutScrolled = '', lastRect = '';
  const active = () => { const t = E.S.tutorial; return typeof t === 'number' && t >= 0 && t < AT.TUTORIAL.length; };
  G.tutorialActive = active;
  const snap = (replay) => ({ ships: E.S.ships.length, launched: E.S.stats.launched, sold: E.S.stats.oreSold, replay: !!replay, lost: false });
  const hold = () => Object.values(E.S.ores).reduce((a, b) => a + b, 0);
  function goStep(n, extra) {
    const S = E.S;
    const replay = !!(S.tutBase && S.tutBase.replay);
    S.tutorial = n >= AT.TUTORIAL.length ? 'done' : n;
    S.tutBase = Object.assign(snap(replay), extra || {});
    tutKey = '';
    if (S.tutorial === 'done') hideTut();
  }
  function activeTab() { const b = $('#tabs .tab.active'); return b ? b.dataset.arg : null; }

  function tutAdvance() {
    const S = E.S;
    if (!S.tutBase) S.tutBase = snap(false);
    const B = S.tutBase, id = AT.TUTORIAL[S.tutorial].id;
    if (id === 'fleet' && S.ships.length > B.ships) goStep(2);
    else if (id === 'launch' && S.stats.launched > B.launched) goStep(3);
    else if (id === 'flight' && S.missions.length === 0) goStep(4);
    else if (id === 'sell') {
      if (S.stats.oreSold > B.sold) goStep(5);
      else if (!B.replay && S.missions.length === 0 && hold() <= 0.0001) goStep(2, { lost: true }); // the ship was lost: try again
    }
  }
  // what to point at right now: { el, kick, text, step }
  function tutTarget() {
    const S = E.S, B = S.tutBase || {};
    let st = AT.TUTORIAL[S.tutorial], text = st.text;
    const out = (el, t) => ({ el, kick: st.kick, text: t, step: st });
    if (st.id === 'welcome' || st.id === 'flight' || st.id === 'done') return out(st.sel ? $(st.sel) : null, text);
    let tab = st.tab, sel = st.sel;
    if (st.id === 'launch' && !S.ships.length) { const f = AT.TUTORIAL[1]; tab = f.tab; sel = f.sel; text = f.lost; }
    else if (st.id === 'launch' && B.lost) text = st.lost;
    if (activeTab() !== tab) return out($(`#tabs [data-act="tab"][data-arg="${tab}"]`), tab === st.tab ? st.tabText : AT.TUTORIAL[1].tabText);
    let el = $(sel);
    if (!el && st.id === 'launch') { el = $('#tabbody .tlist .trow'); text = 'Pick a target first. The top one is the safe one.'; }
    return out(el, text);
  }
  function ensureTut() {
    if (tutEl) return tutEl;
    tutEl = document.createElement('div');
    tutEl.id = 'tut';
    tutEl.innerHTML = '<div class="tut-dim"></div><div class="tut-frame" hidden></div><div class="tut-panel panel" role="dialog" aria-label="Tutorial"></div>';
    document.body.appendChild(tutEl);
    return tutEl;
  }
  function hideTut() { if (tutEl) { tutEl.remove(); tutEl = null; } tutKey = ''; lastRect = ''; }
  function tutRender() {
    const S = E.S;
    const t = tutTarget();
    const root = ensureTut();
    const panel = $('.tut-panel', root), frame = $('.tut-frame', root), dim = $('.tut-dim', root);
    const n = S.tutorial, total = AT.TUTORIAL.length;
    const key = n + '|' + t.text + '|' + t.kick + '|' + (S.tutBase && S.tutBase.replay ? 'r' : '');
    if (key !== tutKey) {
      tutKey = key;
      const first = t.step.id === 'welcome', last = t.step.id === 'done';
      const dots = Array.from({ length: total - 1 }, (_, i) => `<i class="${i < n - 1 ? 'on' : i === n - 1 ? 'cur' : ''}"></i>`).join('');
      panel.innerHTML = `<div class="spread"><span class="tut-kick">${esc(t.kick)}</span>${first ? '' : `<span class="tut-dots" aria-hidden="true">${dots}</span>`}</div>
        <p class="tut-text">${esc(t.text)}</p>
        <div class="flex tut-btns">${first ? '<button class="btn gold" data-act="tut-next">LET\'S GO</button>' : last ? '<button class="btn gold" data-act="tut-next">GOT IT</button>' : S.tutBase && S.tutBase.replay ? '<button class="btn" data-act="tut-step">SKIP STEP</button>' : ''}${last ? '' : '<button class="btn ghost" data-act="tut-skip">SKIP TUTORIAL</button>'}</div>`;
    }
    let r = null;
    if (t.el && t.el.isConnected) {
      const sk = tutKey;
      if (tutScrolled !== sk) {
        tutScrolled = sk;
        const c = t.el.closest('#tabbody'), b = t.el.getBoundingClientRect();
        if (c) { const cb = c.getBoundingClientRect(); if (b.top < cb.top || b.bottom > cb.bottom) t.el.scrollIntoView({ block: 'center' }); }
      }
      const b = t.el.getBoundingClientRect();
      if (b.width > 0 && b.height > 0) r = b;
    }
    dim.hidden = !!r;
    frame.hidden = !r;
    if (r) {
      const p = 5;
      const rs = `${Math.round(r.left - p)},${Math.round(r.top - p)},${Math.round(r.width + p * 2)},${Math.round(r.height + p * 2)}`;
      if (rs !== lastRect) {
        lastRect = rs;
        frame.style.left = Math.round(r.left - p) + 'px'; frame.style.top = Math.round(r.top - p) + 'px';
        frame.style.width = Math.round(r.width + p * 2) + 'px'; frame.style.height = Math.round(r.height + p * 2) + 'px';
      }
    }
    place(panel, r, !!(t.el && t.el.closest('#tabbody')));
  }
  function place(panel, r, vertFirst) {
    const vw = innerWidth, vh = innerHeight, m = 10, g = 20;
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    let x, y;
    if (!r) { x = (vw - pw) / 2; y = (vh - ph) / 2; }
    else {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const sides = [
        { k: 'right', room: vw - r.right - m, ok: vw - r.right - g - m >= pw, x: r.right + g, y: cl(cy - ph / 2, m, vh - ph - m) },
        { k: 'left', room: r.left - m, ok: r.left - g - m >= pw, x: r.left - g - pw, y: cl(cy - ph / 2, m, vh - ph - m) },
        { k: 'below', room: vh - r.bottom - m, ok: vh - r.bottom - g - m >= ph, x: cl(cx - pw / 2, m, vw - pw - m), y: r.bottom + g },
        { k: 'above', room: r.top - m, ok: r.top - g - m >= ph, x: cl(cx - pw / 2, m, vw - pw - m), y: r.top - g - ph },
      ].filter((s) => s.ok);
      // Targets inside the right-hand console: keep the panel below/above them so it never hides the row they sit in.
      const pref = vertFirst ? { below: 4, above: 3, left: 2, right: 1 } : null;
      sides.sort((a, b) => (pref ? pref[b.k] - pref[a.k] : b.room - a.room));
      if (sides.length) { x = sides[0].x; y = sides[0].y; }
      else { x = cl(r.right - pw - m, m, vw - pw - m); y = cl(r.bottom - ph - m, m, vh - ph - m); } // target fills the screen: sit inside it
    }
    panel.style.left = Math.round(x) + 'px'; panel.style.top = Math.round(y) + 'px';
  }

  // =====================================================================
  // BRIEFINGS
  // =====================================================================
  const LIST = AT.BRIEFINGS.filter((b) => !(DEMO && b.post));
  G.list = LIST;
  const queue = [];
  let shown = null, cardEl = null, nextAt = 0, openIds = {};
  function test(w, S, M) {
    switch (w[0]) {
      case 'reveal': return !!S.reveal[w[1]];
      case 'flag': return !!M.flags[w[1]];
      case 'flagAny': return Object.keys(M.flags).some((k) => k.startsWith(w[1]) && M.flags[k]);
      case 'layerReady': return S.region >= w[1] && S.peakEquity >= AT.LAYERS[w[1]].req;
      case 'layerRuns': return S.layers[w[1]].runs >= w[2];
      case 'pads': return S.ships.length > S.pads;
      case 'contracts': return S.contracts.length > 0;
      case 'rep': return E.repLevel() >= w[1];
      case 'incident': return S.cards.some((c) => c.type === 'inc');
      case 'expedition': return S.targets.some((t) => t.story);
      case 'artifact': return Object.keys(S.artifacts).length > 0;
      case 'memorial': return S.memorial.length > 0;
      case 'staff': return Object.values(S.staff).some((n) => n > 0);
      case 'strike': return !!S.strike;
      case 'quarter': return !!S.shares.lastResult;
      case 'challengeDone': return Object.keys(S.chDone).length > 0;
      case 'canEnd': return E.canEnd() || !!S.ended;
      case 'ngPlus': return S.ngPlus >= 1;
    }
    return false;
  }
  G.test = test;
  // saves that predate briefings: everything already unlocked counts as seen, so veterans are not spammed
  function sweep() {
    const S = E.S, M = E.mults();
    S.briefingsSeen = {};
    for (const b of LIST) if (test(b.when, S, M)) S.briefingsSeen[b.id] = 1;
  }
  function scan() {
    const S = E.S;
    if (!S.briefingsSeen) sweep();
    if (active()) return; // the tutorial goes first; briefings wait their turn
    const M = E.mults(), on = S.settings.showBriefings !== false;
    for (const b of LIST) {
      if (S.briefingsSeen[b.id] || queue.includes(b.id) || (shown && shown.id === b.id)) continue;
      if (!test(b.when, S, M)) continue;
      if (on) queue.push(b.id); else S.briefingsSeen[b.id] = 1; // briefings off: still logged in the Field Manual
    }
    if (!on && queue.length) { for (const id of queue.splice(0)) S.briefingsSeen[id] = 1; }
  }
  function showNext() {
    const S = E.S;
    if (shown || !queue.length || performance.now() < nextAt) return;
    if (!$('#modal').hidden || $('#ending') || (tutEl && active())) return;
    const id = queue.shift();
    const b = LIST.find((x) => x.id === id);
    if (!b) return;
    S.briefingsSeen[id] = 1;
    shown = b;
    renderCard();
    AT.audio.play('card');
  }
  function renderCard() {
    if (!cardEl) { cardEl = document.createElement('aside'); cardEl.id = 'briefing'; cardEl.className = 'panel'; cardEl.setAttribute('role', 'status'); document.body.appendChild(cardEl); }
    const b = shown, S = E.S;
    const tab = b.goto && S.reveal[b.goto] ? b.goto : null;
    const isTab = b.when[0] === 'reveal';
    cardEl.innerHTML = `<div class="spread"><span class="brief-kick">BRIEFING${isTab ? ' · NEW CONSOLE' : ''}</span>${queue.length ? `<span class="brief-more">+${queue.length} MORE</span>` : ''}</div>
      <div class="brief-head"><img class="ico lg pixel" src="${SPR.icon(b.icon)}" alt=""><h3>${esc(b.title)}</h3></div>
      <div class="brief-body">${b.lines.map((l, i) => `<p class="${i === 0 ? 'lead' : ''}">${esc(l)}</p>`).join('')}</div>
      <div class="flex brief-btns">${tab ? `<button class="btn gold" data-act="brief-go" data-arg="${tab}">GO TO ${TAB_LABEL[tab]}</button>` : ''}<button class="btn ${tab ? '' : 'gold'}" data-act="brief-ok">GOT IT</button></div>`;
  }
  function closeCard() {
    shown = null; nextAt = performance.now() + 450;
    if (cardEl) { cardEl.remove(); cardEl = null; }
  }

  // =====================================================================
  // FIELD MANUAL (Archive)
  // =====================================================================
  G.manualSig = function (S) { return (S.briefingsSeen ? Object.keys(S.briefingsSeen).length : 0) + Object.keys(openIds).join(); };
  G.manualHTML = function (S) {
    const seen = S.briefingsSeen || {};
    const n = LIST.filter((b) => seen[b.id]).length;
    let h = `<h3 class="section-h">${SPR.img('book')} FIELD MANUAL <span class="sub">${n}/${LIST.length} · select an entry to re-read it</span></h3><div class="manual">`;
    for (const b of LIST) {
      if (!seen[b.id]) continue;
      const open = !!openIds[b.id];
      h += `<div class="man slot ${open ? 'open' : ''}" data-act="manual" data-arg="${b.id}" aria-expanded="${open}"><div class="man-h"><img class="ico pixel" src="${SPR.icon(b.icon)}" alt=""><b>${esc(b.title)}</b><span class="man-x">${open ? '−' : '+'}</span></div>`;
      if (open) h += `<div class="man-b">${b.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>`;
      h += '</div>';
    }
    const locked = LIST.length - n;
    // one line instead of a wall of locked cells: unseen entries carry no information
    if (locked) h += `</div><p class="empty">${SPR.img('lock')} ${locked} more ${locked === 1 ? 'entry' : 'entries'} classified. Briefings unlock as the company grows.</p><div>`;
    return h + '</div>';
  };

  // =====================================================================
  // WIRING
  // =====================================================================
  G.start = function () {
    const S = E.S;
    if (S.tutorial === undefined || S.tutorial === null) S.tutorial = 'done';
    if (!S.briefingsSeen) sweep();
    if (active() && !S.tutBase) S.tutBase = snap(false);
  };
  G.reset = function () { // after an import / wipe
    queue.length = 0; closeCard(); hideTut(); openIds = {}; G.start();
  };
  G.tick = function () {
    const S = E.S;
    if (active()) { tutAdvance(); if (active()) tutRender(); }
    else if (tutEl) hideTut();
    scan();
    showNext();
  };
  G.frame = function () { if (tutEl && active()) tutRender(); };
  G.act = function (name, arg) {
    const S = E.S;
    if (name === 'tut-next') { if (active()) goStep(S.tutorial + 1); }
    else if (name === 'tut-step') { if (active()) goStep(S.tutorial + 1); }
    else if (name === 'tut-skip') { S.tutorial = 'done'; S.tutBase = null; hideTut(); }
    else if (name === 'tut-replay') { S.tutorial = 0; S.tutBase = snap(true); tutKey = ''; queue.length = 0; closeCard(); }
    else if (name === 'brief-ok') closeCard();
    else if (name === 'manual') { if (openIds[arg]) delete openIds[arg]; else openIds[arg] = 1; }
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && shown) { closeCard(); } });
})(window.AT = window.AT || {});

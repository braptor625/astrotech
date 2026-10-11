"""A prologue player for the UI test tools (shot_prologue.py, playtest.py).

It plays the real prologue through the DOM: it only clicks visible, enabled [data-act] controls (MACHINE PART, hire, static fire,
R&D, assemble, launch, funding, investor cards, BEGIN OPERATIONS). State is read to decide what to do and AT.E.simulate() is used only
to fast-forward time between decisions, never to change anything.

    pp = ProPlayer(pg, log=print, snap=None)
    pp.run()                       # until the mining shell is reached; returns the prologue game time in seconds
Hooks for screenshots: pp.snap(label) is called at milestones (if given); pp.on_flight(att) is called right after a LAUNCH press
(shot_prologue.py uses it to capture the flight in real time); pp.before_launch(tier) / pp.before_fire() let a script force outcomes.
"""
import time

RD_ORDER = ['r_tester', 'r_welds', 'r_turbo', 'r_fc', 'r_bay', 'r_telem', 'r_legs', 'r_lathe', 'r_welds2', 'r_turbo2', 'r_fc2', 'r_vab', 'r_sim']
TH = [0.5, 0.5, 0.45, 0.45]   # odds the bot wants before it commits parts to a tier
TABS = {'workshop': 'pro_workshop', 'stand': 'pro_stand', 'rd': 'pro_rd', 'launch': 'pro_launch', 'funding': 'pro_funding'}

STATE_JS = """() => { const E = AT.E, S = E.S, P = S.pro;
  if (!P || !E.proActive()) return { done: true, t: P ? P.t : 0, certified: !!(P && P.certified), ending: !!document.querySelector('#ending.cert') };
  const nt = E.proNextTier(), T = AT.PROLOGUE.tiers[nt];
  const need = T.parts;
  return { done: false, t: P.t, money: S.money, data: P.data, parts: P.parts, made: P.made, madeTotal: E.proMade(),
    jobs: P.jobs.map(j => j.kind + (j.type || '')), staff: P.staff, rocket: P.rocket, attempt: P.attempt ? { tier: P.attempt.tier, t: P.attempt.t, T: P.attempt.T, ok: P.attempt.ok } : null,
    cards: P.cards.length, cleared: P.cleared, fires: P.stats.fires, rd: Object.keys(P.rd), next: nt, nextId: T.id, odds: E.proOdds(nt), tierBlock: E.proTierBlock(nt),
    unlocked: P.unlocked, fireAuto: P.fireAuto, auto: P.auto,
    full: !P.rocket && Object.keys(need).every(k => P.parts[k] >= need[k]) && !E.proTierBlock(nt),
    have: !P.rocket && Object.keys(need).every(k => E.proHave(k) >= need[k]) && !E.proTierBlock(nt),
    grants: AT.PROLOGUE.grants.filter(g => E.proGrantReady(g)).length,
    offers: AT.PROLOGUE.contracts.filter(c => E.proContractOffered(c) && !AT.PROLOGUE.contracts.some(x => x.tier === c.tier && P.contracts[x.id] === 'accepted')).length,
    launchTab: !!document.querySelector('#tabs [data-arg=pro_launch]'), stats: P.stats, free: E.proFreeBays() }; }"""


class ProPlayer:
    def __init__(self, pg, log=print, snap=None, step=2.0, issue=None):
        self.pg, self.log, self.snap, self.step = pg, log, snap, step
        self.issue = issue or (lambda k, m: log('  !! ' + m))
        self.marks = {}
        self.proReady = None
        self.on_flight = None
        self.before_launch = None
        self.before_fire = None
        self.clicks = 0
        self.briefings = []
        self.last = {}

    # ------------------------------------------------------------ plumbing
    def st(self):
        return self.pg.evaluate(STATE_JS)

    def mark(self, key, shot=None):
        if key in self.marks: return
        s = self.last
        self.marks[key] = s.get('t', 0)
        self.log(f'[prologue {int(self.marks[key]) // 60:02d}m{int(self.marks[key]) % 60:02d}s] {key}')
        if self.snap and shot: self.snap(shot)

    def active_tab(self):
        return self.pg.evaluate("(document.querySelector('#tabs .tab.active') || {dataset: {}}).dataset.arg || ''")

    def open(self, name):
        tab = TABS[name]
        if self.active_tab() == tab: return True
        loc = self.pg.locator(f'#tabs [data-act=tab][data-arg={tab}]')
        if not loc.count(): return False
        self.click_el(loc.first, 'tab ' + name)
        self.pg.wait_for_timeout(80)
        return True

    def click_el(self, el, what):
        try:
            el.click(timeout=2500)
        except Exception:
            self.issue('blocked_' + what, f'click on "{what}" was blocked or timed out (overlay in the way?)')
            try: el.evaluate('e => e.click()')
            except Exception: return False
        self.clicks += 1
        return True

    def click(self, sel, what=None):
        loc = self.pg.locator(sel)
        for i in range(loc.count()):
            el = loc.nth(i)
            if el.is_visible() and el.is_enabled():
                return self.click_el(el, what or sel)
        return False

    def ff(self, secs):
        self.pg.evaluate('s => AT.E.simulate(s)', secs)
        self.pg.wait_for_timeout(60)

    # ------------------------------------------------------------ one decision cycle
    def dismiss(self):
        """A new player reads a briefing card and presses GOT IT."""
        loc = self.pg.locator('#briefing [data-act=brief-ok]')
        if loc.count() and loc.first.is_visible():
            title = self.pg.inner_text('#briefing h3')
            self.click_el(loc.first, 'briefing ' + title)
            self.briefings.append(title); self.pg.wait_for_timeout(100)

    def cycle(self):
        self.dismiss()
        s = self.st(); self.last = s
        if s['done']: return False
        pg = self.pg
        # investor cards: read it, pick the first option
        if s['cards']:
            if self.snap: self.mark('first investor card', 'pitch_card')
            if self.click('#cardbox [data-act=pro-pitch][data-arg=a]', 'investor option A'): return True
        # funding: contracts and grants
        if s['grants'] or s['offers']:
            if self.open('funding'):
                if self.click('#tabbody [data-act=pro-grant]:not([disabled])', 'claim grant') or self.click('#tabbody [data-act=pro-contract]:not([disabled])', 'accept contract'):
                    return True
        # first parts by hand; the machinist as soon as one is affordable
        if s['madeTotal'] >= 1 and not s['staff']['machinist'] and s['money'] >= 450:
            if self.open('workshop') and self.click('#tabbody [data-act=pro-hire][data-arg=machinist]', 'hire machinist'):
                self.last = self.st(); self.mark('machinist hired', 'machinist')
                return True
        if s['madeTotal'] >= 1: self.mark('first part machined', 'first_part')
        if s['madeTotal'] < 3 or not s['staff']['machinist']:
            if self.open('workshop'):
                n = 0
                while n < 12 and self.click('#tabbody [data-act=pro-click]', 'MACHINE PART'):
                    n += 1; self.pg.wait_for_timeout(90)
                    s2 = self.st()
                    if s2['done'] or s2['madeTotal'] >= 3 and s2['staff']['machinist'] or (s2['madeTotal'] >= 1 and not s2['staff']['machinist'] and s2['money'] >= 450): break
                if n: return True
        # R&D
        if s['unlocked']['rd'] and s['data'] > 0:
            for rid in RD_ORDER:
                if rid in s['rd']: continue
                sel = f'#tabbody [data-act=pro-rd][data-arg={rid}]'
                if self.open('rd') and self.pg.locator(sel).count() and self.pg.locator(sel).first.is_enabled():
                    self.click(sel, 'R&D ' + rid); self.last = self.st(); self.mark('R&D ' + rid)
                    return True
        if 'r_tester' in s['rd'] and not s['staff']['tester']:
            if self.open('stand') and self.click('#tabbody [data-act=pro-hire][data-arg=tester]', 'hire test engineer'): return True
        # launch campaign
        nt = s['next']
        if s['have'] and self.proReady is None: self.proReady = s['t']
        commit = s['have'] and (s['odds'] >= TH[nt] or (self.proReady is not None and s['t'] - self.proReady > 120))
        go = s['full'] and commit
        if s['staff']['tester']:
            want = not commit
            if bool(s['fireAuto']) != want and self.open('stand'):
                self.click('#tabbody [data-act=pro-fireauto]', 'toggle auto fire')
        if s['rocket'] and not s['attempt']:
            if self.open('launch'):
                self.last = s; self.mark('rocket assembled', f'rocket_{s["rocket"]["tier"]}')
                if self.before_launch: self.before_launch(s['rocket']['tier'])
                if self.click('#tabbody [data-act=pro-att]:not([disabled])', 'LAUNCH'):
                    a = self.st()
                    if self.on_flight and a.get('attempt'): self.on_flight(a['attempt'], a)
                    return True
        if go and not s['jobs'].count('assemble'):
            if self.open('launch') and self.click(f'#tabbody [data-act=pro-asm][data-arg={s["nextId"]}]:not([disabled])', 'ASSEMBLE ' + s['nextId']):
                self.proReady = None
                return True
        # manual static fires until the test engineer takes over
        if not go and not s['staff']['tester'] and s['made']['engine'] >= 1 and s['unlocked']['stand'] and s['parts']['engine'] >= 1 and s['money'] > 200 and not any(j in ('fire', 'assemble') for j in s['jobs']):
            if self.open('stand'):
                if self.before_fire: self.before_fire()
                if self.click('#tabbody [data-act=pro-fire]', 'STATIC FIRE'):
                    self.last = self.st(); self.mark('first static fire started', 'fire_start')
                    return True
        return False

    def run(self, max_game_s=3600, fast=True):
        """Play until the prologue is over (certification overlay up). Returns prologue game time."""
        n = 0
        while True:
            acted = self.cycle()
            s = self.last
            if s.get('done'): break
            if s['t'] > max_game_s:
                self.issue('pro_timeout', f'prologue did not finish within {max_game_s}s of game time'); return s['t']
            if not acted:
                self.ff(self.step if fast else 0.1)
            n += 1
            if n > 40000: self.issue('pro_loop', 'bot loop ran away'); break
        return self.last.get('t', 0)

    def finish(self, name=None, wait=True):
        """The certification overlay: read it, name the rocket, BEGIN OPERATIONS."""
        pg = self.pg
        pg.wait_for_selector('#ending.cert', timeout=5000)
        if wait: pg.wait_for_timeout(11500)   # let the lines fade in
        if self.snap: self.snap('certification')
        if name:
            pg.fill('#cert-name', name)
        pg.click('#ending.cert [data-act=pro-begin]')
        pg.wait_for_timeout(500)

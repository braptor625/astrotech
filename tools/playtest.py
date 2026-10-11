#!/usr/bin/env python3
"""New-player playtest bot for AstroTech.

Plays the prologue first (tools/pro_play.py: MACHINE PART clicks until a machinist is affordable, then the timed jobs, R&D, launch tiers,
funding, certification), then the mining opening like a human: only clicks visible [data-act] buttons, follows the
Board Directive strip, picks the top row of Mission Control (what a newcomer sees first).
State is touched only to fast-forward time (AT.E.simulate). Decisions use visible DOM text.

usage: python3 tools/playtest.py <outdir> [max_game_minutes=60] [max_directives=40]
Writes <outdir>/timeline.txt, <outdir>/issues.txt and screenshots.
"""
import sys, os, re, pathlib, json
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from pro_play import ProPlayer

root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/playtest'); out.mkdir(parents=True, exist_ok=True)
MAX_MIN = float(sys.argv[2]) if len(sys.argv) > 2 else 60
MAX_DIR = int(sys.argv[3]) if len(sys.argv) > 3 else 40
STUCK_SEC = 300      # same directive for this long -> report
STEP = 15            # seconds of fast-forward per loop

timeline, issues, errors = [], [], []
tut_log, brief_log = [], []
top_risky = [0]   # how often the top Mission Control row showed >=35% risk
seen_issue = set()
shots = 0


def fmt_t(s):
    s = int(s)
    return f'{s // 3600}h{(s % 3600) // 60:02d}m{s % 60:02d}s' if s >= 3600 else f'{s // 60:02d}m{s % 60:02d}s'


with sync_playwright() as p:
    exe = os.environ.get('CHROMIUM_PATH') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
    b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
    pg = b.new_page(viewport={'width': 1366, 'height': 800})
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto((root / 'steam/game/index.html').as_uri()); pg.wait_for_timeout(1200)

    # ---- helpers -------------------------------------------------------
    base_t = [0.0]
    def gt(): return pg.evaluate('AT.E.S.time') - base_t[0]   # for logging only; mining time starts at the license
    def money_txt(): return pg.inner_text('#st-money')
    def dir_txt(): return pg.inner_text('#directive').strip()
    def dir_no():
        m = re.search(r'(\d+)/\d+', dir_txt())
        return int(m.group(1)) if m else 99

    def log(msg):
        line = f'[{fmt_t(gt()):>9}] D{dir_no():02d} {money_txt():>8} | {msg}'
        timeline.append(line); print(line, flush=True)

    def issue(key, msg, shot=True):
        if key in seen_issue: return
        seen_issue.add(key)
        name = ''
        if shot: name = snap('issue_' + key)
        line = f'[{fmt_t(gt())}] D{dir_no():02d} {msg}' + (f'  (shot {name})' if name else '')
        issues.append(line); print('  !! ' + line, flush=True)

    def snap(label):
        global shots
        shots += 1
        name = f'{shots:02d}_{label}.png'
        pg.screenshot(path=str(out / name))
        overflow_check(name)
        return name

    def overflow_check(name):
        r = pg.evaluate("""() => { const bad=[]; const de=document.documentElement;
          if (de.scrollWidth > de.clientWidth+1) bad.push('page scrollWidth '+de.scrollWidth);
          for (const el of document.querySelectorAll('#tabbody *, #directive, .ticker, #deck *, .chip')) {
            if (el.children.length===0 && el.textContent.trim() && el.scrollWidth > el.clientWidth+2 && getComputedStyle(el).overflow!=='visible') bad.push((el.className||el.tagName)+':'+el.textContent.trim().slice(0,30)); }
          return bad.slice(0,4); }""")
        if r:
            key = 'overflow_' + re.sub(r'\W', '', str(r)[:30])
            if key not in seen_issue:
                seen_issue.add(key); issues.append(f'[{fmt_t(gt())}] layout overflow: {r} ({name})'); print('  !! overflow', r)

    def vis(sel):
        loc = pg.locator(sel)
        return [loc.nth(i) for i in range(loc.count()) if loc.nth(i).is_visible()]

    def dismiss_guides():
        """A new player reads the welcome card and presses GOT IT on briefings (they sit bottom-right over the console).
        The tutorial itself advances on the bot's own actions (and never blocks clicks)."""
        for _ in range(3):
            if pg.locator('.tut-panel [data-act=tut-next]').count() and pg.locator('.tut-panel [data-act=tut-next]').first.is_visible():
                kind = pg.inner_text('.tut-kick') if pg.locator('.tut-kick').count() else 'tutorial'
                pg.click('.tut-panel [data-act=tut-next]'); pg.wait_for_timeout(120); log('TUTORIAL ' + kind + ': pressed the button'); tut_log.append(kind)
            elif pg.locator('#briefing [data-act=brief-ok]').count() and pg.locator('#briefing [data-act=brief-ok]').first.is_visible():
                title = pg.inner_text('#briefing h3')
                pg.click('#briefing [data-act=brief-ok]'); pg.wait_for_timeout(120); log('BRIEFING dismissed: ' + title); brief_log.append(title)
            else: break

    def open_tab(t):
        dismiss_guides()
        sel = f'[data-act=tab][data-arg={t}]'
        if not pg.locator(sel).count() or not pg.locator(sel).first.is_visible(): return False
        pg.click(sel); pg.wait_for_timeout(120); return True

    def click_enabled(sel, desc):
        """Click first visible enabled match. Returns True/False."""
        dismiss_guides()
        for el in vis(sel):
            if el.is_enabled():
                el.click(); pg.wait_for_timeout(120); log('click ' + desc); return True
        return False

    def tab_has_hint():
        return pg.locator('#tabs .tab.hint').count()

    # ---- game actions ---------------------------------------------------
    def rows():
        return vis('#tabbody .trow')

    def row_risk(txt):
        m = re.findall(r'(\d+)%', txt)
        return int(m[-1]) if m else None

    def pick_row(pred=None, why='top row', max_risk=None):
        """Click a Mission Control row. Default = the top row (what a newcomer does).
        With max_risk, take the first row whose displayed risk is at or under it (a player who learned)."""
        open_tab('missions')
        rs = rows()
        if rs:
            top = row_risk(rs[0].inner_text())
            if top is not None and top >= 35: top_risky[0] += 1
        for r in rs:
            txt = r.inner_text()
            if pred is not None and not pred(txt): continue
            rk_ = row_risk(txt)
            if max_risk is not None and rk_ is not None and rk_ > max_risk: continue
            r.click(); pg.wait_for_timeout(150)
            return txt.replace('\n', ' | ')
        return None

    def risk_of_selected():
        t = pg.locator('#tabbody .srow .snum').first
        if t.count():
            m = re.search(r'(\d+)% risk', t.inner_text())
            return int(m.group(1)) if m else None
        return None

    def launch_idle(pred=None, why='launch', careful=False):
        """Select a row, launch one idle ship that can go. careful=True avoids rows over 30% displayed risk."""
        launched = 0
        info = pick_row(pred, max_risk=30 if careful else None)
        if info is None and careful:
            info = pick_row(pred)
            if info: issue('norisk_safe', 'no target under 30% risk visible; had to take a risky one', shot=True)
        if info is None:
            return 0
        risk = risk_of_selected()
        for btn in vis('#tabbody [data-act=launch]'):
            if btn.is_enabled():
                if risk is not None and risk >= 25:
                    issue(f'highrisk_{dir_no()}_{risk}', f'launching at {risk}% risk: {info[:70]}')
                btn.click(); pg.wait_for_timeout(150); launched += 1
                log(f'LAUNCH ({why}) risk={risk}% target: {info[:70]}')
                break
        return launched

    def sell_all():
        if open_tab('market') and vis('[data-act=sellall]'):
            b_ = vis('[data-act=sellall]')[0]
            if b_.is_enabled():
                b_.click(); pg.wait_for_timeout(100); log('click SELL ALL'); return True
        return False

    def hire_pilots():
        if open_tab('crew'):
            return click_enabled('[data-act=hirepilot]', 'HIRE PILOT')
        return False

    def handle_cards():
        if pg.locator('#cardbox').is_visible() and pg.locator('#cardbox [data-act=card]').count():
            txt = pg.inner_text('#cardbox').replace('\n', ' ')[:160]
            snap('card')
            pg.click('#cardbox [data-act=card] >> nth=0'); pg.wait_for_timeout(150)
            log('CARD: ' + txt)

    def research(name):
        """Tree nodes are select-only buttons (button.rn); the detail pane's RESEARCH button (#rdbtn) buys the selected node.
        A LOCKED node names its prerequisite (data-req), so the bot follows that chain like a player reading the node."""
        if not open_tab('research'): return 'notab'
        nodes = vis('#tabbody button.rn')
        want = name.split()[0].lower()
        node = next((n for n in nodes if want in n.locator('.nn').inner_text().lower().replace('\xad', '')), None)
        if node is None: return 'node_not_found'
        for _ in range(8):
            cls = node.get_attribute('class') or ''
            if ' done' in cls: return True
            if 'lockd' in cls:
                issue(f'locked_{name[:10]}', f'directive targets "{name}" which is locked behind a prerequisite; bot follows the "needs" label')
                reqs = [r for r in (node.get_attribute('data-req') or '').split(',') if r]
                nxt = next((pg.locator('#node-' + r) for r in reqs if ' done' not in (pg.locator('#node-' + r).get_attribute('class') or '')), None)
                if nxt is None: return 'node_not_found'
                node = nxt; continue
            node.click(); pg.wait_for_timeout(120)
            b = pg.locator('#rdbtn')
            if b.is_enabled():
                b.click(); pg.wait_for_timeout(120); log('click RESEARCH ' + node.locator('.nn').inner_text().replace('\n', ' ')[:40]); return True
            return 'cant_afford'
        return 'cant_afford'

    # ---- directive handlers --------------------------------------------
    def do_directive(text):
        t = text.lower()
        if 'first ship' in t:
            open_tab('fleet'); return click_enabled('[data-act=buyship]', 'BUY ship (first enabled)') or 'no'
        if 'launch a mission' in t or 'first mining mission' in t:
            if not open_tab('missions'): return 'notab'
            # the Mission Control card may already be open on a target: a human just presses LAUNCH
            card = [b_ for b_ in vis('#tabbody .tcard [data-act=launch]') if b_.is_enabled()]
            if card:
                risk = risk_of_selected()
                nm = pg.inner_text('#tabbody .tcard h3')
                card[0].click(); pg.wait_for_timeout(150); log(f'LAUNCH (pre-selected card) risk={risk}% target: {nm}')
                if risk is not None and risk >= 25: issue('first_launch_risk', f'first launch via pre-selected card is {risk}% risk')
                return True
            return bool(launch_idle()) or 'no'
        if t.startswith('sell'):
            return sell_all() or 'no'
        if 'hire a pilot' in t:
            return hire_pilots() or 'no'
        if 'survey an asteroid' in t:
            open_tab('missions')
            if not pick_row(lambda x: 'UNSURVEYED' in x): return 'no_unsurveyed_row'
            return click_enabled('#tabbody [data-act=survey]', 'SURVEY') or 'no'
        if 'launch pad' in t:
            open_tab('fleet'); return click_enabled('[data-act=pad]', 'BUILD PAD') or 'no'
        if 'hire a scientist' in t:
            open_tab('crew'); return click_enabled('[data-act=hire][data-arg=scientist]', 'HIRE scientist') or 'no'
        if t.startswith('research ') or 'go public' in t:
            name = 'incorporation' if 'public' in t else re.sub(r'\s*\(.*$', '', t[len('research '):]).rstrip('.')
            return research(name)
        if 'client contract' in t:
            open_tab('market')
            return click_enabled('[data-act=deliver]', 'DELIVER contract') or 'no'
        if 'm-type' in t:
            return bool(launch_idle(lambda x: 'M-type' in x, 'M-type')) or 'no'
        if t.startswith('own ') and 'ships' in t:
            open_tab('fleet'); return click_enabled('[data-act=buyship]', 'BUY ship') or 'no'
        if t.startswith('commission an excavator') or t.startswith('commission an icebreaker'):
            hull = 'excavator' if 'excavator' in t else 'icebreaker'
            open_tab('fleet')
            if click_enabled(f'[data-act=buyship][data-arg={hull}]', 'BUY ' + hull): return True
            if not vis(f'[data-act=buyship][data-arg={hull}]'):
                issue('hull_locked_' + hull, f'{hull} has no BUY button yet; Fleet card says: ' + ' / '.join(e.inner_text() for e in vis('#tabbody .hullcard.locked .teaser'))[:80])
                return research('heavy hulls' if hull == 'excavator' else 'ice')
            return 'no'
        if 'expedition' in t or 'survey' in t.split('complete')[-1]:
            return bool(launch_idle(lambda x: '★' in x, 'expedition')) or 'no'
        if t.startswith('build an outpost'):
            open_tab('missions'); pick_row(lambda x: 'OUTPOST' not in x)
            return click_enabled('#tabbody [data-act=outpost]', 'BUILD OUTPOST') or 'no'
        return 'idle'     # earn / complete N missions / reputation: just keep operating

    # ---- background routine (what a player does while waiting) ----------
    def ssub_texts():  # read in one go: the panel re-renders under us
        return pg.evaluate("() => Array.from(document.querySelectorAll('#tabbody .ssub')).filter(e => e.offsetParent).map(e => e.innerText)")

    def maintenance_and_growth():
        # repair a worn ship (the risk number visibly climbs as hull drops)
        if open_tab('missions'):
            worn = [int(m.group(1)) for tx in ssub_texts() for m in [re.search(r'hull (\d+)%', tx)] if m]
            if worn and min(worn) < 70 and open_tab('fleet'):
                for e in vis('[data-act=repair]'):
                    if e.is_enabled() and 'REPAIR' in e.inner_text().upper():
                        e.click(); pg.wait_for_timeout(100); log(f'click REPAIR (hull {min(worn)}%)'); break
        # grow: a ship per pad, a pad when every pad has a ship
        if open_tab('fleet'):
            nships = len(vis('#tabbody .shiprow'))
            m = re.search(r'(\d+) built', pg.inner_text('#tabbody'))
            pads = int(m.group(1)) if m else 1
            if nships < pads: click_enabled('[data-act=buyship]', 'BUY ship (grow)')
            elif nships >= pads and pads < 4:
                for e in vis('[data-act=pad]'):
                    c = re.search(r'\$([\d.]+)(K?)', e.inner_text())
                    if c and e.is_enabled() and float(c.group(1)) * (1000 if c.group(2) else 1) * 3 < float(re.sub(r'[^\d.]', '', money_txt().replace('K', '')) or 0) * (1000 if 'K' in money_txt() else 1):
                        e.click(); log('click BUILD PAD (grow)')

    def keep_operating():
        if dir_no() <= 2: return   # the directive handler launches the first mission itself
        if 'client contract' not in dir_txt().lower(): sell_all()
        maintenance_and_growth()
        # a player who just lost their only ship buys another (Fleet says "BUY A PROSPECTOR TO START")
        if open_tab('fleet') and vis('#tabbody .teaser') and any('BUY A PROSPECTOR' in e.inner_text() for e in vis('#tabbody .teaser')):
            if click_enabled('[data-act=buyship]', 'REBUY ship (fleet empty)') is False:
                issue('broke_noship', f'fleet is empty and cannot afford a ship (money {money_txt()})')
        if launch_idle(why='auto-routine', careful=gt() > 120) == 0:
            # the ship row says "NO PILOT" when a pilot is what blocks the launch
            if open_tab('missions') and any('NO PILOT' in tx for tx in ssub_texts()):
                hire_pilots()

    # ---- prologue pass --------------------------------------------------
    pro_time = None
    snap('00_start')
    if pg.evaluate('AT.E.proActive()'):
        log('prologue start; order: ' + dir_txt())
        def plog(msg):
            timeline.append(msg); print(msg, flush=True)
        pro_issue = lambda k, m: issue('pro_' + k, m, shot=False)
        pp = ProPlayer(pg, log=plog, snap=None, step=2.0, issue=pro_issue)
        pro_time = pp.run(max_game_s=3600)
        snap('01_prologue_certified')
        if not pg.locator('#ending.cert').count(): issue('nocert', 'the certification beat did not appear')
        pp.finish(wait=False)
        pg.wait_for_timeout(500)
        base_t[0] = pg.evaluate('AT.E.S.time')
        log(f'PROLOGUE DONE in {fmt_t(pro_time)} of game time ({pro_time / 60:.1f} min); {pp.clicks} clicks; briefings read: {len(pp.briefings)}')
        s_ = pg.evaluate('AT.E.S.pro.cert')
        log(f'  license: {s_["attempts"]} attempts, {s_["fails"]} lost, rel avg {s_["relAvg"] * 100:.0f}%, +{s_["rp"]:.0f} RP, risk bonus {s_["bonus"] * 100:.0f}%, name "{s_["name"]}"')
        if pro_time < 300 or pro_time > 1800:
            issue('pro_len', f'the prologue took {pro_time / 60:.1f} min of game time for this bot (design target: 15-25 min for humans, about 10 for the engine bot)', shot=False)
        if pg.locator('#tabs [data-arg=pro_workshop]').count(): issue('pro_rail', 'prologue consoles still in the rail after certification', shot=False)
        snap('02_mining_shell')
    # ---- main loop ------------------------------------------------------
    log('mining start; directive: ' + dir_txt())
    last_dir, last_dir_t, last_money_t = dir_no(), gt(), gt()
    shot_dirs = {1, 2, 3, 4, 5, 6, 8, 10, 14, 20, 25, 30}
    idle_waits = 0
    while gt() < MAX_MIN * 60 and dir_no() <= MAX_DIR:
        dismiss_guides()
        handle_cards()
        d = dir_no()
        text = re.sub(r'^BOARD ORDERS?\s*\d+/\d+\s*', '', dir_txt()).strip()
        res = do_directive(text)
        if res not in (True, 'idle'):
            key = f'cantdo_{d}'
            if res in ('no', 'cant_afford'):
                pass  # normal: likely unaffordable right now; handled by stuck timer
            else:
                issue(key + str(res), f'directive "{text}" needs a UI element that is missing/hidden ({res})')
        keep_operating()
        # directive tab hint
        if pg.evaluate("1") and tab_has_hint() == 0 and d != last_dir:
            pass
        nd = dir_no()
        if nd != last_dir:
            log(f'DIRECTIVE {last_dir} DONE -> {nd}: ' + dir_txt()[:80])
            if last_dir in shot_dirs: snap(f'dir{last_dir:02d}_done')
            last_dir, last_dir_t = nd, gt()
        elif gt() - last_dir_t > STUCK_SEC:
            issue(f'stuck_{d}', f'stuck {fmt_t(gt() - last_dir_t)} on directive {d}: "{text}" (money {money_txt()}, last result {res})')
            last_dir_t = gt() + 1e9 if False else gt()  # re-arm
        # no-affordable-action detector: all visible enabled actionable buttons in 4 key tabs
        stat = pg.evaluate("({idle:AT.E.S.ships.filter(s=>s.state==='idle').length, fly:AT.E.S.missions.length, ships:AT.E.S.ships.length})")
        if stat['ships'] == 0 and gt() > 60:
            issue('noship_60s', f'no ship bought after {fmt_t(gt())}')
        if stat['fly'] == 0 and stat['idle'] == 0 and stat['ships'] > 0:
            idle_waits += 1
            if idle_waits > 6: issue(f'dead_{int(gt()//600)}', f'all ships repairing/idle with nothing flying for a long time (money {money_txt()})')
        else: idle_waits = 0
        pg.evaluate(f'AT.E.simulate({STEP})')
        pg.wait_for_timeout(250)

    snap('99_end')
    tut_state = pg.evaluate('AT.E.S.tutorial')
    final = pg.evaluate("({t:AT.E.S.time, dir:AT.E.S.dirIdx, money:AT.E.S.money, losses:AT.E.S.stats.losses, deaths:AT.E.S.stats.deaths, missions:AT.E.S.stats.missions, ships:AT.E.S.ships.length, pilots:AT.E.S.pilots.length})")
    b.close()

if tut_state != 'done': issues.append(f'tutorial did not finish on its own (state {tut_state})')
summary = f'prologue: {pro_time / 60:.1f} min of game time (certified)\n' if pro_time else ''
summary += f'tutorial: {tut_state}; briefings dismissed: {len(brief_log)} ({", ".join(brief_log)})\n(top row showed >=35% risk on {top_risky[0]} picks)\nFINAL: game time {fmt_t(final["t"])}, directives done {final["dir"]}, missions {final["missions"]}, losses {final["losses"]}, pilot deaths {final["deaths"]}, ships {final["ships"]}, pilots {final["pilots"]}'
(out / 'timeline.txt').write_text('\n'.join(timeline) + '\n\n' + summary + '\n')
(out / 'issues.txt').write_text('\n'.join(issues) + '\n')
print('\n=== ISSUES ===\n' + '\n'.join(issues))
print(summary)
print(json.dumps(errors[:10], indent=1) if errors else 'no console errors')

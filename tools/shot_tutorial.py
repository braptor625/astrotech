#!/usr/bin/env python3
"""Screenshots the prologue coach marks (fresh save), the mining tutorial (a save whose prologue was skipped), a briefing card and the Field Manual.

usage: node tools/build.mjs && python3 tools/shot_tutorial.py <outdir> [width=1366] [height=800] [textSize=large] [--demo]
Also asserts the behaviour: steps advance on the player's own actions, the overlay never blocks clicks,
old saves skip the tutorial and are not spammed with briefings, and the Field Manual / settings work.
"""
import sys, os, pathlib, json, subprocess
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith('--')]
DEMO = '--demo' in sys.argv
out = pathlib.Path(args[0] if args else '/tmp/claude-0/shots-tut'); out.mkdir(parents=True, exist_ok=True)
W = int(args[1]) if len(args) > 1 else 1366
H = int(args[2]) if len(args) > 2 else 800
TEXT = args[3] if len(args) > 3 else 'large'
url = ((root / 'dist/demo/astrotech-demo.html') if DEMO else (root / 'steam/game/index.html')).as_uri()
SAVEKEY = 'astrotech.demo.save.v2' if DEMO else 'astrotech.save.v2'
errors, problems = [], []
tag = f'{W}x{H}_{TEXT}'


def check(cond, msg):
    if not cond: problems.append(msg)


with sync_playwright() as p:
    exe = os.environ.get('CHROMIUM_PATH') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
    b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
    skip_save = subprocess.check_output(['node', str(root / 'tools/skipsave.js'), 'tutorial'], text=True)

    def new_page(save=None):
        pg = b.new_page(viewport={'width': W, 'height': H})
        pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        if save: pg.add_init_script("try { if (!localStorage.getItem('%s')) localStorage.setItem('%s', %s); } catch (e) {}" % (SAVEKEY, SAVEKEY, json.dumps(save)))
        pg.goto(url); pg.wait_for_timeout(1200)
        pg.evaluate("t => { AT.E.S.settings.textSize = t; document.documentElement.dataset.text = t; }", TEXT)
        pg.wait_for_timeout(400)
        return pg

    def shot(name):
        pg.wait_for_timeout(350)
        pg.screenshot(path=str(out / f'{tag}_{name}.png'))

    def step(): return pg.evaluate('AT.E.S.tutorial')
    def panel_text(): return pg.inner_text('.tut-panel') if pg.locator('.tut-panel').count() else ''

    def frame_ok(name):
        """The highlight frame and the panel must be fully on screen and not overlap each other."""
        r = pg.evaluate("""() => { const f = document.querySelector('.tut-frame'), p = document.querySelector('.tut-panel');
          const pr = p.getBoundingClientRect(); const fr = f.hidden ? null : f.getBoundingClientRect();
          return { pr: [pr.left, pr.top, pr.right, pr.bottom], fr: fr && [fr.left, fr.top, fr.right, fr.bottom], vw: innerWidth, vh: innerHeight }; }""")
        pl, pt, pr_, pb = r['pr']
        check(pl >= 0 and pt >= 0 and pr_ <= r['vw'] and pb <= r['vh'], f'{name}: panel off screen {r["pr"]}')
        if r['fr']:
            fl, ft, fr_, fb = r['fr']
            big = (fr_ - fl) * (fb - ft) > 0.35 * r['vw'] * r['vh']
            overlap = not (pr_ <= fl or pl >= fr_ or pb <= ft or pt >= fb)
            check(big or not overlap, f'{name}: panel overlaps its target {r}')

    # ================= A. the prologue coach (fresh save) =================
    pg = new_page()
    check(step() == 'pro', 'a fresh game should be in the prologue (tutorial state "pro")')
    check('MACHINE' in panel_text(), 'coach 1 should point at MACHINE PART')
    frame_ok('p1'); shot('p1_machine_part')
    # the overlay never blocks the click it asks for
    for i in range(40):
        if pg.evaluate('AT.E.proMade()') >= 1: break
        pg.click('#tabbody [data-act=pro-click]'); pg.wait_for_timeout(100)
    pg.wait_for_timeout(300)
    check(pg.evaluate('AT.E.proMade()') >= 1, 'clicking MACHINE PART should machine a part')
    check('MACHINIST' in panel_text().upper(), 'coach 2 should ask for a machinist')
    frame_ok('p2'); shot('p2_hire_machinist')
    pg.click('#tabbody [data-act=pro-hire][data-arg=machinist]'); pg.wait_for_timeout(400)
    check(pg.evaluate('AT.E.S.pro.staff.machinist') == 1, 'HIRE should hire the machinist')
    check('TEST STAND' in panel_text().upper(), 'coach 3 should send the player to the TEST STAND')
    frame_ok('p3a'); shot('p3a_open_stand')
    pg.click('#tabs [data-arg=pro_stand]'); pg.wait_for_timeout(400)
    check('STATIC FIRE' in panel_text().upper(), 'coach 3 should point at STATIC FIRE once in the stand')
    frame_ok('p3b'); shot('p3b_static_fire')
    pg.evaluate('AT.E.simulate(40)'); pg.wait_for_timeout(500)   # the machinist finishes the bay
    pg.click('#tabbody [data-act=pro-fire]'); pg.wait_for_timeout(400)
    check(pg.evaluate("AT.E.S.pro.jobs.some(j => j.kind === 'fire')"), 'STATIC FIRE should start a fire job')
    pg.wait_for_timeout(600)
    check('STATIC FIRE' not in panel_text().upper(), 'the static-fire coach should step aside while the engine burns')
    pg.evaluate('AT.E.simulate(25)'); pg.wait_for_timeout(500)
    check(pg.evaluate('AT.E.S.pro.stats.fires') >= 1, 'the static fire should complete')
    pg.evaluate('AT.E.simulate(40)'); pg.wait_for_timeout(500)   # parts for the hop
    for i in range(8):   # briefings first, then the coach
        if pg.locator('#briefing').count(): pg.click('#briefing [data-act=brief-ok]'); pg.wait_for_timeout(600)
    check('LAUNCH' in panel_text().upper(), 'coach 4 should point at the Launch console')
    frame_ok('p4a'); shot('p4a_open_launch')
    pg.click('#tabs [data-arg=pro_launch]'); pg.wait_for_timeout(400)
    check('ASSEMBLE' in panel_text().upper(), 'coach 4 should point at ASSEMBLE in the Launch console')
    frame_ok('p4b'); shot('p4b_assemble')
    pg.click('#tabbody [data-coach=launch]'); pg.wait_for_timeout(500)
    check(pg.locator('.tut-panel').count() == 0, 'the coach should be done once the first assembly starts')
    shot('p5_coach_done')
    pg.close()

    # ================= B. the mining tutorial (prologue skipped) =================
    pg = new_page(skip_save)
    # ---- 0. welcome -----------------------------------------------------
    check(step() == 0, 'a skipped prologue should start the mining tutorial at step 0')
    check(pg.evaluate('AT.E.S.ships.length') == 1, 'the proof-of-concept rocket should already be a Prospector')
    check(DEMO or pg.locator('#briefing').count() == 0, 'no briefing during the tutorial')
    check('Four clicks' not in panel_text() and 'ore' in panel_text().lower(), 'welcome text should be the new one')
    shot('t0_welcome')
    pg.click('[data-act=tut-next]'); pg.wait_for_timeout(300)
    check(step() == 1, "LET'S GO should advance to the launch step (there is no fleet step any more)")
    # ---- 1. missions ----------------------------------------------------
    check('MISSION' in panel_text().upper(), 'step 1 should ask for the Missions console')
    frame_ok('t1a'); shot('t1a_open_missions')
    pg.click('#tabs [data-arg=missions]'); pg.wait_for_timeout(400)
    check('LAUNCH' in panel_text(), 'step 1 should point at LAUNCH')
    frame_ok('t1b'); shot('t1b_launch')
    pg.click('#tabbody .tcard [data-act=launch] >> nth=0'); pg.wait_for_timeout(2500)
    check(step() == 2, 'launching should advance to the flight step')
    # ---- 2. flight ------------------------------------------------------
    frame_ok('t2'); shot('t2_flight')
    pg.evaluate('AT.E.simulate(40)'); pg.wait_for_timeout(600)
    lost = pg.evaluate('AT.E.S.stats.losses') > 0
    if lost:
        print('mission was lost; tutorial should loop back')
        check(step() == 1, 'a lost ship should send the tutorial back to the launch step')
    else:
        check(step() == 3, 'landing should advance to the market step')
        # ---- 3. market --------------------------------------------------
        frame_ok('t3a'); shot('t3a_open_market')
        pg.click('#tabs [data-arg=market]'); pg.wait_for_timeout(400)
        check('SELL' in panel_text(), 'step 3 should point at SELL EVERYTHING')
        frame_ok('t3b'); shot('t3b_sell')
        pg.click('[data-act=sellall]'); pg.wait_for_timeout(400)
        check(step() == 4, 'selling should advance to the wrap-up')
        frame_ok('t4'); shot('t4_done')
        pg.click('[data-act=tut-next]'); pg.wait_for_timeout(300)
        check(step() == 'done', 'GOT IT should finish the tutorial')
        check(pg.locator('#tut').count() == 0, 'overlay should be removed when done')
        check(pg.evaluate('AT.E.S.dirIdx') >= 3, 'directives 1-3 should be complete after the tutorial')

    # ---- briefing card --------------------------------------------------
    pg.wait_for_timeout(1500)
    if not DEMO or pg.locator('#briefing').count():
        check(pg.locator('#briefing').count() == 1, 'a briefing should show once the tutorial is done')
        if pg.locator('#briefing').count():
            shot('b1_briefing')
            r = pg.evaluate("() => { const b = document.querySelector('#briefing').getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom, innerWidth, innerHeight]; }")
            check(r[2] <= r[4] and r[3] <= r[5] and r[0] >= 0 and r[1] >= 0, f'briefing off screen {r}')
            # toast + decision card at once: nothing should collide with the briefing
            pg.evaluate("""() => { const S = AT.E.S; AT.ui.toast('trophy', 'ACHIEVEMENT', 'Open for Business'); AT.ui.toast('stats', 'SAVED', 'Progress saved.');
              S.cards.push({type:'inc', id:'i_union', ctx:{pilot:'Ada Okafor', ship:'ATS Synergy', target:'X'}, expires: S.time+150}); }""")
            pg.wait_for_timeout(700)
            shot('b2_briefing_with_card_and_toasts')
            hit = pg.evaluate("""() => { const a = document.querySelector('#briefing').getBoundingClientRect(); const bad = [];
              for (const s of ['#cardbox .dcard', '#toasts .toast']) for (const e of document.querySelectorAll(s)) { const b = e.getBoundingClientRect();
                if (!(b.right <= a.left || b.left >= a.right || b.bottom <= a.top || b.top >= a.bottom)) bad.push(s); } return bad; }""")
            check(not hit, f'briefing collides with {hit}')
            pg.click('#cardbox [data-act=card] >> nth=0'); pg.wait_for_timeout(200)
            # dismiss everything queued, counting them
            n = 0
            while pg.locator('#briefing').count() and n < 20:
                pg.click('#briefing [data-act=brief-ok]'); pg.wait_for_timeout(700); n += 1
            print('briefings dismissed:', n)

    # ---- field manual ---------------------------------------------------
    pg.click('#tabs [data-arg=archive]'); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('.manual').scrollIntoView({block:'start'})"); pg.wait_for_timeout(200)
    first = pg.locator('.man:not(.locked)').first
    if first.count():
        first.click(); pg.wait_for_timeout(300)
        check(pg.locator('.man.open .man-b p').count() >= 2, 'clicking a Field Manual entry should expand it')
    check(pg.locator('.manual ~ .empty, .empty').filter(has_text='classified').count() > 0, 'locked entries should be summarised as classified')
    shot('f1_field_manual')
    # settings: toggle + replay
    pg.click('[data-act=settings]'); pg.wait_for_timeout(300)  # settings are a modal now
    pg.evaluate("document.querySelector('[data-k=set_brief]').scrollIntoView({block:'center'})"); pg.wait_for_timeout(200)
    shot('f2_settings')
    pg.click('[data-k=set_brief]'); pg.wait_for_timeout(200)
    check(pg.evaluate('AT.E.S.settings.showBriefings') is False, 'toggle should turn briefings off')
    pg.click('[data-k=set_brief]'); pg.wait_for_timeout(200)
    check(pg.evaluate('AT.E.S.settings.showBriefings') is True, 'toggle should turn briefings back on')
    pg.click('[data-k=set_tut]'); pg.wait_for_timeout(500)
    check(step() == 0 and pg.locator('.tut-panel').count() == 1, 'REPLAY should restart the tutorial')
    shot('r1_replay')
    pg.click('[data-act=tut-skip]'); pg.wait_for_timeout(300)
    check(step() == 'done' and pg.locator('#tut').count() == 0, 'SKIP TUTORIAL should end it')

    # ---- old saves ------------------------------------------------------
    if not DEMO:
        old = pg.evaluate("""() => { const E = AT.E, S = E.S; S.money = 5e7; S.rp = 5e4; S.earnedTotal = 1e8; S.earnedRun = 1e8; S.stats.oreMined = 1e5; S.peakEquity = 5e7;
          for (const r of AT.RESEARCH.filter(r => r.region === 0 && r.cost < 5000)) S.research[r.id] = 1; E.touch(); E.simulate(5);
          const j = JSON.parse(E.save()); delete j.tutorial; delete j.tutBase; delete j.briefingsSeen; delete j.pro; delete j.prologueDone; return JSON.stringify(j); }""")
        # a fresh page, so the old page's save-on-unload cannot overwrite the planted save
        pg = b.new_page(viewport={'width': W, 'height': H})
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.add_init_script("try { localStorage.setItem('astrotech.save.v2', %s); } catch (e) {}" % json.dumps(old))
        pg.goto(url); pg.wait_for_timeout(1500)
        check(step() == 'done', 'an old save should count the tutorial as done')
        check(pg.evaluate('AT.E.proActive()') is False, 'an old save (no prologue fields) should count the prologue as done')
        pg.wait_for_timeout(1000)
        check(pg.locator('#briefing').count() == 0, 'an old save must not be spammed with briefings for features it already has')
        check(pg.evaluate('Object.keys(AT.E.S.briefingsSeen).length') >= 8, 'an old save should have its unlocked briefings marked seen')
        pg.click('#tabs [data-arg=archive]'); pg.wait_for_timeout(400)
        check(pg.locator('.man:not(.locked)').count() >= 8, "Field Manual should list the veteran's unlocked entries")
    b.close()

print('PROBLEMS:' if problems else 'checks ok', json.dumps(problems, indent=1) if problems else '')
print(json.dumps(errors[:10], indent=1) if errors else 'no console errors')
sys.exit(1 if problems or errors else 0)

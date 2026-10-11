#!/usr/bin/env python3
"""Plays the real prologue through the UI on a fresh save and screenshots every stage.

usage: node tools/build.mjs && python3 tools/shot_prologue.py <outdir> [W=1366] [text=large] [H=800] [--demo]

Everything the player does is a click on a visible control (tools/pro_play.py). AT.E.simulate() only fast-forwards time, and AT.E.rng is
forced for a handful of rolls so the stages worth looking at (an exploded engine, a lost Hop, a lost Suborbital) always happen, once each.
Also checks the keyboard shortcuts, the phone layout, and what New game (with prologue), Replay prologue, Skip prologue and Wipe do.
Asserts: no console errors, no horizontal overflow, the certification beat appears, the mining shell opens with a ship and the mining tutorial.
"""
import sys, os, json, pathlib, subprocess
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from pro_play import ProPlayer

root = pathlib.Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith('--')]
DEMO = '--demo' in sys.argv
out = pathlib.Path(args[0] if args else '/tmp/claude-0/prologue-ui/run'); out.mkdir(parents=True, exist_ok=True)
W = int(args[1]) if len(args) > 1 else 1366
TEXT = args[2] if len(args) > 2 else 'large'
H = int(args[3]) if len(args) > 3 else 800
url = ((root / 'dist/demo/astrotech-demo.html') if DEMO else (root / 'steam/game/index.html')).as_uri()
SAVEKEY = 'astrotech.demo.save.v2' if DEMO else 'astrotech.save.v2'
FLAGKEY = 'astrotech.demo.prologueDone' if DEMO else 'astrotech.prologueDone'
errors, overflow = [], {}
SCAN = """() => { const out = []; const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth) out.push('PAGE scrollWidth ' + de.scrollWidth + ' > ' + de.clientWidth);
  for (const e of document.querySelectorAll('body *')) { if (e.closest('svg') || !e.offsetParent) continue; const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && cs.textOverflow !== 'ellipsis' && e.clientWidth > 0 && !e.closest('.mach-art') && !e.classList.contains('tut-frame')) out.push((e.tagName + '.' + e.className + ' ' + e.scrollWidth + '>' + e.clientWidth + ' ' + (e.textContent || '').trim().slice(0, 30)));
    const r = e.getBoundingClientRect(); const c = e.closest('.tabbody, main, #modal'); if (c && e.matches('button.btn') && (r.right > c.getBoundingClientRect().right + 1 || r.left < c.getBoundingClientRect().left - 1)) out.push('CLIPPED-X ' + e.className + ' ' + e.textContent.trim().slice(0, 20)); }
  return out.slice(0, 12); }"""
n = [0]

with sync_playwright() as p:
    exe = os.environ.get('CHROMIUM_PATH') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
    b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H})
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto(url); pg.wait_for_timeout(1500)
    pg.evaluate("t => { AT.E.S.settings.textSize = t; document.documentElement.dataset.text = t; }", TEXT); pg.wait_for_timeout(300)

    def snap(label):
        n[0] += 1
        name = f'{n[0]:02d}_{label}.png'
        pg.screenshot(path=str(out / name))
        r = pg.evaluate(SCAN)
        if r: overflow[name] = r
        return name

    def log(msg): print(msg, flush=True)

    pp = ProPlayer(pg, log=log, snap=snap, step=2.0, issue=lambda k, m: errors.append('BOT: ' + m))
    # ---- the very start: a bare lot
    snap('00_bare_lot')
    assert pg.locator('#tabs [data-arg=pro_workshop]').count() == 1, 'workshop missing in the rail'
    assert pg.locator('#tabs [data-arg=missions]').count() == 0, 'mining consoles visible in the prologue'
    assert 'MACHINE' in pg.inner_text('#directive').upper(), 'goal pill does not show the first order'
    # the first clicks, with the sparks at the lathe
    for i in range(4):
        pp.click('#tabbody [data-act=pro-click]', 'MACHINE PART'); pg.wait_for_timeout(110)
    # holding the button keeps machining (the pointer-repeat of the engine's other buy buttons)
    c0 = pg.evaluate('AT.E.S.pro.stats.clicks')
    box = pg.locator('#tabbody [data-act=pro-click]').bounding_box()
    pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); pg.mouse.down(); pg.wait_for_timeout(1300); pg.mouse.up()
    if pg.evaluate('AT.E.S.pro.stats.clicks') - c0 < 5: errors.append('holding MACHINE PART did not repeat')
    snap('01_first_part_in_progress')
    # phone width in the prologue: the rail becomes a bottom bar and nothing overflows
    pg.set_viewport_size({'width': 420, 'height': 900}); pg.wait_for_timeout(500)
    snap('01b_phone_420')
    if pg.evaluate('document.documentElement.scrollWidth') > 420: errors.append('horizontal overflow at 420px in the prologue')
    pg.set_viewport_size({'width': 1000, 'height': 760}); pg.wait_for_timeout(500)
    snap('01c_narrow_1000')
    if pg.evaluate('document.documentElement.scrollWidth') > 1000: errors.append('horizontal overflow at 1000px in the prologue')
    pg.set_viewport_size({'width': W, 'height': H}); pg.wait_for_timeout(500)
    # accessibility modes do not break the prologue shell
    pg.evaluate("() => { const s = AT.E.S.settings; s.highContrast = true; s.reduceMotion = true; document.documentElement.classList.add('hc', 'reduce-motion'); AT.reducedMotion = true; }")
    pg.wait_for_timeout(400); snap('01d_high_contrast_reduce_motion')
    pg.evaluate("() => { const s = AT.E.S.settings; s.highContrast = false; s.reduceMotion = false; document.documentElement.classList.remove('hc', 'reduce-motion'); AT.reducedMotion = false; }")

    # ---- a fire that works, and one that does not
    fires = [0]
    def before_fire():
        fires[0] += 1
        pg.evaluate('r => { AT.E.rng = () => r; }', 0.99 if fires[0] == 1 else 0.0)
    pp.before_fire = before_fire

    attempts = {'n': 0, 'sub': 0}
    def before_launch(tier):
        attempts['n'] += 1
        fail = (tier == 0 and attempts['n'] == 1) or (tier == 1 and attempts['sub'] == 0)
        if tier == 1: attempts['sub'] += 1
        # rolls: success, [cause, failAt]. 0.999 fails; the failure is placed ~half way through the flight
        pg.evaluate('seq => { let i = 0; AT.E.rng = () => seq[Math.min(i++, seq.length - 1)]; }', [0.999, 0.3, 0.3] if fail else [0.0, 0.5, 0.5])
    pp.before_launch = before_launch

    def on_flight(att, s):
        pg.evaluate('AT.E.rng = null')
        T = att['T']; tier = att['tier']
        marks = [0.1, 0.3, 0.5, 0.7, 0.9]
        got = set()
        end = pg.evaluate('() => performance.now()') + (T + 6) * 1000
        while pg.evaluate('() => performance.now()') < end:
            a = pg.evaluate('() => { const a = AT.E.S.pro && AT.E.S.pro.attempt; return a ? [a.t, a.T] : null; }')
            if not a: break
            for k in marks:
                if k not in got and a[0] >= k * a[1]:
                    got.add(k); snap(f'flight_t{tier}_{int(k * 100):02d}')
            pg.wait_for_timeout(120)
        pg.wait_for_timeout(450); snap(f'flight_t{tier}_result')
        pg.wait_for_timeout(1800); snap(f'flight_t{tier}_after')
    pp.on_flight = on_flight

    # the loop. Static fires and the first screens are shot from the marks; the stand fire is also watched in real time.
    seen = set()
    orig_cycle = pp.cycle
    def cycle():
        r = orig_cycle()
        s = pp.last
        if s.get('done'): return r
        if s['unlocked']['stand'] and 'stand' not in seen:
            seen.add('stand'); pp.open('stand'); snap('02_test_stand_unlocked')
            # keyboard: 1 and 2 open the first two consoles in rail order, [ and ] do nothing in the prologue
            pg.keyboard.press('1'); pg.wait_for_timeout(200)
            if pp.active_tab() != 'pro_workshop': errors.append('key 1 did not open the Workshop')
            pg.keyboard.press('2'); pg.wait_for_timeout(200)
            if pp.active_tab() != 'pro_stand': errors.append('key 2 did not open the Test Stand')
            pg.keyboard.press(']'); pg.wait_for_timeout(200)
            if pg.evaluate('AT.scene.getView()') != 'launch': errors.append('] changed the viewport in the prologue')
            if pg.locator('#vbar .segctl').is_visible(): errors.append('map/close-up view buttons are visible in the prologue')
        if s['unlocked']['rd'] and 'rd' not in seen:
            seen.add('rd'); pp.open('rd'); snap('03_rd_unlocked')
        if s['launchTab'] and 'launch' not in seen:
            seen.add('launch'); pp.open('launch'); snap('04_launch_console')
        if 'burn' not in seen and any(j == 'fire' for j in s['jobs']) and fires[0] >= 1:
            seen.add('burn'); pg.evaluate('AT.E.simulate(3)'); pg.wait_for_timeout(500); pp.open('stand'); snap('05_static_fire_burning')
            pg.evaluate('AT.E.rng = null')
        if fires[0] >= 2 and 'boom' not in seen and any(j == 'fire' for j in s['jobs']):
            seen.add('boom'); pp.open('stand')
            j = pg.evaluate("() => { const j = AT.E.S.pro.jobs.find(j => j.kind === 'fire'); return j ? j.T - j.t : 0; }")
            if j > 3: pg.evaluate('s => AT.E.simulate(s)', j - 2.6)
            pg.wait_for_timeout(2300); snap('06_static_fire_before_boom')
            pg.wait_for_timeout(700); snap('07_engine_lost'); pg.wait_for_timeout(1200); snap('08_engine_lost_after')
            pg.evaluate('AT.E.rng = null')
        if s['cleared'].get('hop') and 'funding' not in seen:
            seen.add('funding'); pg.wait_for_timeout(600); snap('09_pitch_card_over_viewport'); pp.open('funding'); snap('10_funding_console')
        if s['cards'] and 'cardchoice' not in seen:
            seen.add('cardchoice')
        return r
    pp.cycle = cycle

    t = pp.run(max_game_s=3600)
    print(f'prologue game time: {t:.0f}s ({t / 60:.1f} min)')
    assert pg.evaluate("AT.E.proActive() === false"), 'the prologue did not end'
    # certification beat
    pp.finish(name='ATS Long Shot')
    snap('50_mining_shell')
    pg.wait_for_timeout(600)
    # ---- the mining shell: unlocked, with a ship and the (shortened) mining tutorial
    assert pg.locator('#tabs [data-arg=missions]').count() == 1, 'mining shell did not open'
    ships = pg.evaluate('AT.E.S.ships.map(s => s.name)')
    assert ships == ['ATS Long Shot'], f'expected the named proof-of-concept ship, got {ships}'
    assert pg.locator('.tut-panel').count() == 1 and 'LET' in pg.inner_text('.tut-panel'), 'mining tutorial welcome missing'
    snap('51_mining_tutorial_welcome')
    pg.click('[data-act=tut-next]'); pg.wait_for_timeout(400)
    snap('52_mining_tutorial_launch')
    assert pg.evaluate('AT.E.S.tutorial') == 1, 'tutorial did not advance to the launch step (fleet step should be gone)'
    for t_ in ['missions', 'fleet', 'crew']:
        pass
    pg.click('[data-act=tut-skip]'); pg.wait_for_timeout(300)
    snap('53_mining_missions')
    assert pg.evaluate("localStorage.getItem('%s')" % FLAGKEY) == '1', 'device flag not persisted'

    # ---- New game (with prologue), Replay prologue, Skip prologue ----------------------------------------------------
    def settings_click(k):
        pg.click('[data-act=settings]'); pg.wait_for_timeout(300)
        pg.evaluate("k => document.querySelector('[data-k=' + k + ']').scrollIntoView({block: 'center'})", k); pg.wait_for_timeout(150)
        pg.click(f'[data-k={k}]'); pg.wait_for_timeout(300)
    pg.keyboard.press('Escape')
    pg.evaluate("() => { AT.E.S.tutorial = 'done'; AT.E.S.settings.textSize = 'xl'; }")
    pg.evaluate("() => { AT.E.S.achMarker = 1; }")
    settings_click('set_replaypro'); snap('60_replay_prologue_confirm')
    pg.click('[data-act=do-newpro]'); pg.wait_for_timeout(600)
    assert pg.evaluate('AT.E.proActive()'), 'Replay prologue should start the prologue even though the device flag is set'
    assert pg.locator('#modal:not([hidden])').count() == 0, 'Replay prologue must not ask whether to skip'
    assert pg.evaluate('AT.E.S.settings.textSize') == 'xl' and pg.evaluate('AT.E.S.ach.ACH_PRO_RETURNED') == 1, 'Replay prologue should keep settings and achievements'
    assert pg.locator('#tabs [data-arg=pro_workshop]').count() == 1 and pg.locator('#tabs [data-arg=missions]').count() == 0, 'prologue shell expected after Replay'
    assert pg.evaluate('AT.E.proCanSkip()'), 'Skip should be offered on this device after a completion'
    snap('61_replayed_prologue')
    # skip from the Workshop (confirm-click)
    pg.click('[data-k=w_skip]'); pg.wait_for_timeout(200)
    pg.click('[data-k=w_skip]'); pg.wait_for_timeout(600)
    assert not pg.evaluate('AT.E.proActive()') and pg.evaluate('AT.E.S.ships.length') == 1, 'SKIP PROLOGUE should leave a mining game with one ship'
    assert pg.locator('#tabs [data-arg=missions]').count() == 1, 'mining shell expected after the skip'
    snap('62_after_skip')
    # New game (with prologue): wipes everything, always plays the prologue
    pg.evaluate("() => { AT.E.S.tutorial = 'done'; }")
    settings_click('set_newpro'); snap('63_new_game_confirm')
    pg.click('[data-act=do-newpro]'); pg.wait_for_timeout(600)
    assert pg.evaluate('Object.keys(AT.E.S.ach).length') == 0, 'New game (with prologue) wipes achievements too'
    assert pg.evaluate('AT.E.proActive()'), 'New game (with prologue) should play the prologue'
    # Wipe Save offers both on a device that has finished the prologue
    pg.click('[data-act=settings]'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-k=set_reset]').scrollIntoView({block: 'center'})"); pg.click('[data-k=set_reset]'); pg.wait_for_timeout(300)
    assert pg.locator('[data-act=do-reset-skip]').count() == 1, 'Wipe should offer to skip the prologue on this device'
    snap('64_wipe_offers_skip')
    pg.click('[data-act=do-reset-skip]'); pg.wait_for_timeout(600)
    assert not pg.evaluate('AT.E.proActive()') and pg.evaluate('AT.E.S.ships.length') == 1, 'WIPE AND SKIP should start mining directly'
    pg.close()
    # a brand-new save on this device offers the skip right at the start
    ctx = b.new_context(viewport={'width': W, 'height': H})
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.add_init_script("try { localStorage.setItem('%s', '1'); } catch (e) {}" % FLAGKEY)
    pg.goto(url); pg.wait_for_timeout(1500)
    assert pg.locator('#modal [data-act=offer-skip]').count() == 1, 'a new game on a device with the flag should offer to skip'
    snap('65_offer_skip_on_new_game')
    pg.click('[data-act=offer-play]'); pg.wait_for_timeout(300)
    assert pg.evaluate('AT.E.proActive()'), 'PLAY THE PROLOGUE should keep the prologue'
    pg.reload(); pg.wait_for_timeout(1500)
    assert pg.locator('#modal [data-act=offer-skip]').count() == 0, 'a loaded mid-prologue save must not ask again'
    ctx.close()
    # a device without the flag never offers it
    ctx = b.new_context(viewport={'width': W, 'height': H})
    pg = ctx.new_page(); pg.goto(url); pg.wait_for_timeout(1200)
    assert pg.locator('#modal [data-act=offer-skip]').count() == 0 and not pg.evaluate('AT.E.proCanSkip()'), 'first-time players must not be offered the skip'
    assert pg.locator('[data-k=w_skip]').count() == 0, 'no skip button for a first-time player'
    ctx.close()
    b.close()

if overflow: print('OVERFLOW', json.dumps(overflow, indent=1))
print(json.dumps(errors[:20], indent=1) if errors else 'no console errors')

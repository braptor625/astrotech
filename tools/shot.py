# Headless play-test v2: loads the standalone build, plays the opening, screenshots every console.
import sys, os, pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/shots'); out.mkdir(parents=True, exist_ok=True)
url = (root / 'steam/game/index.html').as_uri()
errors = []
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1366
H = int(sys.argv[4]) if len(sys.argv) > 4 else 800
TEXT = sys.argv[3] if len(sys.argv) > 3 else None  # optional: normal | large | xl
SCAN = """() => { const out = []; const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth) out.push('PAGE scrollWidth ' + de.scrollWidth + ' > ' + de.clientWidth);
  for (const e of document.querySelectorAll('body *')) { if (e.closest('svg') || !e.offsetParent) continue; const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && cs.textOverflow !== 'ellipsis' && e.clientWidth > 0) out.push((e.tagName + '.' + e.className + ' ' + e.scrollWidth + '>' + e.clientWidth + ' ' + (e.textContent || '').trim().slice(0, 30)));
    const r = e.getBoundingClientRect(); const c = e.closest('.tabbody, main, #modal'); if (c && e.matches('button.btn') && (r.right > c.getBoundingClientRect().right + 1 || r.left < c.getBoundingClientRect().left - 1)) out.push('CLIPPED-X ' + e.className + ' ' + e.textContent.trim().slice(0, 20)); }
  return out.slice(0, 12); }"""
scans = {}
with sync_playwright() as p:
    exe = os.environ.get('CHROMIUM_PATH') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
    b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H})
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error',) else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto(url); pg.wait_for_timeout(1500)
    if TEXT:
        pg.evaluate("t => { AT.E.S.settings.textSize = t; document.documentElement.dataset.text = t; }", TEXT); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / '00_start.png'))
    pg.click('[data-act=tut-skip]'); pg.wait_for_timeout(400)  # the tutorial dim would hide the layout in every later shot
    pg.screenshot(path=str(out / '00b_fresh.png'))  # empty states: no ships, ops summary, no flights
    # opening: buy a ship, pick the surveyed target, launch
    pg.click('[data-act=tab][data-arg=fleet]'); pg.wait_for_timeout(200)
    pg.click('[data-act=buyship][data-arg=prospector]'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(out / '01_fleet.png'))
    pg.click('[data-act=tab][data-arg=missions]'); pg.wait_for_timeout(200)
    pg.click('.trow >> nth=0'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / '02_target.png'))
    pg.click('[data-act=launch] >> nth=0'); pg.wait_for_timeout(1800)
    pg.screenshot(path=str(out / '03_launch.png'))
    if not pg.locator('#deck .deck').count(): errors.append('flight deck missing while a ship is flying')
    pg.click('[data-act=view][data-arg=map]'); pg.wait_for_timeout(600)
    pg.screenshot(path=str(out / '04_map.png'))
    # fast-forward a mid game
    pg.evaluate("""() => { const E=AT.E, S=E.S; S.money=5e7; S.rp=5e4; S.earnedTotal=1e8; S.earnedRun=1e8; S.stats.oreMined=1e5;
      for (const r of AT.RESEARCH.filter(r=>r.region===0 && r.cost<5000)) S.research[r.id]=1; E.touch();
      for (let i=0;i<5;i++) E.buyPad(); for (const h of ['hauler','excavator','leviathan','hauler','excavator']) E.buyShip(h);
      for (let i=0;i<4;i++) E.hirePilot(S.candidates[0].id);
      for (const r of ['scientist','trader','engineer','analyst']) for (let i=0;i<5;i++) E.hire(r);
      const t=S.targets.find(t=>t.surveyed&&!t.story); if (t) E.buildOutpost(t.id);
      S.fleetAI = true; E.simulate(400); }""")
    pg.wait_for_timeout(800)
    for t in ['missions', 'fleet', 'crew', 'market', 'outposts', 'research', 'projects', 'company', 'expansion', 'archive']:
        if pg.locator(f'[data-act=tab][data-arg={t}]').count():
            pg.click(f'[data-act=tab][data-arg={t}]'); pg.wait_for_timeout(350)
            pg.screenshot(path=str(out / f'10_{t}.png'))
            r = pg.evaluate(SCAN)
            if r: scans[t] = r
        else: errors.append(f'missing tab {t}')
    pg.click('[data-act=tab][data-arg=missions]'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / '14_midgame_flights.png'))
    # activity drawer: open, filter, close; keyboard shortcuts
    pg.click('[data-act=activity]'); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / '15_drawer.png')); r = pg.evaluate(SCAN)
    if r: scans['drawer'] = r
    pg.click('[data-act=actfilter][data-arg=alerts]'); pg.wait_for_timeout(300); pg.screenshot(path=str(out / '16_drawer_alerts.png'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    if pg.evaluate("document.querySelector('#drawer').classList.contains('open')"): errors.append('Esc did not close the drawer')
    pg.keyboard.press('a'); pg.wait_for_timeout(300)
    if not pg.evaluate("document.querySelector('#drawer').classList.contains('open')"): errors.append('A did not open the drawer')
    pg.keyboard.press('a'); pg.wait_for_timeout(300)
    pg.keyboard.press('2'); pg.wait_for_timeout(200)
    if pg.evaluate("document.querySelector('#tabs .tab.active').dataset.arg") != 'fleet': errors.append('key 2 did not open Fleet')
    pg.keyboard.press(']'); pg.wait_for_timeout(200)
    if pg.evaluate('AT.scene.getView()') != 'launch': errors.append('] did not cycle the view')
    pg.keyboard.press('1'); pg.wait_for_timeout(200)
    # settings modal
    pg.click('[data-act=settings]'); pg.wait_for_timeout(400); pg.screenshot(path=str(out / '17_settings.png'))
    r = pg.evaluate(SCAN)
    if r: scans['settings'] = r
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    if pg.evaluate("!document.querySelector('#modal').hidden"): errors.append('Esc did not close the settings modal')
    pg.click('[data-act=view][data-arg=launch]'); pg.wait_for_timeout(500); pg.screenshot(path=str(out / '11_launchmid.png'))
    pg.click('[data-act=view][data-arg=target]'); pg.wait_for_timeout(500); pg.screenshot(path=str(out / '12_closeup.png'))
    # an incident card
    pg.evaluate("() => { const S=AT.E.S; S.cards.push({type:'inc', id:'i_union', ctx:{pilot:'Ada Okafor', ship:'ATS Synergy', target:'X'}, expires: S.time+150}); }")
    pg.wait_for_timeout(500); pg.screenshot(path=str(out / '13_card.png'))
    pg.click('#cardbox [data-act=card] >> nth=0'); pg.wait_for_timeout(300)
    # late game
    pg.evaluate("""() => { const S=AT.E.S; S.region=4; S.layers.forEach(l=>{l.runs=3;l.cur=80;l.total=200;}); AT.E.touch(); S.peakEquity=1e80; AT.E.simulate(5); }""")
    pg.click('[data-act=tab][data-arg=expansion]'); pg.wait_for_timeout(500); pg.screenshot(path=str(out / '20_late_expansion.png'))
    pg.click('[data-act=view][data-arg=map]'); pg.wait_for_timeout(200)
    pg.click('[data-act=mapreg][data-arg="3"]'); pg.wait_for_timeout(400); pg.screenshot(path=str(out / '21_map_stars.png'))
    pg.set_viewport_size({'width': 1000, 'height': 760}); pg.wait_for_timeout(500)
    pg.click('[data-act=tab][data-arg=missions]'); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / '29_narrow_1000.png'))
    if pg.evaluate('document.documentElement.scrollWidth') > 1000: errors.append('horizontal overflow at 1000px')
    pg.set_viewport_size({'width': 420, 'height': 900}); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / '30_phone.png'), full_page=True)
    sw = pg.evaluate('document.documentElement.scrollWidth')
    if sw > 420: errors.append(f'horizontal overflow at phone width: {sw}px')
    b.close()
if scans: print('OVERFLOW', json.dumps(scans, indent=1))
print(json.dumps(errors[:20], indent=1) if errors else 'no console errors')

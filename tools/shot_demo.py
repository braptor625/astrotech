# Headless test of the demo build: fast-forward to a ready Kuiper Jump, trigger it, screenshot the end-of-demo screen.
# Usage: node tools/build.mjs --demo && python3 tools/shot_demo.py [outdir]
import sys, os, pathlib, json, subprocess
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/shots-demo'); out.mkdir(parents=True, exist_ok=True)
url = (root / 'dist/demo/astrotech-demo.html').as_uri()
errors = []
with sync_playwright() as p:
    exe = os.environ.get('CHROMIUM_PATH') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
    b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
    pg = b.new_page(viewport={'width': 1366, 'height': 800})
    # the demo run starts with the prologue skipped (the prologue itself is covered by shot_prologue.py --demo)
    skip_save = subprocess.check_output(['node', str(root / 'tools/skipsave.js')], text=True)
    pg.add_init_script("try { if (!localStorage.getItem('astrotech.demo.save.v2')) localStorage.setItem('astrotech.demo.save.v2', %s); } catch (e) {}" % json.dumps(skip_save))
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto(url); pg.wait_for_timeout(1500)
    if not pg.evaluate('AT.DEMO === true'): errors.append('AT.DEMO not set')
    if pg.locator('#demo-tag:visible').count() != 1: errors.append('DEMO tag not visible')
    pg.screenshot(path=str(out / 'd0_start.png'))
    pg.evaluate("""() => { const E=AT.E, S=E.S; S.money=5e7; S.earnedTotal=S.earnedRun=2e8; S.stats.missions=137; S.stats.totalTime=3900;
      S.memorial.push({name:'A',ship:'B',target:'C',level:1,t:1},{name:'D',ship:'E',target:'F',level:1,t:2});
      S.peakEquity=Math.max(S.peakEquity, AT.LAYERS[0].req*4); E.touch(); E.simulate(2); }""")
    pg.wait_for_timeout(500)
    pg.click('[data-act=tab][data-arg=expansion]'); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / 'd1_expansion.png'))
    pg.click('[data-act=prestige][data-arg="0"]'); pg.wait_for_timeout(2000)
    if pg.locator('#ending .demo-card').count() != 1: errors.append('end-of-demo screen not shown')
    pg.screenshot(path=str(out / 'd2_end_1366.png'))
    if pg.evaluate('AT.E.S.layers[0].runs') != 0: errors.append('prestige was not blocked')
    pg.set_viewport_size({'width': 420, 'height': 800}); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / 'd3_end_420.png'))
    if pg.evaluate('document.documentElement.scrollWidth') > 420: errors.append('horizontal overflow at 420px')
    pg.click('[data-act=demo-keep]'); pg.wait_for_timeout(300)
    if pg.locator('#ending').count(): errors.append('keep playing did not dismiss')
    pg.evaluate('AT.E.prestige(0, true)')
    if pg.evaluate('AT.E.S.layers[0].runs') != 0: errors.append('auto prestige not blocked')
    pg.evaluate('AT.ui.save()')
    ks = pg.evaluate('Object.keys(localStorage)')
    if 'astrotech.demo.save.v2' not in ks or 'astrotech.save.v2' in ks: errors.append(f'bad save keys {ks}')
    code = pg.evaluate('btoa(unescape(encodeURIComponent(AT.E.save())))')
    (out / 'demo_export.txt').write_text(code)
    b.close()
print(json.dumps(errors[:20], indent=1) if errors else 'no console errors')

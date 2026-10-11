# Close-up render benchmark + screenshots. usage: gfxbench.py <outdir> <prefix> [bench|shots|both]
import sys, os, pathlib, json, subprocess
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
prefix = sys.argv[2]; mode = sys.argv[3] if len(sys.argv) > 3 else 'both'
levels = sys.argv[4].split(',') if len(sys.argv) > 4 else ['low', 'high', 'ultra']
url = (root / 'steam/game/index.html').as_uri()
errors = []
CASES = [('asteroid', 'S'), ('ice', 'KC'), ('binary', 'KB'), ('comet', 'OC'), ('earth', None), ('star', 'SY'), ('pulsar', 'SN'), ('galaxy', 'GS'), ('quasar', 'GQ')]
with sync_playwright() as p:
    exe = os.environ.get('CHROMIUM_PATH') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
    b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    # the close-up needs the mining game: start from a save whose prologue was skipped
    pg.add_init_script("try { if (!localStorage.getItem('astrotech.save.v2')) localStorage.setItem('astrotech.save.v2', %s); } catch (e) {}" % json.dumps(subprocess.check_output(['node', str(root / 'tools/skipsave.js')], text=True)))
    pg.goto(url); pg.wait_for_timeout(1200)
    pg.evaluate("""() => { const E=AT.E, S=E.S; S.money=5e7; S.rp=5e4; E.touch();
      window.__tg = {}; for (const c of ['S','KC','KB','OC','SY','SN','GS','GQ']) { const reg=AT.CLASSES[c].region; const t=E.genTarget(reg,c,{surveyed:true}); S.targets.push(t); window.__tg[c]=t.id; }
      S.settings.scanlines=false; AT.scene.setView('target'); }""")
    def sel(c):
        pg.evaluate("(c) => { const S=AT.E.S; S.selTarget = c ? window.__tg[c] : null; AT.scene.setView('target'); }", c)
    res = {}
    def st(a):
        a = sorted(a); return (sum(a) / len(a), a[max(0, int(len(a) * 0.95) - 1)], len(a))
    for gfx in levels:
        pg.evaluate("(g) => { AT.E.S.settings.gfx = g; }", gfx)
        if mode in ('shots', 'both'):
            for name, c in CASES:
                sel(c); pg.wait_for_timeout(700)
                pg.locator('canvas').first.screenshot(path=str(out / f'{prefix}_{gfx}_{name}.png'))
        if mode in ('bench', 'both'):
            for name, c in [('asteroid', 'S'), ('earth', None), ('star', 'SY'), ('pulsar', 'SN'), ('galaxy', 'GS')]:
                sel(c); pg.wait_for_timeout(300)
                r = pg.evaluate("""() => new Promise(res => { const sc=AT.scene, orig=sc.frame, ft=[], rd=[]; let last=performance.now(), t0=last;
                  sc.frame = function(dt){ const a=performance.now(); orig.call(sc,dt); ft.push(performance.now()-a); };
                  function raf(n){ rd.push(n-last); last=n; if (n-t0<5000) requestAnimationFrame(raf); else { sc.frame=orig; res({ft,rd}); } }
                  requestAnimationFrame(raf); })""")
                res[f'{gfx}/{name}'] = {'frame': st(r['ft']), 'raf': st(r['rd'])}
                print(gfx, name, 'SC.frame avg %.2f p95 %.2f n=%d' % st(r['ft']), '| rAF avg %.1f p95 %.1f n=%d' % st(r['rd']), flush=True)
    print('internal size', pg.evaluate("AT.scene.size()"))
    json.dump(res, open(out / f'{prefix}_bench.json', 'w'))
    b.close()
print(json.dumps(errors[:10]) if errors else 'no console errors')

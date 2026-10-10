// Bundles src/ into a single self-contained HTML page.
//   dist/web/astrotech.html   — page body for the claude.ai artifact (host adds <html>/<head>)
//   steam/game/index.html     — full standalone document used by the Electron/Steam build
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => join(root, 'src', p);
const read = (p) => readFileSync(src(p), 'utf8');

let css = read('style.css');
css = css.replace(/url\('fonts\/([^']+)'\)/g, (_, f) => `url(data:font/woff2;base64,${readFileSync(src('fonts/' + f)).toString('base64')})`);

const scripts = ['data.js', 'engine.js', 'sprites.js', 'render.js', 'audio.js', 'scene.js', 'ui.js']
  .map((f) => `/* ---- ${f} ---- */\n` + read(f))
  .join('\n');
if (/<\/script/i.test(scripts)) throw new Error('script contains </script');

const body = read('index.html').replace('/*STYLE*/', () => css).replace('/*SCRIPTS*/', () => scripts);

mkdirSync(join(root, 'dist/web'), { recursive: true });
writeFileSync(join(root, 'dist/web/astrotech.html'), body);

const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: blob:">
</head>
<body>
${body}
</body>
</html>
`;
mkdirSync(join(root, 'steam/game'), { recursive: true });
writeFileSync(join(root, 'steam/game/index.html'), full);
for (const f of ['OFL-Silkscreen.txt', 'OFL-VT323.txt']) copyFileSync(src('fonts/' + f), join(root, 'steam/game', f));
console.log('built', (body.length / 1024).toFixed(1) + ' KB');

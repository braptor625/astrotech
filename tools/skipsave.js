// Prints a save (JSON) of a fresh game whose prologue was skipped, for UI test harnesses that need the mining game from the start:
//   save = subprocess.check_output(['node', 'tools/skipsave.js'], text=True)
//   page.add_init_script("if (!localStorage.getItem('astrotech.save.v2')) localStorage.setItem('astrotech.save.v2', %s)" % json.dumps(save))   // 'astrotech.demo.save.v2' for the demo build
// Pass `tutorial` to leave the mining tutorial running (the state a real skip leaves behind); by default the tutorial is marked done.
// To play the real prologue through the UI instead, see tools/pro_play.py and tools/shot_prologue.py.
const path = require('path');
globalThis.AT = {};
require(path.join(__dirname, '../src/data.js'));
require(path.join(__dirname, '../src/engine.js'));
const E = globalThis.AT.E;
E.newGame({ skipPrologue: true });
if (!process.argv.includes('tutorial')) E.S.tutorial = 'done';
process.stdout.write(E.save());

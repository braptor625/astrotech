// Prints a save (JSON) of a fresh game whose prologue was skipped, for UI test harnesses that need the mining game from the start:
//   save = subprocess.check_output(['node', 'tools/skipsave.js'], text=True)
//   page.add_init_script("localStorage.setItem('astrotech.save.v2', %s)" % json.dumps(save))   // 'astrotech.demo.save.v2' for the demo build
// With the prologue UI in place, harnesses can click through the real prologue or pass ?skipPrologue instead.
const path = require('path');
globalThis.AT = {};
require(path.join(__dirname, '../src/data.js'));
require(path.join(__dirname, '../src/engine.js'));
const E = globalThis.AT.E;
E.newGame({ skipPrologue: true });
E.S.tutorial = 'done';
process.stdout.write(E.save());

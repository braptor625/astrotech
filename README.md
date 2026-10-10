# AstroTech

A pixel-art incremental game about a mining company that consumes the universe. Launch missions
from Earth to asteroids with different compositions and risks, survey them, build outposts, hire
named pilots, deliver contracts, and push through four prestige layers: Inner System → Kuiper Belt →
Oort Cloud → the stars → other galaxies. Fully mouse-playable.

## Layout

| Path | What it is |
|---|---|
| `src/data.js` | All tunable content: ores, ships, crew, research tree, projects, prestige layers, story text, achievements |
| `src/engine.js` | Pure game logic (no DOM). Runs in the browser and in Node |
| `src/sprites.js` | Pixel art: icons, procedural rockets and pilot portraits |
| `src/render.js` | Pixel renderer: rotating lit planets/asteroids, stars, galaxies, bitmap font |
| `src/scene.js` | The viewport: system map, launch complex, close-up |
| `src/ui.js` | Consoles, tooltips, saving, offline progress, main loop |
| `src/audio.js` | Chiptune sound effects synthesized with WebAudio |
| `src/style.css`, `src/index.html` | Retro UI chrome and page shell |
| `tools/build.mjs` | Bundles everything into one self-contained HTML file |
| `tools/sim.js` | Headless balance bot: `node tools/sim.js 16` simulates 16 hours of play |
| `tools/shot.py` | Headless browser play-test with screenshots (needs Python Playwright) |
| `dist/web/astrotech.html` | Browser build |
| `steam/` | Electron + Steamworks wrapper. See `steam/README.md` |
| `art/blender/` | Blender pipeline: headless store-art renders + Blender MCP setup. See `art/blender/README.md` |
| `art/store/` | Rendered Steam capsules / library art |

## Build

```bash
node tools/build.mjs        # refresh dist/web and steam/game
node tools/sim.js 16        # check pacing after changing numbers in data.js
node tools/build.mjs --demo # demo build only: dist/demo/astrotech-demo.html
python3 tools/shot_demo.py /tmp/claude-0/shots-demo   # headless demo test, screenshots the end-of-demo screen
```

**Demo build.** `--demo` injects `AT.DEMO = true` ahead of all other scripts and writes only
`dist/demo/astrotech-demo.html` (the web and Steam builds are untouched). In demo mode the header shows a DEMO tag,
saves use their own key (`astrotech.demo.save.v2`), and the first Kuiper Jump is blocked: attempting it, or loading a
save that already did it, shows the end-of-demo screen (stats, wishlist button, "keep playing this run"). Set the
store link via `STEAM_URL` at the top of `src/ui.js`. Export codes use the same format as the full game and import
there directly.

## Pacing (bot simulation: perfect play, 24/7)

First Kuiper Jump ~1h · Oort Exodus ~8-10h · Stellar Ignition ~18-24h · Galactic Ascent ~24-29h · ending ~32-39h.
The bot plays optimally every second with no breaks; real players should expect roughly 2-3x that,
plus 13 challenges, 32 artifacts (collecting all needs a second universe), and NG+.

`v1/` holds the original clicker prototype for reference.

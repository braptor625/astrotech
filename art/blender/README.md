# Blender for AstroTech

There are two ways to use Blender with this project:

| | **Blender MCP (interactive)** | **Headless scripts (repeatable)** |
|---|---|---|
| Runs on | Your computer, with Blender open | Anywhere, including CI and cloud Claude sessions |
| Good for | Sculpting a hero asset, trying a look, "make the asteroid craggier" | Rebuilding final assets from code, every size, the same way each time |
| Entry point | `.mcp.json` → `mcp-for-blender` | `python3 art/blender/store_art.py` |

A good loop is to prototype a look over MCP, then have Claude fold the settings it used into a script here, so the asset can be rebuilt.

## 1. Blender MCP (Claude Code ↔ a running Blender)

The project's `.mcp.json` registers the [MCP for Blender](https://github.com/ahujasid/blender-mcp) server (PyPI: `mcp-for-blender`). Claude Code offers to enable it when you open the repo.

One-time setup on your machine:

1. Install [uv](https://docs.astral.sh/uv/): `brew install uv` on macOS, or `curl -LsSf https://astral.sh/uv/install.sh | sh` on Linux.
2. Install the Blender addon (Blender 3.0+):
   ```bash
   uvx mcp-for-blender install-addon
   ```
   Then in Blender, open **Edit → Preferences → Add-ons** and enable **Interface: MCP for Blender**. If the command can't find Blender, download `addon.py` from the repo and use **Install…** on that same screen.
3. Open Blender, press `N` in the 3D viewport, open the **MCP for Blender** tab, and click **Start MCP Server** if it isn't running already. It listens on `localhost:9876`.
4. Start (or restart) `claude` in this repo and approve the `blender` server. `/mcp` should list it as connected.

Things to ask for:

- "Open a new scene and build the Leviathan hull from `src/data.js` as a low-poly rocket, matching the palette in `src/style.css`."
- "Render the current scene at 320×180 with transparent film to `art/wip/`."
- "Take a viewport screenshot and tell me what reads poorly at small size."

Notes:

- The addon's socket has **no authentication**, and the MCP can run arbitrary Python inside Blender. Keep it on `localhost`, and save your `.blend` before big changes.
- Run only one MCP client against Blender at a time.
- Cloud sessions (claude.ai/code) **cannot** reach the Blender on your desktop. Use the headless scripts there.

## 2. Headless scripts

You need `pip install bpy pillow fonttools brotli`. `bpy` is Blender packaged as a Python module, and Blender 4.2+ needs Python 3.11+. You can also run the script inside a Blender install: `blender -b -P art/blender/store_art.py -- header`.

```bash
python3 art/blender/store_art.py                  # every Steam size -> art/store/
python3 art/blender/store_art.py header small     # some
python3 art/blender/store_art.py --seed 7         # another asteroid and starfield
```

Each image takes a few seconds on CPU with Cycles. EEVEE and Workbench need a GPU or display.

### How `store_art.py` keeps it pixel-art

1. It builds the scene in normalized frame coordinates (`LAYOUTS`) with an orthographic camera, so each capsule size gets its own composition from the same objects:
   - a displaced icosphere asteroid with masked gold ore veins
   - Earth with clouds and an atmosphere rim
   - a procedural rocket with an emissive flame
   - a Bezier trail
2. It renders at **1/PX of the target resolution** with transparent film.
3. It composites over a dithered void gradient and a pixel starfield, using the same star colours as the in-game sky.
4. It **ordered-dithers (Bayer 4×4) to a fixed palette** made of the `style.css` tokens plus rock, earth and flame ramps. Every pixel in the output is a palette colour. Alpha is dithered too, so the atmosphere glow stays soft without semi-transparent pixels.
5. It draws the logo in **Silkscreen** (the game's display font, converted from the bundled woff2) at multiples of 8px, so its pixel grid stays exact.
6. It upscales with nearest-neighbour by PX and crops to the exact Steam size.

| File | Size | Steam slot |
|---|---|---|
| `header_920x430.png` | 920×430 | Header capsule |
| `small_462x174.png` | 462×174 | Small capsule (logo-led) |
| `main_1232x706.png` | 1232×706 | Main capsule |
| `vertical_748x896.png` | 748×896 | Vertical capsule |
| `library_600x900.png` | 600×900 | Library capsule |
| `library_hero_3840x1240.png` | 3840×1240 | Library hero (no text, per Steam rules) |
| `library_logo_1280x720.png` | 1280×720 | Library logo (transparent) |

Tuning knobs: `LAYOUTS` (positions and sizes), `PALETTE`, the dither strength in `quantize()`, the vein mask threshold in `asteroid()`, and Cycles `samples`.

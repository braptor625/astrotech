# AstroTech — Steam build

This folder is a ready-to-build Electron app that wraps the same game you play in the browser
(`game/index.html`) and adds what a Steam release needs:

- **Steam achievements** via [steamworks.js](https://github.com/ceifa/steamworks.js) (38 achievements, list in `steamworks/achievements.md`)
- **Steam overlay** (Shift+Tab)
- **File saves** at `<userData>/saves/astrotech.json`, ready for Steam Auto-Cloud
- **Fullscreen** (in-game button or F11), a Quit button in Records, no menu bar, background ticking

The game runs fine without Steam (e.g. `npm start` with Steam closed); achievements simply no-op.

## 1. Run it locally

Requires Node.js 20+.

```bash
npm install
npm start
```

`steam_appid.txt` contains `480` (Valve's public Spacewar test app), so with Steam running you can
test the overlay and achievement calls before you have your own App ID. Spacewar won't have
AstroTech's achievement names, so they won't appear until you use your own ID.

## 2. Build release folders

```bash
npm run dist:win     # -> release/win-unpacked/AstroTech.exe
npm run dist:linux   # -> release/linux-unpacked/astrotech
npm run dist:mac     # must run on a Mac -> release/mac-universal/AstroTech.app
```

Build each platform on (or in CI for) that platform for the most reliable native module packaging.

## 3. Set up Steamworks

1. Join the Steamworks partner program and pay the Steam Direct fee for the app
   ($100 per app, recoupable once the game earns $1,000 on Steam).
2. Put your App ID in `steam_appid.txt` (it ships inside the build and `main.js` reads it).
   Update `steamworks/app_build.vdf` and the two depot files with your App ID and depot IDs.
3. **Achievements:** create the 38 entries in `steamworks/achievements.md`, using the API names exactly.
   Upload 64x64 icons for each (achieved + unachieved).
4. **Steam Cloud (Auto-Cloud):** App Admin → Cloud. Set a byte quota (1 MB is plenty), then add a root:
   - Windows: root `WinAppDataRoaming`, subdirectory `AstroTech/saves`, pattern `*.json`
   - Root overrides: `MacAppSupport` → `AstroTech/saves`, `LinuxXdgConfigHome` → `AstroTech/saves`
5. **Launch options:** Windows executable `AstroTech.exe`; Linux `astrotech`.

## 4. Upload with SteamPipe

From the Steamworks SDK `tools/ContentBuilder/builder` (or `builder_linux`) folder:

```bash
steamcmd +login <your_build_account> +run_app_build /full/path/to/steam/steamworks/app_build.vdf +quit
```

Then set the build live on a branch in App Admin → SteamPipe → Builds.

## Notes

- The game page (`game/index.html`) is generated: edit `src/` in the main project, then run
  `node tools/build.mjs` to refresh both the browser build and this folder.
- Fonts are Silkscreen and VT323 under the SIL Open Font License (license files in `game/`),
  which permits bundling them in a commercial game.
- Store-page art (capsules, screenshots, trailer) still needs to be made; `build/icon.png` is a placeholder app icon.

// AstroTech — Electron shell for the Steam release.
// Loads game/index.html, connects to Steam (achievements + overlay), and stores saves
// as a JSON file under the user-data folder so Steam Auto-Cloud can sync it.
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Your Steam App ID. 480 is Valve's public "Spacewar" test app; replace it with yours.
const STEAM_APP_ID = Number(process.env.ASTROTECH_APPID || readAppIdFile() || 480);

let steam = null;
try {
  const steamworks = require('steamworks.js');
  steam = steamworks.init(STEAM_APP_ID);
  steamworks.electronEnableSteamOverlay();
  console.log('[steam] connected as', steam.localplayer.getName());
} catch (err) {
  console.warn('[steam] not available, running without Steam:', err && err.message);
  steam = null;
}

function readAppIdFile() {
  try { return fs.readFileSync(path.join(__dirname, 'steam_appid.txt'), 'utf8').trim(); } catch (e) { return null; }
}

const saveDir = () => path.join(app.getPath('userData'), 'saves');
const saveFile = () => path.join(saveDir(), 'astrotech.json');

ipcMain.on('save:load', (e) => {
  try { e.returnValue = fs.readFileSync(saveFile(), 'utf8'); } catch (err) { e.returnValue = null; }
});
ipcMain.on('save:write', (e, data) => {
  try {
    fs.mkdirSync(saveDir(), { recursive: true });
    const tmp = saveFile() + '.tmp';
    fs.writeFileSync(tmp, data, 'utf8');
    fs.renameSync(tmp, saveFile()); // atomic replace so a crash never leaves half a save
  } catch (err) { console.error('[save] failed', err); }
});
ipcMain.on('steam:achievement', (e, id) => {
  if (!steam) return;
  try { if (!steam.achievement.isActivated(id)) steam.achievement.activate(id); } catch (err) { console.warn('[steam] achievement failed', id, err && err.message); }
});
ipcMain.on('window:fullscreen', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.setFullScreen(!win.isFullScreen());
});
// small device-level flags (e.g. prologueDone), kept beside the save so they survive a wiped save
const flagFile = () => path.join(saveDir(), 'flags.json');
const readFlags = () => { try { return JSON.parse(fs.readFileSync(flagFile(), 'utf8')) || {}; } catch (err) { return {}; } };
ipcMain.on('flag:get', (e, name) => { e.returnValue = readFlags()[name] || null; });
ipcMain.on('flag:set', (e, name, value) => {
  try { const f = readFlags(); f[name] = value; fs.mkdirSync(saveDir(), { recursive: true }); fs.writeFileSync(flagFile(), JSON.stringify(f), 'utf8'); } catch (err) { console.error('[flag] failed', err); }
});
ipcMain.on('app:quit', () => app.quit());

function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#0b0d1f',
    title: 'AstroTech',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false, // keep the economy ticking while unfocused
    },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'game', 'index.html'));
  // F11 toggles fullscreen for players who want it (the in-game button does the same)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
  });
  // block navigation away from the game
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

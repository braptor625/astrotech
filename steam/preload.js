// Exposes a tiny, safe bridge to the game page as window.astrotechNative.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astrotechNative', {
  load: () => ipcRenderer.sendSync('save:load'),
  save: (data) => ipcRenderer.send('save:write', String(data)),
  achievement: (id) => ipcRenderer.send('steam:achievement', String(id)),
  toggleFullscreen: () => ipcRenderer.send('window:fullscreen'),
  quit: () => ipcRenderer.send('app:quit'),
});

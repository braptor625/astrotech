// Exposes a tiny, safe bridge to the game page as window.astrotechNative.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astrotechNative', {
  load: () => ipcRenderer.sendSync('save:load'),
  save: (data) => ipcRenderer.send('save:write', String(data)),
  achievement: (id) => ipcRenderer.send('steam:achievement', String(id)),
  toggleFullscreen: () => ipcRenderer.send('window:fullscreen'),
  flag: (name, value) => (value === undefined ? ipcRenderer.sendSync('flag:get', String(name)) : ipcRenderer.send('flag:set', String(name), String(value))),
  quit: () => ipcRenderer.send('app:quit'),
});

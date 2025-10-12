// preload-gamepad.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gp', {
  emit: (payload) => ipcRenderer.send('gp:event', payload),
});

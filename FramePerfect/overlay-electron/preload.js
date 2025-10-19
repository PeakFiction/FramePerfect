const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // events from main
  onKey: (fn) => ipcRenderer.on('key', (_e, payload) => fn(payload)),
  onStatus: (fn) => ipcRenderer.on('status', (_e, payload) => fn(payload)),

  // commands to main
  startRecord: () => ipcRenderer.send('record:start'),
  stopAndSave: () => ipcRenderer.send('record:stopAndSave'),
  importAndPlay: () => ipcRenderer.send('import:chooseAndPlay'),
  stopPlayback: () => ipcRenderer.send('playback:stop'),
  setInject: (on) => ipcRenderer.send('inject:set', !!on),

  // overlay hit-testing for Help button
  setOverlayPassthrough: (on) => ipcRenderer.send('overlay:passthrough', !!on),

  // help window
  openHelp:  () => ipcRenderer.send('help:open'),
  closeHelp: () => ipcRenderer.send('help:close')
});

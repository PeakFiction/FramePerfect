// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Overlay HUD streams
  onKey:    (cb) => ipcRenderer.on('key',    (_, p) => cb(p)),
  onStatus: (cb) => ipcRenderer.on('status', (_, p) => cb(p)),

  // Launcher actions
  recordStart:         () => ipcRenderer.send('record:start'),
  recordStopAndSave:   () => ipcRenderer.send('record:stopAndSave'),
  importChooseAndPlay: () => ipcRenderer.send('import:chooseAndPlay'),
  playbackStop:        () => ipcRenderer.send('playback:stop'),
  injectSet:           (v) => ipcRenderer.send('inject:set', !!v),

  // Capability hint for launcher (Windows-only inject)
  onLauncherInit: (cb) => ipcRenderer.on('launcher:init', (_, p) => cb(p)),
  
  openHelp: () => ipcRenderer.send('help:open'),
  setOverlayPassthrough: (on) => ipcRenderer.send('overlay:passthrough', !!on),
  closeHelp: () => ipcRenderer.send('help:close'),


});


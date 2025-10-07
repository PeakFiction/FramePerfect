const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onKey:   (cb) => ipcRenderer.on('key',    (_, p) => cb(p)),
  onStatus:(cb) => ipcRenderer.on('status', (_, p) => cb(p)),
  recordStart:         () => ipcRenderer.send('record:start'),
  recordStopAndSave:   () => ipcRenderer.send('record:stopAndSave'),
  importChooseAndPlay: () => ipcRenderer.send('import:chooseAndPlay'),
  playbackStop:        () => ipcRenderer.send('playback:stop'),
  injectSet:           (v) => ipcRenderer.send('inject:set', !!v),
});

const { app, BrowserWindow, globalShortcut, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process'); // Windows SendKeys injector

let overlayWin = null;
let launcherWin = null;
let mode = 'idle';
let providerName = 'unknown';
let injectEnabled = true;  // UI + Ctrl+Shift+J toggles

// recording
let recStartTs = 0;
let recEvents = [];

// playback
let playbackTimers = [];
let playbackEndTimer = null;

function ensureOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) return overlayWin;
  overlayWin = new BrowserWindow({
    width: 900, height: 160, x: 100, y: 80,
    transparent: true, frame: false, resizable: false,
    alwaysOnTop: true, focusable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  try { overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
  overlayWin.loadFile(path.join(__dirname, 'overlay.html'));
  return overlayWin;
}

function ensureLauncher() {
  if (launcherWin && !launcherWin.isDestroyed()) return launcherWin;
  launcherWin = new BrowserWindow({
    width: 420, height: 280, title: 'FramePerfect Overlay',
    resizable: false, frame: true, focusable: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  launcherWin.loadFile(path.join(__dirname, 'launcher.html'));
  return launcherWin;
}

function setStatus(obj) {
  const w = ensureOverlay();
  w.webContents.send('status', { ...obj, mode, provider: providerName });
}

function clearPlayback() {
  playbackTimers.forEach(clearTimeout);
  playbackTimers = [];
  if (playbackEndTimer) { clearTimeout(playbackEndTimer); playbackEndTimer = null; }
}

function stopPlayback() {
  clearPlayback();
  mode = 'idle';
  setStatus({ ok: true, message: 'Playback stopped' });
}

// ---------- Windows injection (no npm deps) ----------
function mapLabelToSendKeys(label) {
  if (!label || label.startsWith('Keycode:')) return '';
  const tokens = label.split('+').map(s => s.trim());
  const last = tokens.pop();
  const modChar = t => ({Ctrl:'^',Control:'^',Shift:'+',
                         Alt:'%',Option:'%',Cmd:'^',Meta:'^',Windows:'^'})[t] || '';
  const prefix = tokens.map(modChar).join('');
  const keyMap = {
    Space:' ', Enter:'{ENTER}', Tab:'{TAB}', Esc:'{ESC}', Escape:'{ESC}', Backspace:'{BACKSPACE}',
    Left:'{LEFT}', Right:'{RIGHT}', Up:'{UP}', Down:'{DOWN}',
    F1:'{F1}',F2:'{F2}',F3:'{F3}',F4:'{F4}',F5:'{F5}',F6:'{F6}',
    F7:'{F7}',F8:'{F8}',F9:'{F9}',F10:'{F10}',F11:'{F11}',F12:'{F12}',
  };
  const main = keyMap[last] || last; // A..Z, 0..9 pass through
  return prefix + main;
}
function sendKeysPS(seq) {
  if (!seq) return;
  const escaped = seq.replace(/`/g,'``').replace(/"/g,'`"').replace(/\\/g,'`\\');
  const cmd = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${escaped}")`;
  spawn('powershell.exe', ['-NoLogo','-NoProfile','-Command', cmd], { windowsHide: true });
}
function injectLabel(label) {
  if (!injectEnabled) return;
  if (process.platform !== 'win32') return;
  const seq = mapLabelToSendKeys(label);
  if (seq) sendKeysPS(seq);
}
// ----------------------------------------------------

function startPlaybackFrom(events, durationMs) {
  clearPlayback();
  mode = 'playback';
  const start = Date.now();
  const w = ensureOverlay();

  for (const ev of events) {
    const id = setTimeout(() => {
      w.webContents.send('key', { label: ev.label, playback: true, at: Date.now() - start });
      if (mode === 'playback') injectLabel(ev.label);
    }, Math.max(0, ev.t));
    playbackTimers.push(id);
  }
  playbackEndTimer = setTimeout(() => { stopPlayback(); }, Math.max(0, durationMs));
  setStatus({ ok: true, message: 'Playback' });
}

function startRecording() {
  mode = 'recording';
  recStartTs = Date.now();
  recEvents = [];
  setStatus({ ok: true, message: 'Recording' });
}

async function stopRecordingAndSave() {
  if (mode !== 'recording') return;
  const durationMs = Date.now() - recStartTs;
  const payload = {
    type: 'frameperfect.keys',
    version: 1,
    createdAt: new Date().toISOString(),
    platform: process.platform,
    provider: providerName,
    durationMs,
    events: recEvents,
  };
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Save keystroke recording',
    defaultPath: 'recording.fpkeys',
    filters: [{ name: 'FramePerfect Keys', extensions: ['fpkeys'] }]
  });
  if (!canceled && filePath) fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  mode = 'idle';
  setStatus({ ok: true, message: 'Recording saved' });
}

async function chooseAndPlay(filePathArg) {
  let fileToOpen = filePathArg;
  if (!fileToOpen) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open keystroke recording',
      filters: [
        { name: 'FramePerfect Keys (*.fpkeys)', extensions: ['fpkeys'] },
        { name: 'JSON (*.json)', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (canceled || !filePaths || !filePaths[0]) return;
    fileToOpen = filePaths[0];
  }
  const text = fs.readFileSync(fileToOpen, 'utf-8');
  const json = JSON.parse(text);
  if (json?.type !== 'frameperfect.keys' || !Array.isArray(json.events)) {
    setStatus({ ok: false, error: 'Invalid .fpkeys file' });
    return;
  }
  ensureOverlay().show();
  const duration = json.durationMs ?? (json.events.at(-1)?.t ?? 0);
  startPlaybackFrom(json.events, duration);
}


function wireKeys() {
  let addListener = null, stop = null;

  try {
    const { GlobalKeyboardListener } = require('node-global-key-listener');
    const gkl = new GlobalKeyboardListener();
    providerName = 'node-global-key-listener';
    addListener = (fn) => gkl.addListener((e) => { if (e.state === 'DOWN') fn(e); });
    stop = () => gkl.removeAllListeners();
  } catch {
    try {
      const iohook = require('iohook');
      providerName = 'iohook';
      addListener = (fn) => { iohook.on('keydown', fn); iohook.start(); };
      stop = () => { try { iohook.stop(); } catch {} };
    } catch {
      providerName = 'none';
    }
  }

  if (!addListener) { setStatus({ ok: false, error: 'No global key provider' }); return; }

  setStatus({ ok: true, message: 'Ready' });

  addListener((e) => {
    const mods = [];
    if (e.ctrlKey)  mods.push('Ctrl');
    if (e.shiftKey) mods.push('Shift');
    if (e.altKey)   mods.push('Alt');
    if (e.metaKey)  mods.push('Windows');
    const name =
      e.name ||
      (e.rawKey && e.rawKey.code) ||
      (e.keycode && `Keycode:${e.keycode}`) ||
      'Key';
    const label = [...mods, name].join('+');

    ensureOverlay().webContents.send('key', { label });
    if (mode === 'recording') recEvents.push({ t: Date.now() - recStartTs, label });
  });

  app.on('will-quit', () => { try { stop && stop(); } catch {} });
}

function wireIPC() {
  ipcMain.on('record:start', () => {
    stopPlayback();
    startRecording();
    ensureOverlay().show();
  });

  ipcMain.on('record:stopAndSave', () => {
    stopRecordingAndSave();
  });

  ipcMain.on('import:chooseAndPlay', () => {
    chooseAndPlay();
  });

  ipcMain.on('playback:stop', () => {
    stopPlayback();
  });

  ipcMain.on('inject:set', (_e, v) => {
    injectEnabled = !!v;
    setStatus({ ok: true, message: `Inject ${injectEnabled ? 'ON' : 'OFF'}` });
  });
}


function wireShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    const w = ensureOverlay(); if (w.isVisible()) w.hide(); else w.show();
  });
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (mode !== 'recording') { stopPlayback(); startRecording(); ensureOverlay().show(); }
    else { stopRecordingAndSave(); }
  });
  globalShortcut.register('CommandOrControl+Shift+S', () => { stopRecordingAndSave(); });
  globalShortcut.register('CommandOrControl+Shift+I', () => { chooseAndPlay(); });
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (mode === 'playback') stopPlayback(); else chooseAndPlay();
  });
  globalShortcut.register('CommandOrControl+Shift+J', () => {
    injectEnabled = !injectEnabled;
    setStatus({ ok:true, message:`Inject ${injectEnabled?'ON':'OFF'}` });
  });
}

app.whenReady().then(() => {
  ensureLauncher();
  ensureOverlay();
  wireKeys();
  wireIPC();
  wireShortcuts();
});

app.on('open-file', (e, filePath) => { e.preventDefault(); chooseAndPlay(filePath); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

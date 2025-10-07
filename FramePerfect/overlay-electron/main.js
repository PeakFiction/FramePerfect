// overlay-electron/main.js
const { app, BrowserWindow, globalShortcut, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let overlayWin = null;
let launcherWin = null;
let mode = 'idle';
let providerName = 'unknown';
let injectEnabled = true;

// recording
let recStartTs = 0;
let recEvents = [];

// playback
let playbackTimers = [];
let playbackEndTimer = null;

// ---------------- ViGEm pad server (FpPad.exe) ----------------
let padProc = null;
let padStdin = null;

function startPadServer() {
  if (process.platform !== 'win32') return;
  const exe = path.join(__dirname, 'tools', 'win', 'FpPad', 'bin', 'Release', 'net8.0', 'FpPad.exe');
  if (!fs.existsSync(exe)) {
    setStatus({ ok: false, error: `FpPad missing: ${exe}` });
    return;
  }
  if (padProc && !padProc.killed) return;
  padProc = spawn(exe, [], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
  padStdin = padProc.stdin;
  padProc.on('exit', (code) => {
    padProc = null;
    padStdin = null;
    setStatus({ ok: false, error: `FpPad exited ${code}` });
  });
}

function padSend(line) {
  if (!injectEnabled || process.platform !== 'win32') return;
  if (!padStdin) startPadServer();
  if (!padStdin) return;
  try { padStdin.write(line + '\n'); } catch {}
}

function injectChord(labels, holdMs = 55) {
  // normalize labels to FpPad keys; ',' becomes COMMA
  const ks = labels.map(l => (l === ',' ? 'COMMA' : l)).join(',');
  padSend(`chord ${ks} ${holdMs}`);
}
// --------------------------------------------------------------

// group events that occur within a small window so “df+1” presses together
function groupEventsForChords(events, windowMs = 35) {
  const out = [];
  let i = 0;
  while (i < events.length) {
    const t0 = events[i].t;
    const labels = [events[i].label];
    let j = i + 1;
    while (j < events.length && (events[j].t - t0) <= windowMs) {
      labels.push(events[j].label);
      j++;
    }
    out.push({ t: t0, labels });
    i = j;
  }
  return out;
}

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

function startPlaybackFrom(events, durationMs) {
  clearPlayback();
  mode = 'playback';
  const start = Date.now();
  const w = ensureOverlay();

  // HUD pills
  for (const ev of events) {
    const id = setTimeout(() => {
      w.webContents.send('key', { label: ev.label, playback: true, at: Date.now() - start });
    }, Math.max(0, ev.t));
    playbackTimers.push(id);
  }

  // Controller injection with chord grouping
  const chords = groupEventsForChords(events, 35);       // “df+1” window
  for (const ch of chords) {
    const id = setTimeout(() => {
      if (mode === 'playback') injectChord(ch.labels, 55); // hold ~55ms
    }, Math.max(0, ch.t));
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
  ipcMain.on('record:start',        () => { stopPlayback(); startRecording(); ensureOverlay().show(); });
  ipcMain.on('record:stopAndSave',  () => { stopRecordingAndSave(); });
  ipcMain.on('import:chooseAndPlay',() => { chooseAndPlay(); });
  ipcMain.on('playback:stop',       () => { stopPlayback(); });
  ipcMain.on('inject:set', (_e, v)  => { injectEnabled = !!v; setStatus({ ok:true, message:`Inject ${injectEnabled?'ON':'OFF'}` }); });
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
  globalShortcut.register('CommandOrControl+Shift+P', () => { if (mode === 'playback') stopPlayback(); else chooseAndPlay(); });
  globalShortcut.register('CommandOrControl+Shift+J', () => {
    injectEnabled = !injectEnabled;
    setStatus({ ok:true, message:`Inject ${injectEnabled?'ON':'OFF'}` });
  });
}

app.whenReady().then(() => {
  ensureLauncher();
  ensureOverlay();
  startPadServer();        // start ViGEm controller server
  wireKeys();
  wireIPC();
  wireShortcuts();
});

app.on('open-file', (e, filePath) => { e.preventDefault(); chooseAndPlay(filePath); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

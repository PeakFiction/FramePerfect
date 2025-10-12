// overlay-electron/main.js
const { app, BrowserWindow, globalShortcut, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let overlayWin = null;
let launcherWin = null;
let gpWin = null; // gamepad bridge window
let mode = 'idle';
let providerName = 'unknown';
let injectEnabled = true;

// recording
let recStartTs = 0;
let recEvents = []; // v2: [{ t, type:'down'|'up', key:'W'|'A'|'U'|'I'|'J'|'K', ... }]

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
    padProc = null; padStdin = null;
    setStatus({ ok: false, error: `FpPad exited ${code}` });
  });
}

function padSend(line) {
  if (!injectEnabled || process.platform !== 'win32') return;
  if (!padStdin) startPadServer();
  if (!padStdin) return;
  try { padStdin.write(line + '\n'); } catch {}
}
// --------------------------------------------------------------

// ---------------- Gamepad bridge window ----------------
function ensureGamepadBridge() {
  if (gpWin && !gpWin.isDestroyed()) return gpWin;
  gpWin = new BrowserWindow({
    show: false,            // keep it hidden
    width: 300, height: 80,
    webPreferences: {
      preload: path.join(__dirname, 'preload-gamepad.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // keep timers running while hidden
    }
  });
  gpWin.loadFile(path.join(__dirname, 'gamepad-bridge.html'));
  return gpWin;
}
// -------------------------------------------------------

// ---------- helpers ----------
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
    width: 640, height: 360, title: 'FramePerfect Overlay', // wider so buttons never clip
    resizable: false, frame: true, focusable: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  launcherWin.loadFile(path.join(__dirname, 'launcher.html'));
  return launcherWin;
}

// Map raw labels from the keyboard hook to the pad keys we care about.
// We now allow U/I/J/K (buttons) and WASD (directions).
function mapToPadKey(label) {
  if (!label) return null;
  const s = String(label).toUpperCase();
  const allowed = new Set(['W','A','S','D','U','I','J','K','B','V']);
  return allowed.has(s) ? s : null;
}

// Group v1 single-key events (not used by v2 pipeline here, but kept for compatibility)
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

function upgradeV1ToV2(v1events, holdMs = 55, windowMs = 35) {
  const chords = groupEventsForChords(v1events, windowMs);
  const v2 = [];
  for (const ch of chords) {
    const keys = ch.labels.map(mapToPadKey).filter(Boolean);
    if (keys.length === 0) continue;
    for (const k of keys) v2.push({ t: ch.t, type: 'down', key: k });
    for (const k of keys) v2.push({ t: ch.t + holdMs, type: 'up', key: k });
  }
  v2.sort((a,b)=>a.t-b.t);
  const duration = v2.length ? v2[v2.length-1].t + 30 : 0;
  return { events: v2, durationMs: duration };
}

// ---------- playback ----------
function startPlaybackFromV2(v2events, durationMs) {
  clearPlayback();
  mode = 'playback';
  const start = Date.now();
  const w = ensureOverlay();

  for (const ev of v2events) {
    const id = setTimeout(() => {
      if (ev.type === 'down') {
        w.webContents.send('key', { label: ev.key, playback: true, at: Date.now() - start });
        padSend(`down ${ev.key}`);
      } else if (ev.type === 'up') {
        padSend(`up ${ev.key}`);
      }
    }, Math.max(0, ev.t));
    playbackTimers.push(id);
  }

  playbackEndTimer = setTimeout(() => { stopPlayback(); }, Math.max(0, durationMs));
  setStatus({ ok: true, message: 'Playback' });
}

// ---------- record ----------
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
    version: 2,
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

// ---------- import ----------
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

  if (json?.type !== 'frameperfect.keys') {
    setStatus({ ok: false, error: 'Invalid .fpkeys file' });
    return;
  }

  let v2events, duration;
  if (json.version >= 2 && Array.isArray(json.events) && json.events[0]?.type) {
    v2events = json.events
      .map(ev => ({ t: ev.t|0, type: ev.type, key: mapToPadKey(ev.key || ev.label) }))
      .filter(ev => ev.key && (ev.type === 'down' || ev.type === 'up'))
      .sort((a,b)=>a.t-b.t);
    duration = json.durationMs ?? (v2events.length ? v2events[v2events.length-1].t + 30 : 0);
  } else {
    const v1events = (json.events || []).map(e => ({ t: e.t|0, label: e.label }));
    const upgraded = upgradeV1ToV2(v1events);
    v2events = upgraded.events;
    duration = json.durationMs ?? upgraded.durationMs;
  }

  ensureOverlay().show();
  startPlaybackFromV2(v2events, duration);
}

// ---------- keyboard hook ----------
function wireKeys() {
  let addListener = null, stop = null;

  try {
    const { GlobalKeyboardListener } = require('node-global-key-listener');
    const gkl = new GlobalKeyboardListener();
    providerName = 'node-global-key-listener';
    addListener = (fn) => gkl.addListener((e) => fn(e));
    stop = () => gkl.removeAllListeners();
  } catch {
    try {
      const iohook = require('iohook');
      providerName = 'iohook';
      addListener = (fn) => { iohook.on('keydown', e => fn({ ...e, state: 'DOWN' })); iohook.on('keyup', e => fn({ ...e, state: 'UP' })); iohook.start(); };
      stop = () => { try { iohook.stop(); } catch {} };
    } catch {
      providerName = 'none';
    }
  }

  if (!addListener) { setStatus({ ok: false, error: 'No global key provider' }); return; }
  setStatus({ ok: true, message: 'Ready' });

  addListener((e) => {
    const rawName =
      e.name ||
      (e.rawKey && e.rawKey.code) ||
      (typeof e.keychar === 'string' && e.keychar) ||
      (e.keycode && `Keycode:${e.keycode}`) ||
      '';
    if (e.state === 'DOWN') {
      ensureOverlay().webContents.send('key', { label: String(rawName) });
    }
    if (mode === 'recording') {
      const k = mapToPadKey(String(rawName));
      if (!k) return;
      const type = (e.state === 'DOWN') ? 'down' : (e.state === 'UP' ? 'up' : null);
      if (!type) return;
      recEvents.push({ t: Date.now() - recStartTs, type, key: k });
    }
  });

  app.on('will-quit', () => { try { stop && stop(); } catch {} });
}

// ---------- gamepad -> app mapping & IPC ----------
function gamepadButtonIndexToKey(index) {
  // Face buttons (standard layout / XInput):
  // 0:A, 1:B, 2:X, 3:Y
  if (index === 2) return 'U'; // X -> button 1
  if (index === 3) return 'I'; // Y -> button 2
  if (index === 0) return 'J'; // A -> button 3
  if (index === 1) return 'K'; // B -> button 4
  // D-Pad:
  if (index === 12) return 'W'; // Up
  if (index === 13) return 'S'; // Down
  if (index === 14) return 'A'; // Left
  if (index === 15) return 'D'; // Right
  return null;
}

ipcMain.on('gp:event', (_e, payload) => {
  if (!payload || payload.kind !== 'button') return;
  const key = gamepadButtonIndexToKey(payload.index);
  if (!key) return;

  // HUD on press
  if (payload.pressed) {
    ensureOverlay().webContents.send('key', { label: key });
  }

  // Record while in recording mode
  if (mode === 'recording') {
    recEvents.push({
      t: Date.now() - recStartTs,
      type: payload.pressed ? 'down' : 'up',
      key
    });
  }
});

// ---------- IPC & shortcuts ----------
function wireIPC() {
  ipcMain.on('record:start',        () => { stopPlayback(); startRecording(); ensureOverlay().show(); });
  ipcMain.on('record:stopAndSave',  () => { stopRecordingAndSave(); });
  ipcMain.on('import:chooseAndPlay',() => { chooseAndPlay(); });
  ipcMain.on('playback:stop',       () => { stopPlayback(); });
  ipcMain.on('inject:set', (_e, v)  => { injectEnabled = !!v; setStatus({ ok:true, message:`Inject ${injectEnabled ? 'ON' : 'OFF'}` }); });
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
    setStatus({ ok:true, message:`Inject ${injectEnabled ? 'ON' : 'OFF'}` });
  });
}

// ---------- boot ----------
app.whenReady().then(() => {
  ensureLauncher();
  ensureOverlay();
  ensureGamepadBridge();  // start hidden gamepad bridge
  startPadServer();
  wireKeys();
  wireIPC();
  wireShortcuts();
});

app.on('open-file', (e, filePath) => { e.preventDefault(); chooseAndPlay(filePath); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

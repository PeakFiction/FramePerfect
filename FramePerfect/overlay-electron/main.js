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

// recording (v2: [{ t, type: 'down'|'up', key: <canonical> }])
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

function padStop() { padSend('stop'); }
// --------------------------------------------------------------

// ---------- HUD/status ----------
function setStatus(obj) {
  const w = ensureOverlay();
  w.webContents.send('status', { ...obj, mode, provider: providerName });
}

// ---------- windows ----------
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

// ---------- mappings ----------
// Canonical pad keys we store/send: W A S D  J K M COMMA  B V
// Tekken notation: 1=Square(J), 2=Triangle(K), 3=Cross(M), 4=Circle(COMMA)
function displayLabelForPadKey(k) {
  switch (k) {
    case 'J': return '1';
    case 'K': return '2';
    case 'M': return '3';
    case 'COMMA': return '4';
    case 'W': return '↑';
    case 'A': return '←';
    case 'S': return '↓';
    case 'D': return '→';
    case 'B': return 'Options';
    case 'V': return 'Select';
    default:  return k;
  }
}

// Only for RAW keyboard → canonical (recording and v1 upgrade). Never for v2 playback.
// UIJK → 1,2,3,4 exclusively; physical M and ',' are not accepted as 3/4.
function mapToPadKey(label) {
  if (!label) return null;
  const s0 = String(label).toUpperCase();

  // block legacy physical 3/4
  if (s0 === 'M') return null;
  if (s0 === ',') return null;

  const alias = {
    ',': 'COMMA', // in case a raw comma slips in

    // UIJK → canonical face buttons
    'U': 'J',        // 1 (Square)
    'I': 'K',        // 2 (Triangle)
    'J': 'M',        // 3 (Cross)
    'K': 'COMMA',    // 4 (Circle)

    // direction synonyms
    'ARROWUP': 'W',   'UP': 'W',
    'ARROWDOWN': 'S', 'DOWN': 'S',
    'ARROWLEFT': 'A', 'LEFT': 'A',
    'ARROWRIGHT': 'D','RIGHT': 'D',

    // options/select
    'ESCAPE': 'B', 'ENTER': 'V'
  };

  const s = alias[s0] || s0;
  const allowed = new Set(['W','A','S','D','J','K','M','COMMA','B','V']);
  return allowed.has(s) ? s : null;
}

// v1 upgrade: group close events into chords, synthesize holds, and convert to v2 down/up
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
function clearPlayback() {
  playbackTimers.forEach(clearTimeout);
  playbackTimers = [];
  if (playbackEndTimer) { clearTimeout(playbackEndTimer); playbackEndTimer = null; }
}

function stopPlayback() {
  clearPlayback();
  padStop();
  mode = 'idle';
  setStatus({ ok: true, message: 'Playback stopped' });
}

function startPlaybackFromV2(v2events, durationMs) {
  clearPlayback();
  mode = 'playback';
  const start = Date.now();
  const w = ensureOverlay();

  for (const ev of v2events) {
    const id = setTimeout(() => {
      if (ev.type === 'down') {
        w.webContents.send('key', { label: displayLabelForPadKey(ev.key), playback: true, at: Date.now() - start });
        padSend(`down ${ev.key}`);
      } else if (ev.type === 'up') {
        padSend(`up ${ev.key}`);
      }
    }, Math.max(0, ev.t));
    playbackTimers.push(id);
  }

  playbackEndTimer = setTimeout(() => { stopPlayback(); }, Math.max(0, (durationMs|0) + 30));
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

  const ALLOWED = new Set(['W','A','S','D','J','K','M','COMMA','B','V']);

  let v2events, duration;
  if (json.version >= 2 && Array.isArray(json.events) && (json.events[0]?.type === 'down' || json.events[0]?.type === 'up')) {
    // v2: trust file; do NOT call mapToPadKey here
    v2events = json.events
      .map(ev => ({
        t: ev.t|0,
        type: ev.type === 'down' ? 'down' : ev.type === 'up' ? 'up' : null,
        key: String(ev.key || '').toUpperCase()
      }))
      .filter(ev => ev.type && ALLOWED.has(ev.key))
      .sort((a,b)=>a.t-b.t);
    duration = json.durationMs ?? (v2events.length ? v2events[v2events.length-1].t + 30 : 0);
  } else {
    // v1: upgrade using RAW→canonical mapping
    const v1events = (json.events || []).map(e => ({ t: e.t|0, label: e.label }));
    const upgraded = upgradeV1ToV2(v1events);
    v2events = upgraded.events;
    duration = json.durationMs ?? upgraded.durationMs;
  }

  ensureOverlay().show();
  startPlaybackFromV2(v2events, duration);
}

// ---------- key hook ----------
function wireKeys() {
  let add = null, stop = null;

  try {
    const { GlobalKeyboardListener } = require('node-global-key-listener');
    const gkl = new GlobalKeyboardListener();
    providerName = 'node-global-key-listener';
    add = (fn) => gkl.addListener((e) => fn(e));
    stop = () => gkl.removeAllListeners();
  } catch {
    try {
      const iohook = require('iohook');
      providerName = 'iohook';
      add = (fn) => {
        iohook.on('keydown', e => fn({ ...e, state: 'DOWN' }));
        iohook.on('keyup',   e => fn({ ...e, state: 'UP' }));
        iohook.start();
      };
      stop = () => { try { iohook.stop(); } catch {} };
    } catch {
      providerName = 'none';
    }
  }

  if (!add) { setStatus({ ok: false, error: 'No global key provider' }); return; }
  setStatus({ ok: true, message: 'Ready' });

  add((e) => {
    // normalize raw name
    const rawName =
      e.name ||
      (e.rawKey && e.rawKey.code) ||
      (typeof e.keychar === 'string' && e.keychar) ||
      (e.keycode && `Keycode:${e.keycode}`) ||
      '';

    // HUD: show mapped Tekken notation for mapped keys on DOWN; else show raw
    if (e.state === 'DOWN') {
      const k = mapToPadKey(String(rawName));
      const label = k ? displayLabelForPadKey(k) : String(rawName);
      ensureOverlay().webContents.send('key', { label });
    }

    // recording: RAW → canonical here only
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

// ---------- ipc & shortcuts ----------
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

// ---------- boot ----------
app.whenReady().then(() => {
  ensureLauncher();
  ensureOverlay();
  startPadServer();
  wireKeys();
  wireIPC();
  wireShortcuts();
});

app.on('open-file', (e, filePath) => { e.preventDefault(); chooseAndPlay(filePath); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

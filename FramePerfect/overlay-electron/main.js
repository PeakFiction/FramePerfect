// Main process
const { app, BrowserWindow, globalShortcut, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ---------------- Paths (dev vs packaged) ----------------
const isDev = !app.isPackaged;
const RESROOT = isDev ? __dirname : process.resourcesPath;

const PAD_EXE = path.join(
  RESROOT,
  isDev ? 'tools/win/FpPad/bin/Release/net8.0/win-x64/publish/FpPad.exe'
       : 'tools/win/FpPad/FpPad.exe'
);
const XREC_EXE = path.join(
  RESROOT,
  isDev ? 'tools/win/FpXRec/bin/Release/net8.0/win-x64/publish/FpXRec.exe'
       : 'tools/win/FpXRec/FpXRec.exe'
);

// ---------------- Windows ----------------
let overlayWin = null;
let launcherWin = null;
let helpWin = null;

function ensureOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) return overlayWin;

  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const W = 900, H = 168; // room for strip + status card
  const X = Math.max(0, Math.round((width - W) / 2));
  const Y = 0;

  overlayWin = new BrowserWindow({
    width: W, height: H, x: X, y: Y,
    useContentSize: true,
    transparent: true, frame: false, resizable: false,
    alwaysOnTop: true, focusable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
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
    width: 420, height: 280, title: 'FramePerfect HUD',
    resizable: false, frame: true, focusable: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  launcherWin.loadFile(path.join(__dirname, 'launcher.html'));
  launcherWin.on('closed', () => { killChildren(); app.quit(); });
  return launcherWin;
}

function showHelp() {
  if (helpWin && !helpWin.isDestroyed()) { helpWin.show(); helpWin.focus(); return; }
  helpWin = new BrowserWindow({
    width: 760, height: 600,
    resizable: true, minimizable: false, maximizable: false,
    title: 'Help — FramePerfect HUD',
    transparent: true, frame: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  helpWin.loadFile(path.join(__dirname, 'help.html'));
  helpWin.on('closed', () => { helpWin = null; });
}
function hideHelp() { if (helpWin && !helpWin.isDestroyed()) helpWin.close(); }
function toggleHelp() { (helpWin && !helpWin.isDestroyed() && helpWin.isVisible()) ? hideHelp() : showHelp(); }

// ---------------- Status -> overlay ----------------
let mode = 'idle';
let providerName = 'unknown';
let injectEnabled = true;

function setStatus(obj) {
  const w = ensureOverlay();
  w.webContents.send('status', { ...obj, mode, provider: providerName });
}

// ---------------- ViGEm sender (FpPad) ----------------
let padProc = null;
let padStdin = null;

function startPadServer() {
  if (process.platform !== 'win32') return;

  if (!fs.existsSync(PAD_EXE)) {
    setStatus({ ok: false, error: `FpPad missing: ${PAD_EXE}` });
    return;
  }
  if (padProc && !padProc.killed) return;

  padProc = spawn(PAD_EXE, [], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
  padProc.on('error', (err) => setStatus({ ok: false, error: `FpPad spawn ${err.code || err.message}` }));
  padProc.on('exit',  (code) => setStatus({ ok: false, error: `FpPad exited ${code}` }));
  padStdin = padProc.stdin;
}
function padSend(line) {
  if (!injectEnabled || process.platform !== 'win32') return;
  if (!padStdin) startPadServer();
  if (!padStdin) return;
  try { padStdin.write(line + '\n'); } catch {}
}
function padStop() { padSend('stop'); }

// ---------------- XInput recorder (FpXRec) ----------------
let xrecProcs = []; // [{proc,buf,idx}]
let padEventsSeen = false;

function handlePadEvent(type, key) {
  if (type === 'down') {
    ensureOverlay().webContents.send('key', { label: displayLabelForPadKey(key) });
  }
  if (mode === 'recording') {
    padEventsSeen = true;
    recEvents.push({ t: Date.now() - recStartTs, type, key: String(key).toUpperCase() });
  }
}

function startXRecOne(index, hz = 120, axisFallback = true) {
  if (process.platform !== 'win32') return;
  if (!fs.existsSync(XREC_EXE)) {
    setStatus({ ok: false, error: `FpXRec missing: ${XREC_EXE}` });
    return;
  }
  const proc = spawn(XREC_EXE, ['--index', String(index), '--hz', String(hz), '--axisFallback', String(axisFallback)], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'ignore']
  });
  const rec = { proc, buf: '', idx: index };
  proc.on('error', (err) => setStatus({ ok: false, error: `FpXRec[${index}] ${err.code || err.message}` }));
  proc.stdout.on('data', (chunk) => {
    rec.buf += chunk.toString('utf-8');
    let nl;
    while ((nl = rec.buf.indexOf('\n')) >= 0) {
      const line = rec.buf.slice(0, nl).trim();
      rec.buf = rec.buf.slice(nl + 1);
      if (!line) continue;
      const [type, key] = line.split(/\s+/, 2);
      if ((type === 'down' || type === 'up') && key) handlePadEvent(type, key.toUpperCase());
    }
  });
  proc.on('exit', (code) => setStatus({ ok: false, error: `FpXRec[${index}] exited ${code}` }));
  xrecProcs.push(rec);
}
function startXRecAll() {
  stopXRecAll();
  startXRecOne(0, 120, true);
  startXRecOne(1, 120, true);
  startXRecOne(2, 120, true);
  startXRecOne(3, 120, true);
}
function stopXRecAll() {
  for (const r of xrecProcs) { try { r.proc.kill(); } catch {} }
  xrecProcs = [];
}

// ---------------- Recording model ----------------
let recStartTs = 0;
let recEvents = [];

function startRecording() {
  mode = 'recording';
  recStartTs = Date.now();
  recEvents = [];
  padEventsSeen = false;
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
    provider: padEventsSeen ? 'xinput+keyboard' : providerName,
    durationMs,
    events: recEvents
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

// ---------------- Playback ----------------
let playbackTimers = [];
let playbackEndTimer = null;

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
  playbackEndTimer = setTimeout(() => { stopPlayback(); }, Math.max(0, (durationMs | 0) + 30));
  setStatus({ ok: true, message: 'Playback' });
}

// Import (supports v1 -> v2 upgrade)
function groupEventsForChords(events, windowMs = 35) {
  const out = []; let i = 0;
  while (i < events.length) {
    const t0 = events[i].t, labels = [events[i].label]; let j = i + 1;
    while (j < events.length && (events[j].t - t0) <= windowMs) { labels.push(events[j].label); j++; }
    out.push({ t: t0, labels }); i = j;
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
    for (const k of keys) v2.push({ t: ch.t + holdMs, type: 'up',   key: k });
  }
  v2.sort((a,b)=>a.t-b.t);
  const duration = v2.length ? v2[v2.length-1].t + 30 : 0;
  return { events: v2, durationMs: duration };
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
  if (json?.type !== 'frameperfect.keys') { setStatus({ ok:false, error:'Invalid .fpkeys file' }); return; }

  const ALLOWED = new Set(['W','A','S','D','J','K','M','COMMA','B','V']);
  let v2events, duration;

  if (json.version >= 2 && Array.isArray(json.events) && (json.events[0]?.type === 'down' || json.events[0]?.type === 'up')) {
    v2events = json.events
      .map(ev => ({ t: ev.t|0, type: ev.type === 'down' ? 'down' : ev.type === 'up' ? 'up' : null, key: String(ev.key||'').toUpperCase() }))
      .filter(ev => ev.type && ALLOWED.has(ev.key))
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

// ---------------- Keyboard hook ----------------
function mapToPadKey(label) {
  if (!label) return null;
  const s0 = String(label).toUpperCase();

  // block raw M and COMMA if you want UIJK-only on keyboard → digits
  if (s0 === 'M') return null;
  if (s0 === ',') return null;

  const alias = {
    ',':'COMMA',
    'U':'J','I':'K','J':'M','K':'COMMA',     // UIJK -> 1..4 via displayLabel
    'ARROWUP':'W','UP':'W',
    'ARROWDOWN':'S','DOWN':'S',
    'ARROWLEFT':'A','LEFT':'A',
    'ARROWRIGHT':'D','RIGHT':'D',
    'ESCAPE':'B','ENTER':'V'
  };
  const s = alias[s0] || s0;
  const allowed = new Set(['W','A','S','D','J','K','M','COMMA','B','V']);
  return allowed.has(s) ? s : null;
}
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
    default: return k;
  }
}

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

  if (!add) { setStatus({ ok:false, error:'No global key provider' }); return; }
  setStatus({ ok:true, message:'Ready' });

  add((e) => {
    const rawName =
      e.name ||
      (e.rawKey && e.rawKey.code) ||
      (typeof e.keychar === 'string' && e.keychar) ||
      (e.keycode && `Keycode:${e.keycode}`) || '';

    if (e.state === 'DOWN') {
      const k = mapToPadKey(String(rawName));
      const label = k ? displayLabelForPadKey(k) : String(rawName);
      ensureOverlay().webContents.send('key', { label });
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

// ---------------- IPC + Shortcuts ----------------
function wireIPC() {
  ipcMain.on('record:start',        () => { stopPlayback(); startRecording(); ensureOverlay().show(); });
  ipcMain.on('record:stopAndSave',  () => { stopRecordingAndSave(); });
  ipcMain.on('import:chooseAndPlay',() => { chooseAndPlay(); });
  ipcMain.on('playback:stop',       () => { stopPlayback(); });
  ipcMain.on('inject:set', (_e, v)  => { injectEnabled = !!v; setStatus({ ok:true, message:`Inject ${injectEnabled?'ON':'OFF'}` }); });
  ipcMain.on('help:open',           () => { showHelp(); });
  ipcMain.on('help:close',          () => { hideHelp(); });
  ipcMain.on('overlay:passthrough', (_e, on) => {
    if (!overlayWin || overlayWin.isDestroyed()) return;
    overlayWin.setIgnoreMouseEvents(!!on, { forward: true });
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
  globalShortcut.register('CommandOrControl+Shift+P', () => { if (mode === 'playback') stopPlayback(); else chooseAndPlay(); });
  globalShortcut.register('CommandOrControl+Shift+J', () => { injectEnabled = !injectEnabled; setStatus({ ok:true, message:`Inject ${injectEnabled?'ON':'OFF'}` }); });
  globalShortcut.register('CommandOrControl+Shift+H', () => { toggleHelp(); });
  globalShortcut.register('CommandOrControl+Shift+Q', () => { killChildren(); app.quit(); });
}

// ---------------- Teardown ----------------
function killChildren() {
  try { padSend('stop'); } catch {}
  try { if (padStdin) { padStdin.end(); padStdin = null; } } catch {}
  try { if (padProc && !padProc.killed) padProc.kill(); } catch {}
  try { stopXRecAll(); } catch {}
}

// ---------------- Boot ----------------
app.whenReady().then(() => {
  ensureLauncher();
  ensureOverlay();
  startPadServer();
  startXRecAll();
  wireKeys();
  wireIPC();
  wireShortcuts();
});

app.on('open-file', (e, filePath) => { e.preventDefault(); chooseAndPlay(filePath); });
app.on('before-quit', () => { killChildren(); });
app.on('window-all-closed', () => { killChildren(); app.quit(); });
process.on('uncaughtException',  () => { killChildren(); });
process.on('SIGTERM',            () => { killChildren(); });
process.on('SIGINT',             () => { killChildren(); });

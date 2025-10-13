// overlay-electron/overlay.js
const stack    = document.getElementById('stack');
const statusEl = document.getElementById('status');
const modeEl   = document.getElementById('mode');
const recDot   = document.getElementById('recdot');

// Show face buttons as arrows; directions stay Tekken u/f/d/b
function toHudLabel(raw) {
  const s = String(raw).toUpperCase();
  if (s === 'U') return '↑'; // was "1"
  if (s === 'I') return '→'; // was "2"
  if (s === 'J') return '↓'; // was "3"
  if (s === 'K') return '←'; // was "4"
  if (s === 'W') return 'u';
  if (s === 'D') return 'f';
  if (s === 'S') return 'd';
  if (s === 'A') return 'b';
  return raw;
}

function keyClass(raw) {
  const s = String(raw).toUpperCase();
  if (s === 'U') return 'key--btn1';
  if (s === 'I') return 'key--btn2';
  if (s === 'J') return 'key--btn3';
  if (s === 'K') return 'key--btn4';
  if (s === 'W') return 'key--dir-u';
  if (s === 'D') return 'key--dir-f';
  if (s === 'S') return 'key--dir-d';
  if (s === 'A') return 'key--dir-b';
  return '';
}

function push(raw) {
  const div = document.createElement('div');
  div.className = 'key ' + keyClass(raw);
  div.textContent = toHudLabel(raw);
  stack.appendChild(div);
  setTimeout(() => div.remove(), 1300);
}

window.api.onStatus((p) => {
  statusEl.textContent = p.ok ? `[${p.provider}] ${p.message || ''}`.trim()
                              : `Error: ${p.error || p.message}`;
  modeEl.textContent = p.mode ? `• ${p.mode}` : '';
  if (p.mode === 'recording') recDot.classList.add('rec'); else recDot.classList.remove('rec');
});

window.api.onKey(({ label }) => { push(label); });

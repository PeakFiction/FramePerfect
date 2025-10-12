const stack    = document.getElementById('stack');
const statusEl = document.getElementById('status');
const modeEl   = document.getElementById('mode');
const recDot   = document.getElementById('recdot');

function toTekkenLabel(raw) {
  const s = String(raw).toUpperCase();
  if (s === 'U') return '1';
  if (s === 'I') return '2';
  if (s === 'J') return '3';
  if (s === 'K') return '4';
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
  div.textContent = toTekkenLabel(raw);
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

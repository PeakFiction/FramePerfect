const stack    = document.getElementById('stack');
const statusEl = document.getElementById('status');
const modeEl   = document.getElementById('mode');
const recDot   = document.getElementById('recdot');

function push(text) {
  const div = document.createElement('div');
  div.className = 'key';
  div.textContent = text;
  stack.appendChild(div);
  setTimeout(() => div.remove(), 1300);
}

window.api.onStatus((p) => {
  statusEl.textContent = p.ok ? `[${p.provider}] ${p.message || ''}`.trim()
                              : `Error: ${p.error || p.message}`;
  modeEl.textContent = p.mode ? `• ${p.mode}` : '';
  if (recDot) {
    if (p.mode === 'recording') recDot.classList.add('rec');
    else recDot.classList.remove('rec');
  }
});

window.api.onKey(({ label }) => { push(label); });

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

/**
 * Defensive HUD normalization (fallback).
 * main.js already sends Tekken numbers and arrows,
 * but we normalize here too in case a raw label slips through.
 */
function toDisplayLabel(input) {
  if (!input) return '';
  const s = String(input).trim();
  const t = s.toUpperCase();

  // Directions
  if (t === 'W' || t === 'UP' || t === 'ARROWUP')       return '↑';
  if (t === 'S' || t === 'DOWN' || t === 'ARROWDOWN')   return '↓';
  if (t === 'A' || t === 'LEFT' || t === 'ARROWLEFT')   return '←';
  if (t === 'D' || t === 'RIGHT' || t === 'ARROWRIGHT') return '→';

  // Internal pad keys → Tekken numbers
  if (t === 'J')      return '1';
  if (t === 'K')      return '2';
  if (t === 'M')      return '3';
  if (t === 'COMMA')  return '4';

  // Already numbers
  if (s === '1' || s === '2' || s === '3' || s === '4') return s;

  return s;
}

window.api.onStatus((p) => {
  statusEl.textContent = p.ok ? `[${p.provider}] ${p.message || ''}`.trim()
                              : `Error: ${p.error || p.message}`;
  modeEl.textContent = p.mode ? `• ${p.mode}` : '';
  if (p.mode === 'recording') recDot.classList.add('rec'); else recDot.classList.remove('rec');
});

window.api.onKey(({ label }) => {
  push(toDisplayLabel(label));
});

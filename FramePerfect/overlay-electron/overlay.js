const stack    = document.getElementById('stack');
const statusEl = document.getElementById('status');
const modeEl   = document.getElementById('mode');
const recDot   = document.getElementById('recdot');

// PNG root; you copied files here in step 0
const ASSETS = 'assets/notation';

function makeImg(src, cls = 'icon') {
  const img = document.createElement('img');
  img.className = cls;
  img.alt = '';
  img.draggable = false;
  img.src = src;
  return img;
}

function pushTile({ motion, buttons }) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  if (motion) tile.appendChild(makeImg(`${ASSETS}/motion-${motion}.png`));
  if (motion && buttons) {
    const plus = document.createElement('span');
    plus.className = 'plus';
    plus.textContent = '+';
    tile.appendChild(plus);
  }
  if (buttons) tile.appendChild(makeImg(`${ASSETS}/button-${buttons}.png`));
  stack.appendChild(tile);
  setTimeout(() => tile.remove(), 1300);
}

// chord aggregator
let chordTimer = null;
let chord = resetChord();

function resetChord() {
  return { U:false, D:false, F:false, B:false, btn:new Set() };
}

/** Accepts labels coming from main: '1','2','3','4' and arrows '↑','↓','←','→' */
function addLabelToChord(label) {
  const s = String(label).trim();
  if (s === '1' || s === '2' || s === '3' || s === '4') { chord.btn.add(s); return; }
  const map = { '↑':'U','U':'U','u':'U', '↓':'D','D':'D','d':'D', '→':'F','F':'F','f':'F', '←':'B','B':'B','b':'B' };
  const t = map[s];
  if (t) chord[t] = true;
}

function finishChord() {
  chordTimer = null;

  // motion code: at most one vertical + one horizontal
  const vert = chord.U && !chord.D ? 'u' : chord.D && !chord.U ? 'd' : '';
  const hori = chord.F && !chord.B ? 'f' : chord.B && !chord.F ? 'b' : '';
  const motion = (vert + hori) || (vert || hori) || '';

  // buttons code: sorted ascending e.g. "12","234","1234"
  const btns = [...chord.btn];
  btns.sort((a,b) => Number(a) - Number(b));
  const buttons = btns.length ? btns.join('') : '';

  if (!motion && !buttons) { chord = resetChord(); return; }
  pushTile({ motion: motion || null, buttons: buttons || null });
  chord = resetChord();
}

window.api.onStatus((p) => {
  statusEl.textContent = p.ok ? `[${p.provider}] ${p.message || ''}`.trim()
                              : `Error: ${p.error || p.message}`;
  modeEl.textContent = p.mode ? `• ${p.mode}` : '';
  if (p.mode === 'recording') recDot.classList.add('rec'); else recDot.classList.remove('rec');
});

window.api.onKey(({ label }) => {
  addLabelToChord(label);
  if (!chordTimer) chordTimer = setTimeout(finishChord, 40); // 40ms window → one chord
});

const helpBtn = document.getElementById('helpBtn');
if (helpBtn && window.api && window.api.openHelp) {
  // Allow clicking only when hovering the button
  helpBtn.addEventListener('mouseenter', () => window.api.setOverlayPassthrough(false));
  helpBtn.addEventListener('mouseleave', () => window.api.setOverlayPassthrough(true));
  helpBtn.addEventListener('click', () => window.api.openHelp());
}

// Multi-playlist store + short share URLs.
// Storage shape:
// fp_playlists_v2 = [{ id, name, items:[{key, id, charKey, character, notation, moveName, startup, onBlock, onHit, onCH, properties, notes, ts}] }]
// A "key" is stable per move: `${charKey}:${id}`.

import { compressToEncodedURIComponent as cEnc, decompressFromEncodedURIComponent as cDec } from 'lz-string';

const LS = 'fp_playlists_v2';
const LAST = 'fp_last_playlist_id';
const LEGACY = 'fp_working_playlist_v2'; // migrate one-off working list if present

/* ---------- storage core ---------- */
function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS) || '[]');
    if (Array.isArray(raw)) return raw;
  } catch {}
  return [];
}
function write(arr) {
  localStorage.setItem(LS, JSON.stringify(arr));
  window.dispatchEvent(new CustomEvent('fp:playlist-change'));
}

/* ---------- migrate old single list -> one playlist ---------- */
(function migrateOnce() {
  try {
    if (localStorage.getItem(LS)) return;
    const old = JSON.parse(localStorage.getItem(LEGACY) || '[]');
    if (!Array.isArray(old) || !old.length) return;
    const id = crypto.randomUUID?.() || String(Date.now());
    const pl = { id, name: 'My Playlist', items: old };
    localStorage.setItem(LS, JSON.stringify([pl]));
    localStorage.setItem(LAST, id);
  } catch {}
})();

/* ---------- public API ---------- */
export function getPlaylists() { return read(); }
export function getPlaylist(id) { return read().find(p => p.id === id) || null; }

export function createPlaylist(name = 'New Playlist') {
  const id = crypto.randomUUID?.() || String(Date.now());
  const list = read();
  list.push({ id, name, items: [] });
  write(list);
  localStorage.setItem(LAST, id);
  return id;
}

export function renamePlaylist(id, name) {
  const list = read();
  const pl = list.find(p => p.id === id);
  if (!pl) return;
  pl.name = name || pl.name;
  write(list);
}

export function deletePlaylist(id) {
  const list = read().filter(p => p.id !== id);
  write(list);
  const last = localStorage.getItem(LAST);
  if (last === id) localStorage.removeItem(LAST);
}

export function setLastPlaylist(id) { localStorage.setItem(LAST, id); }
export function getLastPlaylist() { return localStorage.getItem(LAST) || null; }

export function addItem(id, entry) {
  const list = read();
  const pl = list.find(p => p.id === id);
  if (!pl) return { status: 'no-playlist' };
  const key = String(entry.key || `${entry.charKey}:${entry.id}`);
  if (pl.items.some(x => x.key === key)) return { status: 'exists', size: pl.items.length };
  pl.items.push({ ...entry, key, ts: Date.now() });
  write(list);
  return { status: 'added', size: pl.items.length };
}

export function removeItem(id, key) {
  const list = read();
  const pl = list.find(p => p.id === id);
  if (!pl) return;
  pl.items = pl.items.filter(x => x.key !== key);
  write(list);
}

export function moveItem(id, from, to) {
  const list = read();
  const pl = list.find(p => p.id === id);
  if (!pl) return;
  const arr = pl.items;
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return;
  const [it] = arr.splice(from, 1);
  arr.splice(to, 0, it);
  write(list);
}

export function clearItems(id) {
  const list = read();
  const pl = list.find(p => p.id === id);
  if (!pl) return;
  pl.items = [];
  write(list);
}

export function onPlaylistsChange(cb) {
  const fn = () => cb(read());
  window.addEventListener('fp:playlist-change', fn);
  return () => window.removeEventListener('fp:playlist-change', fn);
}

/* ---------- sharing (short URLs via lz-string) ---------- */
export function encodePlaylistToParam(items) {
  try { return cEnc(JSON.stringify(items || [])); }
  catch { return cEnc('[]'); }
}
export function decodePlaylistFromParam(p) {
  if (!p) return [];
  try { return JSON.parse(cDec(p)); }
  catch { return []; }
}
export function buildShareUrl(basePath = '/playlist', playlist) {
  const url = new URL(basePath, window.location.origin);
  const name = (playlist?.name || '').trim();
  const p = encodePlaylistToParam(playlist?.items || []);
  url.searchParams.set('p', p);
  if (name) url.searchParams.set('n', name);
  return url.toString();
}

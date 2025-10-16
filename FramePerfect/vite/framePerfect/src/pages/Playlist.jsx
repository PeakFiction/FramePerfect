// src/pages/Playlist.jsx
import { useExportData } from '../data/useData.js';
import { useSearchParams, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';

const norm = (v) => (v ?? '').toString().trim().toLowerCase();
const keyOf = (m) => Number(m?.no ?? m?.moveID);
const parseParamP = (p) =>
  new Set((p || '').split(/[.,-]/).map((s) => parseInt(s, 10)).filter(Number.isFinite));

export default function PlaylistPage() {
  const data = useExportData();
  const [params] = useSearchParams();

  const charParam = params.get('char') || '';
  const cid = useMemo(() => {
    if (!data || !charParam) return '';
    const k = norm(charParam);
    const c =
      (data.characters || []).find((x) => norm(x.slug) === k) ||
      (data.characters || []).find((x) => norm(x.name) === k) ||
      null;
    return c ? norm(c.slug || c.characterID) : '';
  }, [data, charParam]);

  const pick = useMemo(() => parseParamP(params.get('p')), [params]);

  const [favs, setFavs] = useState(() => new Set(JSON.parse(localStorage.getItem('fp_favorites') || '[]')));
  const isFavorite = (id) => favs.has(String(id));
  const toggleFavorite = (id) => {
    const next = new Set(favs);
    const key = String(id);
    next.has(key) ? next.delete(key) : next.add(key);
    setFavs(next);
    localStorage.setItem('fp_favorites', JSON.stringify([...next]));
  };
  const [notes, setNotes] = useState(() => JSON.parse(localStorage.getItem('fp_notes') || '{}'));
  const getNote = (id) => notes[id] || '';
  const setNote = (id, text) => {
    const next = { ...notes };
    if (!text) delete next[id]; else next[id] = text;
    setNotes(next);
    localStorage.setItem('fp_notes', JSON.stringify(next));
  };

  const moves = useMemo(() => {
    if (!data || !cid || pick.size === 0) return [];
    const list = (data.moves || [])
      .filter((m) => norm(m.characterID) === cid)
      .filter((m) => pick.has(keyOf(m)));
    list.sort(
      (a, b) =>
        (a.no ?? 999999) - (b.no ?? 999999) ||
        (String(a.moveID) > String(b.moveID) ? 1 : -1)
    );
    return list;
  }, [data, cid, pick]);

  if (!data) return null;

  return (
    <div className="page">
      <h1>Playlist {charParam ? `— ${charParam}` : ''}</h1>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <Link className="border rounded px-3 py-1" to={`/moves?char=${encodeURIComponent(charParam)}`}>
          ← Back to moves
        </Link>
        <span style={{ opacity: .7 }}>Items: {moves.length}</span>
      </div>

      {moves.length === 0 ? (
        <p>Tidak ada item di playlist.</p>
      ) : (
        <ul className="list">
          {moves.map((m) => {
            const id = String(m.moveID);
            const label = m.moveName || m.notation || `Move ${id}`;
            const meta = {
              Notation: m.notation,
              Startup: m.startupFrames,
              'On Hit': m.framesOnHit,
              'On Block': m.framesOnBlock,
              'On CH': m.framesOnCounter,
              Properties: m.stringProperties,
              Damage: m.damage,
            };
            return (
              <li key={id} className="item">
                <div className="row">
                  <div className="col">
                    <div className="title">{label}</div>
                    <div className="meta">
                      {Object.entries(meta).map(([k, v]) =>
                        v ? (
                          <span key={k} className="pill">
                            <strong>{k}:</strong> {v}
                          </span>
                        ) : null
                      )}
                    </div>
                    {m.notes && <div className="notes">{m.notes}</div>}
                  </div>

                  <button
                    className="fav"
                    title={isFavorite(id) ? 'Remove favorite' : 'Add favorite'}
                    onClick={() => toggleFavorite(id)}
                    style={{ fontSize: 20 }}
                  >
                    {isFavorite(id) ? '★' : '☆'}
                  </button>
                </div>

                <textarea
                  placeholder="Add note…"
                  defaultValue={getNote(id)}
                  onBlur={(e) => setNote(id, e.target.value)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
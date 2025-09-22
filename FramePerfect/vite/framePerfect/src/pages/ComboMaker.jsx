// src/pages/ComboMaker.jsx
import { useExportData } from '../data/useData.js';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

const norm = v => (v ?? '').toString().trim().toLowerCase();

export default function ComboMaker() {
  const data = useExportData();
  const [params] = useSearchParams();
  const [favs, setFavs] = useState(() => new Set(JSON.parse(localStorage.getItem('fp_favorites') || '[]')));
  const [notes, setNotes] = useState(() => JSON.parse(localStorage.getItem('fp_notes') || '{}'));

  const charName = params.get('char') || '';
  const character = useMemo(() => {
    if (!data) return null;
    return (data.characters || []).find(c => (c.name || c.characterName) === charName) || null;
  }, [data, charName]);

  const cid = norm(character?.characterID || '');
  const moves = useMemo(() => {
    if (!data || !cid) return [];
    const list = (data.moves || []).filter(m => norm(m.characterID) === cid);
    // stable sort optional: by notation, then startup
    list.sort((a,b) => (a.notation||'').localeCompare(b.notation||'') || (a.startupFrames||'').localeCompare(b.startupFrames||''));
    return list;
  }, [data, cid]);

  const isFavorite = (id) => favs.has(id);
  const toggleFavorite = (id) => {
    const next = new Set(favs);
    next.has(id) ? next.delete(id) : next.add(id);
    setFavs(next);
    localStorage.setItem('fp_favorites', JSON.stringify([...next]));
  };

  const getNote = (id) => notes[id] || '';
  const setNote = (id, text) => {
    const next = { ...notes };
    if (!text) delete next[id]; else next[id] = text;
    setNotes(next);
    localStorage.setItem('fp_notes', JSON.stringify(next));
  };

  return (
    <div className="page">
      <h1>{charName}</h1>
      <ul className="list">
        {moves.map((m) => {
          const id = String(m.moveID ?? `${m.notation}-${m.startupFrames}-${m.damage}`);
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
                    {Object.entries(meta).map(([k,v]) =>
                      v ? <span key={k} className="pill"><strong>{k}:</strong> {v}</span> : null
                    )}
                  </div>
                </div>
                <button className="fav" onClick={() => toggleFavorite(id)}>{isFavorite(id) ? '★' : '☆'}</button>
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
    </div>
  );
}

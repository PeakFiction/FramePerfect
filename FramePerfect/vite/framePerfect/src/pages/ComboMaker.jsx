import { useExportData } from '../data/useData.js';
import { useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';

const norm = (v) => (v ?? '').toString().trim().toLowerCase();

export default function ComboMaker() {
  const data = useExportData();
  const [params] = useSearchParams();
  const [favs, setFavs] = useState(() => new Set(JSON.parse(localStorage.getItem('fp_favorites') || '[]')));
  const [notes, setNotes] = useState(() => JSON.parse(localStorage.getItem('fp_notes') || '{}'));

  // pakai SLUG dari query (?char=alisa)
  const slugParam = norm(params.get('char') || '');

  const character = useMemo(() => {
    if (!data) return null;
    return (data.characters || []).find((c) => norm(c.slug) === slugParam) || null;
  }, [data, slugParam]);

  // di JSON moves, characterID kamu juga slug (mis. "alisa", "deviljin")
  const cid = character ? norm(character.slug || character.characterID) : '';

  const moves = useMemo(() => {
    if (!data || !cid) return [];
    const list = (data.moves || []).filter((m) => norm(m.characterID) === cid);
    // urutkan: No. lalu moveID
    list.sort((a, b) => (a.no ?? 999999) - (b.no ?? 999999) || (a.moveID > b.moveID ? 1 : -1));
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
    if (!text) delete next[id];
    else next[id] = text;
    setNotes(next);
    localStorage.setItem('fp_notes', JSON.stringify(next));
  };

  if (!data) return null;

  return (
    <div className="page">
      <h1>{character ? character.name : 'Combo Maker'}</h1>
      {!character && <p>Pilih karakter dari halaman Characters.</p>}

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
                  {m.notes && (
                    <div className="notes">
                     {m.notes}
                   </div>
                 )}
                </div>
                <button className="fav" onClick={() => toggleFavorite(id)}>
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
    </div>
  );
}
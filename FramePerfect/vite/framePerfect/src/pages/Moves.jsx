import { useExportData, useCharacter, slugify } from '../data/useData.js';
import { useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';

export default function Moves() {
  const data = useExportData();
  const [params] = useSearchParams();

  // local prefs
  const [favs, setFavs] = useState(() => new Set(JSON.parse(localStorage.getItem('fp_favorites') || '[]')));
  const [notes, setNotes] = useState(() => JSON.parse(localStorage.getItem('fp_notes') || '{}'));

  // ?char= bisa "Armor King" atau "armorking"
  const charParam = params.get('char') || '';
  const character = useCharacter(data, charParam);

  // ambil dan urutkan moves untuk karakter ini
  const moves = useMemo(() => {
    if (!data || !character) return [];
    const key = character.key; // contoh: 'armorking'
    const list = (data.moves || []).filter((m) => (m.charKey ?? slugify(m.characterID)) === key);
    list.sort(
      (a, b) =>
        (a.no ?? 1e9) - (b.no ?? 1e9) ||
        String(a.notation || '').localeCompare(String(b.notation || '')) ||
        String(a.moveID).localeCompare(String(b.moveID))
    );
    return list;
  }, [data, character]);

  // fav & notes helpers
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
                  {m.notes && <div className="notes">{m.notes}</div>}
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
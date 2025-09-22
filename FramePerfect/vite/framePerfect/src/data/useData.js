import { useEffect, useState, useMemo } from 'react';

const FAV_KEY = 'fp_favorites';
const NOTES_KEY = 'fp_notes';

const readLS = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k) || '') ?? fallback; }
  catch { return fallback; }
};
const writeLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
export const slugify = s => String(s).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'');

export function useExportData() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/data/export.json')
      .then(r => r.json())
      .then(raw => {
        const moves = (raw.moves || []).map(m => ({
          ...m,
          moveID: String(m.moveID),
          characterID: String(m.characterID),
        }));
        let characters = raw.characters || [];
        if (!characters.length) {
          const ids = [...new Set(moves.map(m => m.characterID))].filter(Boolean).sort();
          characters = ids.map(id => ({ characterID: id, name: id, slug: slugify(id) }));
        } else {
          characters = characters.map(c => ({
            characterID: String(c.characterID ?? c.id ?? c._id ?? c.slug ?? c.name),
            name: c.name ?? c.characterName ?? String(c.characterID),
            slug: c.slug ?? slugify(c.name ?? c.characterID),
          }));
        }
        setData({ moves, characters });
      })
      .catch(() => setData({ moves: [], characters: [] }));
  }, []);
  return data;
}

export function usePrefs() {
  const [favs, setFavs] = useState(() => new Set(readLS(FAV_KEY, [])));
  const [notes, setNotes] = useState(() => readLS(NOTES_KEY, {}));

  const isFavorite = (id) => favs.has(id);
  const toggleFavorite = (id) => {
    const next = new Set(favs);
    next.has(id) ? next.delete(id) : next.add(id);
    setFavs(next);
    writeLS(FAV_KEY, [...next]);
  };

  const getNote = (id) => notes[id] || '';
  const setNote = (id, text) => {
    const next = { ...notes };
    if (!text) delete next[id]; else next[id] = text;
    setNotes(next);
    writeLS(NOTES_KEY, next);
  };

  return { isFavorite, toggleFavorite, getNote, setNote };
}

// Utilities
export function useCharacter(data, name) {
  return useMemo(() => {
    if (!data) return null;
    return data.characters.find(c => (c.name || c.characterName) === name) || null;
  }, [data, name]);
}

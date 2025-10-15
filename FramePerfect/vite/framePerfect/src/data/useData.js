import { useEffect, useMemo, useState } from 'react';

const FAV_KEY = 'fp_favorites';
const NOTES_KEY = 'fp_notes';

const readLS = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k) || '') ?? fallback; }
  catch { return fallback; }
};
const writeLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')       // spasi -> -
    .replace(/[^a-z0-9-]/g, '') // buang selain alnum/-
    .replace(/-+/g, '-')        // multiple - -> single
    .replace(/^-|-$/g, '');     // trim -

export function useExportData() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;

    fetch('/data/export.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((raw) => {
        if (!alive) return;

        // ── Normalisasi MOVES + charKey (slug dari characterID)
        const moves = (raw.moves || []).map((m) => {
          const characterID = String(m.characterID ?? m.character ?? '');
          return {
            ...m,
            moveID: String(m.moveID ?? `${m.notation}-${m.startupFrames}-${m.damage}`),
            characterID,
            charKey: slugify(characterID), // <── kunci join stabil
            moveName: m.moveName ?? m.move_name ?? null,
            notation: m.notation ?? null,
            stringProperties: m.stringProperties ?? m.string_properties ?? null,
            startupFrames: m.startupFrames ?? m.startup_frames ?? null,
            framesOnBlock: m.framesOnBlock ?? m.frames_on_block ?? null,
            framesOnHit: m.framesOnHit ?? m.frames_on_hit ?? null,
            framesOnCounter: m.framesOnCounter ?? m.frames_on_counter ?? null,
            notes: m.notes ?? m.Notes ?? null,
            throwBreak: m.throwBreak ?? m.throw_break ?? null,
          };
        });

        // ── Normalisasi CHARACTERS + key (slug) untuk join
        let characters = raw.characters || [];
        if (!characters.length) {
          const ids = [...new Set(moves.map((m) => m.characterID))].filter(Boolean).sort();
          characters = ids.map((id) => {
            const slug = slugify(id);
            return { characterID: id, name: id, slug, key: slug };
          });
        } else {
          characters = characters.map((c) => {
            const id   = String(c.characterID ?? c.id ?? c._id ?? c.slug ?? c.name ?? '');
            const name = c.name ?? c.characterName ?? id;
            const slug = c.slug ?? slugify(name);
            const key = slugify(c.key ?? (id || name));
            return { characterID: id, name, slug, key };
          });
        }

        setData({ moves, characters });
      })
      .catch(() => {
        if (!alive) return;
        setData({ moves: [], characters: [] });
      });

    return () => { alive = false; };
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

// Helper: cari karakter dari apa pun (name/slug/id) — semua dinormalisasi ke slug
export function useCharacter(data, query) {
  return useMemo(() => {
    if (!data) return null;
    const want = slugify(query);
    return (
      data.characters.find((c) => c.key === want) ||
      data.characters.find((c) => slugify(c.slug) === want) ||
      data.characters.find((c) => slugify(c.characterID) === want) ||
      data.characters.find((c) => slugify(c.name) === want) ||
      null
    );
  }, [data, query]);
}
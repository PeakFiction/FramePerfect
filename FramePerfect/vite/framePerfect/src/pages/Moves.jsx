// src/pages/Moves.jsx
import { useEffect, useMemo, useState } from "react";
import { useExportData, usePrefs, useCharacter, slugify } from "../lib/data";

// ---------- local playlist store (already used by Playlist.jsx) ----------
const readLS = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? f; } catch { return f; } };
const writeLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const PL_KEY = "fp_playlist";
function usePlaylist() {
  const [list, setList] = useState(() => readLS(PL_KEY, []));
  useEffect(() => writeLS(PL_KEY, list), [list]);
  const add = (entry) => {
    const key = `${entry.charKey}:${entry.id}`;
    if (list.some(x => x.key === key)) return "exists";
    setList(prev => [...prev, { ...entry, key, ts: Date.now() }]);
    return "added";
  };
  const remove = (key) => setList(cur => cur.filter(x => x.key !== key));
  return { list, add, remove };
}

// ---------- helpers ----------
const parseStartup = (s) => {
  const m = String(s ?? "").match(/i?(\d+)/i);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
};
const parseFrame = (s) => {
  const m = String(s ?? "").match(/[-+]?(\d+)/);
  return m ? parseInt(m[0], 10) : 0;
};
const clsFrame = (n) => (n > 0 ? "pos" : n < 0 ? "neg" : "muted");
const useDebounced = (v, ms = 180) => {
  const [val, setVal] = useState(v);
  useEffect(() => { const t = setTimeout(() => setVal(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return val;
};

// A few filename exceptions where the render file doesn’t strictly match the slug
const RENDER_OVERRIDES = {
  "armor-king": "armorking_render_transparent",
  "devil-jin": "deviljin_render_transparent",
  "jack-8": "jack8_render_transparent",
  "lee": "lee_render_transparent",
  "lidia": "lidia_render_transparent",
  "hwoarang": "hwoarang_render_transparent",
  "heihachi": "heihachi_render_transparent",
  "fahkumram": "fahkumram_render_transparent",
};

export default function Moves() {
  const data = useExportData();

  // character from ?char=…
  const qs = new URLSearchParams(window.location.search);
  const queryChar = qs.get("char") || "";
  const character = useCharacter(data, queryChar);
  const charKey = character ? slugify(character.key || character.slug || character.name) : null;

  const { isFavorite, toggleFavorite, getNote, setNote } = usePrefs();
  const { add: addToPlaylist } = usePlaylist();

  // ----- moves of this character -----
  const sourceMoves = useMemo(() => {
    if (!data || !charKey) return [];
    return (data.moves || []).filter(m => slugify(m.charKey || m.characterID) === charKey);
  }, [data, charKey]);

  // ----- toolbar state -----
  const [q, setQ] = useState("");
  const qd = useDebounced(q, 200);
  const [sort, setSort] = useState("az");
  const [compact, setCompact] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState(new Set());

  // ----- tokens from PROPERTIES + NOTES -----
  const tokens = useMemo(() => {
    const bag = new Set();
    for (const m of sourceMoves) {
      const text = [m.stringProperties, m.notes, m.throwBreak].filter(Boolean).join(" ");
      text.split(/[,*()\/\[\]\s]+/)
        .map(x => x.trim())
        .filter(Boolean)
        .forEach(t => bag.add(t));
    }
    return Array.from(bag).filter(t => t.length >= 2).slice(0, 100).sort((a, b) => a.localeCompare(b));
  }, [sourceMoves]);

  // ----- filter + sort -----
  const rows = useMemo(() => {
    const qLower = qd.trim().toLowerCase();
    let out = sourceMoves.filter(m => {
      if (qLower) {
        const hay = [
          m.moveName, m.notation, m.stringProperties, m.notes, m.throwBreak,
          m.startupFrames, m.framesOnBlock, m.framesOnHit, m.framesOnCounter
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      if (selectedTokens.size) {
        const hay = ((m.stringProperties || "") + " " + (m.notes || "") + " " + (m.throwBreak || "")).toLowerCase();
        for (const tok of selectedTokens) if (!hay.includes(String(tok).toLowerCase())) return false;
      }
      return true;
    });

    out.sort((a, b) => {
      if (sort === "startup") return parseStartup(a.startupFrames) - parseStartup(b.startupFrames);
      if (sort === "on-block") return parseFrame(b.framesOnBlock) - parseFrame(a.framesOnBlock);
      if (sort === "on-hit")   return parseFrame(b.framesOnHit) - parseFrame(a.framesOnHit);
      if (sort === "on-ch")    return parseFrame(b.framesOnCounter) - parseFrame(a.framesOnCounter);
      const ka = String(a.notation || a.moveName || "").toLowerCase();
      const kb = String(b.notation || b.moveName || "").toLowerCase();
      return ka.localeCompare(kb, undefined, { sensitivity: "base" });
    });

    return out;
  }, [sourceMoves, qd, selectedTokens, sort]);

  // ----- choose render from /public/characterRenders -----
  const [renderUrl, setRenderUrl] = useState("");

  useEffect(() => {
    let live = true;
    if (!character) { setRenderUrl(''); return; }

    const slug = slugify(character.slug || character.name || '');

    // filenames in /public/characterRenders can differ from slugs
    const RENDER_ALIAS = {
      'devil-jin': 'deviljin',
      'armor-king': 'armorking',
      'jack-8': 'jack8',
      // add more aliases only if your file name differs from the slug
      // e.g. 'lee-chaolan': 'lee'
    };

    const base = RENDER_ALIAS[slug] || slug;

    const candidates = [
      `/characterRenders/${base}_render_transparent.png`,
      `/characterRenders/${base}_render_transparent.webp`,
      `/characterRenders/${base}.png`,
      `/characterRenders/${base}.webp`,
    ];

    (async () => {
      for (const p of candidates) {
        try {
          const r = await fetch(p, { method: 'HEAD' });
          if (!live) return;
          if (r.ok) { setRenderUrl(p); return; }
        } catch {}
      }
      if (live) setRenderUrl(''); // hide if still not found
    })();

    return () => { live = false; };
  }, [character]);

  // ----- misc ui -----
  const toggleToken = (t) => {
    const next = new Set(selectedTokens);
    next.has(t) ? next.delete(t) : next.add(t);
    setSelectedTokens(next);
  };
  const resetTokens = () => setSelectedTokens(new Set());
  useEffect(() => {
    document.body.classList.toggle("mv-compact", compact);
    return () => document.body.classList.remove("mv-compact");
  }, [compact]);

  // ----- render -----
  return (
    <>
      {/* centered character render behind */}
      {renderUrl ? (
        <img className="mv-render" src={renderUrl} alt="" aria-hidden="true" />
      ) : null}

      {/* Toolbar */}
      <section className="mv-toolbar container">
        <div className="mv-left">
          <button className="mv-back" onClick={() => window.history.back()} title="Back">←</button>
          <div className="mv-title">
            <h1 className="mv-h1">{character?.name || "Moves"}</h1>
            <span className="mv-sub">Move Database</span>
          </div>
        </div>

        <div className="mv-controls">
          <div className="mv-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 18a8 8 0 1 1 5.29-14.03l5.37 5.37-1.41 1.41-4.9-4.9A6 6 0 1 0 10 18z"/></svg>
            <input
              id="mvSearch"
              type="search"
              placeholder='Search moves like "df2" or "electric"'
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
            {q ? <button id="mvClear" className="mv-btn ghost" onClick={() => setQ("")}>Clear</button> : null}
          </div>

          <select id="mvSort" className="mv-select" value={sort} onChange={(e) => setSort(e.target.value)} title="Sort">
            <option value="az">A → Z</option>
            <option value="startup">Startup</option>
            <option value="on-block">On Block</option>
            <option value="on-hit">On Hit</option>
            <option value="on-ch">On CH</option>
          </select>

          <button id="mvFiltersBtn" className="mv-btn" onClick={() => setFiltersOpen(v => !v)}>Apply Filters</button>
          <button id="mvView" className="mv-btn" onClick={() => setCompact(v => !v)}>{compact ? "Card" : "Compact"}</button>

          {filtersOpen && (
            <div id="mvFilters" className="mv-popover" role="dialog" aria-label="Filters">
              <div className="mv-pophead">
                <strong>Filters</strong>
                <button id="mvFiltersReset" className="mv-link" onClick={resetTokens}>Reset</button>
              </div>
              <div id="mvFilterChips" className="mv-chips">
                {tokens.map((t) => {
                  const checked = selectedTokens.has(t);
                  return (
                    <label key={t} className="mv-chip">
                      <input type="checkbox" checked={checked} onChange={() => toggleToken(t)} />
                      <span>{t}</span>
                    </label>
                  );
                })}
                {!tokens.length && <span className="muted">No discoverable tokens.</span>}
              </div>
              <div className="mv-popfoot">
                <button id="mvFiltersClose" className="mv-btn ghost" onClick={() => setFiltersOpen(false)}>Close</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Glass panel + REAL table so header and rows share the same columns */}
      <section className="mv-shell">
        <div className="mv-glass">
          <table id="movesTable" className="mv-table">
            {/* One source of truth for column widths */}
            <colgroup>
              <col style={{width: "28%"}} />  {/* command (notation + name) */}
              <col style={{width: "9%"}} />   {/* startup */}
              <col style={{width: "9%"}} />   {/* on block */}
              <col style={{width: "9%"}} />   {/* on hit */}
              <col style={{width: "9%"}} />   {/* on CH */}
              <col style={{width: "22%"}} />  {/* properties */}
              <col style={{width: "10%"}} />  {/* notes */}
              <col style={{width: "14%"}} />  {/* actions */}
            </colgroup>

            

            <thead>
              <tr>
                <th>COMMAND</th>
                <th>STARTUP</th>
                <th>ON BLOCK</th>
                <th>ON HIT</th>
                <th>ON CH</th>
                <th>PROPERTIES</th>
                <th>NOTES</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((m) => {
                const id = String(m.moveID || `${m.notation}-${m.startupFrames}-${m.framesOnBlock}`);
                const note = getNote(id);
                const blockN = parseFrame(m.framesOnBlock);
                const hitN = parseFrame(m.framesOnHit);
                const chN = parseFrame(m.framesOnCounter);

                const handleAddToPlaylist = () => {
                  addToPlaylist({
                    id,
                    charKey,
                    character: character?.name || "",
                    notation: m.notation || "",
                    moveName: m.moveName || "",
                    startup: String(m.startupFrames ?? ""),
                    onBlock: String(m.framesOnBlock ?? ""),
                    onHit: String(m.framesOnHit ?? ""),
                    onCH: String(m.framesOnCounter ?? ""),
                    properties: m.stringProperties || m.throwBreak || "",
                    notes: m.notes || "",
                  });
                };

                return (
                  <Fragment key={id}>
                    <tr className="mv-row">
                      <td className="cmd">
                        <div className="cmd-wrap">
                          <strong>{m.notation || "-"}</strong>
                          {m.moveName ? <span className="muted">{m.moveName}</span> : null}
                          {m.stringProperties || m.throwBreak ? (
                            <div className="mini-props">{m.stringProperties || m.throwBreak}</div>
                          ) : null}
                        </div>
                      </td>
                      <td className={clsFrame(parseStartup(m.startupFrames))}>{m.startupFrames || ""}</td>
                      <td className={clsFrame(blockN)}>{m.framesOnBlock ?? ""}</td>
                      <td className={clsFrame(hitN)}>{m.framesOnHit ?? ""}</td>
                      <td className={clsFrame(chN)}>{m.framesOnCounter ?? ""}</td>
                      <td className="props">{m.stringProperties || m.throwBreak || ""}</td>
                      <td className="notes">{m.notes || ""}</td>
                      <td className="acts">
                        <div className="acts-wrap">
                          <button
                            className="mv-btn ghost"
                            title={isFavorite(id) ? "Unfavorite" : "Favorite"}
                            onClick={() => toggleFavorite(id)}
                          >
                            {isFavorite(id) ? "★" : "☆"}
                          </button>
                          <button className="mv-btn" title="Add to playlist" onClick={handleAddToPlaylist}>
                            Add to playlist
                          </button>
                        </div>
                      </td>
                    </tr>

                    <tr className="mv-note">
                      <td colSpan={8}>
                        <textarea
                          className="mv-note-box"
                          placeholder="Your note…"
                          value={note}
                          onChange={(e) => setNote(id, e.target.value)}
                        />
                      </td>
                    </tr>
                  </Fragment>
                );
              })}

              {!rows.length && (
                <tr>
                  <td colSpan={8} className="muted">No results.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// allow Fragment above without a new import line everywhere
function Fragment({ children }) { return children; }

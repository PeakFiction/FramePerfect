import { useEffect, useMemo, useState } from 'react';
import { useExportData, usePrefs, useCharacter, slugify } from '../lib/data';
import PlaylistModal from '../components/PlaylistModal';

const parseStartup = (s) => { const m = String(s ?? '').match(/i?(\d+)/i); return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY; };
const parseFrame  = (s) => { const m = String(s ?? '').match(/[-+]?(\d+)/); return m ? parseInt(m[0], 10) : 0; };
const clsFrame    = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted');

const useDebounced = (v, ms=180) => { const [val,setVal]=useState(v); useEffect(()=>{const t=setTimeout(()=>setVal(v),ms); return ()=>clearTimeout(t);},[v,ms]); return val; };

export default function Moves() {
  const data = useExportData();

  const qs = new URLSearchParams(window.location.search);
  const character = useCharacter(data, qs.get('char') || '');
  const charKey = character ? slugify(character.key || character.slug || character.name) : null;

  const { isFavorite, toggleFavorite, getNote, setNote } = usePrefs();

  const sourceMoves = useMemo(() => {
    if (!data || !charKey) return [];
    return (data.moves || []).filter((m) => slugify(m.charKey || m.characterID) === charKey);
  }, [data, charKey]);

  const [q, setQ] = useState(''); const qd = useDebounced(q, 200);
  const [sort, setSort] = useState('az');
  const [compact, setCompact] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState(new Set());

  const tokens = useMemo(() => {
    const bag = new Set();
    for (const m of sourceMoves) {
      const text = [m.stringProperties, m.notes, m.throwBreak].filter(Boolean).join(' ');
      text.split(/[,*()\/\[\]\s]+/).map((x)=>x.trim()).filter(Boolean).forEach((t)=>bag.add(t));
    }
    return Array.from(bag).filter((t)=>t.length>=2).slice(0,100).sort((a,b)=>a.localeCompare(b));
  }, [sourceMoves]);

  const rows = useMemo(() => {
    const qLower = qd.trim().toLowerCase();
    let out = sourceMoves.filter((m) => {
      if (qLower) {
        const hay = [
          m.moveName, m.notation, m.stringProperties, m.notes, m.throwBreak,
          m.startupFrames, m.framesOnBlock, m.framesOnHit, m.framesOnCounter,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      if (selectedTokens.size) {
        const hay = ((m.stringProperties||'')+' '+(m.notes||'')+' '+(m.throwBreak||'')).toLowerCase();
        for (const t of selectedTokens) if (!hay.includes(String(t).toLowerCase())) return false;
      }
      return true;
    });
    out.sort((a,b)=>{
      if (sort==='startup') return parseStartup(a.startupFrames)-parseStartup(b.startupFrames);
      if (sort==='on-block') return parseFrame(b.framesOnBlock)-parseFrame(a.framesOnBlock);
      if (sort==='on-hit')   return parseFrame(b.framesOnHit)-parseFrame(a.framesOnHit);
      if (sort==='on-ch')    return parseFrame(b.framesOnCounter)-parseFrame(a.framesOnCounter);
      const ka = String(a.notation||a.moveName||'').toLowerCase();
      const kb = String(b.notation||b.moveName||'').toLowerCase();
      return ka.localeCompare(kb, undefined, {sensitivity:'base'});
    });
    return out;
  }, [sourceMoves, qd, selectedTokens, sort]);

  const [avatar, setAvatar] = useState('');
  useEffect(() => {
    let live = true;
    (async () => {
      if (!character) return setAvatar('');
      const slug = (character.slug || character.name || '').toLowerCase();
      const candidates = [`/characters/${slug}.png`, `/characters/${slug}.webp`];
      for (const p of candidates) {
        try { const r = await fetch(p, { method:'HEAD' }); if (!live) return; if (r.ok) return setAvatar(p); }
        catch {}
      }
      if (live) setAvatar('');
    })();
    return () => { live = false; };
  }, [character]);

  useEffect(() => {
    document.body.classList.toggle('mv-compact', compact);
    return () => document.body.classList.remove('mv-compact');
  }, [compact]);

  // Playlist modal
  const [plOpen, setPlOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState(null);
  const openAdd = (item) => { setPendingItem(item); setPlOpen(true); };

  return (
    <>
      <section className="mv-toolbar container">
        <div className="mv-left">
          <button className="mv-back" onClick={() => window.history.back()} title="Back">←</button>
          <div className="mv-title">
            {avatar ? <img className="mv-avatar" src={avatar} alt="" /> : null}
            <h1 className="mv-h1">{character?.name || 'Moves'}</h1>
            <span className="mv-sub">Move Database</span>
          </div>
        </div>

        <div className="mv-controls">
          <div className="mv-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 18a8 8 0 1 1 5.29-14.03l5.37 5.37-1.41 1.41-4.9-4.9A6 6 0 1 0 10 18z"/></svg>
            <input id="mvSearch" type="search" placeholder='Search moves like "df2" or "electric"' value={q} onChange={(e)=>setQ(e.target.value)} autoComplete="off"/>
            {q ? <button id="mvClear" className="mv-btn ghost" onClick={()=>setQ('')}>Clear</button> : null}
          </div>

          <select id="mvSort" className="mv-select" value={sort} onChange={(e)=>setSort(e.target.value)} title="Sort">
            <option value="az">A → Z</option>
            <option value="startup">Startup</option>
            <option value="on-block">On Block</option>
            <option value="on-hit">On Hit</option>
            <option value="on-ch">On CH</option>
          </select>

          <button id="mvFiltersBtn" className="mv-btn" onClick={()=>setFiltersOpen(v=>!v)}>Apply Filters</button>
          <button id="mvView" className="mv-btn" onClick={()=>setCompact(v=>!v)}>{compact ? 'Card' : 'Compact'}</button>

          {filtersOpen && (
            <div id="mvFilters" className="mv-popover" role="dialog" aria-label="Filters">
              <div className="mv-pophead">
                <strong>Filters</strong>
                <button id="mvFiltersReset" className="mv-link" onClick={()=>setSelectedTokens(new Set())}>Reset</button>
              </div>
              <div id="mvFilterChips" className="mv-chips">
                {tokens.map((t) => {
                  const checked = selectedTokens.has(t);
                  return (
                    <label key={t} className="mv-chip">
                      <input type="checkbox" checked={checked} onChange={()=> {
                        const next = new Set(selectedTokens);
                        checked ? next.delete(t) : next.add(t);
                        setSelectedTokens(next);
                      }}/>
                      <span>{t}</span>
                    </label>
                  );
                })}
                {!tokens.length && <span className="muted">No discoverable tokens.</span>}
              </div>
              <div className="mv-popfoot">
                <button id="mvFiltersClose" className="mv-btn ghost" onClick={()=>setFiltersOpen(false)}>Close</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <table id="movesTable" className="mv-table container">
        <thead>
          <tr>
            <th>COMMAND</th>
            <th>STARTUP</th>
            <th>ON BLOCK</th>
            <th>ON HIT</th>
            <th>ON CH</th>
            <th>PROPERTIES</th>
            <th>NOTES</th>
            <th style={{ width: 160 }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const id = String(m.moveID || `${m.notation}-${m.startupFrames}-${m.framesOnBlock}`);
            const note = getNote(id);
            const blockN = parseFrame(m.framesOnBlock);
            const hitN = parseFrame(m.framesOnHit);
            const chN = parseFrame(m.framesOnCounter);

            const item = {
              id,
              charKey,
              character: character?.name || '',
              notation: m.notation || '',
              moveName: m.moveName || '',
              startup: String(m.startupFrames ?? ''),
              onBlock: String(m.framesOnBlock ?? ''),
              onHit: String(m.framesOnHit ?? ''),
              onCH: String(m.framesOnCounter ?? ''),
              properties: m.stringProperties || m.throwBreak || '',
              notes: m.notes || '',
            };

            return (
              <>
                <tr key={id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong>{m.notation || '-'}</strong>
                      {m.moveName ? <span className="muted">{m.moveName}</span> : null}
                    </div>
                  </td>
                  <td className={clsFrame(parseStartup(m.startupFrames))}>{m.startupFrames || ''}</td>
                  <td className={clsFrame(blockN)}>{m.framesOnBlock ?? ''}</td>
                  <td className={clsFrame(hitN)}>{m.framesOnHit ?? ''}</td>
                  <td className={clsFrame(chN)}>{m.framesOnCounter ?? ''}</td>
                  <td>{m.stringProperties || m.throwBreak || ''}</td>
                  <td>{m.notes || ''}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="mv-btn ghost" title={isFavorite(id) ? 'Unfavorite' : 'Favorite'} onClick={()=>toggleFavorite(id)}>
                        {isFavorite(id) ? '★' : '☆'}
                      </button>
                      <button className="mv-btn" onClick={()=>openAdd(item)}>Add to playlist</button>
                    </div>
                  </td>
                </tr>

                <tr className="mv-note">
                  <td colSpan={8}>
                    <textarea className="mv-note-box" placeholder="Your note…" value={note} onChange={(e)=>setNote(id, e.target.value)} />
                  </td>
                </tr>
              </>
            );
          })}
          {!rows.length && (
            <tr><td colSpan={8} className="muted">No results.</td></tr>
          )}
        </tbody>
      </table>

      <PlaylistModal open={plOpen} onClose={()=>setPlOpen(false)} initialItem={pendingItem} />
    </>
  );
}

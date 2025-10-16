// src/pages/Moves.jsx
import { useExportData } from '../data/useData.js';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

const norm = (v) => (v ?? '').toString().trim().toLowerCase();

const keyOf = (m) => String(m?.no ?? m?.moveID);

function parseParamP(p) {
  if (!p) return new Set();
  return new Set(
    p
      .split(/[.,-]/) 
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n))
  );
}
function stringifyP(set) {
  return Array.from(set).sort((a, b) => a - b).join(',');
}

export default function MovesPage() {
  const data = useExportData();
  const [params, setParams] = useSearchParams();

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

  const [favs, setFavs] = useState(
    () => new Set(JSON.parse(localStorage.getItem('fp_favorites') || '[]'))
  );
  const isFavorite = (id) => favs.has(String(id));
  const toggleFavorite = (id) => {
    const next = new Set(favs);
    const key = String(id);
    next.has(key) ? next.delete(key) : next.add(key);
    setFavs(next);
    localStorage.setItem('fp_favorites', JSON.stringify([...next]));
  };

  const [notes, setNotes] = useState(
    () => JSON.parse(localStorage.getItem('fp_notes') || '{}')
  );
  const getNote = (id) => notes[id] || '';
  const setNote = (id, text) => {
    const next = { ...notes };
    if (!text) delete next[id]; else next[id] = text;
    setNotes(next);
    localStorage.setItem('fp_notes', JSON.stringify(next));
  };

  const [playlist, setPlaylist] = useState(() => parseParamP(params.get('p') || ''));
  const inPlaylist = (k) => playlist.has(Number(k));
  const toggleInPlaylist = (k) =>
    setPlaylist((prev) => {
      const nx = new Set(prev);
      const n = Number(k);
      nx.has(n) ? nx.delete(n) : nx.add(n);
      return nx;
    });
  const clearPlaylist = () => setPlaylist(new Set());

  useEffect(() => {
    const next = new URLSearchParams(params);
    const str = stringifyP(playlist);
    if (str) next.set('p', str);
    else next.delete('p');
    setParams(next, { replace: true });
  }, [playlist]);

  const moves = useMemo(() => {
    if (!data || !cid) return [];
    const list = (data.moves || []).filter((m) => norm(m.characterID) === cid);
    list.sort(
      (a, b) =>
        (a.no ?? 999999) - (b.no ?? 999999) ||
        (String(a.moveID) > String(b.moveID) ? 1 : -1)
    );
    return list;
  }, [data, cid]);

  const shareUrl = useMemo(() => {
    const url = new URL('/playlist', window.location.origin);
    if (charParam) url.searchParams.set('char', charParam);
    const str = stringifyP(playlist);
    if (str) url.searchParams.set('p', str);
    return url.toString();
  }, [playlist, charParam]);

  const openView = () => { window.location.href = shareUrl; };

  const [qrOpen, setQrOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState('');
  async function openQR() {
    try {
      const QR = await import('qrcode'); // optional: npm i qrcode
      const dataUrl = await QR.toDataURL(shareUrl, { margin: 1, scale: 6 });
      setQrSrc(dataUrl);
    } catch {
      setQrSrc(
        `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(
          shareUrl
        )}`
      );
    }
    setQrOpen(true);
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied!');
    } catch {
      alert('Copy failed — copy manually:\n' + shareUrl);
    }
  };

  if (!data) return null;

  return (
    <div className="page">
      <h1>{charParam || 'Moves'}</h1>

      {playlist.size > 0 && (
        <div style={barStyle}>
          <div>
            <strong>Playlist ({playlist.size})</strong>
            <span style={{ marginLeft: 8, opacity: 0.7 }}>
              {Array.from(playlist).sort((a,b)=>a-b).slice(0, 6).join(' • ')}
              {playlist.size > 6 ? ' …' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="border rounded px-3 py-1" onClick={openView}>Open view</button>
            <button className="border rounded px-3 py-1" onClick={copyLink}>Copy link</button>
            <button className="border rounded px-3 py-1" onClick={openQR}>Show QR</button>
            <button className="border rounded px-3 py-1" onClick={clearPlaylist}>Clear</button>
          </div>
        </div>
      )}

      <ul className="list">
        {moves.map((m) => {
          const id = String(m.moveID);
          const k = keyOf(m);               
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

                <div className="col-right" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="fav"
                    title={isFavorite(id) ? 'Remove favorite' : 'Add favorite'}
                    onClick={() => toggleFavorite(id)}
                    style={{ fontSize: 20 }}
                  >
                    {isFavorite(id) ? '★' : '☆'}
                  </button>

                  <button
                    className="border rounded px-3 py-1"
                    onClick={() => toggleInPlaylist(k)}
                    title={inPlaylist(k) ? 'Remove from playlist' : 'Add to playlist'}
                  >
                    {inPlaylist(k) ? '✓ In playlist' : '+ Add to playlist'}
                  </button>
                </div>
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

      {qrOpen && (
        <div style={modalWrap} onClick={() => setQrOpen(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Scan Playlist</h3>
            {qrSrc ? <img src={qrSrc} alt="QR" /> : <div>Generating…</div>}
            <p style={{ fontSize: 12, opacity: 0.7, wordBreak: 'break-all' }}>{shareUrl}</p>
            <button className="border rounded px-3 py-1" onClick={() => setQrOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* inline styles kecil biar gak nyentuh CSS lain */
const barStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  marginBottom: 12,
  background: '#fff',
};

const modalWrap = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 50,
};

const modalBox = {
  background: '#fff',
  padding: 16,
  borderRadius: 12,
  width: 320,
  textAlign: 'center',
};
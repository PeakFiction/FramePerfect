import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getPlaylists, getPlaylist, onPlaylistsChange, createPlaylist, renamePlaylist, deletePlaylist,
  addItem, removeItem, moveItem, clearItems, buildShareUrl, decodePlaylistFromParam
} from '../lib/playlist';

export default function Playlist() {
  const sp = new URLSearchParams(window.location.search);
  const shareParam = sp.get('p');
  const sharedItems = useMemo(() => shareParam ? decodePlaylistFromParam(shareParam) : null, [shareParam]);
  const sharedName  = sp.get('n') || 'Shared';

  const viewOnly = !!sharedItems;

  // Local mode: pick a playlist
  const [pls, setPls] = useState(() => getPlaylists());
  useEffect(() => onPlaylistsChange(setPls), []);
  const [sel, setSel] = useState(() => pls[0]?.id || '');
  useEffect(() => { if (!viewOnly && !pls.find(p=>p.id===sel)) setSel(pls[0]?.id || ''); }, [pls, viewOnly, sel]);

  const current = viewOnly ? { id:'shared', name: sharedName, items: sharedItems || [] } : (getPlaylist(sel) || { id:'', name:'', items: [] });

  const [newName, setNewName] = useState('');
  const mk = () => { const id = createPlaylist(newName.trim() || 'New Playlist'); setNewName(''); setSel(id); };
  const rn = () => renamePlaylist(sel, (current.name || '').trim());
  const del = () => { deletePlaylist(sel); };

  const up = (i) => moveItem(sel, i, Math.max(0, i-1));
  const dn = (i) => moveItem(sel, i, Math.min((current.items.length-1), i+1));
  const rm = (k) => removeItem(sel, k);
  const clr = () => clearItems(sel);

  const shareUrl = useMemo(() => buildShareUrl('/playlist', current), [current]);

  // QR (optional)
  const canvasRef = useRef(null);
  useEffect(() => {
    if (viewOnly) return;
    (async () => {
      if (!canvasRef.current) return;
      try {
        const QR = await import('qrcode');
        await QR.toCanvas(canvasRef.current, shareUrl, { width: 220, margin: 1, color: { dark: '#111', light: '#fff' } });
      } catch {}
    })();
  }, [shareUrl, viewOnly]);

  return (
    <section className="container" style={{padding:'20px 0 60px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap',marginBottom:12}}>
        <h1 className="h1">Playlist{viewOnly ? ' (Shared)' : ''}</h1>

        {!viewOnly && (
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <select className="mv-select" value={sel} onChange={(e)=>setSel(e.target.value)}>
              {pls.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className="mv-input" placeholder="New playlist name" value={newName} onChange={(e)=>setNewName(e.target.value)} />
            <button className="mv-btn" onClick={mk}>Create</button>
            {current.id && <>
              <button className="mv-btn ghost" onClick={rn}>Rename</button>
              <button className="mv-btn danger" onClick={del}>Delete</button>
            </>}
          </div>
        )}
      </div>

      <div style={{display:'flex',gap:24,alignItems:'flex-start',flexWrap:'wrap',marginBottom:18}}>
        <div>
          <strong className="muted">Shareable link</strong>
          <div className="mv-card" style={{padding:'10px 12px',maxWidth:880,wordBreak:'break-all'}}>{shareUrl}</div>
          <div style={{marginTop:8,display:'flex',gap:8}}>
            <a className="mv-btn ghost" href={shareUrl}>Open Link</a>
            {!viewOnly && <button className="mv-btn" onClick={async()=>{try{await navigator.clipboard.writeText(shareUrl);}catch{}}}>Copy Link</button>}
          </div>
        </div>
        {!viewOnly && (
          <div>
            <strong className="muted">QR</strong>
            <div className="mv-card" style={{padding:8}}>
              <canvas ref={canvasRef} width="220" height="220" />
            </div>
          </div>
        )}
      </div>

      <h3 style={{margin:'10px 0'}}>Items — {current.name}</h3>
      <table className="mv-table">
        <thead>
          <tr>
            <th style={{width:56}}>#</th>
            <th>CHARACTER</th>
            <th>COMMAND</th>
            <th>STARTUP</th>
            <th>ON BLOCK</th>
            <th>ON HIT</th>
            <th>ON CH</th>
            <th>PROPERTIES</th>
            {!viewOnly && <th style={{width:160}}>ACTIONS</th>}
          </tr>
        </thead>
        <tbody>
          {(current.items || []).map((i, idx) => (
            <tr key={i.key}>
              <td>{idx+1}</td>
              <td>{i.character}</td>
              <td>
                <div style={{display:'flex',flexDirection:'column'}}>
                  <strong>{i.notation || '-'}</strong>
                  {i.moveName ? <span className="muted">{i.moveName}</span> : null}
                </div>
              </td>
              <td>{i.startup ?? ''}</td>
              <td>{i.onBlock ?? ''}</td>
              <td>{i.onHit ?? ''}</td>
              <td>{i.onCH ?? ''}</td>
              <td>{i.properties ?? ''}</td>
              {!viewOnly && (
                <td style={{display:'flex',gap:6}}>
                  <button className="mv-btn ghost" onClick={()=>up(idx)}>↑</button>
                  <button className="mv-btn ghost" onClick={()=>dn(idx)}>↓</button>
                  <button className="mv-btn danger" onClick={()=>rm(i.key)}>Remove</button>
                </td>
              )}
            </tr>
          ))}
          {(!current.items || !current.items.length) && (
            <tr><td colSpan={viewOnly ? 8 : 9} className="muted">Empty.</td></tr>
          )}
        </tbody>
      </table>

      {!viewOnly && current.id && current.items.length > 0 && (
        <div style={{marginTop:12}}>
          <button className="mv-btn danger" onClick={clr}>Clear All</button>
        </div>
      )}
    </section>
  );
}

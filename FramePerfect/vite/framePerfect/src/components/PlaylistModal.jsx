import { useEffect, useMemo, useState } from 'react';
import {
  getPlaylists, getPlaylist, createPlaylist, renamePlaylist,
  addItem, removeItem, moveItem, setLastPlaylist, getLastPlaylist, onPlaylistsChange
} from '../lib/playlist';

export default function PlaylistModal({ open, onClose, initialItem }) {
  const [pls, setPls] = useState(() => getPlaylists());
  useEffect(() => onPlaylistsChange(setPls), []);

  const last = getLastPlaylist();
  const [sel, setSel] = useState(last || (pls[0]?.id ?? ''));
  useEffect(() => { if (open) setSel(getLastPlaylist() || (getPlaylists()[0]?.id ?? '')); }, [open]);

  const selected = useMemo(() => getPlaylist(sel), [sel, pls]);

  const [newName, setNewName] = useState('');
  const [rename, setRename] = useState(selected?.name || '');
  useEffect(() => setRename(selected?.name || ''), [selected?.id]);

  if (!open) return null;

  const add = () => {
    if (!sel || !initialItem) return;
    setLastPlaylist(sel);
    addItem(sel, initialItem);
  };

  const mk = () => {
    const id = createPlaylist(newName.trim() || 'New Playlist');
    setNewName('');
    setSel(id);
  };

  const rm = (key) => removeItem(sel, key);
  const up = (i) => moveItem(sel, i, Math.max(0, i - 1));
  const dn = (i) => moveItem(sel, i, Math.min((selected?.items.length ?? 1) - 1, i + 1));

  const doRename = () => renamePlaylist(sel, rename.trim() || selected?.name);

  return (
    <div className="mv-modal">
      <div className="mv-dialog">
        <div className="mv-dialog-head">
          <strong>Playlist</strong>
          <button className="mv-btn ghost" onClick={onClose}>Close</button>
        </div>

        <div className="mv-row" style={{gap:12, alignItems:'center', marginBottom:12}}>
          <select className="mv-select" value={sel} onChange={(e)=>setSel(e.target.value)}>
            {pls.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="mv-input" placeholder="New playlist name" value={newName} onChange={e=>setNewName(e.target.value)} />
          <button className="mv-btn" onClick={mk}>Create</button>
        </div>

        {selected && (
          <div className="mv-card" style={{padding:12}}>
            <div className="mv-row" style={{gap:8, alignItems:'center', marginBottom:10}}>
              <input className="mv-input" value={rename} onChange={e=>setRename(e.target.value)} />
              <button className="mv-btn ghost" onClick={doRename}>Rename</button>
              {initialItem && <button className="mv-btn" onClick={add}>Add current move</button>}
            </div>

            <table className="mv-table">
              <thead>
                <tr>
                  <th style={{width:56}}>#</th>
                  <th>COMMAND</th>
                  <th>STARTUP</th>
                  <th>ON BLOCK</th>
                  <th>ON HIT</th>
                  <th>ON CH</th>
                  <th>PROPERTIES</th>
                  <th style={{width:140}}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {(selected.items || []).map((it, idx) => (
                  <tr key={it.key}>
                    <td>{idx+1}</td>
                    <td>
                      <div style={{display:'flex',flexDirection:'column'}}>
                        <strong>{it.notation || '-'}</strong>
                        {it.moveName ? <span className="muted">{it.moveName}</span> : null}
                      </div>
                    </td>
                    <td>{it.startup ?? ''}</td>
                    <td>{it.onBlock ?? ''}</td>
                    <td>{it.onHit ?? ''}</td>
                    <td>{it.onCH ?? ''}</td>
                    <td>{it.properties ?? ''}</td>
                    <td style={{display:'flex',gap:6}}>
                      <button className="mv-btn ghost" onClick={()=>up(idx)}>↑</button>
                      <button className="mv-btn ghost" onClick={()=>dn(idx)}>↓</button>
                      <button className="mv-btn danger" onClick={()=>rm(it.key)}>Remove</button>
                    </td>
                  </tr>
                ))}
                {(!selected.items || !selected.items.length) && (
                  <tr><td colSpan={8} className="muted">Empty.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

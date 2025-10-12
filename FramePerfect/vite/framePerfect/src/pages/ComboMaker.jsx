// src/pages/ComboMaker.jsx
import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { ICONS, parseNotation } from "../lib/notation.js";

export default function ComboMaker() {
  const [tokens, setTokens] = useState([]);
  const [text, setText] = useState("");
  const canvasRef = useRef(null);

  function add(t) { setTokens((a) => [...a, t]); }
  function backspace() { setTokens((a) => a.slice(0, -1)); }
  function clearAll() { setTokens([]); }
  function fromText() { setTokens(parseNotation(text)); }

  async function exportPng() {
    if (!canvasRef.current) return;
    const url = await toPng(canvasRef.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
    const a = document.createElement("a");
    a.href = url; a.download = "combo.png"; a.click();
  }

  const iconKeys = useMemo(() => Object.keys(ICONS), []);

  return (
    <div className="page" style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>Combo Maker</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", width: 420, fontFamily: "monospace" }}
          placeholder="Type Tekken notation, e.g. df+2, 1, 2, f,f+4"
          value={text} onChange={(e)=>setText(e.target.value)}
          onKeyDown={(e)=>{ if(e.key==="Enter") fromText(); }}
        />
        <button onClick={fromText} className="btn">Convert</button>
        <button onClick={backspace} className="btn">⌫</button>
        <button onClick={clearAll} className="btn">Clear</button>
        <button onClick={exportPng} className="btn">Export PNG</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {iconKeys.map(k => (
          <button key={k} onClick={() => add(k)} className="chip">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <img src={`/icons/${ICONS[k]}`} alt={k} height={18} />
              <small style={{ opacity: .6 }}>{k}</small>
            </span>
          </button>
        ))}
      </div>

      <div
        ref={canvasRef}
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          background: "#fff",
          padding: 16,
          minHeight: 96,
          maxWidth: 960
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          {tokens.length === 0 ? (
            <span style={{ color: "#aaa" }}>Your combo will appear here…</span>
          ) : tokens.map((t, i) => {
              const src = ICONS[t];
              if (src) return <img key={i} src={`/icons/${src}`} alt={t} height={32} />;
              // fallback kalau tak ada icon: tulis teksnya biar tetap terlihat
              return <span key={i} style={{ fontFamily: "monospace" }}>{t}</span>;
            })
          }
        </div>
      </div>

      <style>{`
        .btn {
          border: 1px solid #ddd; border-radius: 8px; padding: 8px 12px; background: #fff; cursor: pointer;
        }
        .btn:hover { background: #f8f8f8; }
        .chip {
          border: 1px solid #eee; border-radius: 8px; padding: 6px 10px; background:#fff; cursor:pointer;
        }
        .chip:hover { background:#f9f9f9; }
      `}</style>
    </div>
  );
}
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

  /* ───────────────────────────────────────────────
     Robust export (fixes "tainted canvas" failures)
     - Inlines every <img> inside the export area to data: URLs
     - Works with PNG/SVG and with Vite/Prod
     ─────────────────────────────────────────────── */
  async function inlineImages(root) {
    const imgs = Array.from(root.querySelectorAll("img"));
    const originals = new Map();

    async function urlToDataURL(url) {
      const res = await fetch(url, { cache: "no-store" });
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.readAsDataURL(blob);
      });
    }

    await Promise.allSettled(
      imgs.map(async (img) => {
        const src = img.getAttribute("src");
        if (!src || src.startsWith("data:")) return;
        try {
          originals.set(img, src);
          img.setAttribute("crossorigin", "anonymous");
          img.src = await urlToDataURL(src);
        } catch (e) {
          // Keep going even if one icon fails; html-to-image will still work
          // eslint-disable-next-line no-console
          console.warn("Could not inline", src, e);
        }
      })
    );

    // return a restore function
    return () => {
      originals.forEach((src, img) => {
        img.src = src;
        img.removeAttribute("crossorigin");
      });
    };
  }

  // replace your exportPng() with this
  async function exportPng() {
    if (!canvasRef.current) return;

    // inline all <img> so the canvas is not tainted
    const restore = await (async function inlineImages(root) {
      const imgs = Array.from(root.querySelectorAll("img"));
      const originals = new Map();

      async function urlToDataURL(url) {
        const res = await fetch(url, { cache: "no-store" });
        const blob = await res.blob();
        return await new Promise((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.readAsDataURL(blob);
        });
      }

      await Promise.allSettled(
        imgs.map(async (img) => {
          const src = img.getAttribute("src");
          if (!src || src.startsWith("data:")) return;
          try {
            originals.set(img, src);
            img.setAttribute("crossorigin", "anonymous");
            img.src = await urlToDataURL(src);
          } catch {}
        })
      );
      return () => {
        originals.forEach((src, img) => {
          img.src = src;
          img.removeAttribute("crossorigin");
        });
      };
    })(canvasRef.current);

    try {
      const url = await toPng(canvasRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        style: { transform: "none", "transform-origin": "center" },
        // ⬇⬇ KEY LINE — do not try to embed Google Fonts
        skipFonts: true,
      });

      const a = document.createElement("a");
      a.href = url;
      a.download = "combo.png";
      document.body.appendChild(a); // Safari
      a.click();
      a.remove();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Check the console for details.");
    } finally {
      restore();
    }
  }


  // --------- Button groups (not random anymore) ----------
  const allKeys = useMemo(() => Object.keys(ICONS), []);
  const groups = useMemo(() => {
    const g = {
      Inputs: [],
      Directions: [],
      Stances: [],
      Specials: [],
      Punctuation: [],
      Other: [],
    };

    const isInput = (k) => /^\d+$/.test(k) || /^[1234]{2,4}$/.test(k);
    const isDir = (k) => /^(u|d|f|b|ub|uf|db|df|ff|bb|n)$/i.test(k);
    const isStance = (k) => /^(ws|wr|fc|ssl|ssr|swl|swr)$/i.test(k);
    const isSpecial = (k) =>
      /^(heat|inheat|hb!|heatburst|rage|ra|ch|wb|wt|w!|fb)$/i.test(k);
    const isPunc = (k) => /^([,.;:~·\-–—>»\)\(\[\]\{\}])$/.test(k);

    // Keep a deterministic order using common, “expected” sequences first
    const preferredInputs = [
      "1","2","3","4","12","13","14","23","24","34","123","124","134","234","1234",
    ].filter((k) => ICONS[k]);

    const preferredDirs = [
      "u","uf","f","df","d","db","b","ub","ff","bb","n",
    ].filter((k) => ICONS[k]);

    // Seed with preferred orders
    g.Inputs.push(...preferredInputs);
    g.Directions.push(...preferredDirs);

    // Add everything else by classification, skipping duplicates
    const seen = new Set([...g.Inputs, ...g.Directions]);
    for (const k of allKeys) {
      if (seen.has(k)) continue;
      if (isInput(k)) g.Inputs.push(k);
      else if (isDir(k)) g.Directions.push(k);
      else if (isStance(k)) g.Stances.push(k);
      else if (isSpecial(k)) g.Specials.push(k);
      else if (isPunc(k)) g.Punctuation.push(k);
      else g.Other.push(k);
      seen.add(k);
    }

    // Clean empty groups
    Object.keys(g).forEach((name) => { if (!g[name].length) delete g[name]; });
    return g;
  }, [allKeys]);

  return (
    <div className="cm-wrap container">
      <h1 className="cm-title">COMBO MAKER</h1>

      <div className="cm-toolbar">
        <div className="cm-search">
          <input
            className="cm-input"
            placeholder="Type Tekken notation, e.g. df+2, 1, 2, f,f+4"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") fromText(); }}
            aria-label="Notation input"
          />
          <button onClick={fromText} className="cm-btn primary">Convert</button>
        </div>

        <div className="cm-actions">
          <button onClick={backspace} className="cm-btn ghost" title="Backspace">⌫</button>
          <button onClick={clearAll} className="cm-btn ghost">Clear</button>
          <button onClick={exportPng} className="cm-btn">Export PNG</button>
        </div>
      </div>

      {/* GROUPED ICONS */}
      <div className="cm-groups">
        {Object.entries(groups).map(([title, keys]) => (
          <section key={title} className="cm-group">
            <header className="cm-group-title">{title}</header>
            <div className="cm-chiplist">
              {keys.map((k) => (
                <button key={k} onClick={() => add(k)} className="cm-chip" title={k}>
                  <span className="cm-chip-inner">
                    <img
                      src={`/icons/${ICONS[k]}`}
                      alt={k}
                      height={18}
                      crossOrigin="anonymous"
                    />
                    <small>{k}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* EXPORT AREA */}
      <div ref={canvasRef} className="cm-canvas">
        <div className="cm-row">
          {tokens.length === 0 ? (
            <span className="cm-empty">Your combo will appear here…</span>
          ) : (
            tokens.map((t, i) => {
              const src = ICONS[t];
              if (src) {
                return (
                  <img
                    key={i}
                    src={`/icons/${src}`}
                    alt={t}
                    height={32}
                    crossOrigin="anonymous"
                  />
                );
              }
              return <span key={i} className="cm-fallback">{t}</span>;
            })
          )}
        </div>
      </div>
    </div>
  );
}

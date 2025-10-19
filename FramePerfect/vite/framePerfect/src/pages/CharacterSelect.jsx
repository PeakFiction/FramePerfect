import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useExportData, slugify } from "../data/useData.js";

/** Prefer WEBP, fall back to PNG for each /public/characters/<slug>.(webp|png) */
const iconWebp = (slug) => `/characters/${slug}.webp`;
const iconPng  = (slug) => `/characters/${slug}.png`;

export default function CharacterSelect() {
  const navigate = useNavigate();
  const data = useExportData();

  const roster = useMemo(() => {
    const list = (data?.characters || []).map((c) => {
      const name = c.name || c.slug || c.characterID;
      const slug = slugify(c.key || name);
      return { name, slug };
    });
    return list;
  }, [data]);

  const go = (name) => navigate(`/moves?char=${encodeURIComponent(name)}`);

  return (
    <div className="cs-wrap">
      <div className="cs-topbar">
        <div className="container">
          <h1 className="cs-title h1">CHARACTER SELECT</h1>
        </div>
      </div>

      <div className="container">
        {/* fixed 6 columns on desktop */}
        <div className="cs-grid cs-grid--6">
          {roster.map((c) => (
            <button
              key={c.slug}
              className="char-card"
              onClick={() => go(c.name)}
              title={c.name}
              aria-label={c.name}
            >
              {/* gradient slab */}
              <div className="char-bg" />

              {/* character icon */}
              <img
                className="char-img"
                src={iconWebp(c.slug)}
                alt=""
                loading="lazy"
                onError={(e) => {
                  const png = iconPng(c.slug);
                  if (e.currentTarget.src !== png) e.currentTarget.src = png;
                }}
              />

              {/* border + chamfer */}
              <div className="char-border" />

              {/* dark fade at bottom for legible name */}
              <div className="char-fade" />

              {/* name */}
              <div className="char-name">{c.name.toUpperCase()}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

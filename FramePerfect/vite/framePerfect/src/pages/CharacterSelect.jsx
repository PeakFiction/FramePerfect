import { useExportData, slugify } from '../data/useData.js';
import { Link } from 'react-router-dom';

export default function CharacterSelect() {
  const data = useExportData();
  if (!data) return null;

  const chars = data.characters || [];
  return (
    <div className="page">
      <h1>Character Select</h1>
      <div className="grid">
        {chars.map((c) => {
          const id = c.characterID ?? c.id ?? c._id;
          const name = c.name || c.characterName || `Char ${id}`;
          const slug = c.slug || slugify(name);
          return (
            <Link key={id} to={`/combo?char=${encodeURIComponent(name)}`} className="card">
              <img src={`/assets/${slug}.webp`} alt={name} onError={(e)=>{e.currentTarget.style.display='none';}}/>
              <div>{name}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

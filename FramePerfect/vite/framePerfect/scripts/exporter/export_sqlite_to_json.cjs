// scripts/exporter/export_sqlite_to_json.cjs
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.resolve(__dirname, 'mydatabase.db'); // same folder as this script
const OUT_DIR = path.resolve(__dirname, '../../public/data'); // write directly into the app's public/data
const OUT_FILE = path.join(OUT_DIR, 'export.json');

// optional mapping: characterID -> display name (fill as you learn real names)
const NAME_MAP = {
  // 'djin': 'Devil Jin',
  // 'alisa': 'Alisa',
};

function run() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`DB not found: ${DB_PATH}`);
    process.exit(1);
  }
  const db = new sqlite3.Database(DB_PATH);

  const all = (sql, params=[]) =>
    new Promise((res, rej) => db.all(sql, params, (e, rows) => (e ? rej(e) : res(rows))));

  (async () => {
    // ensure moves exists
    const tables = await all(`SELECT name FROM sqlite_master WHERE type='table'`);
    const haveMoves = tables.some(t => t.name === 'moves');
    if (!haveMoves) {
      console.error('Required table "moves" not found');
      process.exit(1);
    }

    // dump moves
    const moves = await all(`SELECT * FROM moves`);

    // synthesize characters from distinct characterID
    const ids = [...new Set(moves.map(m => String(m.characterID)))].filter(Boolean).sort();
    const characters = ids.map(id => {
      const name = NAME_MAP[id] || id;
      const slug = String(name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
      return { characterID: id, name, slug };
    });

    // if a real `characters` table exists, prefer it
    const haveCharacters = tables.some(t => t.name === 'characters');
    if (haveCharacters) {
      const charsRows = await all(`SELECT * FROM characters`);
      // try to normalize to {characterID, name, slug}
      const norm = charsRows.map(r => {
        const id = String(r.characterID ?? r.id ?? r._id ?? r.slug ?? r.name);
        const name = String(r.name ?? r.characterName ?? id);
        const slug = String((r.slug || name)).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
        return { characterID: id, name, slug };
      });
      // only overwrite if non-empty
      if (norm.length) {
        norm.sort((a,b)=>a.name.localeCompare(b.name));
        // keep `moves` from above
        await write({ characters: norm, moves });
        db.close();
        console.log(`Wrote ${OUT_FILE} (with characters table)`);
        return;
      }
    }

    await write({ characters, moves });
    db.close();
    console.log(`Wrote ${OUT_FILE} (characters synthesized from moves)`);
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });

  function write(obj) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(obj, null, 2));
  }
}

run();

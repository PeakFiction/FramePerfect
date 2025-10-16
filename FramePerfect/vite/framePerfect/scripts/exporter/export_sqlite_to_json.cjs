// scripts/exporter/export_sqlite_to_json.cjs
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const projectRoot = path.resolve(__dirname, '..', '..'); // vite/framePerfect
const defaultDB = path.join(projectRoot, 'public', 'data', 'tekken8.db');
const defaultOut = path.join(projectRoot, 'public', 'data', 'export.json');

// CLI: node scripts/exporter/export_sqlite_to_json.cjs [dbPath] [outPath]
const DB_PATH = path.resolve(process.argv[2] || defaultDB);
const OUT_FILE = path.resolve(process.argv[3] || defaultOut);
const OUT_DIR = path.dirname(OUT_FILE);

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/\-+/g, '-')
    .replace(/^\-|\-$/g, '');
}
function toNullEmpty(v) {
  return v === null || v === undefined ? null : String(v);
}

async function openDB(file) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(file)) return reject(new Error(`DB not found: ${file}`));
    const db = new sqlite3.Database(file, (err) => (err ? reject(err) : resolve(db)));
  });
}

async function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

(async () => {
  const db = await openDB(DB_PATH);

  // apakah ada tabel 'character'?
  const tables = await all(db, `SELECT name FROM sqlite_master WHERE type='table'`);
  const haveCharacter = tables.some(t => t.name === 'character');
  const haveMove = tables.some(t => t.name === 'move');
  if (!haveMove) {
    throw new Error(`Required table "move" not found in ${DB_PATH}`);
  }

  let characters = [];
  if (haveCharacter) {
    const rows = await all(
      db,
      `SELECT id, name, slug FROM character ORDER BY name`
    );
    characters = rows.map(r => ({
      characterID: r.slug || String(r.id),
      name: r.name || String(r.slug || r.id),
      slug: r.slug || slugify(r.name || r.id),
    }));
  } else {
    // fallback: synthesize dari move.character_id
    const ids = await all(db, `SELECT DISTINCT character_id FROM move ORDER BY character_id`);
    characters = ids.map(r => {
      const id = String(r.character_id);
      const slug = slugify(id);
      return { characterID: slug, name: id, slug };
    });
  }

  // map id -> slug buat ekspor moves
  const idToSlug = new Map();
  if (haveCharacter) {
    const mapRows = await all(db, `SELECT id, slug, name FROM character`);
    mapRows.forEach(r => idToSlug.set(r.id, r.slug || slugify(r.name || r.id)));
  } else {
    characters.forEach(c => idToSlug.set(c.characterID, c.slug));
  }

  // ambil moves
  const movesRaw = await all(
    db,
    `SELECT
       m.id,
       m.character_id,
       m.no,
       m.move_name,
       m.notation,
       m.string_properties,
       m.damage,
       m.startup_frames,
       m.frames_on_block,
       m.frames_on_hit,
       m.frames_on_counter,
       m.notes,
       m.throw_break
     FROM move m
     ORDER BY m.character_id, COALESCE(m.no, 999999), m.id`
  );

  const moves = movesRaw.map(m => ({
    // gunakan slug karakter sebagai characterID di JSON (stabil & dipakai UI)
    characterID: idToSlug.get(m.character_id) || slugify(String(m.character_id)),
    moveID: m.id,
    no: m.no ?? null,
    moveName: toNullEmpty(m.move_name),
    notation: toNullEmpty(m.notation),
    stringProperties: toNullEmpty(m.string_properties),
    damage: toNullEmpty(m.damage),
    startupFrames: toNullEmpty(m.startup_frames),
    framesOnBlock: toNullEmpty(m.frames_on_block),
    framesOnHit: toNullEmpty(m.frames_on_hit),
    framesOnCounter: toNullEmpty(m.frames_on_counter),
    notes: toNullEmpty(m.notes),
    throwBreak: toNullEmpty(m.throw_break),
  }));

  // tulis file
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({ characters, moves }, null, 2));
  db.close();

  console.log(`Wrote ${OUT_FILE} (chars=${characters.length}, moves=${moves.length})`);
})().catch(err => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
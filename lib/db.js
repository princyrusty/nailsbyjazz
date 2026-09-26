// Tiny data layer.
// - With MONGODB_URI set (production on Render): stores everything in MongoDB Atlas.
// - Without it (local development): stores JSON files in ./data.
// Documents always carry a string `id`.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const newId = (bytes = 8) => crypto.randomBytes(bytes).toString('hex');

function matches(doc, filter) {
  return Object.entries(filter).every(([k, v]) => doc[k] === v);
}

// ---------------- JSON file store ----------------
function jsonStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const cache = {};
  const file = (c) => path.join(dir, `${c}.json`);
  const load = (c) => {
    if (!cache[c]) {
      try { cache[c] = JSON.parse(fs.readFileSync(file(c), 'utf8')); } catch { cache[c] = []; }
    }
    return cache[c];
  };
  const save = (c) => {
    const tmp = file(c) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cache[c], null, 1));
    fs.renameSync(tmp, file(c));
  };
  const clone = (x) => (x ? JSON.parse(JSON.stringify(x)) : x);
  return {
    kind: 'json',
    async list(c, filter = {}, { sort } = {}) {
      let rows = load(c).filter((d) => matches(d, filter));
      if (sort) { const [k, dir] = Object.entries(sort)[0]; rows = [...rows].sort((a, b) => (a[k] > b[k] ? dir : a[k] < b[k] ? -dir : 0)); }
      return clone(rows);
    },
    async get(c, id) { return clone(load(c).find((d) => d.id === id)); },
    async findOne(c, filter) { return clone(load(c).find((d) => matches(d, filter))); },
    async insert(c, doc) { const d = { id: doc.id || newId(), ...doc }; load(c).push(d); save(c); return clone(d); },
    async update(c, id, patch) {
      const d = load(c).find((x) => x.id === id); if (!d) return null;
      Object.assign(d, patch); save(c); return clone(d);
    },
    async remove(c, id) { const rows = load(c); const i = rows.findIndex((x) => x.id === id); if (i < 0) return false; rows.splice(i, 1); save(c); return true; },
    async count(c, filter = {}) { return load(c).filter((d) => matches(d, filter)).length; },
    // images: binary kept as base64 in JSON mode
    async putImage(img) { return this.insert('images', { ...img, data: img.data.toString('base64') }); },
    async getImage(id) { const d = await this.get('images', id); return d && { ...d, data: Buffer.from(d.data, 'base64') }; },
  };
}

// ---------------- MongoDB store ----------------
async function mongoStore(uri) {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri, { maxPoolSize: 5 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'nailsbyjazz');
  const col = (c) => db.collection(c);
  const out = (d) => { if (!d) return d; const { _id, ...rest } = d; return rest; };
  await Promise.all([
    col('users').createIndex({ phone: 1 }, { unique: true }),
    col('orders').createIndex({ userId: 1 }),
    col('orders').createIndex({ createdAt: -1 }),
  ]).catch(() => {});
  return {
    kind: 'mongo',
    async list(c, filter = {}, { sort } = {}) { let q = col(c).find(filter); if (sort) q = q.sort(sort); return (await q.toArray()).map(out); },
    async get(c, id) { return out(await col(c).findOne({ _id: id })); },
    async findOne(c, filter) { return out(await col(c).findOne(filter)); },
    async insert(c, doc) { const d = { id: doc.id || newId(), ...doc }; await col(c).insertOne({ _id: d.id, ...d }); return d; },
    async update(c, id, patch) { const r = await col(c).findOneAndUpdate({ _id: id }, { $set: patch }, { returnDocument: 'after' }); return out(r); },
    async remove(c, id) { const r = await col(c).deleteOne({ _id: id }); return r.deletedCount > 0; },
    async count(c, filter = {}) { return col(c).countDocuments(filter); },
    async putImage(img) { const d = { id: newId(), ...img }; await col('images').insertOne({ _id: d.id, ...d }); return { ...d, data: undefined }; },
    async getImage(id) { const d = await col('images').findOne({ _id: id }); return d && { ...out(d), data: Buffer.from(d.data.buffer || d.data) }; },
  };
}

// ---------------- PostgreSQL store (Render Postgres) ----------------
// Every collection lives in one table as JSON documents; photos live in their own table.
async function pgStore(url) {
  const { Pool } = require('pg');
  const external = /render\.com|amazonaws|neon\.tech|supabase/.test(url);
  const pool = new Pool({ connectionString: url, max: 5, ssl: external ? { rejectUnauthorized: false } : false });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS docs (coll TEXT NOT NULL, id TEXT NOT NULL, data JSONB NOT NULL, PRIMARY KEY (coll, id));
    CREATE INDEX IF NOT EXISTS docs_data_gin ON docs USING GIN (data jsonb_path_ops);
    CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON docs ((data->>'phone')) WHERE coll = 'users';
    CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, content_type TEXT NOT NULL, data BYTEA NOT NULL, size INT, created_at TIMESTAMPTZ DEFAULT now());
  `);
  const q = (text, params) => pool.query(text, params);
  const safeKey = (k) => String(k).replace(/[^a-zA-Z0-9_]/g, '');
  return {
    kind: 'postgres',
    async list(c, filter = {}, { sort } = {}) {
      let sql = 'SELECT data FROM docs WHERE coll = $1 AND data @> $2::jsonb';
      if (sort) {
        const [k, dir] = Object.entries(sort)[0];
        const key = safeKey(k);
        sql += ` ORDER BY (CASE WHEN jsonb_typeof(data->'${key}') = 'number' THEN (data->>'${key}')::numeric END) ${dir < 0 ? 'DESC' : 'ASC'}, data->>'${key}' ${dir < 0 ? 'DESC' : 'ASC'}`;
      }
      return (await q(sql, [c, JSON.stringify(filter)])).rows.map((r) => r.data);
    },
    async get(c, id) { return (await q('SELECT data FROM docs WHERE coll = $1 AND id = $2', [c, id])).rows[0]?.data; },
    async findOne(c, filter) { return (await q('SELECT data FROM docs WHERE coll = $1 AND data @> $2::jsonb LIMIT 1', [c, JSON.stringify(filter)])).rows[0]?.data; },
    async insert(c, doc) {
      const d = { id: doc.id || newId(), ...doc };
      await q('INSERT INTO docs (coll, id, data) VALUES ($1, $2, $3)', [c, d.id, JSON.stringify(d)]);
      return d;
    },
    async update(c, id, patch) {
      const r = await q('UPDATE docs SET data = data || $3::jsonb WHERE coll = $1 AND id = $2 RETURNING data', [c, id, JSON.stringify(patch)]);
      return r.rows[0]?.data || null;
    },
    async remove(c, id) {
      if (c === 'images') return (await q('DELETE FROM images WHERE id = $1', [id])).rowCount > 0;
      return (await q('DELETE FROM docs WHERE coll = $1 AND id = $2', [c, id])).rowCount > 0;
    },
    async count(c, filter = {}) { return Number((await q('SELECT count(*) FROM docs WHERE coll = $1 AND data @> $2::jsonb', [c, JSON.stringify(filter)])).rows[0].count); },
    async putImage(img) {
      const id = newId();
      await q('INSERT INTO images (id, content_type, data, size) VALUES ($1, $2, $3, $4)', [id, img.contentType, img.data, img.size]);
      return { id, contentType: img.contentType, size: img.size };
    },
    async getImage(id) {
      const r = (await q('SELECT content_type, data FROM images WHERE id = $1', [id])).rows[0];
      return r && { id, contentType: r.content_type, data: r.data };
    },
  };
}

async function connect() {
  if (process.env.DATABASE_URL) {
    const s = await pgStore(process.env.DATABASE_URL);
    console.log('Database: PostgreSQL');
    return s;
  }
  if (process.env.MONGODB_URI) {
    const s = await mongoStore(process.env.MONGODB_URI);
    console.log('Database: MongoDB');
    return s;
  }
  console.warn('Database: local JSON files in ./data (set DATABASE_URL in production — Render free tier wipes files on restart)');
  return jsonStore(path.join(__dirname, '..', 'data', 'store'));
}

module.exports = { connect, newId };

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

async function connect() {
  if (process.env.MONGODB_URI) {
    const s = await mongoStore(process.env.MONGODB_URI);
    console.log('Database: MongoDB');
    return s;
  }
  console.warn('Database: local JSON files in ./data (set MONGODB_URI in production — Render free tier wipes files on restart)');
  return jsonStore(path.join(__dirname, '..', 'data', 'store'));
}

module.exports = { connect, newId };

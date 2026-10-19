// Node deployment adapter. Cloudflare bindings are replaced at build time;
// production records and media live outside the source tree on a persistent disk.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync, chmodSync } from 'node:fs';
import { mkdir, readFile, writeFile, rename, rm, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export class SQLiteBinding {
  constructor(filename, migrations = resolve('drizzle')) {
    if (filename !== ':memory:') mkdirSync(resolve(filename, '..'), { recursive: true, mode: 0o700 });
    this.sqlite = new DatabaseSync(filename);
    this.sqlite.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
    if (filename !== ':memory:') chmodSync(filename, 0o600);
    this.sqlite.exec('CREATE TABLE IF NOT EXISTS sator_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at TEXT NOT NULL)');
    for (const name of readdirSync(migrations).filter(f => /^\d+.*\.sql$/.test(f)).sort()) {
      const sql = readFileSync(join(migrations, name), 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      const old = this.sqlite.prepare('SELECT hash FROM sator_migrations WHERE name=?').get(name);
      if (old) { if (old.hash !== hash) throw new Error('Previously applied migration changed: ' + name); continue; }
      this.sqlite.exec('BEGIN IMMEDIATE');
      try {
        this.sqlite.exec(sql);
        this.sqlite.prepare('INSERT INTO sator_migrations VALUES (?,?,?)').run(name, hash, new Date().toISOString());
        this.sqlite.exec('COMMIT');
      } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
    }
  }
  prepare(query) { return new SQLiteStatement(this, query); }
  // No await inside the transaction: another request cannot interleave its writes.
  async batch(statements) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => {
        if (statement.db !== this) throw new Error('Mixed database batch');
        return statement.execute();
      });
      this.sqlite.exec('COMMIT'); return results;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
  async exec(sql) { this.sqlite.exec(sql); return { count: 0, duration: 0 }; }
  close() { this.sqlite.close(); }
}
class SQLiteStatement {
  constructor(db, query, params = []) { this.db = db; this.query = query; this.params = params; }
  bind(...params) { return new SQLiteStatement(this.db, this.query, params.map(v => typeof v === 'boolean' ? Number(v) : v)); }
  execute() {
    const statement = this.db.sqlite.prepare(this.query);
    let results = [], changes = 0, last_row_id = 0;
    if (statement.columns().length) {
      results = statement.all(...this.params);
      if (/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(this.query)) {
        ({ changes, last_row_id } = this.db.sqlite.prepare('SELECT changes() AS changes, last_insert_rowid() AS last_row_id').get());
      }
    } else {
      const result = statement.run(...this.params);
      changes = Number(result.changes); last_row_id = Number(result.lastInsertRowid);
    }
    return { success: true, results, meta: { changes, last_row_id, duration: 0 } };
  }
  async all() { return this.execute(); }
  async run() { return this.execute(); }
  async first(column) { const row = this.db.sqlite.prepare(this.query).get(...this.params); return row ? (column ? row[column] : row) : null; }
  async raw(options) {
    const statement = this.db.sqlite.prepare(this.query); statement.setReturnArrays(true);
    const rows = statement.all(...this.params);
    return options?.columnNames ? [statement.columns().map(c => c.name), ...rows] : rows;
  }
}

export class FileBucket {
  constructor(root) { this.root = resolve(root); mkdirSync(this.root, { recursive: true, mode: 0o700 }); }
  location(key) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key)) throw new Error('Invalid media key');
    return join(this.root, key);
  }
  async head(key) {
    const directory = this.location(key);
    try {
      if (!(await lstat(directory)).isDirectory() || (await lstat(directory)).isSymbolicLink()) throw new Error('Invalid media path');
      const meta = JSON.parse(await readFile(join(directory, 'metadata.json'), 'utf8'));
      return { ...meta, key };
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async get(key, options) {
    const metadata = await this.head(key); if (!metadata) return null;
    const data = await readFile(join(this.location(key), 'body'));
    const range = options?.range;
    const bytes = range ? data.subarray(range.offset, range.offset + range.length) : data;
    return { ...metadata, body: new Uint8Array(bytes), arrayBuffer: async () => new Uint8Array(bytes).buffer };
  }
  async put(key, value, options = {}) {
    const destination = this.location(key), temporary = join(this.root, '.upload-' + randomUUID());
    const data = Buffer.from(value);
    if (data.length > 20_000_000) throw new Error('Media too large');
    await mkdir(temporary, { mode: 0o700 });
    try {
      const meta = { size: data.length, httpMetadata: options.httpMetadata || {}, customMetadata: options.customMetadata || {} };
      await writeFile(join(temporary, 'body'), data, { mode: 0o600 });
      await writeFile(join(temporary, 'metadata.json'), JSON.stringify(meta), { mode: 0o600 });
      // Immutable UUID objects: retrying cannot replace another owner's file.
      await rename(temporary, destination);
      return { ...meta, key };
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }
  async delete(key) { await rm(this.location(key), { recursive: true, force: true }); }
}

const state = globalThis[Symbol.for('sator.node.bindings')] ||= {};
export const env = new Proxy({}, {
  get(_target, key) {
    if (key === 'SATOR_RUNTIME') return 'node';
    if (key === 'DB') return state.db ||= new SQLiteBinding(join(dataRoot(), 'sator.sqlite'), process.env.SATOR_MIGRATIONS_DIR || resolve('drizzle'));
    if (key === 'BUCKET') return state.bucket ||= new FileBucket(join(dataRoot(), 'assets'));
    // Open-source deployment does not activate proprietary payment or API services.
    if (typeof key === 'string' && (key.startsWith('RAZORPAY_') || key.startsWith('OPENAI_'))) return undefined;
    if (key === 'AI_PROVIDER') return 'compatible';
    return typeof key === 'string' ? process.env[key] : undefined;
  },
});
function dataRoot() {
  if (!process.env.SATOR_DATA_DIR) throw new Error('Set SATOR_DATA_DIR to a persistent, private directory before starting ŚATOR.');
  return resolve(process.env.SATOR_DATA_DIR);
}

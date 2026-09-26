import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { repairUser } from '#src/default';
import config from '#config';

const COLLECTIONS = ['users', 'guild', 'chats', 'stats', 'settings', 'bots'];
const emptyData = () => ({ users: {}, guild: {}, chats: {}, stats: {}, settings: {}, bots: {} });

const dbScope = new AsyncLocalStorage();
const stores = [];
let mainStore = null;
const activeStore = () => dbScope.getStore() ?? mainStore;

export const db = new Proxy(
  {},
  {
    get: (_, prop) => activeStore()?.[prop],
    set: (_, prop, value) => {
      const s = activeStore();
      if (s) s[prop] = value;
      return true;
    },
  }
);

export function dbBaseName(name = '') {
  const base = String(name || '').replace(/\.(db|sqlite3?)$/i, '');
  return base || 'database';
}

function ensureDbDir() {
  const dir = path.join(path.resolve(process.cwd()), 'db');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveDbFile(name = '') {
  return path.join(path.resolve(process.cwd()), 'db', `${dbBaseName(name)}.db`);
}

function resolvePaths(name) {
  const dir = path.resolve(process.cwd());
  const stem = name ? `${name}_database` : 'database';
  return {
    sqlitePath: resolveDbFile(name),
    legacySqlite: path.join(dir, `${stem}.sqlite`),
    legacyJson: path.join(dir, `${stem}.json`),
  };
}

function backupLegacyFile(filePath) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = `${path.basename(filePath)}.${stamp}.bak`;
    const parentDir = path.join(path.resolve(process.cwd()), '..', 'backup');
    try {
      fs.mkdirSync(parentDir, { recursive: true });
      const dest = path.join(parentDir, file);
      fs.renameSync(filePath, dest);
      console.log(`Legacy database backed up to ${dest}`);
      return;
    } catch {}
    const localDir = path.join(path.resolve(process.cwd()), '.backup');
    fs.mkdirSync(localDir, { recursive: true });
    const dest = path.join(localDir, file);
    fs.renameSync(filePath, dest);
    console.log(`Legacy database backed up to ${dest}`);
  } catch (e) {
    console.warn('Could not back up legacy database file:', e.message);
  }
}

function migrateFromJson(sqlite, stmts, jsonPath) {
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const data = raw?.data ?? raw ?? {};
    for (const col of COLLECTIONS) {
      const colData = data[col];
      if (!colData || typeof colData !== 'object') continue;
      for (const [k, v] of Object.entries(colData)) {
        if (col === 'users' && v && typeof v === 'object' && 'aiHistory' in v) delete v.aiHistory;
        stmts.upsert.run(col, k, JSON.stringify(v));
      }
    }
    console.log(`Migrated legacy ${path.basename(jsonPath)} into SQLite`);
  } catch (e) {
    console.warn('Migration from database.json failed:', e.message);
  }
  backupLegacyFile(jsonPath);
}

function loadAll(sqlite) {
  const data = emptyData();
  const sel = sqlite.prepare('SELECT key, value FROM store WHERE collection = ?');
  for (const col of COLLECTIONS) {
    for (const row of sel.all(col)) {
      try {
        data[col][row.key] = JSON.parse(row.value);
        if (col === 'users') repairUser(data[col][row.key]);
      } catch {}
    }
  }
  return data;
}

const snapshotAll = (data) => {
  const snaps = new Map();
  for (const col of COLLECTIONS) {
    const m = new Map();
    for (const [k, v] of Object.entries(data[col] ?? {})) m.set(k, JSON.stringify(v) ?? 'null');
    snaps.set(col, m);
  }
  return snaps;
};

function saveStore(store) {
  const { stmts, data, snapshots } = store;
  const dirty = [];
  const gone = [];
  for (const col of COLLECTIONS) {
    const colData = data[col] ?? {};
    const snap = snapshots.get(col);
    for (const [k, v] of Object.entries(colData)) {
      const json = JSON.stringify(v) ?? 'null';
      if (snap.get(k) !== json) {
        dirty.push([col, k, json]);
        snap.set(k, json);
      }
    }
    for (const k of [...snap.keys()]) {
      if (!(k in colData)) {
        gone.push([col, k]);
        snap.delete(k);
      }
    }
  }
  if (!dirty.length && !gone.length) return { saved: 0 };
  store.sqlite.exec('BEGIN');
  try {
    for (const [col, k, json] of dirty) stmts.upsert.run(col, k, json);
    for (const [col, k] of gone) stmts.del.run(col, k);
    store.sqlite.exec('COMMIT');
  } catch (e) {
    try {
      store.sqlite.exec('ROLLBACK');
    } catch {}
    throw e;
  }
  return { saved: dirty.length + gone.length };
}

function copyLegacySqlite(legacySqlite, sqlitePath) {
  fs.copyFileSync(legacySqlite, sqlitePath);
  for (const ext of ['-wal', '-shm']) {
    try {
      if (fs.existsSync(legacySqlite + ext)) fs.copyFileSync(legacySqlite + ext, sqlitePath + ext);
    } catch {}
  }
  backupLegacyFile(legacySqlite);
  for (const ext of ['-wal', '-shm']) {
    try {
      if (fs.existsSync(legacySqlite + ext)) backupLegacyFile(legacySqlite + ext);
    } catch {}
  }
}

export function openDatabase(prefix = '') {
  ensureDbDir();
  const { sqlitePath, legacySqlite, legacyJson } = resolvePaths(prefix);
  const fresh = !fs.existsSync(sqlitePath);
  if (fresh) {
    if (fs.existsSync(legacySqlite)) {
      copyLegacySqlite(legacySqlite, sqlitePath);
      console.log(`Moved legacy ${path.basename(legacySqlite)} into ${sqlitePath}`);
    }
  }
  const sqlite = new DatabaseSync(sqlitePath);
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec(
    'CREATE TABLE IF NOT EXISTS store (collection TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (collection, key))'
  );
  const stmts = {
    upsert: sqlite.prepare(
      'INSERT INTO store (collection, key, value) VALUES (?, ?, ?) ON CONFLICT (collection, key) DO UPDATE SET value = excluded.value'
    ),
    del: sqlite.prepare('DELETE FROM store WHERE collection = ? AND key = ?'),
  };
  if (fresh && fs.existsSync(legacyJson)) migrateFromJson(sqlite, stmts, legacyJson);
  const data = loadAll(sqlite);
  const snapshots = snapshotAll(data);
  const store = { prefix, sqlite, stmts, data, snapshots, READ: true, instance: null };
  store.instance = { sqlite, data, write: () => store.save() };
  store.save = () => saveStore(store);
  stores.push(store);
  return store;
}

export async function loadDatabase(opts = {}) {
  const prefix = opts.prefix ?? global.opts?._[0] ?? config.bot?.db ?? '';
  mainStore = openDatabase(prefix);
  return mainStore;
}

export async function saveDatabase() {
  const s = activeStore();
  if (!s) throw new Error('Database not initialized. Call loadDatabase() first.');
  return s.save();
}

export async function saveAllStores() {
  return Promise.all(stores.map((s) => s.save()));
}

export function setSubbotStatus(number, patch = {}) {
  if (!mainStore) return;
  const key = String(number ?? '').replace(/\D/g, '');
  if (!key) return;
  const cur = mainStore.data.bots[key] ?? {};
  mainStore.data.bots[key] = { ...cur, ...patch, updatedAt: Date.now() };
}

export function getSubbotStatus(number) {
  if (!mainStore) return null;
  const key = String(number ?? '').replace(/\D/g, '');
  return mainStore.data.bots[key] ?? null;
}

export const storeByPrefix = (prefix) => stores.find((s) => s.prefix === prefix);

export { dbScope };

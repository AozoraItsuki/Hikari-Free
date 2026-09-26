import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import chokidar from 'chokidar';
export class ApiLoader {
  constructor(opts = {}) {
    this.baseDir = path.resolve(opts.baseDir || './api');
    this.verbose = !!opts.verbose;
    this.onReload = typeof opts.onReload === 'function' ? opts.onReload : null;
    this.onRemove = typeof opts.onRemove === 'function' ? opts.onRemove : null;
    this.ignore = Array.isArray(opts.ignore) ? opts.ignore : [];
    this.ignorePattern = opts.ignorePattern instanceof RegExp ? opts.ignorePattern : null;
    this.api = {};
    this._watcher = null;
  }
  async init() {
    await this._ensureBase();
    await this._loadAll();
    this._startWatcher();
    return this.api;
  }
  async _ensureBase() {
    await fs.mkdir(this.baseDir, {
      recursive: true,
    });
  }
  _shouldIgnore(rel) {
    if (!rel) return true;
    if (this.ignore.includes(rel)) return true;
    if (this.ignorePattern && this.ignorePattern.test(rel)) return true;
    const b = path.basename(rel);
    if (b.startsWith('.')) return true;
    return false;
  }
  async _loadAll() {
    const entries = await this._walk(this.baseDir);
    for (const file of entries) {
      const rel = path.relative(this.baseDir, file).replace(/\\/g, '/');
      if (!file.endsWith('.js')) continue;
      if (this._shouldIgnore(rel)) continue;
      await this._loadFile(file).catch((err) => {
        if (this.verbose) console.error(`[ApiLoader] failed load ${rel}:`, err?.message || err);
        if (this.onReload)
          this.onReload(err, {
            path: rel,
          });
      });
    }
  }
  async _walk(dir) {
    const files = [];
    let items;
    try {
      items = await fs.readdir(dir, {
        withFileTypes: true,
      });
    } catch (err) {
      if (err.code === 'EACCES' || err.code === 'EMFILE' || err.code === 'EPERM') return files;
      throw err;
    }
    for (const it of items) {
      const full = path.join(dir, it.name);
      try {
        if (it.isSymbolicLink()) continue;
        if (it.isDirectory()) {
          files.push(...(await this._walk(full)));
        } else {
          files.push(full);
        }
      } catch (err) {
        if (err.code === 'EACCES' || err.code === 'EMFILE') continue;
        throw err;
      }
    }
    return files;
  }
  async _loadFile(filePath) {
    const rel = path.relative(this.baseDir, filePath).replace(/\\/g, '/');
    if (this._shouldIgnore(rel)) return;
    const fileUrl = pathToFileURL(path.resolve(filePath)).href + `?update=${Date.now()}`;
    let mod;
    try {
      mod = await import(fileUrl);
    } catch (err) {
      throw err;
    }
    const assignValue = this._unwrapModule(mod);
    const parts = rel.split('/');
    const fileName = parts.pop();
    const baseName = fileName.replace(/\.js$/, '');
    let cursor = this.api;
    for (const p of parts) {
      if (['__proto__', 'constructor', 'prototype'].includes(p)) continue;
      if (!cursor[p]) cursor[p] = {};
      cursor = cursor[p];
    }
    if (['__proto__', 'constructor', 'prototype'].includes(baseName)) return;
    cursor[baseName] = assignValue;
    if (this.onReload)
      this.onReload(null, {
        path: rel,
      });
  }
  _unwrapModule(mod) {
    if (mod == null) return mod;
    const keys = Object.keys(mod);
    if (keys.length === 1 && keys[0] === 'default') return mod.default;
    if (typeof mod.default !== 'undefined' && keys.length === 1) return mod.default;
    return mod;
  }
  close() {
    if (this._watcher) {
      try {
        this._watcher.close();
      } catch {}
      this._watcher = null;
    }
  }
  _startWatcher() {
    if (this._watcher) return;
    this._watcher = chokidar.watch(this.baseDir, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });
    this._watcher.on('add', (fp) => this._onAdd(fp));
    this._watcher.on('change', (fp) => this._onChange(fp));
    this._watcher.on('unlink', (fp) => this._onUnlink(fp));
  }
  async _onAdd(fp) {
    const rel = path.relative(this.baseDir, fp).replace(/\\/g, '/');
    if (this._shouldIgnore(rel) || !fp.endsWith('.js')) return;
    try {
      await this._loadFile(fp);
    } catch (err) {
      if (this.verbose) console.error(`[ApiLoader] add error ${rel}:`, err?.message || err);
      if (this.onReload)
        this.onReload(err, {
          path: rel,
        });
    }
  }
  async _onChange(fp) {
    const rel = path.relative(this.baseDir, fp).replace(/\\/g, '/');
    if (this._shouldIgnore(rel) || !fp.endsWith('.js')) return;
    try {
      await this._loadFile(fp);
    } catch (err) {
      if (this.verbose) console.error(`[ApiLoader] change error ${rel}:`, err?.message || err);
      if (this.onReload)
        this.onReload(err, {
          path: rel,
        });
    }
  }
  _onUnlink(fp) {
    const rel = path.relative(this.baseDir, fp).replace(/\\/g, '/');
    if (this._shouldIgnore(rel) || !fp.endsWith('.js')) return;
    const parts = rel.split('/');
    const fileName = parts.pop();
    const baseName = fileName.replace(/\.js$/, '');
    if (['__proto__', 'constructor', 'prototype'].includes(baseName)) return;
    let cursor = this.api;
    for (const p of parts) {
      if (['__proto__', 'constructor', 'prototype'].includes(p)) continue;
      if (!cursor[p]) return;
      cursor = cursor[p];
    }
    if (cursor && cursor[baseName]) delete cursor[baseName];
    if (this.verbose) console.log(`[ApiLoader] removed ${rel}`);
    if (this.onRemove)
      this.onRemove({
        path: rel,
      });
  }
}

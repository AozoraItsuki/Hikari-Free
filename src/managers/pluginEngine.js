import fs, { existsSync, watch, promises as fsPromises } from 'fs';
import { fileURLToPath } from 'url';
import terminal from '#lib/utils/logger';
import path, { resolve, relative, basename, dirname as pathDirname } from 'path';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import dayjs from 'dayjs';
import config from '#config';
import { plugins } from '../plugins.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginFolder = resolve(__dirname, '../../plugins');
const pluginFilter = (filename) =>
  /\.(js|ts)$/i.test(filename) && !basename(filename).startsWith('.');
const logger = {
  info: (msg) => terminal.log(msg, 'plugins', 'blueBright'),
  warn: (msg) => console.log(msg, 'plugins', 'orange'),
  error: (msg) => console.log(msg, 'plugins', 'redBright'),
};
async function notifyOwner(message, conn) {
  const owners = conn?.botProfile?.owner ?? config.owner;
  if (!conn || !owners) return;
  const notifications = owners
    .filter(([, , isOwner]) => isOwner)
    .map(async ([id]) => {
      try {
        await conn.sendMessage(id + '@s.whatsapp.net', {
          text: message,
        });
      } catch (e) {
        logger.error(`Failed to notify owner ${id}: ${e.message}`);
      }
    });
  await Promise.allSettled(notifications);
}
class PluginManager {
  constructor() {
    this.loadQueue = new Set();
    this.maxConcurrentLoads = 5;
  }
  async getAllPluginFiles(dir) {
    const entries = await fsPromises.readdir(dir, {
      withFileTypes: true,
    });
    const files = await Promise.all(
      entries.map((entry) => {
        const fullPath = path.join(dir, entry.name);
        return entry.isDirectory() ? this.getAllPluginFiles(fullPath) : fullPath;
      })
    );
    return files.flat().filter((file) => pluginFilter(file));
  }
  async loadAll(conn) {
    try {
      const pluginFiles = await this.getAllPluginFiles(pluginFolder);
      let success = 0,
        failed = 0;
      const chunks = this.chunkArray(pluginFiles, this.maxConcurrentLoads);
      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map((filename) => this.loadPlugin(filename, conn))
        );
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') success++;
          else {
            failed++;
            logger.error(`Failed to load ${chunk[index]}: ${result.reason?.message}`);
          }
        });
      }
      const sorted = Object.fromEntries(
        Object.entries(plugins ?? {}).sort(([a], [b]) => a.localeCompare(b))
      );
      Object.keys(plugins).forEach((k) => delete plugins[k]);
      Object.assign(plugins, sorted);
      logger.info(`Loaded ${chalk.green(success)} plugins, ${chalk.red(failed)} failed`);
    } catch (error) {
      logger.error(`Plugin loading failed: ${error.message}`);
    }
  }
  async loadPlugin(filename, conn) {
    if (this.loadQueue.has(filename)) return;
    this.loadQueue.add(filename);
    try {
      const filePath = resolve(filename);
      const name = relative(pluginFolder, filePath).replace(/\\/g, '/');
      const module = await import(`file://${filePath}?update=${Date.now()}`);
      const hasDefault = !!module.default;
      const originalPlugin = hasDefault ? module.default : module;
      let pluginToStore;
      const ext = path.extname(filePath).toLowerCase();
      const format = ext === '.ts' ? 'typescript' : 'javascript';
      if (originalPlugin) {
        const categoryFolder = pathDirname(name);
        const baseCategory =
          categoryFolder === '.' ? 'uncategorized' : categoryFolder.replace(/\\/g, '/');
        let extra = originalPlugin.category;
        if (typeof extra === 'string') extra = [extra];
        if (!Array.isArray(extra)) extra = [];
        const categories = Array.from(new Set([baseCategory, ...extra]));
        const isSystem = name.startsWith('_System/');
        if (isSystem) {
          pluginToStore = {
            ...originalPlugin,
            category: categories,
            format,
          };
        } else {
          const mutable = hasDefault ? originalPlugin : { ...originalPlugin };
          for (const key of Object.keys(mutable)) {
            const value = mutable[key];
            if (typeof value === 'boolean') continue;
            if (typeof value === 'string') mutable[key] = [value];
          }
          mutable.category = categories;
          mutable.format = format;
          pluginToStore = mutable;
        }
        plugins[name] = pluginToStore;
        if (pluginToStore.init && typeof pluginToStore.init === 'function') {
          await pluginToStore.init(conn);
        }
      } else {
        plugins[name] = {
          format,
        };
      }
    } catch (e) {
      logger.error(`Error loading plugin '${filename}': ${e.message}`);
      delete plugins[filename];
      const silentErrors = [
        'object is not extensible',
        'Cannot add property',
        'read only property',
      ];
      if (conn && !silentErrors.some((x) => e.message?.toLowerCase().includes(x.toLowerCase()))) {
        await notifyOwner(`❌ Plugin error *${filename}*:\n${e.message}`, conn);
      }
      throw e;
    } finally {
      this.loadQueue.delete(filename);
    }
  }
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
export async function reload(_ev, filePath, conn) {
  if (!filePath || !pluginFilter(filePath)) return;
  const exists = existsSync(filePath);
  const name = relative(pluginFolder, filePath).replace(/\\/g, '/');
  if (name in plugins && !exists) {
    logger.warn(`Deleted plugin: ${name}`);
    delete plugins[name];
    return;
  }
  const action = name in plugins ? 'Reloading' : 'Loading new';
  logger.info(`${action} plugin: ${name}`);
  try {
    if (exists) {
      const fileContent = await fsPromises.readFile(filePath, 'utf8');
      const syntaxErr = syntaxerror(fileContent, filePath, {
        sourceType: 'module',
        allowAwaitOutsideFunction: true,
      });
      if (syntaxErr) {
        logger.error(`Syntax error in '${name}': ${syntaxErr.message}`);
        if (conn) await notifyOwner(`❌ Syntax error in *${name}*:\n${syntaxErr}`, conn);
        return;
      }
      await pluginManager.loadPlugin(filePath, conn);
    }
  } catch (error) {
    logger.error(`Failed to reload plugin '${name}': ${error.message}`);
  }
}
class FileWatcher {
  constructor(directory) {
    this.directory = directory;
    this.watcher = null;
    this.debounceMap = new Map();
    this.debounceDelay = 1500;
  }
  start(conn) {
    try {
      this.watcher = watch(
        this.directory,
        {
          recursive: true,
        },
        (event, filename) => {
          if (!filename) return;
          const fullPath = path.join(this.directory, filename);
          if (this.debounceMap.has(filename)) clearTimeout(this.debounceMap.get(filename));
          const timeout = setTimeout(() => {
            reload(event, fullPath, conn);
            this.debounceMap.delete(filename);
          }, this.debounceDelay);
          this.debounceMap.set(filename, timeout);
        }
      );
      logger.info(`📁 Watching ${this.directory} for changes`);
    } catch (error) {
      logger.error(`Failed to watch directory ${this.directory}: ${error.message}`);
    }
  }
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.debounceMap.forEach((timeout) => clearTimeout(timeout));
      this.debounceMap.clear();
      logger.info(`📁 Stopped watching ${this.directory}`);
    }
  }
}
export const pluginManager = new PluginManager();
export const fileWatcher = new FileWatcher(pluginFolder);

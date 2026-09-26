import { watch, existsSync, promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import syntaxerror from 'syntax-error';
import terminal from '#lib/utils/logger';
import { createSocketContext } from './context.js';
import { applyOverrides } from './overrides.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const socketFilter = (filename) =>
  /\.js$/i.test(filename) &&
  !path.basename(filename).startsWith('.') &&
  ![
    'index.js',
    'context.js',
    'overrides.js',
    'builders.js',
    'blocks.js',
    'nativeflow.js',
    'errors.js',
  ].includes(path.basename(filename));
const live = new Map();
let factories = {};
let watching = false;
let debounceTimer = null;
export { createSocketContext };
export async function loadSocketModules() {
  const files = (await fsp.readdir(__dirname)).filter(socketFilter).sort();
  const next = {};
  for (const file of files) {
    const fullPath = path.join(__dirname, file);
    try {
      const mod = await import(pathToFileURL(fullPath).href + `?update=${Date.now()}`);
      if (typeof mod.default !== 'function') continue;
      next[file.replace(/\.js$/i, '')] = mod.default;
    } catch (e) {
      terminal.log(`Failed to load ${file}: ${e.message}`, 'socket', 'redBright');
    }
  }
  factories = next;
  return factories;
}
function buildDescriptors(ctx) {
  const descriptors = {};
  for (const factory of Object.values(factories)) {
    Object.assign(descriptors, factory(ctx));
  }
  for (const key of Object.keys(descriptors)) {
    descriptors[key].configurable = true;
  }
  return descriptors;
}
export function attachSocket(conn, ctx) {
  Object.defineProperties(conn, buildDescriptors(ctx));
  applyOverrides(conn, ctx);
  live.set(conn, ctx);
  return conn;
}
export function detachSocket(conn) {
  live.delete(conn);
}
async function reloadAll() {
  try {
    await loadSocketModules();
  } catch (e) {
    terminal.log(`Socket reload failed: ${e.message}`, 'socket', 'redBright');
    return;
  }
  for (const [conn, ctx] of live) {
    try {
      Object.defineProperties(conn, buildDescriptors(ctx));
      applyOverrides(conn, ctx);
    } catch (e) {
      live.delete(conn);
      terminal.log(`Detached dead socket: ${e.message}`, 'socket', 'yellow');
    }
  }
  terminal.log('Socket modules hot-reloaded', 'socket', 'cyan');
}
export function startSocketWatcher() {
  if (watching) return;
  watching = true;
  try {
    watch(
      __dirname,
      {
        recursive: false,
      },
      (_event, filename) => {
        if (!filename || !socketFilter(filename)) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const fullPath = path.join(__dirname, filename);
          if (!existsSync(fullPath)) return;
          try {
            const src = await fsp.readFile(fullPath, 'utf8');
            const err = syntaxerror(src, fullPath, {
              sourceType: 'module',
            });
            if (err) {
              terminal.log(
                `Syntax error in socket/${filename}: ${err.message}`,
                'socket',
                'redBright'
              );
              return;
            }
            terminal.log(`Reloading socket/${filename}...`, 'socket', 'blueBright');
            await reloadAll();
          } catch (e) {
            terminal.log(`Socket watch error: ${e.message}`, 'socket', 'redBright');
          }
        }, 1500);
      }
    );
    terminal.log(`Watching ${__dirname} for changes`, 'socket', 'blueBright');
  } catch (e) {
    terminal.log(`Failed to watch socket dir: ${e.message}`, 'socket', 'redBright');
  }
}

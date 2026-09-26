import fs from 'fs';
const CONFIG_FILE = './config.json';
const EXAMPLE_FILE = './example.config.json';
syncMissingConfigKeys();
let config = load() ?? {};
function load() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE));
  } catch (e) {
    console.error('Failed to load config:', e.message);
    return null;
  }
}
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}
function collectMissing(target, source, path = '') {
  const added = [];
  for (const [k, v] of Object.entries(source)) {
    const keyPath = path ? `${path}.${k}` : k;
    if (!(k in target)) {
      target[k] = clone(v);
      added.push(keyPath);
    } else if (isPlainObject(v) && isPlainObject(target[k])) {
      added.push(...collectMissing(target[k], v, keyPath));
    }
  }
  return added;
}
function reorderKeys(obj, template) {
  if (!isPlainObject(obj) || !isPlainObject(template)) return obj;
  const out = {};
  for (const k of Object.keys(template)) {
    if (k in obj) {
      out[k] =
        isPlainObject(obj[k]) && isPlainObject(template[k])
          ? reorderKeys(obj[k], template[k])
          : obj[k];
    }
  }
  for (const k of Object.keys(obj)) {
    if (!(k in out)) out[k] = obj[k];
  }
  return out;
}
function syncMissingConfigKeys() {
  let example;
  try {
    example = JSON.parse(fs.readFileSync(EXAMPLE_FILE));
  } catch {
    return;
  }
  let current;
  try {
    current = JSON.parse(fs.readFileSync(CONFIG_FILE));
  } catch {
    return;
  }
  const added = collectMissing(current, example);
  if (added.length === 0) return;
  const reordered = reorderKeys(current, example);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(reordered, null, 2) + '\n');
  console.log(`Config: added missing keys from example.config.json: ${added.join(', ')}`);
}
let reloadTimer;
const watcher = fs.watch(
  CONFIG_FILE,
  {
    persistent: true,
  },
  (event) => {
    if (event !== 'change') return;
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      const newConfig = load();
      if (!newConfig) return;
      for (const key of Object.keys(config)) {
        delete config[key];
      }
      Object.assign(config, newConfig);
      console.log('Config reloaded');
    }, 5000);
  }
);
watcher.on('error', (err) => {
  console.error('Config watcher error:', err.message);
});
export function closeConfigWatcher() {
  if (reloadTimer) clearTimeout(reloadTimer);
  watcher.close();
}
const KEEP_SUBTREES = new Set(['media', 'optionFlags', 'source', 'githubAssets']);
const KEEP_STRINGS = new Set(['currency', 'mode']);
function blankSecrets(value, key = '') {
  if (typeof value === 'string') {
    if (KEEP_STRINGS.has(key)) return value;
    return '';
  }
  if (Array.isArray(value)) return value.map((v) => blankSecrets(v, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = KEEP_SUBTREES.has(k) ? v : blankSecrets(v, k);
    }
    return out;
  }
  return value;
}
export function buildExampleConfig() {
  let template;
  try {
    template = JSON.parse(fs.readFileSync(EXAMPLE_FILE));
  } catch {
    template = null;
  }
  const current = load() ?? {};
  const result = reorderKeys(current, template);
  return template ? blankSecrets(result) : blankSecrets(current);
}
export function writeExampleConfig(target = EXAMPLE_FILE) {
  fs.writeFileSync(target, JSON.stringify(buildExampleConfig(), null, 2) + '\n');
  return target;
}
function replaceConfigValue(raw, key, value) {
  const label = `"${key}"`;
  const start = raw.indexOf(label);
  if (start === -1) throw new Error(`Config key "${key}" not found in file`);
  const colon = raw.indexOf(':', start + label.length);
  let head = colon + 1;
  while (head < raw.length && /\s/.test(raw[head])) head++;
  let depth = 0;
  let inString = false;
  let i = head;
  while (i < raw.length) {
    const ch = raw[i];
    if (inString) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
    i++;
  }
  if (depth !== 0) throw new Error(`Value "${key}" is not closed properly`);
  return raw.slice(0, head) + JSON.stringify(value) + raw.slice(i);
}
export function saveConfigKey(key = '', value) {
  if (!(key in config)) throw new Error(`Config key "${key}" not found`);
  config[key] = value;
  const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
  fs.writeFileSync(CONFIG_FILE, replaceConfigValue(raw, key, value));
}
export default config;

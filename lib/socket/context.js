import fs from 'fs';
import fsp from 'fs/promises';
import chalk from 'chalk';
import { PATH as locate } from '#lib/utils/helper';
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000;
  }
  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, {
      value,
      expire: Date.now() + ttl,
    });
    if (this.cache.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.cache) {
        if (v.expire < now) this.cache.delete(k);
      }
    }
    if (this.cache.size > 500) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expire) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
  delete(key) {
    this.cache.delete(key);
  }
  clear() {
    this.cache.clear();
  }
}
class RateLimiter {
  constructor(maxCalls = 10, timeWindow = 1000) {
    this.maxCalls = maxCalls;
    this.timeWindow = timeWindow;
    this.calls = new Map();
  }
  async throttle(key) {
    const now = Date.now();
    const callTimes = this.calls.get(key) || [];
    const recentCalls = callTimes.filter((time) => now - time < this.timeWindow);
    if (recentCalls.length >= this.maxCalls) {
      const oldestCall = recentCalls[0];
      const waitTime = this.timeWindow - (now - oldestCall);
      await new Promise((resolve) => setTimeout(resolve, waitTime + 100));
      return this.throttle(key);
    }
    recentCalls.push(now);
    this.calls.set(key, recentCalls);
    if (this.calls.size > 100) {
      const entries = Array.from(this.calls.entries());
      entries.slice(0, 50).forEach(([k]) => this.calls.delete(k));
    }
  }
}
class OperationQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }
  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        resolve,
        reject,
      });
      this.process();
    });
  }
  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const { fn, resolve, reject } = this.queue.shift();
    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.processing = false;
      this.process();
    }
  }
}
const isValidUrl = (str) => /^https?:\/\//.test(str);
const isBase64DataUri = (str) => /^data:.*?\/.*?;base64,/i.test(str);
const isValidPath = (str) => typeof str === 'string' && fs.existsSync(str);
const colors = {
  info: {
    label: chalk.bold.bgRgb(51, 204, 51)(' INFO '),
    text: chalk.cyan,
  },
  error: {
    label: chalk.bold.bgRgb(247, 38, 33)(' ERROR '),
    text: chalk.rgb(255, 38, 0),
  },
  warn: {
    label: chalk.bold.bgRgb(255, 153, 0)(' WARN '),
    text: chalk.yellowBright,
  },
  trace: {
    label: chalk.grey(' TRACE '),
    text: chalk.white,
  },
  debug: {
    label: chalk.bold.bgRgb(66, 167, 245)(' DEBUG '),
    text: chalk.white,
  },
};
function timestamp() {
  return chalk.white(`[${new Date().toUTCString()}]`);
}
const ensureTmpDir = async () => {
  try {
    await fsp.mkdir(locate.tmp, {
      recursive: true,
    });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.warn('Failed to create tmp directory:', error.message);
    }
  }
};
function getEphemeralSetting(conn, jid) {
  return (
    conn.chats[jid]?.metadata?.ephemeralDuration || conn.chats[jid]?.ephemeralDuration || 604.8
  );
}
export function createSocketContext(conn, options = {}) {
  const botdate = new Date().toLocaleString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return {
    conn,
    options,
    cache: new CacheManager(),
    rateLimiter: new RateLimiter(8, 1000),
    groupMetaQueue: new OperationQueue(),
    smsg: null,
    MAX_FILE_SIZE: 64 * 1024,
    DEFAULT_MIME: 'application/octet-stream',
    DEFAULT_EXT: '.bin',
    isValidUrl,
    isBase64DataUri,
    isValidPath,
    colors,
    timestamp,
    ensureTmpDir,
    getEphemeralSetting,
    botdate,
  };
}
export { CacheManager, RateLimiter, OperationQueue };
export const nameCache = new Map();
export const groupMetaCache = new Map();
export const bizProfileCache = new Map();
export function isPnUser(id) {
  if (id.endsWith('@s.whatsapp.net')) {
    return true;
  } else {
    return false;
  }
}
export function isLidUser(id) {
  if (id.endsWith('@lid')) {
    return true;
  } else {
    return false;
  }
}
export function isJidNewsletter(id) {
  if (id.endsWith('@newsletter')) {
    return true;
  } else {
    return false;
  }
}
export function nullish(args) {
  return !(args !== null && args !== undefined);
}
export function mapPrefixToLocation(number) {
  const code = number.startsWith('0') ? '' : number.replace(/[^0-9]/g, '');
  const pick = (addr, lat, lng) => ({
    address: addr,
    lat,
    lng,
  });
  if (code.startsWith('62')) return pick('Indonesia', -6.2, 106.8167);
  if (code.startsWith('60')) return pick('Malaysia', 3.139, 101.6869);
  if (code.startsWith('65')) return pick('Singapore', 1.3521, 103.8198);
  if (code.startsWith('63')) return pick('Philippines', 14.5995, 120.9842);
  if (code.startsWith('66')) return pick('Thailand', 13.7563, 100.5018);
  if (code.startsWith('84')) return pick('Vietnam', 21.0278, 105.8342);
  if (code.startsWith('81')) return pick('Japan', 35.6895, 139.6917);
  if (code.startsWith('82')) return pick('South Korea', 37.5665, 126.978);
  if (code.startsWith('86')) return pick('China', 39.9042, 116.4074);
  if (code.startsWith('91')) return pick('India', 28.6139, 77.209);
  if (code.startsWith('92')) return pick('Pakistan', 24.8607, 67.0011);
  return pick('Unknown', 0, 0);
}
export function escapeVCardText(text = '') {
  return text
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/:/g, '\\:')
    .replace(/\r/g, '');
}
export function foldLine(text = '') {
  return text.length > 75 ? text.match(/.{1,75}/g).join('\r\n ') : text;
}

import fs from 'fs';
import fsp from 'fs/promises';
import { initAuthCreds, BufferJSON } from 'baileys';

const FLUSH_TIMEOUT_MS = 3000;

const createMutex = () => {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };
};

export const useSingleFileAuthState = async (fileName) => {
  const cache = new Map();
  const mutex = createMutex();
  let fileData = {};
  let isLoaded = false;
  let flushTimeout = null;

  const loadKey = async () =>
    mutex(async () => {
      if (isLoaded) return;
      try {
        const data = JSON.parse(await fsp.readFile(fileName, 'utf-8'), BufferJSON.reviver);
        fileData = data || {};
        for (const [keyName, value] of Object.entries(fileData)) cache.set(keyName, value);
      } catch {
        fileData = {};
      }
      isLoaded = true;
    });

  const flushKey = () => {
    if (flushTimeout) return;
    flushTimeout = setTimeout(async () => {
      flushTimeout = null;
      await mutex(async () => {
        try {
          const tempFile = fileName + '.temp';
          await fsp.writeFile(tempFile, JSON.stringify(fileData, BufferJSON.replacer));
          await fsp.rename(tempFile, fileName);
        } catch {}
      });
    }, FLUSH_TIMEOUT_MS);
  };

  const writeKey = (keyName, value) => {
    cache.set(keyName, value);
    fileData[keyName] = value;
    flushKey();
  };

  const removeKey = (keyName) => {
    cache.delete(keyName);
    delete fileData[keyName];
    flushKey();
  };

  const fileInfo = await fsp.stat(fileName).catch(() => null);
  if (!fileInfo) {
    await fsp.writeFile(fileName, '{}');
  } else if (!fileInfo.isFile()) {
    throw new Error(`found something that is not a file at ${fileName}`);
  }
  await loadKey();
  const creds = fileData.creds || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => {
          const data = {};
          for (const id of ids) {
            const keyName = type + id;
            let value = cache.get(keyName);
            if (value === undefined && fileData[keyName] !== undefined) {
              value = fileData[keyName];
              cache.set(keyName, value);
            }
            data[id] = value;
          }
          return data;
        },
        set: (data) => {
          for (const category in data) {
            for (const id in data[category]) {
              const keyName = category + id;
              const value = data[category][id];
              if (value) writeKey(keyName, value);
              else removeKey(keyName);
            }
          }
        },
      },
    },
    saveCreds: () => writeKey('creds', creds),
  };
};

export const clearSingleFileAuthState = async (fileName) => {
  try {
    await fsp.unlink(fileName);
  } catch {}
  try {
    await fsp.unlink(fileName + '.temp');
  } catch {}
};

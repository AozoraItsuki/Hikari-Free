import fs from 'fs';
import path from 'path';
import { hkNet } from './network.js';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import config from '#config';
const execAsync = promisify(exec);
const ROOT = process.cwd();
const BIN_DIR = path.join(ROOT, 'src', 'bin');
const SPEEDTEST_URL =
  'https://github.com/SoranoHoshi1/Speedtest/releases/download/Speedtest/speedtest';
export function isTermux() {
  if (process.platform === 'android') return true;
  if ((process.env.PREFIX || '').includes('com.termux')) return true;
  try {
    return fs.existsSync('/data/data/com.termux/files/usr');
  } catch {
    return false;
  }
}
const downloadFile = async (url, outputPath) => {
  const response = await hkNet.request({
    method: 'GET',
    url,
    responseType: 'stream',
    timeout: 30000,
  });
  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
    response.data.on('error', reject);
  });
};
async function hasSystemBinary(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9_.\/-]+$/.test(name)) return false;
  try {
    await execAsync(`command -v ${name}`);
    return true;
  } catch {
    return false;
  }
}
export async function setupCACert() {
  const certDir = path.join(ROOT, 'certs');
  const caPath = path.join(certDir, 'cacert.pem');
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, {
      recursive: true,
    });
  }
  if (!fs.existsSync(caPath)) {
    if (config.binaries?.install?.cacert === false) return;
    await downloadFile('https://curl.se/ca/cacert.pem', caPath);
  }
  process.env.SSL_CERT_FILE = caPath;
  process.env.REQUESTS_CA_BUNDLE = caPath;
  process.env.NODE_EXTRA_CA_CERTS = caPath;
}
function isExecutableFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile() && (stats.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}
function systemBinaryPath(command) {
  try {
    const out = execSync(`command -v ${command}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
      .split('\n')[0];
    return out && isExecutableFile(out) ? out : null;
  } catch {
    return null;
  }
}
const binaryCache = new Map();
export function resolveBinary(name) {
  if (binaryCache.has(name)) return binaryCache.get(name);
  const cfg = config.binaries || {};
  const custom = cfg.paths?.[name];
  let resolved = null;
  if (custom) {
    resolved = isExecutableFile(custom) ? custom : null;
  } else {
    const bundled = path.join(BIN_DIR, name);
    resolved = isExecutableFile(bundled) ? bundled : systemBinaryPath(name);
  }
  binaryCache.set(name, resolved);
  return resolved;
}
export function clearBinaryCache() {
  binaryCache.clear();
}
export const downloadUtils = async () => {
  const binCfg = config.binaries || {};
  if (binCfg.autoInstall === false) {
    console.log('[Download] binaries.autoInstall disabled, skipping');
    return;
  }
  if (binCfg.install?.speedtest === false) {
    console.log('[Download] speedtest install disabled, skipping');
    return;
  }
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, {
      recursive: true,
    });
  }
  const finalPath = path.join(BIN_DIR, 'speedtest');
  if (fs.existsSync(finalPath)) return;
  if (await hasSystemBinary('speedtest')) return;
  console.log('[Download] speedtest');
  await downloadFile(SPEEDTEST_URL, finalPath);
  fs.chmodSync(finalPath, 0o755);
};

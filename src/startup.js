import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { execSync } from 'child_process';
import { setupCACert, downloadUtils, isTermux, resolveBinary } from '#lib/utils/installer';
import config from '#config';
import net from 'net';
import chalk from 'chalk';
const ROOT = process.cwd();
const BIN_DIR = path.join(ROOT, 'src', 'bin');
const PYTHON_DIR = path.join(BIN_DIR, 'python');
const PYTHON_BIN = path.join(PYTHON_DIR, 'bin');
const PYTHON_EXE = path.join(PYTHON_BIN, 'python3');
const ARCHIVE_EXT = ['.zip', '.tar', '.gz', '.tgz', '.tar.gz', '.rar', '.7z'];
let torProcess = null;
let torReady = false;
async function isPortOpen(port, host = '127.0.0.1', timeout = 1000) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    s.setTimeout(timeout);
    s.once('connect', () => {
      done = true;
      s.destroy();
      resolve(true);
    });
    s.once('timeout', () => {
      if (!done) {
        done = true;
        s.destroy();
        resolve(false);
      }
    });
    s.once('error', () => {
      if (!done) {
        done = true;
        s.destroy();
        resolve(false);
      }
    });
    s.connect(port, host);
  });
}
export async function startTor() {
  if (!config.proxy.useTor) return;
  const already = await isPortOpen(config.proxy.port);
  if (already) {
    console.log(chalk.yellow(`⚡ Tor is already running on port ${config.proxy.port}`));
    torReady = true;
    return true;
  }
  if (!fs.existsSync(config.proxy.DataDir))
    fs.mkdirSync(config.proxy.DataDir, {
      recursive: true,
    });
  const torBinary = 'tor';
  const args = [
    '--SocksPort',
    String(config.proxy.port),
    '--DataDirectory',
    config.proxy.DataDir,
    '--Log',
    'notice file ' + config.proxy.LogFile,
    '--quiet',
  ];
  torProcess = spawn(torBinary, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      LD_LIBRARY_PATH: path.join(ROOT, 'src', 'bin', 'tor'),
    },
  });
  let attempts = 0;
  const maxAttempts = 12;
  while (attempts < maxAttempts) {
    attempts++;
    await new Promise((r) => setTimeout(r, 1000));
    const ok = await isPortOpen(config.proxy.port);
    if (ok) {
      console.log(chalk.green(`🔒 Tor is active on port ${config.proxy.port}`));
      torReady = true;
      return true;
    }
  }
  console.log(chalk.red('❌ Tor failed to start'));
  return false;
}
export function stopTor() {
  if (torProcess) {
    try {
      torProcess.kill('SIGTERM');
    } catch {}
    torProcess = null;
    torReady = false;
    console.log('🔒 Tor stopped');
  }
}
export function torReadyStatus() {
  return torReady;
}
function which(cmd) {
  try {
    return execSync(`command -v ${cmd}`).toString().trim();
  } catch {
    return null;
  }
}
async function cleanJunk(dir) {
  let entries;
  try {
    entries = await fsp.readdir(dir, {
      withFileTypes: true,
    });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      if (entry.name === '.cache' || entry.name === '.npm' || entry.name === 'debug') {
        try {
          await fsp.rm(fullPath, {
            recursive: true,
            force: true,
          });
        } catch {}
        continue;
      }
      await cleanJunk(fullPath);
      continue;
    }
    if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (ARCHIVE_EXT.some((ext) => lower.endsWith(ext))) {
        try {
          await fsp.rm(fullPath, {
            force: true,
          });
        } catch {}
      }
    }
  }
}
async function addBinToPath() {
  const pathDirs = [];
  if (fs.existsSync(BIN_DIR)) {
    pathDirs.push(BIN_DIR);
    const entries = await fsp.readdir(BIN_DIR, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const p = path.join(BIN_DIR, entry.name);
      if (entry.isDirectory() && entry.name === 'python') {
        const binPath = path.join(p, 'bin');
        if (fs.existsSync(binPath)) {
          pathDirs.push(binPath);
          const files = await fsp.readdir(binPath);
          await Promise.all(
            files.map(async (f) => {
              const fp = path.join(binPath, f);
              try {
                if ((await fsp.stat(fp)).isFile()) {
                  await fsp.chmod(fp, 0o755);
                }
              } catch {}
            })
          );
        }
      }
      if (entry.isDirectory() && entry.name === 'tor') {
        pathDirs.push(p);
        try {
          await fsp.chmod(path.join(p, 'tor'), 0o755);
        } catch {}
      }
      if (entry.isFile()) {
        try {
          await fsp.chmod(p, 0o755);
        } catch {}
      }
    }
  }
  process.env.PATH = [...pathDirs, process.env.PATH || ''].join(path.delimiter);
}
function getPythonExe() {
  return resolveBinary('python') ?? (fs.existsSync(PYTHON_EXE) ? PYTHON_EXE : null);
}
async function ensurePip() {
  const exe = getPythonExe();
  if (!exe) {
    if (isTermux()) {
      console.log(
        chalk.yellow('⚠️  python3 not found, restart npm start so the bundle gets downloaded')
      );
      return false;
    }
    throw new Error('Python binary not found');
  }
  if (exe !== PYTHON_EXE) return true;
  process.env.PYTHONHOME = PYTHON_DIR;
  process.env.PYTHONPATH = '';
  const moduleWorks = (args) =>
    new Promise((resolve) => {
      const p = spawn(exe, args, {
        stdio: 'ignore',
        env: process.env,
      });
      p.on('error', () => resolve(false));
      p.on('exit', (code) => resolve(code === 0));
    });
  if (await moduleWorks(['-m', 'pip', '--version'])) return true;
  await moduleWorks(['-m', 'ensurepip', '--upgrade']);
  return true;
}
async function installPipPackages(packages = []) {
  if (!packages.length) return;
  const exe = getPythonExe();
  if (!exe) {
    console.log(chalk.yellow('⚠️  skipping pip package installs (python not found)'));
    return;
  }
  if (
    exe === PYTHON_EXE &&
    fs.existsSync(path.join(PYTHON_BIN, 'yt-dlp')) &&
    fs.existsSync(path.join(PYTHON_BIN, 'gallery-dl'))
  ) {
    return;
  }
  const runPip = (cmdExe, extraArgs = []) =>
    new Promise((resolve) => {
      const p = spawn(
        cmdExe,
        ['-m', 'pip', 'install', '--upgrade', '--quiet', ...extraArgs, ...packages],
        {
          stdio: ['ignore', 'ignore', 'pipe'],
          env: process.env,
        }
      );
      p.stderr.on('data', () => {});
      p.on('error', () => resolve(false));
      p.on('exit', (code) => resolve(code === 0));
    });
  const writeLauncher = (binName, moduleName) => {
    const launcher = path.join(PYTHON_BIN, binName);
    const content = [
      '#!/bin/sh',
      'DIR="$(dirname "$(readlink -f "$0")")"',
      'SYS="$(command -v python3 || true)"',
      'if [ -n "$SYS" ] && [ "$SYS" != "$DIR/python3" ]; then',
      '  unset PYTHONHOME',
      '  PYTHONPATH="$DIR/../lib/python3.10/site-packages${PYTHONPATH:+:$PYTHONPATH}"',
      '  export PYTHONPATH',
      `  exec "$SYS" -m ${moduleName} "$@"`,
      'fi',
      `exec "$DIR/python3" -m ${moduleName} "$@"`,
      '',
    ].join('\n');
    try {
      fs.writeFileSync(launcher, content);
      fs.chmodSync(launcher, 0o755);
    } catch {}
  };
  if (await runPip(exe, ['--timeout', '10', '--retries', '0', '--no-cache-dir'])) {
    writeLauncher('yt-dlp', 'yt_dlp');
    writeLauncher('gallery-dl', 'gallery_dl');
    return;
  }
  if (exe !== PYTHON_EXE) return;
  const systemPy = which('python3') || which('python');
  if (systemPy && systemPy !== PYTHON_EXE) {
    const siteTarget = path.join(PYTHON_DIR, 'lib', 'python3.10', 'site-packages');
    const ok = await new Promise((resolve) => {
      const p = spawn(
        systemPy,
        ['-m', 'pip', 'install', '--upgrade', '--quiet', '--target', siteTarget, ...packages],
        {
          stdio: ['ignore', 'ignore', 'pipe'],
          env: process.env,
        }
      );
      p.stderr.on('data', () => {});
      p.on('error', () => resolve(false));
      p.on('exit', (code) => resolve(code === 0));
    });
    if (!ok) {
      console.log(
        chalk.yellow('⚠️  pip bundle install failed (DNS/network issue?), using system python')
      );
    } else {
      writeLauncher('yt-dlp', 'yt_dlp');
      writeLauncher('gallery-dl', 'gallery_dl');
    }
  } else {
    console.log(
      chalk.yellow('⚠️  pip install to bundle failed, no system python fallback available')
    );
  }
}
async function linkBinaries(pairs = []) {
  for (const [from, to] of pairs) {
    try {
      if (!from || !to) continue;
      const src = path.isAbsolute(from) ? from : path.join(ROOT, from);
      const dest = path.isAbsolute(to) ? to : path.join(ROOT, to);
      if (!fs.existsSync(src)) continue;
      if (fs.existsSync(dest)) continue;
      await fsp.mkdir(path.dirname(dest), {
        recursive: true,
      });
      await fsp.symlink(src, dest);
      await fsp.chmod(dest, 0o755);
    } catch {}
  }
}
export async function startup() {
  const directories = [
    path.join(process.cwd(), 'tmp'),
    path.join(process.cwd(), 'sessions'),
    path.join(process.cwd(), 'src'),
    path.join(process.cwd(), 'src/bin'),
    path.join(process.cwd(), 'src/font'),
    path.join(process.cwd(), 'src/json'),
  ];
  await Promise.all(
    directories.map(async (dir) => {
      if (!fs.existsSync(dir)) {
        await fsp.mkdir(dir, {
          recursive: true,
        });
      }
    })
  );
  await setupCACert();
  await downloadUtils();
  await linkBinaries([
    [which('ffmpeg'), 'src/bin/ffmpeg'],
    [which('ffprobe'), 'src/bin/ffprobe'],
  ]);
  await addBinToPath();
  await cleanJunk(ROOT);
  await startTor();
}

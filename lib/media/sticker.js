import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { fileTypeFromBuffer } from 'file-type';
import webp from 'node-webpmux';
import { PATH } from '../utils/helper.js';
import { hkNet } from '../utils/network.js';
import config from '#config';
import { resolveBinary } from '#lib/utils/installer';
const ffmpegPath = resolveBinary('ffmpeg') ?? 'ffmpeg';
const ffprobePath = resolveBinary('ffprobe') ?? 'ffprobe';
const DEFAULT_CONFIG = {
  pack: config.stickpack,
  author: config.stickauth,
  categories: ['😀'],
  fps: 10,
  quality: 40,
  animatedMaxSize: 500000,
  staticMaxSize: 300000,
  maxSize: 5000000,
};
const SUPPORTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/avi',
  'video/mov',
  'video/webm',
];
async function fetchFromUrl(url) {
  try {
    const res = await hkNet.get(url, {
      headers: {
        'User-Agent': 'StickerBot/1.0',
      },
      timeout: 10000,
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(res.data);
    if (buffer.length === 0) throw new Error('Empty response');
    if (buffer.length > DEFAULT_CONFIG.maxSize) throw new Error('File too large');
    return buffer;
  } catch (error) {
    if (error.code === 'ERR_CANCELED' || error.name === 'AbortError')
      throw new Error('Request timeout');
    throw error;
  }
}
async function validateInput(input) {
  let buffer;
  if (typeof input === 'string') {
    if (input.startsWith('http')) buffer = await fetchFromUrl(input);
    else buffer = await fs.promises.readFile(input);
  } else if (Buffer.isBuffer(input)) buffer = input;
  else throw new Error('Invalid input type');
  if (!buffer?.length) throw new Error('Empty input');
  if (buffer.length > DEFAULT_CONFIG.maxSize) throw new Error('File too large');
  const fileType = await fileTypeFromBuffer(buffer);
  if (!fileType || !SUPPORTED_TYPES.includes(fileType.mime))
    throw new Error(`Unsupported type: ${fileType?.mime}`);
  return {
    buffer,
    fileType,
  };
}
function runFfmpeg(args) {
  const outFile = path.join(PATH.tmp, `${crypto.randomUUID()}.webp`);
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [...args, '-y', '-f', 'webp', outFile]);
    let stderr = '';
    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('FFmpeg timeout'));
    }, 30000);
    proc.stderr.on('data', (c) => {
      stderr += c.toString();
    });
    proc.on('close', async (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      try {
        const result = await fs.promises.readFile(outFile);
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        await fs.promises.unlink(outFile).catch(() => {});
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Spawn error: ${err.message}`));
    });
  });
}
function probeFps(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(ffprobePath, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=r_frame_rate',
      '-of',
      'csv=p=0',
      filePath,
    ]);
    let stdout = '';
    proc.stdout.on('data', (c) => {
      stdout += c.toString();
    });
    proc.on('close', () => {
      const match = stdout.trim().match(/(\d+)\/(\d+)/);
      if (match) {
        resolve(Math.round(parseInt(match[1]) / parseInt(match[2])));
      } else {
        resolve(10);
      }
    });
    proc.on('error', () => resolve(10));
  });
}
async function convertToWebp(buffer, fileType, settings) {
  if (fileType.mime === 'image/webp') return buffer;
  const inputExt = fileType.ext || 'bin';
  const tmpFile = path.join(PATH.tmp, `${crypto.randomUUID()}.${inputExt}`);
  try {
    await fs.promises.mkdir(PATH.tmp, {
      recursive: true,
    });
    await fs.promises.writeFile(tmpFile, buffer);
    const isAnimated = fileType.mime.startsWith('video/') || fileType.mime === 'image/gif';
    const hasAlpha = fileType.mime === 'image/png' || fileType.mime === 'image/gif';
    const pixFmt = hasAlpha ? 'yuva420p' : 'yuv420p';
    const scaleFilter =
      'scale=min(512\\,iw):min(512\\,ih):flags=lanczos:force_original_aspect_ratio=decrease';
    if (isAnimated) {
      const maxSize = settings.animatedMaxSize ?? DEFAULT_CONFIG.animatedMaxSize;
      const rawQuality = settings.quality ?? DEFAULT_CONFIG.quality;
      const rawFps = settings.fps ?? DEFAULT_CONFIG.fps;
      const useOriginalFps = rawFps === 0;
      const fps = useOriginalFps ? await probeFps(tmpFile) : rawFps;
      let lastResult = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const q = rawQuality === 0 ? 0 : Math.max(rawQuality - attempt * 15, 10);
        const f = Math.max(fps - (useOriginalFps ? 0 : attempt * 2), 5);
        const vf =
          rawQuality === 0
            ? `${scaleFilter},format=rgba,pad=ceil(iw/2)*2:ceil(ih/2)*2:0:0:color=white@0,setsar=1,fps=${f}`
            : `${scaleFilter},format=rgba,pad=ceil(iw/2)*2:ceil(ih/2)*2:0:0:color=white@0,setsar=1,fps=${f}`;
        const args = [
          '-i',
          tmpFile,
          '-vf',
          vf,
          '-vcodec',
          'libwebp',
          '-pix_fmt',
          'yuva420p',
          '-loop',
          '0',
          '-t',
          '5',
        ];
        if (q > 0) args.push('-quality', String(q));
        args.push('-compression_level', '6', '-method', '6', '-an', '-vsync', '0');
        const result = await runFfmpeg(args);
        lastResult = result;
        if (maxSize > 0 && result.length <= maxSize) return result;
      }
      return lastResult;
    }
    const rawQuality = settings.quality ?? DEFAULT_CONFIG.quality;
    const maxSize = settings.staticMaxSize ?? DEFAULT_CONFIG.staticMaxSize;
    const keepOriginal = rawQuality === 0;
    let lastResult = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const q = keepOriginal ? 0 : Math.max(rawQuality - attempt * 10, 15);
      const vf = keepOriginal ? undefined : `${scaleFilter},setsar=1`;
      const args = ['-i', tmpFile, '-vcodec', 'libwebp', '-pix_fmt', pixFmt];
      if (vf) args.push('-vf', vf);
      if (q > 0) args.push('-quality', String(q));
      args.push('-preset', 'default', '-an');
      const result = await runFfmpeg(args);
      lastResult = result;
      if (maxSize > 0 && result.length <= maxSize) return result;
    }
    return lastResult;
  } finally {
    await fs.promises.unlink(tmpFile).catch(() => {});
  }
}
function pick(obj, key, fallback) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : fallback;
}
async function addMetadata(webpBuffer, config) {
  try {
    const img = new webp.Image();
    await img.load(webpBuffer);
    const metadata = {
      'sticker-pack-id': crypto.randomUUID(),
      'sticker-pack-name': pick(config, 'pack', DEFAULT_CONFIG.pack),
      'sticker-pack-publisher': pick(config, 'author', DEFAULT_CONFIG.author),
      'sticker-pack-publisher-email': '',
      emojis: Array.isArray(config.categories)
        ? config.categories
        : [pick(config, 'categories', DEFAULT_CONFIG.categories)].flat(),
      'is-avatar-sticker': 0,
    };
    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuffer = Buffer.from(JSON.stringify(metadata));
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);
    img.exif = exif;
    return await img.save(null);
  } catch (error) {
    console.warn('Metadata failed:', error.message);
    return webpBuffer;
  }
}
async function createSticker(input, options = {}) {
  const settings = {
    ...(config.sticker ?? {}),
    ...options,
  };
  const { buffer, fileType } = await validateInput(input);
  const webpBuffer = await convertToWebp(buffer, fileType, settings);
  return await addMetadata(webpBuffer, settings);
}
async function getStickerInfo(input) {
  const { buffer, fileType } = await validateInput(input);
  return {
    size: buffer.length,
    type: fileType.mime,
    ext: fileType.ext,
    isAnimated: fileType.mime.startsWith('video/') || fileType.mime === 'image/gif',
    isSupported: true,
  };
}
export { createSticker, getStickerInfo };

import { promises as fsp, createReadStream } from 'fs';
import { join } from 'path';
import { spawn, exec } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import { resolveBinary } from './installer.js';
import BodyForm from 'form-data';
import sizeOf from 'image-size';
import * as cheerio from 'cheerio';
import { PATH } from './helper.js';
import { hkNet } from './network.js';
let cachedFFMPEG = null;
function getFFMPEG() {
  if (!cachedFFMPEG) cachedFFMPEG = resolveBinary('ffmpeg') || 'ffmpeg';
  return cachedFFMPEG;
}
const BINARIES = {
  get FFMPEG() {
    return getFFMPEG();
  },
  QT_FASTSTART: 'qt-faststart',
};
class TempFileManager {
  constructor(basePath) {
    this.basePath = basePath;
    this.files = new Set();
  }
  create(ext = '') {
    const filename = join(
      this.basePath,
      `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    );
    this.files.add(filename);
    return filename;
  }
  async cleanup(filename) {
    try {
      await fsp.unlink(filename);
      this.files.delete(filename);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn(`Failed to cleanup temp file ${filename}:`, err.message);
      }
    }
  }
  async cleanupAll() {
    const promises = Array.from(this.files).map((f) => this.cleanup(f));
    await Promise.allSettled(promises);
  }
}
async function spawnProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, options);
    let stdout = '';
    let stderr = '';
    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }
    proc.on('error', (err) => {
      reject(new Error(`Process spawn error: ${err.message}`));
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}. stderr: ${stderr}`));
      } else {
        resolve({
          stdout,
          stderr,
          code,
        });
      }
    });
  });
}
async function ffmpeg(buffer, args = [], inputExt = '', outputExt = '') {
  const tempManager = new TempFileManager(PATH.tmp);
  const inputFile = tempManager.create(inputExt || 'tmp');
  const outputFile = outputExt ? `${inputFile}.${outputExt}` : inputFile;
  try {
    await fsp.writeFile(inputFile, buffer);
    const ffArgs = ['-y', '-i', inputFile, ...args];
    if (outputExt) ffArgs.push('-f', outputExt);
    ffArgs.push(outputFile);
    await spawnProcess(getFFMPEG(), ffArgs);
    const data = await fsp.readFile(outputFile);
    return {
      data,
      filename: outputFile,
      async delete() {
        await tempManager.cleanup(outputFile);
      },
    };
  } catch (err) {
    throw new Error(`FFmpeg conversion failed: ${err.message}`);
  } finally {
    await tempManager.cleanup(inputFile);
  }
}
async function toPTT(buffer) {
  const args = [
    '-vn',
    '-c:a',
    'libopus',
    '-b:a',
    '64k',
    '-vbr',
    'on',
    '-application',
    'voip',
    '-ar',
    '48000',
  ];
  return await ffmpeg(buffer, args, 'tmp', 'ogg');
}
function toAudio(buffer, ext) {
  return ffmpeg(buffer, ['-vn', '-c:a', 'libmp3lame', '-q:a', '2', '-ar', '44100'], ext, 'mp3');
}
function toVideo(buffer, ext) {
  return ffmpeg(
    buffer,
    [
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      '-ab',
      '128k',
      '-ar',
      '44100',
      '-crf',
      '28',
      '-preset',
      'medium',
      '-profile:v',
      'baseline',
      '-level',
      '3.0',
      '-movflags',
      '+faststart',
      '-pix_fmt',
      'yuv420p',
    ],
    ext,
    'mp4'
  );
}
function toVideoCustom(buffer, ext, options = {}) {
  const {
    width = null,
    height = null,
    crf = 28,
    preset = 'medium',
    fps = null,
    audioBitrate = '128k',
  } = options;
  const args = ['-c:v', 'libx264', '-c:a', 'aac', '-ab', audioBitrate, '-ar', '44100'];
  if (width || height) {
    const scale = width && height ? `${width}:${height}` : width ? `${width}:-2` : `-2:${height}`;
    args.push('-vf', `scale=${scale}`);
  }
  if (fps) {
    args.push('-r', fps.toString());
  }
  args.push(
    '-crf',
    crf.toString(),
    '-preset',
    preset,
    '-profile:v',
    'baseline',
    '-level',
    '3.0',
    '-movflags',
    '+faststart',
    '-pix_fmt',
    'yuv420p'
  );
  return ffmpeg(buffer, args, ext, 'mp4');
}
function extractAudio(buffer, ext, audioFormat = 'mp3') {
  const codecMap = {
    mp3: 'libmp3lame',
    aac: 'aac',
    opus: 'libopus',
    ogg: 'libvorbis',
    wav: 'pcm_s16le',
  };
  const codec = codecMap[audioFormat] || 'libmp3lame';
  const outputExt = audioFormat === 'ogg' ? 'ogg' : audioFormat;
  return ffmpeg(buffer, ['-vn', '-c:a', codec, '-b:a', '192k', '-ar', '44100'], ext, outputExt);
}
function createThumbnail(buffer, ext, options = {}) {
  const { time = '00:00:01', width = 320, height = 240, quality = 2 } = options;
  return ffmpeg(
    buffer,
    ['-ss', time, '-vframes', '1', '-vf', `scale=${width}:${height}`, '-q:v', quality.toString()],
    ext,
    'jpg'
  );
}
function looksLikeWebPBuffer(buf) {
  if (!buf || buf.length < 12) return false;
  try {
    return buf.slice(0, 12).toString('ascii').includes('WEBP');
  } catch (e) {
    return false;
  }
}
async function webpToPng(buffer) {
  const tempManager = new TempFileManager(PATH.tmp);
  const inputPath = tempManager.create('webp');
  const outputPath = inputPath.replace(/\.webp$/, '.png');
  try {
    await fsp.writeFile(inputPath, buffer);
    await spawnProcess(getFFMPEG(), ['-y', '-i', inputPath, outputPath]);
    return await fsp.readFile(outputPath);
  } catch (err) {
    throw new Error(`WebP to PNG conversion failed: ${err.message}`);
  } finally {
    await tempManager.cleanup(inputPath);
    await tempManager.cleanup(outputPath);
  }
}
async function webpToJpeg(buffer) {
  const tempManager = new TempFileManager(PATH.tmp);
  const inputPath = tempManager.create('webp');
  const outputPath = inputPath.replace(/\.webp$/, '.jpg');
  try {
    await fsp.writeFile(inputPath, buffer);
    await spawnProcess(getFFMPEG(), ['-y', '-i', inputPath, '-q:v', '2', outputPath]);
    return await fsp.readFile(outputPath);
  } finally {
    await tempManager.cleanup(inputPath);
    await tempManager.cleanup(outputPath);
  }
}
async function download(url, options = {}) {
  const response = await hkNet.get(url, {
    responseType: 'arraybuffer',
    timeout: options.timeout || 30000,
    signal: options.signal,
    headers: options.headers || {
      'sec-ch-ua-platform': '"Linux"',
      'user-agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      accept: 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  });
  return Buffer.from(response.data);
}
const fetchImageWithRetry = async (url, maxRetries = 2, retryDelay = 1000, timeout = 30000) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const data = await download(url, {
        signal: controller.signal,
        timeout,
      });
      clearTimeout(timeoutId);
      if (!data || data.length === 0) throw new Error('Empty image data');
      return data;
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError' || error.status === 404) break;
      if (attempt < maxRetries) {
        const delay = retryDelay * (attempt + 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
};
async function imgsToPdf(list = [], options = {}) {
  if (!Array.isArray(list) || list.length === 0) throw new Error('Image list is empty.');
  const { referer, headers = {}, timeout = 20000 } = options;
  const pdf = await PDFDocument.create();
  for (const item of list) {
    if (typeof item !== 'string') continue;
    let resolvedReferer = '';
    if (typeof referer === 'function') {
      resolvedReferer = referer(item);
    } else if (typeof referer === 'string') {
      resolvedReferer = referer;
    } else {
      try {
        const u = new URL(item);
        resolvedReferer = `${u.protocol}//${u.hostname}/`;
      } catch {}
    }
    let res;
    try {
      res = await hkNet.get(item, {
        responseType: 'arraybuffer',
        timeout,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Encoding': 'identity',
          Referer: resolvedReferer,
          Origin: resolvedReferer.replace(/\/$/, ''),
        },
        validateStatus: (s) => s >= 200 && s < 500,
      });
    } catch (err) {
      console.warn('Failed to fetch image:', item, err.message);
      continue;
    }
    if (!res.data || res.data.length < 100) {
      console.warn('Blocked or empty image:', item);
      continue;
    }
    let buffer = Buffer.from(res.data);
    const isJPEG = buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
    if (!isJPEG) {
      try {
        buffer = await webpToJpeg(buffer);
      } catch {
        console.warn('Image convert failed:', item);
        continue;
      }
    }
    let img;
    try {
      img = await pdf.embedJpg(buffer);
    } catch (err) {
      console.warn('Embed failed:', item, err.message);
      continue;
    }
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, {
      x: 0,
      y: 0,
      width: img.width,
      height: img.height,
    });
  }
  if (pdf.getPageCount() === 0) throw new Error('No valid images were processed.');
  return Buffer.from(await pdf.save());
}
async function webp2mp4File(path) {
  try {
    const uploadForm = new BodyForm();
    uploadForm.append('new-image-url', '');
    uploadForm.append('new-image', createReadStream(path));
    const uploadResponse = await hkNet({
      method: 'post',
      url: 'https://ezgif.com/webp-to-mp4',
      data: uploadForm,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${uploadForm._boundary}`,
      },
      timeout: 30000,
    });
    const $ = cheerio.load(uploadResponse.data);
    const file = $('input[name="file"]').attr('value');
    if (!file) {
      throw new Error('Failed to upload file to conversion service');
    }
    const convertForm = new BodyForm();
    convertForm.append('file', file);
    convertForm.append('convert', 'Convert WebP to MP4!');
    const convertResponse = await hkNet({
      method: 'post',
      url: `https://ezgif.com/webp-to-mp4/${file}`,
      data: convertForm,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${convertForm._boundary}`,
      },
      timeout: 30000,
    });
    const $result = cheerio.load(convertResponse.data);
    const result = 'https:' + $result('div#output > p.outfile > video > source').attr('src');
    if (!result || result === 'https:undefined') {
      throw new Error('Failed to get conversion result');
    }
    return {
      status: true,
      message: 'Converted successfully',
      result,
    };
  } catch (err) {
    throw new Error(`WebP to MP4 conversion failed: ${err.message}`);
  }
}
async function webp2mp4Local(buffer) {
  return ffmpeg(
    buffer,
    [
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-preset',
      'medium',
      '-crf',
      '23',
    ],
    'webp',
    'mp4'
  );
}
function base64ToBuffer(dataUri) {
  const match = dataUri.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid base64 data URI format');
  }
  const [, mime, b64] = match;
  const buffer = Buffer.from(b64, 'base64');
  return {
    buffer,
    mime,
  };
}
async function combineToWebp(inputDir, outputPath) {
  const inputPattern = join(inputDir, 'processed_frame_%04d.png');
  const args = [
    '-y',
    '-framerate',
    '15',
    '-i',
    inputPattern,
    '-vf',
    'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:-1:-1:color=black@0.0',
    '-vcodec',
    'libwebp',
    '-lossless',
    '0',
    '-q:v',
    '75',
    '-loop',
    '0',
    '-preset',
    'default',
    '-an',
    '-fps_mode',
    'passthrough',
    outputPath,
  ];
  await spawnProcess(getFFMPEG(), args);
}
async function video2gif(buffer, ext, options = {}) {
  const {
    fps = 10,
    width = 320,
    height = null,
    startTime = null,
    duration = null,
    colors = 256,
    dither = 'bayer',
    quality = 'high',
  } = options;
  const qualityPresets = {
    low: {
      fps: 10,
      width: 240,
      colors: 128,
      dither: 'none',
    },
    medium: {
      fps: 15,
      width: 320,
      colors: 256,
      dither: 'bayer',
    },
    high: {
      fps: 20,
      width: 480,
      colors: 256,
      dither: 'floyd_steinberg',
    },
    ultra: {
      fps: 25,
      width: 640,
      colors: 256,
      dither: 'floyd_steinberg',
    },
  };
  const preset = qualityPresets[quality] || {};
  const finalFps = options.fps !== undefined ? fps : preset.fps || 10;
  const finalWidth = options.width !== undefined ? width : preset.width || 320;
  const finalColors = options.colors !== undefined ? colors : preset.colors || 256;
  const finalDither = options.dither !== undefined ? dither : preset.dither || 'bayer';
  const args = [];
  if (startTime !== null) {
    args.push('-ss', typeof startTime === 'number' ? startTime.toString() : startTime);
  }
  if (duration !== null) {
    args.push('-t', duration.toString());
  }
  let vfilter = [];
  const scaleFilter = height
    ? `scale=${finalWidth}:${height}:flags=lanczos`
    : `scale=${finalWidth}:-1:flags=lanczos`;
  vfilter.push(scaleFilter);
  vfilter.push(`fps=${finalFps}`);
  const paletteFilter = `split[s0][s1];[s0]palettegen=max_colors=${finalColors}:stats_mode=diff[p];[s1][p]paletteuse=dither=${finalDither}`;
  vfilter.push(paletteFilter);
  args.push('-vf', vfilter.join(','));
  args.push('-loop', '0');
  return await ffmpeg(buffer, args, ext, 'gif');
}
export {
  ffmpeg,
  toAudio,
  toPTT,
  extractAudio,
  toVideo,
  toVideoCustom,
  createThumbnail,
  webpToPng,
  webpToJpeg,
  webp2mp4File,
  webp2mp4Local,
  base64ToBuffer,
  TempFileManager,
  combineToWebp,
  spawnProcess,
  imgsToPdf,
  BINARIES,
  video2gif,
};

import { fileURLToPath, pathToFileURL } from 'url';
import path, { join } from 'path';
import { createRequire } from 'module';
import { promises as fsp } from 'fs';
import fs from 'fs';
import { spawn } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prepareWAMessageMedia } from 'baileys';
import { db } from '#src/database';
import { resolveBinary } from './installer.js';
import os from 'os';
const FFMPEG_BIN = resolveBinary('ffmpeg') || 'ffmpeg';
const genAI = new GoogleGenerativeAI('AIzaSyBY-K-WeYfghfgCll61Kc9K8kjBrKL9pv4');
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
});
async function detectPromotion(text) {
  const prompt = `Is this promotional spam? Reply ONLY "yes" or "no":\n\n${text}`;
  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 10,
        temperature: 0.1,
      },
    });
    return result.response.text().toLowerCase().trim().includes('yes');
  } catch {
    return false;
  }
}
function filename(pathURL = import.meta.url, rmPrefix = process.platform !== 'win32') {
  return rmPrefix
    ? /file:\/\/\//.test(pathURL)
      ? fileURLToPath(pathURL)
      : pathURL
    : pathToFileURL(pathURL).toString();
}
function dirname(pathURL) {
  return path.dirname(`../${filename(pathURL, true)}`);
}
function require(dir = import.meta.url) {
  return createRequire(dir);
}
function formatNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}
function formatCurrency(num) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(num);
}
function msToTime(duration) {
  const s = Math.floor((duration / 1000) % 60);
  const m = Math.floor((duration / 60000) % 60);
  const h = Math.floor((duration / 3600000) % 24);
  const r = [];
  if (h) r.push(`${h} hour${h > 1 ? 's' : ''}`);
  if (m) r.push(`${m} minute${m > 1 ? 's' : ''}`);
  if (s || (!h && !m)) r.push(`${s} second${s > 1 ? 's' : ''}`);
  return r.join(' ');
}
function clockString(ms) {
  let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000);
  let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')} H ${String(m).padStart(2, '0')} M ${String(s).padStart(2, '0')} S`;
}
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
function readmore() {
  return String.fromCharCode(8206).repeat(4001);
}
const toRupiah = (n) => parseInt(n).toLocaleString().replace(/,/g, '.');
function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return 'N/A';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}
function isNumber(value) {
  return typeof value === 'number' && !isNaN(value);
}
function capitalize(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function dateTime(ts) {
  return new Date(ts).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
const root = process.cwd();
const PATH = {
  tmp: path.resolve(root, 'tmp'),
  json: path.resolve(root, 'src/json'),
  font: path.resolve(root, 'src/font'),
  cookie: path.resolve(root, 'lib/cookies'),
  bin: path.resolve(root, 'src/bin'),
  proxy: path.resolve(root, 'lib/proxy.json'),
};
async function m3u8Dl(url, opt = {}) {
  return new Promise((res, rej) => {
    const args = ['-i', url, '-c', 'copy', '-f', 'mp4', 'pipe:1'];
    if (opt.headers) {
      args.unshift(
        '-headers',
        Object.entries(opt.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n')
      );
    }
    if (opt.userAgent) args.unshift('-user_agent', opt.userAgent);
    const ff = spawn(FFMPEG_BIN, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks = [];
    let err = '';
    ff.stdout.on('data', (d) => chunks.push(d));
    ff.stderr.on('data', (d) => (err += d.toString()));
    ff.on('close', (c) => (c === 0 ? res(Buffer.concat(chunks)) : rej(new Error(err))));
    ff.on('error', rej);
  });
}
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0.6723.91',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 10) Chrome/131.0.0.0 Mobile',
];
function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}
async function createExternalAdReply(image, title = '', body = '', sock) {
  if (!image || !sock) return null;
  let buffer;
  if (typeof image === 'string') buffer = (await sock.getFile(image, true)).data;
  else buffer = image;
  const media = await prepareWAMessageMedia(
    {
      image: buffer,
    },
    {
      upload: sock.waUploadToServer,
    }
  );
  const url = media.imageMessage?.url;
  if (!url) return null;
  return {
    title,
    body,
    thumbnailUrl: url,
    sourceUrl: 'https://hikoshi.xyz',
    mediaType: 1,
    renderLargerThumbnail: true,
  };
}
let fontMappings = null;
function loadFontMappings() {
  if (!fontMappings) fontMappings = JSON.parse(fs.readFileSync(join(PATH.json, 'fonts.json')));
  return fontMappings;
}
function getFontType(conn, type) {
  return loadFontMappings().types[type?.toString() || '0'] || 'normal';
}
function transformText(conn, text, fontType, reverse = false, except = []) {
  if (!text || fontType === 'normal') return text;
  const settings = db.data.settings[conn.user.jid] || {};
  const map = loadFontMappings().mappings[fontType];
  if (!map) return text;
  const t = reverse ? Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) : map;
  const urlRe = /(wa\.me|https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]{2,})/i;
  return text
    .split(urlRe)
    .map((p) => {
      if (!p || except.includes(p)) return p;
      let r = p;
      for (const [k, v] of Object.entries(t)) r = r.replace(new RegExp(k, 'g'), v);
      return r;
    })
    .join('');
}
function processTextWithSmlcap(conn, text, cfg = {}) {
  if (!text || typeof text !== 'string') return text;
  const id = conn?.user?.jid;
  const s = db?.data?.settings?.[id] || {};
  if (cfg.smlcap === false || !s.typeText || s.typeText === 0) return text;
  return transformText(conn, text, getFontType(conn, s.typeText), false, cfg.except || []);
}
function getCookie(fileName, type) {
  if (!fileName) throw 'invalid filename';
  if (!type) throw 'invalid type';
  if (!/^[a-zA-Z0-9_-]+$/.test(fileName)) {
    throw new Error('invalid filename');
  }
  const filePath = path.join(PATH.cookie, fileName + '.txt');
  if (!fs.existsSync(filePath)) {
    throw 'file not exist';
  }
  if (type === 'strings') {
    return fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const parts = line.split('\t');
        if (parts.length <= 6) return null;
        return `${parts[5]}=${parts[6]}`;
      })
      .filter(Boolean)
      .join('; ');
  } else if (type === 'path') {
    return filePath;
  }
  throw new Error('invalid type');
}
function parseRichText(text = '') {
  const source = String(text);
  const patterns = [
    {
      regex: /```(\w*)\n?([\s\S]*?)```/g,
      type: 'codeBlock',
    },
    {
      regex: /\*([^*]+?)\*/g,
      type: 'bold',
    },
    {
      regex: /_([^_]+?)_/g,
      type: 'italic',
    },
    {
      regex: /~([^~]+?)~/g,
      type: 'strikethrough',
    },
    {
      regex: /`([^`]+?)`/g,
      type: 'code',
    },
    {
      regex: /\[([^\]]+?)\]\(([^)]+?)\)/g,
      type: 'link',
    },
  ];
  const matches = [];
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;
    while ((match = regex.exec(source))) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        fullMatch: match[0],
        type: pattern.type,
        content: match[1] || '',
        extra: match[2] || '',
      });
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const segments = [];
  let position = 0;
  for (const match of matches) {
    if (match.start < position) continue;
    if (match.start > position)
      segments.push({
        text: source.slice(position, match.start),
      });
    if (match.type === 'codeBlock') {
      segments.push({
        text: match.fullMatch,
        codeBlock: {
          language: match.content,
          code: match.extra,
        },
      });
    } else if (match.type === 'link') {
      segments.push({
        text: match.content,
        link: {
          url: match.extra,
          text: match.content,
        },
      });
    } else {
      segments.push({
        text: match.content,
        [match.type]: true,
      });
    }
    position = match.end;
  }
  if (position < source.length)
    segments.push({
      text: source.slice(position),
    });
  return segments;
}
function buildAIRichContent(text = '', options = {}) {
  const content = {
    text: String(text),
  };
  if (Array.isArray(options.mentions) && options.mentions.length) {
    content.mentions = options.mentions;
  }
  if (options.contextInfo || options.aiGenerated) {
    content.contextInfo = {
      ...(options.contextInfo || {}),
      ...(options.aiGenerated
        ? {
            isAIGenerated: true,
          }
        : {}),
    };
  }
  if (options.viewOnce) content.viewOnce = true;
  return content;
}
function buildAIRichWithButtons(text = '', buttons = [], options = {}) {
  const content = {
    viewOnce: true,
    interactiveMessage: {
      body: {
        text: String(text),
      },
      footer: options.footer
        ? {
            text: String(options.footer),
          }
        : undefined,
      nativeFlowMessage: {
        buttons: buttons.map((button) => {
          const type = button.type || 'reply';
          const names = {
            reply: 'quick_reply',
            url: 'cta_url',
            copy: 'cta_copy',
            call: 'cta_call',
            reminder: 'cta_reminder',
            'cancel-reminder': 'cta_cancel_reminder',
            'message-reminder': 'message_reminder',
            'cancel-message-reminder': 'cancel_message_reminder',
            location: 'send_location',
            address: 'address_message',
            mpm: 'mpm',
            flow: 'flow',
            catalog: 'cta_catalog',
            webview: 'open_webview',
            'single-select': 'single_select',
            quick_reply: 'quick_reply',
            cta_url: 'cta_url',
            cta_copy: 'cta_copy',
            cta_call: 'cta_call',
            cta_reminder: 'cta_reminder',
            cta_cancel_reminder: 'cta_cancel_reminder',
            message_reminder: 'message_reminder',
            cancel_message_reminder: 'cancel_message_reminder',
            send_location: 'send_location',
            address_message: 'address_message',
            single_select: 'single_select',
          };
          const params = button.buttonParamsJson
            ? typeof button.buttonParamsJson === 'string'
              ? JSON.parse(button.buttonParamsJson)
              : button.buttonParamsJson
            : button.params ||
              (type === 'url'
                ? {
                    display_text: button.text,
                    url: button.url || button.id,
                  }
                : type === 'copy'
                  ? {
                      display_text: button.text,
                      copy_code: button.code || button.id,
                    }
                  : type === 'call'
                    ? {
                        display_text: button.text,
                        phone_number: button.phone || button.id,
                      }
                    : type === 'flow'
                      ? {
                          display_text: button.text,
                          id: button.id,
                          flow_id: button.flowId,
                          flow_token: button.flowToken,
                          flow_action: button.flowAction,
                        }
                      : {
                          display_text: button.text,
                          id: button.id,
                        });
          return {
            name: button.name || names[type] || type,
            buttonParamsJson: JSON.stringify(params),
          };
        }),
        messageParamsJson: options.messageParamsJson || '',
      },
      contextInfo: {
        ...(options.contextInfo || {}),
        mentionedJid: options.mentions || options.contextInfo?.mentionedJid || [],
        ...(options.aiGenerated
          ? {
              isAIGenerated: true,
            }
          : {}),
      },
    },
  };
  if (options.header) content.interactiveMessage.header = options.header;
  return content;
}
function buildAIRichWithMedia(text = '', media, options = {}) {
  if (!media || !media.type) throw new TypeError('media.type is required');
  const mediaType = media.type;
  const mediaValue = media.buffer || media.url || media.data;
  return {
    viewOnce: true,
    interactiveMessage: {
      header: {
        hasMediaAttachment: true,
        [`${mediaType}Message`]: {
          ...(mediaValue
            ? {
                [Buffer.isBuffer(mediaValue) ? 'jpegThumbnail' : 'url']: mediaValue,
              }
            : {}),
          ...(media.mimetype
            ? {
                mimetype: media.mimetype,
              }
            : {}),
          ...(options.caption
            ? {
                caption: options.caption,
              }
            : {}),
        },
      },
      body: {
        text: String(text),
      },
      footer: options.footer
        ? {
            text: String(options.footer),
          }
        : undefined,
      nativeFlowMessage: {
        buttons: Array.isArray(options.buttons)
          ? buildAIRichWithButtons('', options.buttons, options).interactiveMessage
              .nativeFlowMessage.buttons
          : [],
        messageParamsJson: options.messageParamsJson || '',
      },
      contextInfo: {
        ...(options.contextInfo || {}),
        mentionedJid: options.mentions || options.contextInfo?.mentionedJid || [],
        ...(options.aiGenerated
          ? {
              isAIGenerated: true,
            }
          : {}),
      },
    },
  };
}
const codeBlock = (language, code) => `\`\`\`${language || ''}\n${code}\n\`\`\``;
const bold = (text) => `*${text}*`;
const italic = (text) => `_${text}_`;
const strikethrough = (text) => `~${text}~`;
const mono = (text) => `\`\`${text}\`\``;
const QUEST_IDS = ['mulung', 'mining', 'bunuh'];
function trackQuest(user, id) {
  if (!user || typeof user !== 'object' || !QUEST_IDS.includes(id)) return;
  let today = new Date().toISOString().slice(0, 10);
  if (!user.quest || user.quest.day !== today)
    user.quest = { day: today, progress: {}, done: false };
  user.quest.progress[id] = (user.quest.progress[id] || 0) + 1;
}
const link = (text, url) => `[${text}](${url})`;
function safeFileName(name, fallback = 'file') {
  let base = String(name ?? '')
    .replace(/[/\\\0]/g, '')
    .trim();
  if (!base) base = fallback;
  return base;
}
export {
  detectPromotion,
  formatNumber,
  formatCurrency,
  msToTime,
  clockString,
  pickRandom,
  readmore,
  toRupiah,
  formatBytes,
  isNumber,
  capitalize,
  trackQuest,
  QUEST_IDS,
  safeFileName,
  dateTime,
  filename,
  dirname,
  require,
  PATH,
  m3u8Dl,
  getRandomUserAgent,
  createExternalAdReply,
  getFontType,
  transformText,
  processTextWithSmlcap,
  getCookie,
  parseRichText,
  buildAIRichContent,
  buildAIRichWithButtons,
  buildAIRichWithMedia,
  codeBlock,
  bold,
  italic,
  strikethrough,
  mono,
  link,
};

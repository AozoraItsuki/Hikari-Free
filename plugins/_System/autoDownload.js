import { hkNet } from '#lib/utils/network';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';
import { db } from '#src/database';
import { plugins } from '#src/plugins';
const TIKTOK_REGEX = /^http(s)?:\/\/(www|v(t|m)).tiktok.com\/[-a-zA-Z0-9@:%._+~#=]/i;
const regex = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
export async function before(m, { isPrems }) {
  let user = db.data.users[m.sender];
  let chat = db.data.chats[m.chat];
  let setting = db.data.settings[this.user.jid];
  if (!m.text) return;
  if (m.isBaileys || m.fromMe) return;
  if (
    m.text.startsWith('=>') ||
    m.text.startsWith('>') ||
    m.text.startsWith('.') ||
    m.text.startsWith('#') ||
    m.text.startsWith('!') ||
    m.text.startsWith('/') ||
    m.text.startsWith('/')
  )
    return;
  if (chat.mute || chat.isBanned || user.banned) return;
  let text = m.text.replace(/\n+/g, ' ');
  if ((chat.autodownload || user.autodownload) && text.match(regex)) {
    this.autodownload = this.autodownload || {};
    let link = text.match(regex)[0];
    if (TIKTOK_REGEX.test(link)) {
      if (!(m.sender in this.autodownload)) {
        this.autodownload[m.sender] = true;
        try {
          if (setting.composing) await this.sendPresenceUpdate('composing', m.chat).catch(() => {});
          if (setting.autoread) await this.readMessages([m.key]).catch(() => {});
          const dl = plugins['downloader/tiktok.js'];
          if (typeof dl === 'function') {
            await dl.call(this, m, {
              conn: this,
              usedPrefix: '.',
              command: 'tiktok',
              flags: {},
              args: [link],
            });
            return;
          }
          const { data } = await tiktok(link);
          if (!data) return m.reply('Failed to get data from TikTok.');
          const caption =
            `Nickname: ${data.author?.nickname || 'Unknown'}\nDuration: ${data.duration || 0}s\n\n${data.title || ''}`.trim();
          if (data.images?.length) {
            await sendImageAlbum(this, m, data.images, caption);
          } else if (data.play) {
            const videoPath = await downloadTemp(data.play, '.mp4');
            try {
              await this.sendFile(m.chat, videoPath, '', caption, m);
            } finally {
              fs.unlinkSync(videoPath);
            }
          }
          if (data.music) {
            const audioPath = await downloadTemp(data.music, '.mp3');
            const audioBuffer = fs.readFileSync(audioPath);
            try {
              await this.sendMessage(
                m.chat,
                {
                  audio: audioBuffer,
                  mimetype: 'audio/mpeg',
                },
                {
                  quoted: m,
                }
              );
            } finally {
              fs.unlinkSync(audioPath);
            }
          }
        } catch (e) {
          console.error('autoDownload TikTok failed:', e?.message || e);
          await m.reply('Failed to download TikTok video.').catch(() => {});
        } finally {
          delete this.autodownload[m.sender];
        }
      }
    }
  }
  return !0;
}
async function tiktok(url) {
  const res = await hkNet.get('https://www.tikwm.com/api/', {
    params: {
      url,
      hd: 1,
    },
    timeout: 15000,
  });
  return res.data;
}
async function downloadTemp(url, ext = '.bin') {
  const filePath = path.join(tmpdir(), `${crypto.randomBytes(8).toString('hex')}${ext}`);
  const response = await hkNet.get(url, {
    responseType: 'stream',
  });
  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  return filePath;
}
async function sendImageAlbum(conn, m, urls, caption) {
  const mediaObjects = await Promise.all(
    urls.map(async (url) => {
      const { data } = await hkNet.get(url, {
        responseType: 'arraybuffer',
      });
      return {
        image: data,
      };
    })
  );
  await conn.sendAlbumMessage(m.chat, mediaObjects, { caption, quoted: m });
}

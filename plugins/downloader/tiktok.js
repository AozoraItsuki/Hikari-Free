import { hkNet } from '#lib/utils/network';
import { PATH, getCookie } from '#lib/utils/helper';
import { resolveBinary } from '#lib/utils/installer';
import scraper from '#lib/scraper/index';
import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const YTDLP_BIN = resolveBinary('yt-dlp') ?? 'yt-dlp';
const FFMPEG_LOC = resolveBinary('ffmpeg') ? path.dirname(resolveBinary('ffmpeg')) : null;
const TIKTOK_COOKIES_PATH = PATH.cookie + 'tiktok.txt';

const regex =
  /https:\/\/(www\.)?tiktok\.com\/(@[^\/]+\/(video|photo)\/\d+|\w+\/\d+|\w+)|https:\/\/(vt|vm)\.tiktok\.com\/\w+/i;

let handler = async (m, { conn, usedPrefix, command, flags, args }) => {
  try {
    const text = (args || []).join(' ').trim();
    const urlArg = args.find((a) => regex.test(a));
    const noAudio = flags.noaudio || false;
    const noCaption = flags.nocaption || false;

    if (urlArg) {
      const data = await scraper.info.tiktok(urlArg);
      if (!data) {
        return m.reply('Failed to fetch data from the link.');
      }
      const author = data.author?.nickname || data.author?.username || '-';
      const duration = data.video?.duration ?? '-';
      const caption = noCaption
        ? ''
        : `👤 *${author}*\n🎞️ *Duration:* ${duration}s\n📝 *Title:* ${data.description || '-'}`;

      if (data.type === 'slideshow' && data.images?.length) {
        const media = [];
        for (const image of data.images) {
          const imageUrl = typeof image === 'string' ? image : image.url;
          if (!imageUrl) continue;
          const imagePath = await downloadMedia(imageUrl, 'jpg');
          try {
            media.push({
              image: fs.readFileSync(imagePath),
            });
          } finally {
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath);
            }
          }
        }
        if (media.length > 0) {
          await conn.sendAlbumMessage(
            m.chat,
            media.map((item) => ({
              ...item,
              caption,
            })),
            { quoted: m }
          );
        }
      } else if (data.type === 'video' && data.video?.url) {
        const videoPath = await ytdlpDownload(urlArg, 'video');
        let audioPath = null;
        try {
          const stats = fs.statSync(videoPath);
          const fileSizeMB = stats.size / (1024 * 1024);
          if (fileSizeMB > 50) {
            await conn.sendMessage(
              m.chat,
              {
                document: fs.readFileSync(videoPath),
                fileName: `tiktok_${crypto.randomBytes(4).toString('hex')}.mp4`,
                mimetype: 'video/mp4',
                caption,
              },
              { quoted: m }
            );
          } else {
            await conn.sendFile(m.chat, videoPath, '', caption, m);
          }
          if (!noAudio) {
            audioPath = await ytdlpDownload(urlArg, 'audio');
            await conn.sendMessage(
              m.chat,
              {
                audio: fs.readFileSync(audioPath),
                mimetype: 'audio/mp4',
                ptt: false,
              },
              { quoted: m }
            );
          }
        } finally {
          if (audioPath && fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
          }
          if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
          }
        }
      } else {
        return m.reply('TikTok media not found.');
      }

      if (data.type === 'slideshow' && !noAudio && data.music?.url) {
        try {
          const audioPath = await ytdlpDownload(urlArg, 'audio');
          try {
            await conn.sendMessage(
              m.chat,
              {
                audio: fs.readFileSync(audioPath),
                mimetype: 'audio/mp4',
                ptt: false,
              },
              { quoted: m }
            );
          } finally {
            if (fs.existsSync(audioPath)) {
              fs.unlinkSync(audioPath);
            }
          }
        } catch (e) {}
      }
      return;
    }

    if (!text) {
      return m.reply(
        `Example: ${usedPrefix + command} Takanashi Hoshino\nor ${usedPrefix + command} https://vt.tiktok.com/ZShpAJ7DU/.`
      );
    }

    if (!conn.tiktok) {
      conn.tiktok = new Set();
    }

    const [qRaw, cRaw] = text.split(',');
    const q = (qRaw || '').trim();
    let count = (cRaw || '3').trim();

    if (!q) {
      return m.reply('Enter a search keyword.');
    }

    if (isNaN(count) || Number(count) < 1) {
      count = '3';
    }

    if (Number(count) > 10) {
      count = '10';
    }

    const postData = new URLSearchParams({
      keywords: q,
      count,
      cursor: '0',
      web: '1',
      hd: '1',
    }).toString();

    const res = await hkNet.post('https://www.tikwm.com/api/feed/search', postData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const json = res.data;

    if (!json?.data?.videos?.length) {
      return m.reply('No results found for that query.');
    }

    const vids = json.data.videos;
    let vid = null;

    for (const item of vids) {
      if (!conn.tiktok.has(item.video_id)) {
        vid = item;
        break;
      }
    }

    if (!vid) {
      return m.reply('All videos from this search have already been sent.');
    }

    conn.tiktok.add(vid.video_id);

    if (conn.tiktok.size > 200) {
      Array.from(conn.tiktok)
        .slice(0, 100)
        .forEach((id) => conn.tiktok.delete(id));
    }

    const playUrl = 'https://www.tikwm.com' + (vid.play || '');
    const caption = noCaption
      ? ''
      : `👤 *${vid.author?.nickname || '-'}*\n📝 *Title:* ${vid.title || '-'}`;

    await conn.sendMessage(
      m.chat,
      {
        video: { url: playUrl },
        caption,
      },
      { quoted: m }
    );
  } catch (err) {
    throw err;
  }
};

handler.help = ['tiktok'];
handler.command = /^(tiktok-imgdl|tiktok(mp4|slide|foto|video)?|tt(mp4|slide|foto|video)?)$/i;
handler.limit = true;
export default handler;

function hasCookies() {
  try {
    return fs.existsSync(TIKTOK_COOKIES_PATH);
  } catch {
    return false;
  }
}

async function ytdlpDownload(url, mode = 'video') {
  const ext = mode === 'video' ? 'mp4' : 'm4a';
  const dest = path.join(PATH.tmp, `${crypto.randomBytes(6).toString('hex')}.${ext}`);
  const args = ['--no-playlist', '--no-part', '-o', dest];
  if (hasCookies()) args.push('--cookies', TIKTOK_COOKIES_PATH);
  if (FFMPEG_LOC) args.push('--ffmpeg-location', FFMPEG_LOC);

  if (mode === 'video') {
    args.push('-f', 'bv*+ba/b', '--merge-output-format', 'mp4');
  } else {
    args.push('-f', 'ba/b');
  }

  args.push(url);

  try {
    await execa(YTDLP_BIN, args, { timeout: 180000 });
    if (!fs.existsSync(dest)) throw new Error('yt-dlp produced no output file');
    return dest;
  } catch (err) {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    throw err;
  }
}

async function downloadMedia(url, ext = 'mp4') {
  const filePath = path.join(PATH.tmp, `${crypto.randomBytes(6).toString('hex')}.${ext}`);
  try {
    const res = await hkNet({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: getTikTokHeaders(),
    });
    const writer = fs.createWriteStream(filePath);
    res.data.pipe(writer);
    await new Promise((resolve, reject) => {
      const done = () => {
        try {
          res.data.destroy();
        } catch {}
      };
      writer.on('finish', () => {
        done();
        resolve();
      });
      writer.on('error', (err) => {
        done();
        reject(err);
      });
      res.data.on('error', (err) => {
        done();
        reject(err);
      });
    });
    return filePath;
  } catch (err) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw err;
  }
}

function getTikTokHeaders() {
  let cookie = '';
  try {
    cookie = getCookie('tiktok', 'strings') || '';
  } catch {}
  return {
    ...(cookie ? { Cookie: cookie } : {}),
    Origin: 'https://www.tiktok.com',
    Referer: 'https://www.tiktok.com/',
  };
}

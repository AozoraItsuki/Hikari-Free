import { execa } from 'execa';
import { PATH } from '#lib/utils/helper';
import { resolveBinary } from '#lib/utils/installer';
const TIKTOK_COOKIES_PATH = PATH.cookie + 'tiktok.txt';
const YTDLP_BIN = resolveBinary('yt-dlp') ?? 'yt-dlp';
const GALLERYDL_BIN = resolveBinary('gallery-dl') ?? 'gallery-dl';
async function runYtDlp(url, cookiesPath = TIKTOK_COOKIES_PATH) {
  const { stdout } = await execa(YTDLP_BIN, ['--cookies', cookiesPath, '--dump-json', url], {
    timeout: 15000,
  });
  return JSON.parse(stdout);
}
async function runGalleryDl(url, cookiesPath = TIKTOK_COOKIES_PATH) {
  const { stdout } = await execa(GALLERYDL_BIN, ['--cookies', cookiesPath, '--resolve-json', url], {
    timeout: 15000,
  });
  return JSON.parse(stdout);
}
function parseYtDlp(data) {
  const bestFormat =
    (data.formats || [])
      .filter((f) => f.vcodec !== 'none' && f.format_note !== 'watermarked')
      .sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0] || null;
  const videoUrl = bestFormat?.url || data.url || null;
  return {
    source: 'yt-dlp',
    type: 'video',
    id: data.id,
    url: data.webpage_url || data.original_url,
    description: data.description || data.title || '',
    createdAt: data.timestamp ? new Date(data.timestamp * 1000).toISOString() : null,
    author: {
      id: data.uploader_id || null,
      username: data.uploader || null,
      nickname: data.channel || null,
    },
    stats: {
      views: data.view_count ?? null,
      likes: data.like_count ?? null,
      comments: data.comment_count ?? null,
      shares: data.repost_count ?? null,
      saves: data.save_count ?? null,
    },
    video: {
      url: videoUrl,
      width: bestFormat?.width ?? data.width ?? null,
      height: bestFormat?.height ?? data.height ?? null,
      duration: data.duration ?? null,
      thumbnail: data.thumbnail || null,
    },
  };
}
function parseGalleryDl(data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Unrecognized / empty gallery-dl JSON format');
  }
  const meta = data[0][1];
  const mediaEntries = data.slice(1).map((entry) => {
    const [, mediaUrl, itemMeta] = entry;
    return {
      mediaUrl,
      itemMeta,
    };
  });
  const images = mediaEntries
    .filter(({ itemMeta }) => itemMeta.type === 'image')
    .map(({ mediaUrl, itemMeta }) => ({
      url: mediaUrl,
      width: itemMeta.width ?? null,
      height: itemMeta.height ?? null,
      filename: itemMeta.filename ? `${itemMeta.filename}.${itemMeta.extension}` : null,
    }));
  const audioEntry = mediaEntries.find(({ itemMeta }) => itemMeta.type === 'audio');
  const videoEntry = mediaEntries.find(({ itemMeta }) => itemMeta.type === 'video');
  return {
    source: 'gallery-dl',
    type: images.length > 0 ? 'slideshow' : 'video',
    id: meta.id,
    url: `https://www.tiktok.com/@${meta.user}/video/${meta.id}`,
    description: meta.desc || '',
    createdAt: meta.createTime ? new Date(Number(meta.createTime) * 1000).toISOString() : null,
    author: {
      id: meta.author?.id ?? null,
      username: meta.author?.uniqueId ?? meta.user ?? null,
      nickname: meta.author?.nickname ?? null,
    },
    stats: {
      views: meta.stats?.playCount ?? null,
      likes: meta.stats?.diggCount ?? null,
      comments: meta.stats?.commentCount ?? null,
      shares: meta.stats?.shareCount ?? null,
      saves: meta.stats?.collectCount != null ? Number(meta.stats.collectCount) : null,
    },
    images,
    video: videoEntry
      ? {
          url: videoEntry.mediaUrl,
          width: videoEntry.itemMeta.width ?? null,
          height: videoEntry.itemMeta.height ?? null,
          duration: videoEntry.itemMeta.duration ?? null,
        }
      : null,
    music: audioEntry
      ? {
          url: audioEntry.mediaUrl,
          duration: audioEntry.itemMeta.duration ?? null,
          title: meta.music?.title ?? null,
          author: meta.music?.authorName ?? null,
        }
      : null,
  };
}
async function tiktokInfo(url, options = {}) {
  const { mode = 'auto', cookiesPath = TIKTOK_COOKIES_PATH } = options;
  if (mode === 'video') {
    const raw = await runYtDlp(url, cookiesPath);
    return parseYtDlp(raw);
  }
  if (mode === 'photo') {
    const raw = await runGalleryDl(url, cookiesPath);
    return parseGalleryDl(raw);
  }
  try {
    const raw = await runYtDlp(url, cookiesPath);
    return parseYtDlp(raw);
  } catch (err) {
    const raw = await runGalleryDl(url, cookiesPath);
    return parseGalleryDl(raw);
  }
}
export default tiktokInfo;

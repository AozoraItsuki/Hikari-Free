import { generateWAMessageContent, generateWAMessageFromContent } from 'baileys';
import { createZip } from '#lib/utils/zip';

const padName = (index, total) =>
  String(index).padStart(Math.max(2, String(total).length), '0') + '.webp';

const isWebp = (buffer) =>
  buffer.length > 12 &&
  Buffer.compare(buffer.subarray(0, 4), Buffer.from('RIFF', 'latin1')) === 0 &&
  Buffer.compare(buffer.subarray(8, 12), Buffer.from('WEBP', 'latin1')) === 0;

export async function buildStickerPack(conn, buffer, getFile, options = {}) {
  const { name = 'Sticker Pack', publisher = '', description = '', caption = '', cover } = options;
  const stickers = [];
  for (const src of buffer) {
    const file = await getFile(src);
    if (!file?.data?.length) throw new TypeError('sticker source produced no data');
    if (!isWebp(file.data)) {
      throw new TypeError('each sticker must be a .webp image (webp mime)');
    }
    stickers.push(file.data);
  }
  if (!stickers.length) throw new TypeError('sendStickerPack requires at least one sticker');
  let tray = Buffer.isBuffer(cover) ? cover : null;
  if (!tray && stickers.length) tray = stickers[0];
  if (!isWebp(tray)) {
    throw new TypeError('sticker pack cover must be a .webp image');
  }
  const entries = [{ name: 'tray.webp', data: tray }];
  stickers.forEach((sticker, index) => {
    entries.push({ name: padName(index, stickers.length), data: sticker });
  });
  const zip = createZip(entries);
  const upload = (payload) => generateWAMessageContent(payload, { upload: conn.waUploadToServer });
  const packMedia = await upload({
    document: zip,
    fileName: 'Sticker-Pack.zip',
    mimetype: 'application/zip',
    caption,
  });
  const documentMessage = packMedia.documentMessage;
  if (!documentMessage?.directPath) {
    throw new Error('failed to upload sticker pack archive');
  }
  const trayMedia = await upload({ image: tray });
  const trayMessage = trayMedia.imageMessage;
  return {
    stickerPackMessage: {
      name,
      publisher,
      packDescription: description,
      caption,
      stickers: stickers.map((_, index) => ({
        fileName: padName(index, stickers.length),
        isAnimated: false,
      })),
      fileLength: documentMessage.fileLength,
      fileSha256: documentMessage.fileSha256,
      fileEncSha256: documentMessage.fileEncSha256,
      mediaKey: documentMessage.mediaKey,
      directPath: documentMessage.directPath,
      mediaKeyTimestamp: documentMessage.mediaKeyTimestamp,
      trayIconFileName: 'tray.webp',
      thumbnailDirectPath: trayMessage.directPath,
      thumbnailSha256: trayMessage.fileSha256,
      thumbnailEncSha256: trayMessage.fileEncSha256,
      thumbnailHeight: trayMessage.height,
      thumbnailWidth: trayMessage.width,
      stickerPackSize: stickers.length,
      imageDataHash: tray.subarray(0, Math.min(64, tray.length)).toString('base64'),
    },
  };
}

export default function _sendStickerPack(ctx) {
  return {
    sendStickerPack: {
      async value(jid, stickers = [], opts = {}) {
        if (!jid) throw new TypeError('sendStickerPack requires a target jid');
        if (!Array.isArray(stickers) || !stickers.length) {
          throw new TypeError('sendStickerPack requires an array of sticker sources');
        }
        const { quoted, messageId, additionalNodes = [], ...options } = opts;
        const { stickerPackMessage } = await buildStickerPack(
          this,
          stickers,
          (src) => this.getFile(src),
          opts
        );
        const userJid = this.user?.id || this.user?.jid;
        const msg = generateWAMessageFromContent(
          jid,
          { stickerPackMessage },
          { userJid, messageId }
        );
        await this.relayMessage(jid, msg.message, {
          messageId: msg.key.id,
          additionalNodes,
          ...options,
        });
        return msg;
      },
      enumerable: true,
    },
  };
}

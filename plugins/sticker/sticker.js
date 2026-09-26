import config from '#config';
import { createSticker } from '#lib/media/sticker';
let hikari = async (m, { conn, usedPrefix, command }) => {
  try {
    let stiker = false;
    let q = m.quoted ? m.quoted : m;
    let mime = q.mimetype || q.mediaType || '';
    if (!mime)
      return m.reply(`Reply to an Image/Video/Sticker with Command ${usedPrefix + command}`);
    if (/webp|image|video/g.test(mime)) {
      if (/video/g.test(mime) && q.seconds > 10) return m.reply('Max 10 Seconds!');
      let img = await q.download();
      stiker = await createSticker(img, {
        pack: config.stickpack,
        author: config.stickauth,
      });
      await conn.sendFile(m.chat, stiker, 'sticker.webp', '', m);
    }
  } catch (err) {
    if (/File too large/i.test(err.message)) {
      return m.reply('file size too large');
    }
    return m.reply('Failed to create sticker: ' + (err.message || err));
  }
};
hikari.help = ['sticker'];
hikari.command = /^s(tic?ker)?(gif)?$/i;
export default hikari;

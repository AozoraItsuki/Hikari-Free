import { toAudio } from '#lib/utils/converter';
let hikari = async (m, { conn, usedPrefix, command }) => {
  try {
    let notStickerMessage = `Send/Reply to a video with command *${usedPrefix + command}*`;
    if (!m.quoted) return m.reply(notStickerMessage);
    let q = m.quoted ? m.quoted : m;
    let mime = q.mediaType || '';
    if (!/video/.test(mime)) return m.reply(notStickerMessage);
    let buffer = await q.download();
    let { data } = await toAudio(buffer);
    await conn.sendMessage(m.chat, {
      audio: data,
      ptt: false,
    });
  } catch (e) {
    return m.reply('Failed: ' + e.message);
  }
};
hikari.help = ['toaudio'];
hikari.command = /^(to(aud(io)?|mp3))$/i;
export default hikari;

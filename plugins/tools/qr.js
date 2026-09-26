import { hkNet } from '#lib/utils/network';

let hikari = async (m, { conn, text, usedPrefix, command }) => {
  if (!text)
    return m.reply(
      `Usage: ${usedPrefix + command} <text>\nExample: ${usedPrefix + command} hello world`
    );
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text.trim())}`;
  const ok = await hkNet
    .get(url, { responseType: 'arraybuffer' })
    .then((r) => r.status === 200)
    .catch(() => false);
  if (!ok) return m.reply('Failed to generate QR code.');
  return conn.sendMessage(m.chat, { image: { url }, caption: `🔳 ${text.trim()}` }, { quoted: m });
};
hikari.help = ['qr'];
hikari.command = ['qr', 'qrcode'];
hikari.tags = ['tools'];
export default hikari;

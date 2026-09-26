import { db } from '#src/database';
const DAY = 86400000;
const PREFIXES = ['.', '!', '#', '/'];
let handler = async (m) => {
  try {
    const text = (m.text || '').trim();
    if (!text || !PREFIXES.includes(text[0])) return;
    const user = db.data.users[m.sender];
    if (!user) return;
    const now = Date.now();
    if (user.lastUpsell && now - user.lastUpsell < DAY) return;
    user.lastUpsell = now;
    await m.reply(
      `🌟 You are using *Hikari-Free* (10 commands).\nGet 350+ plugins in the full version:\n💬 https://wa.me/6285129987364`
    );
  } catch (e) {}
};
handler.before = handler;
export default handler;

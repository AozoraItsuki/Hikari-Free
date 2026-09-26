import { db } from '#src/database';
export async function before(m, { conn }) {
  let chat = db.data.chats[m.chat];
  let user = db.data.users[m.sender];
  let setting = db.data.settings[conn.user.jid];
  if (!m.isGroup) return;
  if (m.isBaileys || m.fromMe) return;
  if (chat.isBanned || chat.mute || user.banned) return;
  if (typeof chat.store[m.text] !== 'undefined') {
    let { media, caption } = chat.store[m.text];
    if (setting.composing) await this.sendPresenceUpdate('composing', m.chat);
    if (setting.autoread) await this.readMessages([m.key]);
    if (media) {
      await conn.sendFile(m.chat, media, false, caption, m);
    } else {
      await m.reply(caption);
    }
  }
  return !0;
}

import { db } from '#src/database';
let hikari = (m) => m;
hikari.before = async function (m, { conn, isAdmin, isBotAdmin }) {
  if (m.isGroup) {
    let chat = db.data.chats[m.chat];
    if (chat.antiBot) {
      if (m.isBaileys || /^(BAE|B1E|3EB0|WA)/.test(m.id)) {
        if (!m.fromMe) {
          if (!isBotAdmin) return;
          await conn.sendMessage(m.chat, {
            text: `*[ System notice ]* another bot detected`,
          });
          try {
            await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove');
          } catch {}
        }
      }
    }
  }
};
export default hikari;

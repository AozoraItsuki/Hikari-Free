import { db } from '#src/database';
export async function before(m, { conn }) {
  let chat = db.data.chats[m.chat];
  let user = db.data.users[m.sender];
  let setting = db.data.settings[conn.user.jid];
  if (!m.isGroup) return;
  if (m.isBaileys || m.fromMe) return;
  if (chat.isBanned || chat.mute || user.banned) return;
  const isStatusMention =
    m.mtype === 'groupStatusMentionMessage' ||
    m.message?.protocolMessage?.type === 'STATUS_MENTION_MESSAGE';
  if (isStatusMention) {
    const antiTagEnabled = chat.antiTagSw !== undefined ? chat.antiTagSw : false;
    if (antiTagEnabled) {
      try {
        await conn.sendMessage(m.chat, {
          delete: m.key,
        });
        await conn.sendMessage(
          m.chat,
          {
            text: `❌ Status mention detected and deleted!\n@${m.sender.split('@')[0]} please don't tag status in this group.`,
            mentions: [m.sender],
          },
          {
            quoted: m,
          }
        );
        return true;
      } catch (error) {}
    }
  }
  return true;
}

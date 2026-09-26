import { db } from '#src/database';
let linkRegex =
  /\b(anj(k|g)|ajn?(g|k)|a?njin(g|k)|bajingan|b(a?n)?gsa?t|ko?nto?l|me?me?(k|q)|pe?pe?(k|q)|meki|titi(t|d)|pe?ler|tetek|toket|ngewe|go?blo?k|to?lo?l|idiot|(k|ng)e?nto?(t|d)|jembut|bego|dajj?al|janc(u|o)k|pantek|puki ?(mak)?|kimak|kampang|lonte|col(i|mek?)|pelacur|henceu?t|nigga|fuck|dick|bitch|tits|bastard|asshole)\b/i;
export async function before(m, { conn, isBotAdmin }) {
  if (m.isBaileys || m.fromMe) return;
  let chat = db.data.chats[m.chat];
  let setting = db.data.settings[conn.user.jid];
  let isGroupToxic = linkRegex.exec(m.text);
  if (chat.antiToxic && isGroupToxic && m.isGroup) {
    if (!isBotAdmin) return;
    if (setting.composing) await this.sendPresenceUpdate('composing', m.chat);
    if (setting.autoread) await this.readMessages([m.key]);
    await conn.sendMessage(m.chat, {
      delete: m.key,
    });
    let quotedCustom = {
      key: {
        remoteJid: m.sender,
        fromMe: false,
        id: m.key.id,
      },
      message: {
        extendedTextMessage: {
          text: 'bad word 😹',
          matchedText: null,
          contextInfo: {
            mentionedJid: [m.sender],
          },
        },
      },
    };
    await conn.sendMessage(
      m.chat,
      {
        text: 'Ｌｅｔｓ Ｎｏｔ Ｂｅ Ｔｏｘｉｃ！！',
      },
      {
        quoted: quotedCustom,
      }
    );
  }
  return !0;
}

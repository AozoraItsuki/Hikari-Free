import { db } from '#src/database';
import config from '#config';
const linkGcRegex = /(https?:\/\/)?(chat\.whatsapp\.com)\/([0-9A-Za-z]{20,24})/i;
const linkChRegex = /https?:\/\/whatsapp\.com\/channel\/[A-Za-z0-9_-]+/i;
const anyLinkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i;
export async function before(m, { conn, isBotAdmin, isAdmin }) {
  try {
    if ((m.isBaileys && m.fromMe) || m.fromMe || !m.isGroup) return true;
    const chat = db.data.chats[m.chat] || {};
    const text = ((m.text || '') + (m.caption || '')).trim();
    if (!text) return true;
    const isGroupLink = linkGcRegex.test(text);
    const isChannelLink = linkChRegex.test(text);
    const isAnyLink = anyLinkRegex.test(text);
    async function punish(
      reasonTitle = 'ANTI LINK',
      reasonDetail = 'Your Message Has Been Deleted 🚫'
    ) {
      const warnMsg = await conn.sendMessage(
        m.chat,
        {
          text: `*「 ${reasonTitle} 」*\n\n❗ ${reasonDetail}`,
        },
        {
          quoted: {
            key: {
              remoteJid: '0@s.whatsapp.net',
              id: m.id,
              fromMe: false,
            },
            message: {
              conversation: config.group || `(^_^)`,
            },
          },
        }
      );
      if (isAdmin) {
        await m.reply("*Oh wait, it's an admin 😹 - never mind never mind*");
        await conn.delay(500);
        await conn.sendMessage(m.chat, {
          delete: warnMsg.key,
        });
        return;
      }
      if (!isBotAdmin) {
        await m.reply("*I can't delete it, not an admin 😒*");
        return;
      }
      if (!isBotAdmin) return;
      if (isGroupLink) {
        let myInvite = '';
        try {
          myInvite = 'https://chat.whatsapp.com/' + (await conn.groupInviteCode(m.chat));
        } catch {}
        if (myInvite) {
          const myInviteEsc = myInvite.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const reMy = new RegExp(myInviteEsc, 'i');
          if (reMy.test(text)) {
            await m.reply('*Oh sorry, this is my own group, forgot lol😹*');
            return;
          }
        }
      }
      try {
        await conn.sendMessage(m.chat, {
          delete: m.key,
        });
      } catch (e) {}
    }
    if (isGroupLink && chat.antiLinkGc) {
      await punish(
        'ANTI LINK (GROUP)',
        'You Were Detected Sending Another Group Link\n\nYour Message Has Been Deleted 🚫'
      );
      return true;
    }
    if (isChannelLink && chat.antiLinkCh) {
      await punish(
        'ANTI LINK (CHANNEL)',
        'WhatsApp Channel URL detected\n\nYour Message Has Been Deleted 🚫'
      );
      return true;
    }
    if (chat.antiLinks && isAnyLink) {
      await punish(
        'ANTI LINK',
        'You Were Detected Sending a Link\n\nYour Message Has Been Deleted 🚫'
      );
      return true;
    }
    return true;
  } catch (err) {
    return true;
  }
}

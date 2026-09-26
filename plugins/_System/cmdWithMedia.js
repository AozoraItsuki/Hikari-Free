import config from '#config';
import { proto, generateWAMessage } from 'baileys';
import { db } from '#src/database';
export async function before(m, { conn, chatUpdate }) {
  try {
    const user = db.data.users[m.sender];
    if (!user) return;
    const owners = conn?.botProfile?.owner ?? config.owner;
    const devNumbers = owners
      .filter(([number, _, isDev]) => number && isDev)
      .map(([number]) => number.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
    const ownerNumbers = owners
      .filter(([number, _, isDev]) => number && !isDev)
      .map(([number]) => number.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
    const botNumber = this.decodeJid(this.user.id);
    const isMods = [botNumber, ...devNumbers].includes(m.sender);
    const isOwner = m.fromMe || isMods || [botNumber, ...ownerNumbers].includes(m.sender);
    const isPrems = isOwner || new Date() - user.premiumTime < 0;
    if (m.isBaileys || m.fromMe || !m.message || !isPrems || !m.msg?.fileSha256) return;
    db.data.users[m.sender].sticker = db.data.users[m.sender].sticker || {};
    const fileHash = Buffer.from(m.msg.fileSha256).toString('base64');
    const userStickerData = db.data.users[m.sender].sticker;
    if (!(fileHash in userStickerData)) return;
    const { text, mentionedJid } = userStickerData[fileHash];
    const messages = await generateWAMessage(
      m.chat,
      {
        text,
        mentions: mentionedJid,
      },
      {
        userJid: this.user.id,
        quoted: m.quoted && m.quoted.fakeObj,
      }
    );
    messages.key = {
      remoteJid: m.chat,
      fromMe: false,
      id: m.key.id,
      participant: m.sender,
    };
    messages.pushName = m.pushName;
    const msg = {
      ...chatUpdate,
      messages: [proto.WebMessageInfo.fromObject(messages)],
      type: 'append',
    };
    this.ev.emit('messages.upsert', msg);
  } catch (error) {}
}

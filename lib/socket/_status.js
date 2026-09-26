import crypto from 'crypto';
import {
  STORIES_JID,
  delay,
  generateWAMessageContent,
  generateWAMessageFromContent,
  isJidGroup,
  jidNormalizedUser,
} from 'baileys';

const colorToArgb = (color) => {
  if (typeof color === 'number') {
    return (color > 0 ? color : 0xffffffff + Number(color) + 1) >>> 0;
  }
  const str = String(color).trim();
  if (/^0x[0-9a-f]{8}$/i.test(str)) return parseInt(str, 16) >>> 0;
  const hex = str.replace(/^#/, '');
  if (/^[0-9a-f]{1,6}$/i.test(hex)) return parseInt('FF' + hex.padStart(6, '0'), 16) >>> 0;
  return null;
};

export function statusColors(content, isMedia) {
  const randomHex = () =>
    '#' +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, '0');
  const textOnly = !isMedia;
  return {
    font: textOnly ? (content.font ?? Math.floor(Math.random() * 9)) : undefined,
    textArgb: textOnly ? colorToArgb(content.textColor ?? randomHex()) : undefined,
    backgroundArgb:
      !isMedia || content.audio ? colorToArgb(content.backgroundColor ?? randomHex()) : undefined,
  };
}

export const toParticipantJid = (raw) => {
  const str = String(raw ?? '').trim();
  if (!str) return '';
  if (!/@/.test(str)) return str.replace(/\D/g, '') + '@s.whatsapp.net';
  return jidNormalizedUser(str);
};

export async function expandRecipients(conn, jids) {
  const userJid = jidNormalizedUser(conn.user?.id || conn.user?.jid || '0@s.whatsapp.net');
  const set = new Set([userJid]);
  for (const raw of jids || []) {
    const jid = toParticipantJid(raw);
    if (!jid) continue;
    if (isJidGroup(jid)) {
      try {
        const metadata = await conn.groupMetadata(jid);
        for (const p of metadata?.participants || []) set.add(jidNormalizedUser(p.id));
      } catch {
        set.add(jid);
      }
    } else {
      set.add(jid);
    }
  }
  return [...set];
}

export async function buildStatusStory(conn, content, colors = {}) {
  const { font, textArgb, backgroundArgb } = colors;
  const body = { ...content };
  const isMedia = !!(body.image || body.video || body.audio);
  if (isMedia && body.text && !body.caption) {
    body.caption = body.text;
    delete body.text;
  }
  const prepped = await generateWAMessageContent(body, {
    upload: conn.waUploadToServer,
    backgroundColor: backgroundArgb ?? body.backgroundColor,
    font: font ?? body.font,
  });
  const key = Object.keys(prepped)[0];
  if (textArgb !== undefined && prepped[key] && typeof prepped[key] === 'object') {
    prepped[key].textArgb = textArgb;
  }
  const userJid = jidNormalizedUser(conn.user?.id || conn.user?.jid || '0@s.whatsapp.net');
  return generateWAMessageFromContent(STORIES_JID, prepped, { userJid });
}

export async function sendMentionProtocol(conn, jids, storyKey) {
  const userJid = jidNormalizedUser(conn.user?.id || conn.user?.jid || '0@s.whatsapp.net');
  const results = [];
  for (const raw of jids || []) {
    const jid = toParticipantJid(raw);
    if (!jid || jid === userJid) continue;
    const isGroup = isJidGroup(jid);
    const type = isGroup ? 'groupStatusMentionMessage' : 'statusMentionMessage';
    const protocolMessage = {
      [type]: {
        message: {
          protocolMessage: {
            key: storyKey,
            type: 25,
          },
        },
      },
      messageContextInfo: {
        messageSecret: crypto.randomBytes(32),
      },
    };
    const msg = generateWAMessageFromContent(jid, protocolMessage, { userJid });
    await conn.relayMessage(jid, msg.message, {
      messageId: msg.key.id,
      additionalNodes: [
        {
          tag: 'meta',
          attrs: isGroup ? { is_group_status_mention: 'true' } : { is_status_mention: 'true' },
        },
      ],
    });
    results.push(jid);
    await delay(500);
  }
  return results;
}

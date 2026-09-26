import { generateWAMessageFromContent } from 'baileys';

export function buildPaymentMessage(data, { quoted, sender } = {}) {
  const {
    amount = 0,
    currency = 'IDR',
    note,
    sticker,
    from = '0@s.whatsapp.net',
    expiry = 0,
    background,
  } = data;
  const quotedInfo =
    quoted?.key && quoted?.message
      ? {
          stanzaId: quoted.key.id,
          participant: quoted.key.participant || sender,
          quotedMessage: quoted.message,
        }
      : null;
  let noteMessage = {};
  if (sticker?.stickerMessage) {
    noteMessage = {
      stickerMessage: {
        ...sticker.stickerMessage,
        contextInfo: quotedInfo ?? {},
      },
    };
  } else if (note) {
    noteMessage = {
      extendedTextMessage: {
        text: String(note),
        contextInfo: quotedInfo ?? {},
      },
    };
  }
  const amount1000 =
    typeof amount === 'string' && /^[0-9a-zA-Z]{6,16}$/.test(amount)
      ? parseInt(amount, 36)
      : Math.round(Number(amount) || 0);
  return {
    requestPaymentMessage: {
      currencyCodeIso4217: currency,
      amount1000,
      noteMessage,
      requestFrom: from,
      expiryTimestamp: Number(expiry) || 0,
      background: background ?? {
        id: 'DEFAULT',
        placeholderArgb: 0xfff0f0f0,
        textArgb: 0xff00ff00,
        subtextArgb: 0xffeeeeee,
      },
    },
  };
}

export default function _sendPayment(ctx) {
  return {
    sendPayment: {
      async value(jid, opts = {}, sendOpts = {}) {
        if (!jid) throw new TypeError('sendPayment requires a target jid');
        const { quoted, messageId, additionalNodes = [], ...options } = sendOpts;
        const userJid = this.user?.id || this.user?.jid;
        const msg = generateWAMessageFromContent(
          jid,
          buildPaymentMessage(opts, {
            quoted,
            sender: opts.sender || userJid,
          }),
          {
            userJid,
            messageId,
            ...options,
          }
        );
        await this.relayMessage(jid, msg.message, {
          messageId: msg.key.id,
          additionalNodes,
          ...options,
        });
        return msg;
      },
      enumerable: true,
    },
  };
}

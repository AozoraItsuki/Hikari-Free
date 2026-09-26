import { proto, generateForwardMessageContent, generateWAMessageFromContent } from 'baileys';

export default function _copyNForward(ctx) {
  return {
    copyNForward: {
      async value(jid, message, forwardingScore = true, options = {}) {
        let vtype;
        if (options.readViewOnce && message.message.viewOnceMessage?.message) {
          vtype = Object.keys(message.message.viewOnceMessage.message)[0];
          delete message.message.viewOnceMessage.message[vtype].viewOnce;
          message.message = proto.Message.create(
            JSON.parse(JSON.stringify(message.message.viewOnceMessage.message))
          );
          message.message[vtype].contextInfo = message.message.viewOnceMessage.contextInfo;
        }
        const mtype = Object.keys(message.message)[0];
        let m = generateForwardMessageContent(message, !!forwardingScore);
        const ctype = Object.keys(m)[0];
        if (forwardingScore && typeof forwardingScore === 'number' && forwardingScore > 1) {
          m[ctype].contextInfo.forwardingScore += forwardingScore;
        }
        m[ctype].contextInfo = {
          ...(message.message[mtype].contextInfo || {}),
          ...(m[ctype].contextInfo || {}),
        };
        m = generateWAMessageFromContent(jid, m, {
          ...options,
          userJid: this.user.jid,
        });
        await this.relayMessage(jid, m.message, {
          messageId: m.key.id,
          additionalAttributes: {
            ...options,
          },
        });
        return m;
      },
      enumerable: true,
    },
  };
}

import { proto, areJidsSameUser } from 'baileys';

export default function _cMod(ctx) {
  return {
    cMod: {
      value(jid, message, text = '', sender = this.user.jid, options = {}) {
        if (options.mentions && !Array.isArray(options.mentions)) {
          options.mentions = [options.mentions];
        }
        const copy = message.toJSON();
        delete copy.message.messageContextInfo;
        delete copy.message.senderKeyDistributionMessage;
        const mtype = Object.keys(copy.message)[0];
        const msg = copy.message;
        const content = msg[mtype];
        if (typeof content === 'string') {
          msg[mtype] = text || content;
        } else if (content.caption) {
          content.caption = text || content.caption;
        } else if (content.text) {
          content.text = text || content.text;
        }
        if (typeof content !== 'string') {
          msg[mtype] = {
            ...content,
            ...options,
          };
          msg[mtype].contextInfo = {
            ...(content.contextInfo || {}),
            mentionedJid: options.mentions || content.contextInfo?.mentionedJid || [],
          };
        }
        if (copy.participant) {
          sender = copy.participant = sender || copy.participant;
        } else if (copy.key.participant) {
          sender = copy.key.participant = sender || copy.key.participant;
        }
        if (copy.key.remoteJid.includes('@s.whatsapp.net')) {
          sender = sender || copy.key.remoteJid;
        } else if (copy.key.remoteJid.includes('@broadcast')) {
          sender = sender || copy.key.remoteJid;
        }
        copy.key.remoteJid = jid;
        copy.key.fromMe = areJidsSameUser(sender, this.user.id) || false;
        return proto.WebMessageInfo.create(copy);
      },
      enumerable: true,
    },
  };
}

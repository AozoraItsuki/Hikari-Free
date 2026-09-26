import { areJidsSameUser } from 'baileys';

export default function _fakeReply(ctx) {
  return {
    fakeReply: {
      value(jid, text = '', fakeJid = this.user.jid, fakeText = '', fakeGroupJid, options) {
        return this.reply(jid, text, {
          key: {
            fromMe: areJidsSameUser(fakeJid, this.user.id),
            participant: fakeJid,
            ...(fakeGroupJid
              ? {
                  remoteJid: fakeGroupJid,
                }
              : {}),
          },
          message: {
            conversation: fakeText,
          },
          ...options,
        });
      },
    },
  };
}

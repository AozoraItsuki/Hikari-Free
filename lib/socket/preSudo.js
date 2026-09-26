import { generateWAMessage, proto, areJidsSameUser } from 'baileys';

export default function _preSudo(ctx) {
  return {
    preSudo: {
      async value(text, who, m, chatupdate) {
        const messages = await generateWAMessage(
          m.chat,
          {
            text,
            mentions: await this.parseMention(text),
          },
          {
            userJid: who,
            quoted: m.quoted?.fakeObj,
          }
        );
        messages.key.fromMe = areJidsSameUser(who, this.user.id);
        messages.key.id = m.key.id;
        messages.pushName = m.name;
        if (m.isGroup) messages.key.participant = messages.participant = who;
        return {
          ...chatupdate,
          messages: [proto.WebMessageInfo.create(messages)].map((v) => {
            v.conn = this;
            return v;
          }),
          type: 'append',
        };
      },
    },
  };
}

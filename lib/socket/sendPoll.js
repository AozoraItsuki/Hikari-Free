import { db } from '#src/database';

export default function _sendPoll(ctx) {
  return {
    sendPoll: {
      async value(jid, question, options = [], opts = {}) {
        if (typeof question !== 'string' || !question.trim()) {
          throw new TypeError('poll question must be a non-empty string');
        }
        const values = (Array.isArray(options) ? options : [options])
          .map((v) => String(v ?? '').trim())
          .filter(Boolean)
          .slice(0, 12);
        if (!values.length) throw new TypeError('poll options must be a non-empty array');
        const { multipleChoice = false, quoted, ...sendOptions } = opts;
        const useButton = !!(db?.data?.settings?.[this.user?.jid]?.button === true);
        if (useButton) {
          return this.sendMessage(
            jid,
            {
              poll: {
                name: question,
                values,
                selectableCount: multipleChoice ? values.length : 1,
              },
            },
            {
              quoted,
              ...sendOptions,
            }
          );
        }
        const lines = values.map((v, i) => `*${i + 1}.* ${v}`);
        const caption = `${question.trim()}\n${lines.join('\n')}`.trim();
        return this.reply(jid, caption, quoted, sendOptions);
      },
      enumerable: true,
    },
  };
}

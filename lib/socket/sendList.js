import { readmore } from '#lib/utils/helper';
import { db } from '#src/database';

export default function _sendList(ctx) {
  return {
    sendList: {
      async value(jid, data = {}, opts = {}) {
        const {
          title = '',
          text = '',
          footer = '',
          buttonText = 'Menu',
          sections = [],
          quoted,
          ...sendOptions
        } = data;
        if (typeof text !== 'string' || !text.trim()) {
          throw new TypeError('list text is required');
        }
        const cleanSections = sections.slice(0, 10).map((s) => ({
          title: String(s?.title || ''),
          rows: (s?.rows || []).slice(0, 10).map((r) => ({
            title: String(r?.title || ''),
            rowId: String(r?.rowId || r?.id || ''),
            description: r?.description ? String(r.description) : undefined,
          })),
        }));
        if (!cleanSections.length) throw new TypeError('list sections must be a non-empty array');
        const useButton = !!(db?.data?.settings?.[this.user?.jid]?.button === true);
        if (useButton) {
          return this.sendMessage(
            jid,
            {
              text,
              footer,
              title,
              buttonText,
              sections: cleanSections,
            },
            {
              quoted,
              ...sendOptions,
            }
          );
        }
        const flat = [];
        for (const s of cleanSections) {
          for (const r of s.rows) flat.push([s.title, r]);
        }
        const list = flat.map(([, r], i) => [r.rowId, String(i + 1), r.title]);
        const lines = flat.map(([sec, r], i) => `*${i + 1}.* ${r.title}${sec ? `\n> ${sec}` : ''}`);
        const caption =
          `${text}\n${readmore()}\nPlease reply to this message with the number 1 - ${flat.length}\n${lines.join('\n\n')}`.trim();
        const sent = await this.reply(jid, caption, quoted, sendOptions);
        const id = sent?.key?.id;
        if (id) {
          if (!this.replyText) this.replyText = {};
          this.replyText[id] = { text: caption, list, command: false, timestamp: Date.now() };
        }
        return sent;
      },
      enumerable: true,
    },
  };
}

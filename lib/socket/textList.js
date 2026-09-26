import config from '#config';
import { readmore } from '#lib/utils/helper';
import { db } from '#src/database';

export default function _textList(ctx) {
  return {
    textList: {
      async value(jid, text, image, list = [], m, options = {}) {
        if (!Array.isArray(list)) list = [];
        const useButton = !!(db?.data?.settings?.[this.user?.jid]?.button === true);
        if (useButton && list.length > 0) {
          const rows = list.map((item) => {
            const [command, number, title] = item;
            return {
              id: String(command),
              title: (title || '').split('\n')[0]?.trim() || (command || '').toString(),
              description:
                (title || '')
                  .split('\n')
                  .slice(1)
                  .map((v) => v.trim())
                  .filter(Boolean)
                  .join(' • ') || '',
            };
          });
          const section = {
            title: 'Daftar Pilihan',
            rows,
          };
          if (options.highlightLabel) section.highlight_label = options.highlightLabel;
          return await this.sendMessage(
            jid,
            {
              nativeFlow: true,
              text,
              footer: config.watermark,
              image,
              interactiveButtons: [
                {
                  name: 'single_select',
                  buttonParamsJson: JSON.stringify({
                    title: 'Select option',
                    sections: [section],
                  }),
                },
              ],
            },
            {
              quoted: m,
              ...options,
            }
          );
        }
        const maxIndex = list.length;
        const startNumber = list[0]?.[1] ?? 1;
        const lines = [];
        for (let i = 0; i < list.length; i++) {
          const [cmd, num, title] = list[i];
          lines.push(`*${num}.* ${title}`);
        }
        const bodyList = options.noList || list.length === 0 ? '' : lines.join('\n\n');
        const caption =
          `${text}\n${readmore()}\nPlease reply to this message with the number ${startNumber} - ${maxIndex}\n${bodyList}`.trim();
        let sent;
        if (image) sent = await this.sendFile(jid, image, null, caption, m, false, options);
        else sent = await this.reply(jid, caption, m, options);
        const id = sent?.key?.id;
        if (id) {
          if (!this.replyText) this.replyText = {};
          this.replyText[id] = {
            text: caption,
            list,
            command: false,
            timestamp: Date.now(),
          };
        }
        return sent;
      },
      enumerable: true,
    },
  };
}

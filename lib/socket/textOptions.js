import config from '#config';
import { db } from '#src/database';

export default function _textOptions(ctx) {
  return {
    textOptions: {
      async value(jid, text, image, list = [], m, options = {}) {
        if (!Array.isArray(list)) list = [];
        const useButton = db.data.settings[this.user.jid]?.button === true;
        if (useButton && list.length > 0) {
          const buttons = list.map(([cmd, disp]) => ({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: disp,
              id: cmd,
            }),
          }));
          return await this.sendMessage(
            jid,
            {
              nativeFlow: true,
              text,
              footer: config.watermark,
              image,
              interactiveButtons: buttons,
            },
            {
              quoted: m,
              ...options,
            }
          );
        }
        const caption = `${text}
Please reply to this message with *${list[0]?.[1] || ''}*${list.length > 1 ? ` or *${list[1][1]}*` : ''}`.trim();
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

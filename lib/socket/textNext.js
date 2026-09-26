import config from '#config';
import { db } from '#src/database';

export default function _textNext(ctx) {
  return {
    textNext: {
      async value(jid, text, image, trigger, command, m, options = {}) {
        const useButton = db.data.settings[this.user.jid]?.button === true;
        if (useButton) {
          return await this.sendMessage(
            jid,
            {
              nativeFlow: true,
              text: text.trim(),
              footer: config.watermark,
              image,
              interactiveButtons: [
                {
                  name: 'quick_reply',
                  buttonParamsJson: JSON.stringify({
                    display_text: trigger,
                    id: command,
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
        const caption = text.trim();
        let sent;
        if (image) sent = await this.sendFile(jid, image, null, caption, m, false, options);
        else sent = await this.reply(jid, caption, m, options);
        const id = sent?.key?.id;
        if (id) {
          if (!this.replyText) this.replyText = {};
          this.replyText[id] = {
            text: caption,
            command,
            trigger,
            timestamp: Date.now(),
          };
        }
        return sent;
      },
      enumerable: true,
    },
  };
}

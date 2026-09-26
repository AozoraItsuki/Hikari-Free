import config from '#config';
import fs from 'fs';
import { db } from '#src/database';

export default function _reply(ctx) {
  return {
    reply: {
      value(jid, text = '', quoted, options = {}) {
        if (Buffer.isBuffer(text)) {
          return this.sendFile(jid, text, 'file', '', quoted, false, options);
        }
        if (db.data.settings[this.user.jid].adReply) {
          const thumbs = ['thumb-1', 'thumb-2', 'thumb-3', 'thumb-4', 'thumb-5'];
          return this.adReply(
            jid,
            text,
            config.watermark,
            '',
            fs.readFileSync('./media/' + thumbs.getRandom() + '.jpg'),
            false,
            quoted,
            false,
            false,
            options
          );
        }
        return this.sendMessage(
          jid,
          {
            text,
            ...options,
          },
          {
            quoted,
            ...options,
          }
        );
      },
    },
  };
}

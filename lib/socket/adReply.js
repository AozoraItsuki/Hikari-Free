import fs from 'fs';
import { PATH as locate } from '#lib/utils/helper';

export default function _adReply(ctx) {
  return {
    adReply: {
      async value(
        jid,
        text,
        title = '',
        body = '',
        buffer,
        source = '',
        quoted,
        large = true,
        options = {}
      ) {
        const { data } = await this.getFile(buffer, true);
        const hwaifu = JSON.parse(fs.readFileSync(locate.json + '/hwaifu.json', 'utf-8'));
        return this.sendMessage(
          jid,
          {
            text,
            contextInfo: {
              mentionedJid: await this.parseMention(text),
              externalAdReply: {
                showAdAttribution: false,
                mediaType: 1,
                title,
                body,
                thumbnail: data,
                renderLargeThumbnail: large,
                mediaUrl: hwaifu.getRandom(),
                sourceUrl: source,
              },
            },
          },
          {
            quoted,
            ...options,
          }
        );
      },
      enumerable: true,
    },
  };
}

const RATIOS = {
  landscape: { w: 512, h: 288 },
  portrait: { w: 288, h: 512 },
  square: { w: 320, h: 320 },
};

async function prepareAdThumb(conn, thumbnail, { type, ratio, icon }) {
  let bytes;
  if (thumbnail) {
    try {
      const file = await conn.getFile(thumbnail);
      bytes = file.data;
    } catch {
      bytes = undefined;
    }
  }
  if (type === 'preview-link' && bytes) {
    const dim = RATIOS[ratio] || RATIOS.landscape;
    try {
      bytes = await conn.resize(bytes, dim.w, dim.h);
    } catch {
      // keep original thumbnail if resize fails
    }
  }
  const url = !bytes && typeof icon === 'string' ? icon : undefined;
  return { bytes, url };
}

export default function _sendMessageModify(ctx) {
  return {
    sendMessageModify: {
      async value(jid, text, opts = {}) {
        if (!jid) throw new TypeError('sendMessageModify requires a target jid');
        if (typeof text !== 'string')
          throw new TypeError('sendMessageModify requires a text string');
        const {
          title = '',
          body = '',
          url = 'https://wa.me/',
          thumbnail,
          icon,
          large = true,
          ads = false,
          type,
          ratio,
          quoted,
          ...options
        } = opts;
        const { bytes, url: thumbnailUrl } = await prepareAdThumb(this, thumbnail, {
          type,
          ratio,
          icon,
        });
        return this.sendMessage(
          jid,
          {
            text,
            contextInfo: {
              ...(this.parseMention?.(text).length
                ? { mentionedJid: this.parseMention(text) }
                : {}),
              externalAdReply: {
                title,
                body,
                mediaType: bytes ? 1 : 0,
                ...(thumbnailUrl ? { thumbnailUrl } : {}),
                mediaUrl: url,
                sourceUrl: url,
                ...(bytes ? { thumbnail: bytes } : {}),
                renderLargerThumbnail: large,
                showAdAttribution: ads,
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

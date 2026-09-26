import { prepareWAMessageMedia } from 'baileys';

export default function _sendLinkPreview(ctx) {
  return {
    sendLinkPreview: {
      async value(jid, text, linkUrl, title, description = '', thumbnail, sendOptions = {}) {
        if (typeof jid !== 'string') throw new TypeError('jid is not string');
        if (typeof text !== 'string') throw new TypeError('text is not string');
        if (typeof linkUrl !== 'string') throw new TypeError('link is not string');
        if (typeof title !== 'string') throw new TypeError('title is not string');
        let image;
        if (thumbnail) {
          const source = Buffer.isBuffer(thumbnail) ? thumbnail : thumbnail.url || thumbnail;
          const media = await prepareWAMessageMedia(
            {
              image: source,
            },
            {
              upload: this.waUploadToServer,
              mediaTypeOverride: 'thumbnail-link',
            }
          );
          image = media.imageMessage;
        }
        const value = text.includes(linkUrl) ? text : `${linkUrl}\n${text}`;
        return this.sendMessage(
          jid,
          {
            text: value,
            linkPreview: {
              'matched-text': linkUrl,
              title,
              description,
              jpegThumbnail: image?.jpegThumbnail,
              highQualityThumbnail: image,
            },
          },
          sendOptions
        );
      },
      enumerable: true,
    },
  };
}

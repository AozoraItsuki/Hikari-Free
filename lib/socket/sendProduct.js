import { generateWAMessageFromContent, generateWAMessageContent } from 'baileys';

export async function buildProductMessage(data, ctx) {
  const {
    title,
    description = '',
    thumbnail,
    productId,
    retailerId = '',
    url = '',
    body = '',
    footer = '',
    buttons = [],
    priceAmount1000 = 0,
    currencyCode = 'IDR',
  } = data;
  if (!title) throw new TypeError('sendProduct requires a title');
  let productImage;
  if (Buffer.isBuffer(thumbnail) || thumbnail?.url || ctx.isValidUrl(thumbnail)) {
    const file = await ctx.getFile(thumbnail);
    const { imageMessage } = await generateWAMessageContent(
      { image: file.data },
      { upload: ctx.waUploadToServer }
    );
    productImage = imageMessage;
  }
  return {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          body: { text: String(body) },
          footer: { text: String(footer) },
          header: {
            title: String(title),
            hasMediaAttachment: !!productImage,
            productMessage: {
              product: {
                productImage,
                productId: String(productId ?? ''),
                title: String(title),
                description: String(description),
                currencyCode,
                priceAmount1000: Number(priceAmount1000) || 0,
                retailerId,
                url,
                productImageCount: productImage ? 1 : 0,
              },
              businessOwnerJid: '0@s.whatsapp.net',
            },
          },
          nativeFlowMessage: {
            buttons: Array.isArray(buttons) ? buttons : [],
          },
        },
      },
    },
  };
}

export default function _sendProduct(ctx) {
  return {
    sendProduct: {
      async value(jid, data, opts = {}) {
        if (!jid) throw new TypeError('sendProduct requires a target jid');
        const { quoted, messageId, ...options } = opts;
        const userJid = this.user?.id || this.user?.jid;
        const access = {
          getFile: this.getFile.bind(this),
          waUploadToServer: this.waUploadToServer,
          isValidUrl: ctx.isValidUrl,
        };
        const msg = generateWAMessageFromContent(jid, await buildProductMessage(data, access), {
          userJid,
          messageId,
          ...options,
        });
        await this.relayMessage(jid, msg.message, {
          messageId: msg.key.id,
          ...options,
        });
        return msg;
      },
      enumerable: true,
    },
  };
}

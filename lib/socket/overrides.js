import config from '#config';
import { processTextWithSmlcap } from '#lib/utils/helper';
import helper from '#lib/utils/buttons.helper';
import {
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  normalizeMessageContent,
  isJidGroup,
} from 'baileys';
export function applyOverrides(conn, ctx) {
  conn._origSendMessage ??= conn.sendMessage;
  conn._origRelayMessage ??= conn.relayMessage;
  const originalSendMessage = conn._origSendMessage.bind(conn);
  const originalRelayMessage = conn._origRelayMessage.bind(conn);
  conn.sendMessage = async function (jid, content = {}, options = {}) {
    options.ephemeralExpiration = options.ephemeralExpiration ?? ctx.getEphemeralSetting(this, jid);
    const isInteractive =
      content?.nativeFlow || content?.interactiveButtons || content?.interactiveMessage;
    const rich = options.rich === true;
    delete options.rich;
    delete options.aiGenerated;
    const smlcapConfig = rich ? { ...(options.smlcap || {}), smlcap: false } : options.smlcap || {};
    delete options.smlcap;
    if (isInteractive) {
      if (content?.body?.text && !content.text) {
        content.text = content.body.text;
      }
      if (content.text) {
        content.text = processTextWithSmlcap(this, content.text, smlcapConfig);
      }
      if (content.footer) {
        content.footer = processTextWithSmlcap(this, content.footer, smlcapConfig);
      }
      let media = null;
      const rawMedia = content.image || content.video || content.document;
      if (rawMedia) {
        const type = content.image ? 'image' : content.video ? 'video' : 'document';
        const file = await this.getFile(rawMedia.url || rawMedia);
        const prepared = await prepareWAMessageMedia(
          {
            [type]: file.data,
          },
          {
            upload: this.waUploadToServer,
          }
        );
        const msgObj = prepared[`${type}Message`];
        if (msgObj) {
          media = {
            hasMediaAttachment: true,
            [`${type}Message`]: msgObj,
          };
        }
        delete content.image;
        delete content.video;
        delete content.document;
      }
      const basePayload = helper.convertToInteractiveMessage(content);
      const im = basePayload.interactiveMessage;
      if (im?.body?.text) {
        im.body.text = processTextWithSmlcap(this, im.body.text, smlcapConfig);
      }
      if (im?.footer?.text) {
        im.footer.text = processTextWithSmlcap(this, im.footer.text, smlcapConfig);
      }
      if (im?.header?.title) {
        im.header.title = processTextWithSmlcap(this, im.header.title, smlcapConfig);
      }
      if (media) {
        im.header = media;
      }
      const userJid = this.authState?.creds?.me?.id || this.user?.id;
      const unique = Date.now().toString(36) + '-' + Math.floor(Math.random() * 99999).toString(36);
      const messageId = `${config.bot.id}-${unique.toUpperCase()}`;
      const fullMsg = generateWAMessageFromContent(jid, basePayload, {
        userJid,
        messageId,
        ...options,
      });
      const normalized = normalizeMessageContent(fullMsg.message);
      const additionalNodes = [];
      const btnNode = helper.getButtonArgs?.(normalized);
      if (btnNode) additionalNodes.push(btnNode);
      if (!isJidGroup(jid)) {
        additionalNodes.push({
          tag: 'bot',
          attrs: {
            biz_bot: '1',
          },
        });
      }
      return this.relayMessage(jid, fullMsg.message, {
        messageId: fullMsg.key.id,
        additionalNodes,
      });
    }
    if (!options.messageId) {
      const unique = Date.now().toString(36) + '-' + Math.floor(Math.random() * 99999).toString(36);
      options.messageId = `${config.bot.id}-${unique.toUpperCase()}`;
    }
    if (content.text) {
      content.text = processTextWithSmlcap(this, content.text, smlcapConfig);
    }
    if (content.caption) {
      content.caption = processTextWithSmlcap(this, content.caption, smlcapConfig);
    }
    return originalSendMessage.call(this, jid, content, options);
  };
  conn.relayMessage = async function (jid, message, { messageId, ...opts } = {}) {
    if (!messageId) {
      const unique = Date.now().toString(36) + '-' + Math.floor(Math.random() * 99999).toString(36);
      messageId = `${config.bot.id}-${unique.toUpperCase()}`;
    }
    const rich = opts.rich === true;
    delete opts.rich;
    delete opts.aiGenerated;
    const smlcapConfig = rich ? { ...(opts.smlcap || {}), smlcap: false } : opts.smlcap || {};
    delete opts.smlcap;
    const messageTypes = [
      'conversation',
      'extendedTextMessage',
      'imageMessage',
      'videoMessage',
      'documentMessage',
      'audioMessage',
    ];
    messageTypes.forEach((msgType) => {
      if (message[msgType]) {
        if (typeof message[msgType] === 'string') {
          message[msgType] = processTextWithSmlcap(this, message[msgType], smlcapConfig);
        } else {
          if (message[msgType].text) {
            message[msgType].text = processTextWithSmlcap(
              this,
              message[msgType].text,
              smlcapConfig
            );
          }
          if (message[msgType].caption) {
            message[msgType].caption = processTextWithSmlcap(
              this,
              message[msgType].caption,
              smlcapConfig
            );
          }
        }
      }
    });
    if (message.viewOnceMessage?.message) {
      Object.keys(message.viewOnceMessage.message).forEach((key) => {
        const msg = message.viewOnceMessage.message[key];
        if (msg?.text) {
          msg.text = processTextWithSmlcap(this, msg.text, smlcapConfig);
        }
        if (msg?.caption) {
          msg.caption = processTextWithSmlcap(this, msg.caption, smlcapConfig);
        }
      });
    }
    if (
      config.chanell.useWm &&
      (message.imageMessage || message.videoMessage || message.documentMessage) &&
      !message.audioMessage
    ) {
      const mediaMessage = message.imageMessage || message.videoMessage || message.documentMessage;
      mediaMessage.annotations = [
        {
          polygonVertices: [
            {
              x: 0,
              y: 0,
            },
            {
              x: 50,
              y: 0,
            },
            {
              x: 50,
              y: 25,
            },
            {
              x: 0,
              y: 25,
            },
          ],
          newsletter: {
            newsletterJid: config.chanell.id,
            newsletterName: config.chanell.name,
            contentType: 'UPDATE',
            accessibilityText: '',
          },
        },
      ];
    }
    return await originalRelayMessage.call(this, jid, message, {
      messageId,
      ...opts,
    });
  };
}

import crypto from 'crypto';
import { generateWAMessageFromContent, generateWAMessage } from 'baileys';
import { isJidNewsletter } from './context.js';

export default function _sendAlbumMessage(ctx) {
  return {
    sendAlbumMessage: {
      async value(jid, medias, options = {}) {
        const userJid = this.user?.jid;
        for (const media of medias) {
          if (!media.image && !media.video && !media.filePath) {
            throw new TypeError('medias[i] must have image, video or filePath');
          }
        }
        if (medias.length < 2) {
          const single = medias[0];
          const mtype = single.image ? 'image' : single.video ? 'video' : 'image';
          const content = single.filePath
            ? {
                [mtype]: {
                  url: single.filePath,
                },
              }
            : {
                [mtype]: single[mtype],
              };
          return this.sendMessage(
            jid,
            {
              ...content,
              caption: single.caption,
              mimetype: single.mimetype,
            },
            options
          );
        }
        const time = options.delay || 1500;
        const initialDelay = options.initialDelay || 800;
        delete options.delay;
        delete options.initialDelay;
        const album = await generateWAMessageFromContent(
          jid,
          {
            albumMessage: {
              expectedImageCount: medias.filter((m) => m.image || m.filePath).length,
              expectedVideoCount: medias.filter((m) => m.video).length,
              ...options,
            },
          },
          {
            userJid,
            ...options,
          }
        );
        await this.relayMessage(jid, album.message, {
          messageId: album.key.id,
        });
        await this.delay(initialDelay);
        for (const media of medias) {
          let msg;
          const send = async (mtype) => {
            const base = media.filePath
              ? {
                  [mtype]: {
                    url: media.filePath,
                  },
                }
              : {
                  [mtype]: media[mtype],
                };
            msg = await generateWAMessage(
              jid,
              {
                ...base,
                caption: media.caption,
                mimetype: media.mimetype,
                ...options,
              },
              {
                userJid,
                upload: async (stream, opts) => {
                  return await this.waUploadToServer(stream, {
                    ...opts,
                    newsletter: isJidNewsletter(jid),
                  });
                },
                ...options,
              }
            );
          };
          if (media.image || media.filePath) await send('image');
          else if (media.video) await send('video');
          if (msg) {
            msg.message.messageContextInfo = {
              messageSecret: crypto.randomBytes(32),
              messageAssociation: {
                associationType: 1,
                parentMessageKey: album.key,
              },
            };
            await this.relayMessage(jid, msg.message, {
              messageId: msg.key.id,
            });
            await this.delay(time);
          }
        }
        return album;
      },
      enumerable: true,
    },
  };
}

import path from 'path';
import fsp from 'fs/promises';
import { toAudio } from '#lib/utils/converter';

export default function _sendFile(ctx) {
  return {
    sendFile: {
      async value(jid, PATH, filename = '', text = '', quoted, ptt = false, options = {}) {
        try {
          if (!jid) throw new Error('JID is required');
          if (!PATH) throw new Error('PATH is required');
          const type = await this.getFile(PATH, true);
          let { res, data: file, filename: pathFile } = type;
          if (res && res.status !== 200) {
            throw new Error(`HTTP ${res.status}: Failed to fetch file`);
          }
          if (file.length <= ctx.MAX_FILE_SIZE) {
            try {
              const jsonData = JSON.parse(file.toString());
              throw {
                json: jsonData,
              };
            } catch (e) {
              if (e.json) throw e.json;
            }
          }
          const opt = quoted
            ? {
                quoted,
              }
            : {};
          const mimetype = options.mimetype || type.mime;
          let mtype = 'document';
          let processedFile = file;
          let processedPath = pathFile;
          if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.asSticker)) {
            mtype = 'sticker';
          } else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.asImage)) {
            mtype = 'image';
          } else if (/video/.test(type.mime)) {
            mtype = 'video';
          } else if (/audio/.test(type.mime)) {
            try {
              const converted = await toAudio(file, type.ext);
              processedFile = converted.data;
              processedPath = converted.filename;
              mtype = 'audio';
              options.mimetype = options.mimetype || 'audio/ogg; codecs=opus';
            } catch (error) {
              console.warn('Audio conversion failed, sending as document:', error.message);
              mtype = 'document';
            }
          }
          if (options.asDocument) mtype = 'document';
          const cleanOptions = {
            ...options,
          };
          delete cleanOptions.asSticker;
          delete cleanOptions.asLocation;
          delete cleanOptions.asVideo;
          delete cleanOptions.asDocument;
          delete cleanOptions.asImage;
          const message = {
            ...cleanOptions,
            caption: text,
            ptt,
            mimetype: options.mimetype || mimetype,
            fileName: filename || path.basename(processedPath),
            [mtype]: await fsp.readFile(processedPath).catch(() => processedFile),
          };
          return await this.sendMessage(jid, message, {
            ...opt,
            ...cleanOptions,
          });
        } catch (error) {
          console.error('sendFile error:', error);
          throw new Error(`Failed to send file: ${error.message}`);
        } finally {
          if (typeof file !== 'undefined') file = null;
        }
      },
      enumerable: true,
    },
  };
}

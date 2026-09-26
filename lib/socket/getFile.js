import path from 'path';
import fsp from 'fs/promises';
import { fileTypeFromBuffer } from 'file-type';
import { PATH as locate } from '#lib/utils/helper';
import { hkNet } from '#lib/utils/network';

export default function _getFile(ctx) {
  return {
    getFile: {
      async value(PATH, saveToFile = false) {
        let res, filename;
        let data = Buffer.alloc(0);
        try {
          if (Buffer.isBuffer(PATH)) {
            data = PATH;
          } else if (PATH instanceof ArrayBuffer) {
            data = Buffer.from(PATH);
          } else if (ctx.isBase64DataUri(PATH)) {
            data = Buffer.from(PATH.split(',')[1], 'base64');
          } else if (ctx.isValidUrl(PATH)) {
            res = await hkNet({
              method: 'get',
              url: PATH,
              responseType: 'arraybuffer',
            });
            data = Buffer.from(res.data);
          } else if (ctx.isValidPath(PATH)) {
            filename = PATH;
            data = await fsp.readFile(PATH);
          } else if (typeof PATH === 'string') {
            throw new TypeError('Invalid file input string.');
          }
        } catch (e) {
          console.error('[getFile error]', e);
          throw e;
        }
        if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer');
        const type = (await fileTypeFromBuffer(data)) || {
          mime: ctx.DEFAULT_MIME,
          ext: ctx.DEFAULT_EXT,
        };
        if (saveToFile && !filename) {
          await ctx.ensureTmpDir();
          filename = path.join(locate.tmp, Date.now() + '.' + type.ext);
          await fsp.writeFile(filename, data);
        }
        return {
          res,
          filename,
          ...type,
          data,
          deleteFile() {
            return filename && fsp.unlink(filename).catch(() => {});
          },
        };
      },
      enumerable: true,
    },
  };
}

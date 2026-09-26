import * as jimp from 'jimp';

export default function _resize(ctx) {
  return {
    resize: {
      async value(buffer, width, height) {
        if (!Buffer.isBuffer(buffer)) {
          throw new TypeError('First parameter must be a buffer');
        }
        if (!Number.isInteger(width) || width <= 0) {
          throw new TypeError('Width must be a positive integer');
        }
        if (!Number.isInteger(height) || height <= 0) {
          throw new TypeError('Height must be a positive integer');
        }
        try {
          const image = await jimp.read(buffer);
          return await image.resize(width, height).quality(90).getBufferAsync(jimp.MIME_JPEG);
        } catch (error) {
          throw new Error(`Image resize failed: ${error.message}`);
        }
      },
      enumerable: true,
    },
  };
}

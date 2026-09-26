const MAX_VIDEONOTE_SIZE = 16 * 1024 * 1024;

export default function _sendVideoNote(ctx) {
  return {
    sendVideoNote: {
      async value(jid, src, opts = {}) {
        let buffer = Buffer.isBuffer(src) ? src : null;
        if (!buffer) {
          const file = await this.getFile(src);
          buffer = file?.data || null;
        }
        if (!buffer || !buffer.length) throw new TypeError('cannot load video');
        if (buffer.length > MAX_VIDEONOTE_SIZE) {
          throw new Error('video too large for video note (max 16MB)');
        }
        const { quoted, ...sendOptions } = opts;
        return this.sendMessage(
          jid,
          {
            video: buffer,
            ptv: true,
          },
          {
            quoted,
            ...sendOptions,
          }
        );
      },
      enumerable: true,
    },
  };
}

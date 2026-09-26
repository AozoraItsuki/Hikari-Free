export default function _sendPtv(ctx) {
  return {
    sendPtv: {
      async value(jid, src, opts = {}) {
        if (typeof this.sendVideoNote !== 'function') {
          throw new TypeError('sendPtv requires sendVideoNote to be available');
        }
        return this.sendVideoNote(jid, src, opts);
      },
      enumerable: true,
    },
  };
}

const FRAME_CHARS = ['▰', '▱'];

function makeBar(step, total, length) {
  const filled = Math.round((step / total) * length);
  const bar = FRAME_CHARS[0].repeat(filled) + FRAME_CHARS[1].repeat(length - filled);
  const percent = Math.round((step / total) * 100);
  return { bar, percent };
}

export default function _sendProgress(ctx) {
  return {
    sendProgress: {
      async value(jid, label = '', opts = {}) {
        if (!jid) throw new TypeError('sendProgress requires a target jid');
        const { steps = 8, frameMs = 1800, prefix = '', quoted, messageId, ...options } = opts;
        const total = Math.max(2, Math.min(32, Number(steps) || 8));
        const width = Math.max(6, Math.min(20, total));
        const startText = `${prefix}${label}\n${makeBar(0, total, width).bar}  0%`;
        const first = await this.sendMessage(
          jid,
          { text: startText },
          { ...options, messageId, quoted }
        );
        const key = first?.key;
        for (let step = 1; step <= total; step++) {
          await this.delay?.(frameMs);
          const { bar, percent } = makeBar(step, total, width);
          const frame = `${prefix}${label}\n${bar}  ${percent}%`;
          await this.sendMessage(jid, { text: frame, edit: key }, { ...options, quoted });
        }
        return first;
      },
      enumerable: true,
    },
  };
}

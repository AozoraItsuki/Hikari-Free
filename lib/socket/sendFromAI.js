const MAX_EDITS = 24;

function splitChunks(text, size) {
  const chunks = [];
  let rest = String(text ?? '');
  while (rest.length > size) {
    let cut = rest.slice(0, size);
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > size * 0.5) cut = cut.slice(0, lastSpace);
    chunks.push(cut);
    rest = rest.slice(cut.length);
  }
  if (rest.length) chunks.push(rest);
  return chunks;
}

export default function _sendFromAI(ctx) {
  return {
    sendFromAI: {
      async value(jid, text, opts = {}) {
        if (!jid) throw new TypeError('sendFromAI requires a target jid');
        if (typeof text !== 'string' || !text.trim()) {
          throw new TypeError('sendFromAI requires a non-empty text');
        }
        const {
          delayMs = 40,
          chunk = 4,
          typing = true,
          footer = '',
          quoted,
          messageId,
          ...options
        } = opts;
        const chunks = splitChunks(text, Math.max(1, Number(chunk) || 4));
        const editing = chunks.length > 1 ? Math.min(MAX_EDITS, chunks.length - 1) : 0;
        const steps = editing + 1;
        const paced = [];
        for (let i = 0; i < steps; i++) {
          const end =
            chunks.length === 1 ? undefined : Math.ceil((chunks.length * (i + 1)) / steps);
          paced.push(chunks.slice(0, end ?? undefined).join(''));
        }
        if (typing && typeof this.sendPresenceUpdate === 'function') {
          this.sendPresenceUpdate('composing', jid).catch?.(() => {});
        }
        let current;
        for (let i = 0; i < paced.length; i++) {
          current = await this.sendMessage(
            jid,
            {
              text: paced[i] + (i === paced.length - 1 && footer ? '\n\n' + footer : ''),
              edit: i > 0 ? current?.key : undefined,
            },
            { ...options, quoted, ...(i === 0 ? { messageId } : {}) }
          );
          if (i < paced.length - 1 && delayMs > 0) {
            await this.delay?.(delayMs);
          }
        }
        if (typing && typeof this.sendPresenceUpdate === 'function') {
          this.sendPresenceUpdate('paused', jid).catch?.(() => {});
        }
        return current;
      },
      enumerable: true,
    },
  };
}

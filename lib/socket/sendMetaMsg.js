const renderCode = (block) => {
  const lang = block?.language ? String(block.language) : '';
  const code = String(block?.code ?? '');
  return '```' + lang + '\n' + code + '\n```';
};

const renderTable = (block) => {
  const headers = Array.isArray(block?.headers) ? block.headers.map(String) : [];
  const rows = Array.isArray(block?.rows) ? block.rows.map((r) => [].concat(r).map(String)) : [];
  if (!headers.length && !rows.length) return '';
  const cols = headers.length ? headers.length : Math.max(...rows.map((r) => r.length), 0);
  const widths = Array.from({ length: cols }, (_, i) =>
    Math.max(
      ...(headers[i] !== undefined ? [headers[i].length] : [0]),
      ...rows.map((r) => (r[i] ? r[i].length : 0))
    )
  );
  const pad = (value, i) => String(value ?? '').padEnd(widths[i] + 2);
  const line = headers.length ? headers.map(pad).join('').trimEnd() : '';
  const body = rows.map((r) => r.map(pad).join('').trimEnd()).join('\n');
  return [block?.title ? '*' + block.title + '*' : '', line, body]
    .filter((part) => part !== '')
    .join('\n');
};

const renderBlock = (block) => {
  if (!block || typeof block !== 'object') return '';
  if (typeof block.text === 'string') return block.text;
  if (block.code) {
    const source = block.code?.code ?? block.code;
    return renderCode({ language: block.code?.language, code: source });
  }
  if (block.table) return renderTable(block.table);
  if (typeof block.muted === 'string') return '_' + block.muted + '_';
  if (block.tip) return '💡 ' + String(block.tip);
  if (Array.isArray(block.suggestions)) {
    return '_Suggestion:_ ' + block.suggestions.map((s) => String(s)).join(', ');
  }
  if (Array.isArray(block.sources)) {
    return block.sources
      .map((s) => '- ' + (s?.title ? String(s.title) + ': ' : '') + (s?.url ? String(s.url) : ''))
      .filter(Boolean)
      .join('\n');
  }
  if (Array.isArray(block.reels)) {
    return block.reels
      .map((r) => {
        const reel = typeof r === 'string' ? { url: r } : r;
        return '- 🎞 ' + (reel?.title ? String(reel.title) + ' — ' : '') + (reel?.url || '');
      })
      .filter(Boolean)
      .join('\n');
  }
  if (Array.isArray(block.posts)) {
    return block.posts
      .map((p) => {
        const post = typeof p === 'string' ? { url: p } : p;
        return (
          '- 📌 ' +
          (post?.title || post?.caption ? String(post?.title ?? post?.caption) + ' — ' : '') +
          (post?.postUrl || post?.url || '')
        );
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
};

export function renderMetaSections(sections = []) {
  return (Array.isArray(sections) ? sections : []).map(renderBlock).filter(Boolean).join('\n\n');
}

export default function _sendMetaMsg(ctx) {
  return {
    sendMetaMsg: {
      async value(jid, sections = [], opts = {}) {
        if (!jid) throw new TypeError('sendMetaMsg requires a target jid');
        const { title, quoted, mentions = [], ...options } = opts;
        const text = renderMetaSections(sections);
        if (!text) throw new TypeError('sendMetaMsg requires at least one renderable section');
        const autoMentions = this.parseMention?.(text) || [];
        const combined = [...new Set([...autoMentions, ...mentions])];
        const refs = []
          .concat(combined)
          .map((jid) => (typeof jid === 'string' ? jid.replace(/^@/, '') : ''))
          .filter(Boolean);
        return this.sendMessage(
          jid,
          {
            text,
            contextInfo: {
              ...(refs.length ? { mentionedJid: refs } : {}),
              ...(title
                ? {
                    externalAdReply: {
                      title,
                      body: '',
                      mediaType: 0,
                      mediaUrl: 'https://wa.me/',
                      sourceUrl: 'https://wa.me/',
                      renderLargerThumbnail: false,
                      showAdAttribution: false,
                    },
                  }
                : {}),
            },
          },
          {
            quoted,
            ...options,
          }
        );
      },
      enumerable: true,
    },
  };
}

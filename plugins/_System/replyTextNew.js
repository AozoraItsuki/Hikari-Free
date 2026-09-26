let _conn = null;
export async function before(m, { conn }) {
  if (!_conn) _conn = conn;
  if (m?.isBaileys || !m?.quoted) return;
  const quotedId = m.quoted?.id;
  if (!quotedId || !conn?.replyText?.[quotedId]) return;
  const replyData = conn.replyText[quotedId];
  const now = Date.now();
  const maxAge = 30 * 60 * 1000;
  if (replyData.timestamp && now - replyData.timestamp > maxAge) {
    return true;
  }
  try {
    if (replyData.trigger && m.text.toLowerCase() === replyData.trigger.toLowerCase()) {
      const command = replyData.command;
      const msg = await conn.preSudo(command, m.sender, m);
      conn.ev.emit('messages.upsert', msg);
      return true;
    } else if (replyData.command && typeof replyData.command === 'string') {
      if (replyData.command.includes('INPUT')) {
        const command = replyData.command.replace(/INPUT/g, m.text);
        const msg = await conn.preSudo(command, m.sender, m);
        conn.ev.emit('messages.upsert', msg);
        return true;
      }
    } else if (Array.isArray(replyData.list) && replyData.list.length > 0) {
      const userInput = m.text?.trim();
      let selected = replyData.list.find((item) => {
        const [command, number, title] = item;
        return number?.toString() === userInput;
      });
      if (!selected) {
        selected = replyData.list.find((item) => {
          const [command, identifier] = item;
          return identifier?.toLowerCase() === userInput?.toLowerCase();
        });
      }
      if (selected) {
        const [command] = selected;
        const msg = await conn.preSudo(command, m.sender, m);
        conn.ev.emit('messages.upsert', msg);
        return true;
      }
    }
  } catch (error) {
    conn.logger.error('Error in replyText hikari:', error);
  }
  return true;
}
export async function cleanup(conn) {
  if (!conn?.replyText) return;
  const now = Date.now();
  const maxAge = 30 * 60 * 1000;
  let cleaned = 0;
  for (const [messageId, data] of Object.entries(conn.replyText)) {
    if (data.timestamp && now - data.timestamp > maxAge) {
      delete conn.replyText[messageId];
      cleaned++;
    }
  }
  if (cleaned > 0) {
    conn.logger.debug(`Cleaned up ${cleaned} expired replyText entries`);
  }
}
setInterval(() => cleanup(_conn), 30 * 60 * 1000);

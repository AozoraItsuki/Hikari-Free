import { db } from '#src/database';
const IDLE_LIMIT = 7 * 24 * 60 * 60 * 1000;
export async function before(m, { conn, groupMetadata, isBotAdmin }) {
  if (!m.isGroup) return;
  const chatCfg = db.data.chats[m.chat];
  if (!chatCfg?.antiSider) return;
  if (!isBotAdmin) return;
  const meta = groupMetadata || (await conn.groupMetadata(m.chat).catch(() => null));
  if (!meta) return;
  const parts = meta.participants || [];
  const now = Date.now();
  const kick = [];
  for (const p of parts) {
    let jid = conn.decodeJid(p.phoneNumber || p.id || p);
    if (!jid) continue;
    if (jid.endsWith('@lid')) {
      const pn = await conn.resolveJid(jid, 'pn').catch(() => null);
      if (pn) jid = conn.decodeJid(pn);
    }
    if (p.admin === 'admin' || p.admin === 'superadmin') continue;
    if (jid === conn.decodeJid(conn.user.id)) continue;
    const member = db.data.chats[m.chat]?.member?.[jid];
    let last = member?.lastseen;
    if (!last) continue;
    if (last > now) last = now;
    const idle = now - last;
    if (idle >= IDLE_LIMIT) kick.push(jid);
  }
  if (kick.length) {
    await conn.groupParticipantsUpdate(m.chat, kick, 'remove').catch(() => {});
  }
}

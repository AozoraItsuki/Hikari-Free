import { db } from '#src/database';

const scamRegex =
  /\b(selamat.*(memenangkan|menang|hadiah)|anda.*(pemenang|terpilih)|klaim.*(hadiah|saldo|dana)|pinjaman.*(cepat|tanpa jaminan)|lowongan.*(gaji|kerja)|minta.*(otp|kode verifikasi)|transfer.*(biaya admin|jaminan|pajak)|investasi.*(crypto|bitcoin|saham).*(untung|bunga)|deposit.*(bunga|bonus)|100%\s*(legal|aman|terpercaya)|paypal|western\s*union|bukan penipuan|(tinyurl|bit\.ly|rb\.gy|s\.short|shorturl|is\.gd|cutty)\.(com|at|io|xyz)\/)\b/i;

const RAID_WINDOW = 60000;
const RAID_THRESHOLD = 5;
const LOCK_MS = 600000;
const ACTIONS_WINDOW = 300000;
const MAX_ACTIONS = 3;

const joinLog = new Map();
const lockState = new Map();
const actionLog = new Map();
const stats = { scams: 0, raids: 0, impersonations: 0 };

function prune(log, windowMs) {
  const now = Date.now();
  const arr = (log || []).filter((t) => now - t < windowMs);
  return arr;
}

function canAct(sender) {
  const arr = prune(actionLog.get(sender), ACTIONS_WINDOW);
  actionLog.set(sender, arr);
  return arr.length < MAX_ACTIONS;
}

function recordAction(sender) {
  const arr = prune(actionLog.get(sender), ACTIONS_WINDOW);
  arr.push(Date.now());
  actionLog.set(sender, arr);
}

function resolveJid(p) {
  if (typeof p === 'string') return p;
  return p?.phoneNumber || p?.id || p?.lid || p;
}

async function lockGroup(conn, id) {
  const existing = lockState.get(id);
  if (existing) clearTimeout(existing.timer);
  await conn.groupSettingUpdate(id, 'announcement').catch(() => {});
  const timer = setTimeout(async () => {
    await conn.groupSettingUpdate(id, 'not_announcement').catch(() => {});
    lockState.delete(id);
  }, LOCK_MS);
  lockState.set(id, { timer });
}

async function handleParticipants(conn, { id, participants, action }) {
  const chat = db.data.chats[id] || {};
  if (!chat.guardian) return;
  if (action !== 'add' || !participants?.length) return;
  const meta = await conn.groupMetadata(id).catch(() => null);
  if (!meta) return;
  const botJid = conn.user?.jid;
  const isBotAdmin = meta.participants.some((p) => p.id === botJid && p.admin);
  const now = Date.now();

  const joins = prune(joinLog.get(id), RAID_WINDOW);
  participants.forEach(() => joins.push(now));
  joinLog.set(id, joins);
  if (joins.length >= RAID_THRESHOLD) {
    stats.raids++;
    joinLog.delete(id);
    if (isBotAdmin) {
      await conn
        .groupParticipantsUpdate(id, participants.map(resolveJid), 'remove')
        .catch(() => {});
      await lockGroup(conn, id);
    }
    await conn.sendMessage(id, {
      text: isBotAdmin
        ? '⚠️ *RAID DETECTED!*\nBurst join terdeteksi. Member baru dikeluarkan dan grup dikunci sementara (10 menit).'
        : '⚠️ *RAID DETECTED!*\nBurst join terdeteksi. Beri bot admin agar bisa mengeluarkan member baru & mengunci grup.',
    });
    return;
  }

  const admins = meta.participants.filter((p) => p.admin).map((p) => p.id);
  for (const raw of participants) {
    const jid = resolveJid(raw);
    if (!jid || admins.includes(jid)) continue;
    const newName = await conn.getName(jid).catch(() => '');
    if (!newName) continue;
    for (const adminJid of admins) {
      const adminName = await conn.getName(adminJid).catch(() => '');
      if (!adminName) continue;
      if (adminName.trim().toLowerCase() === newName.trim().toLowerCase()) {
        stats.impersonations++;
        if (isBotAdmin) await conn.groupParticipantsUpdate(id, [jid], 'remove').catch(() => {});
        await conn.sendMessage(id, {
          text: `🛡️ *IMPERSONATION DETECTED*\n@${jid.split('@')[0]} meniru nama admin (@${adminJid.split('@')[0]}).${
            isBotAdmin ? ' Dikeluarkan dari grup.' : ''
          }`,
          mentions: [jid, adminJid],
        });
        break;
      }
    }
  }
}

export async function init(conn) {
  conn.ev.on('group-participants.update', (update) => handleParticipants(conn, update));
}

export async function before(m, { conn, isBotAdmin, isAdmin }) {
  if (m.isBaileys || m.fromMe || !m.isGroup || !m.text) return;
  const chat = db.data.chats[m.chat] || {};
  if (!chat.guardian || isAdmin) return;
  if (!scamRegex.test(m.text)) return;
  if (!canAct(m.sender)) return;
  recordAction(m.sender);
  stats.scams++;
  const strict = chat.guardianMode !== 'warn';
  if (strict && isBotAdmin) {
    await conn.sendMessage(m.chat, { delete: m.key });
    const quotedCustom = {
      key: { remoteJid: m.sender, fromMe: false, id: m.key.id },
      message: {
        extendedTextMessage: {
          text: '🛡️ flagged as scam',
          matchedText: null,
          contextInfo: { mentionedJid: [m.sender] },
        },
      },
    };
    await conn.sendMessage(
      m.chat,
      {
        text: '🛡️ *GUARDIAN*\nPesan terindikasi penipuan/scam telah dihapus.\nMode: strict',
      },
      { quoted: quotedCustom }
    );
  } else {
    await conn.sendMessage(m.chat, {
      text: '🛡️ *GUARDIAN*\nPesan terindikasi penipuan/scam.\nAktifkan mode strict + bot admin untuk auto-hapus.',
      quoted: m,
    });
  }
  return true;
}

let hikari = async (m, { text, usedPrefix, command }) => {
  const chat = db.data.chats[m.chat];
  const arg = (text || '').trim().toLowerCase();
  if (!arg || arg === 'status') {
    return m.reply(
      `🛡️ *Guardian AI*\nStatus: ${chat.guardian ? '🟢 ON' : '🔴 OFF'}\nMode: ${chat.guardianMode === 'warn' ? 'warn' : 'strict'}\n\nSession actions:\n• Scam: ${stats.scams}\n• Raid: ${stats.raids}\n• Impersonation: ${stats.impersonations}\n\nUsage:\n${usedPrefix + command} on|off\n${usedPrefix + command} strict|warn`
    );
  }
  if (arg === 'on' || arg === 'off') {
    chat.guardian = arg === 'on';
    return m.reply(`🛡️ Guardian AI ${chat.guardian ? 'diaktifkan' : 'dimatikan'}.`);
  }
  if (arg === 'strict' || arg === 'warn') {
    chat.guardianMode = arg;
    return m.reply(`🛡️ Guardian mode: ${arg}.`);
  }
  return m.reply(
    `Perintah tidak dikenali.\nGunakan: ${usedPrefix + command} on|off|strict|warn|status`
  );
};

hikari.help = ['guardian'];
hikari.command = /^guardian$/i;
hikari.group = true;
hikari.admin = true;
export default hikari;

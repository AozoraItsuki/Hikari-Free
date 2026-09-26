console.clear();
import '#src/bootstrap';
import config from '#config';
import terminal from '#lib/utils/logger';
import {
  loadDatabase,
  db,
  openDatabase,
  dbScope,
  saveAllStores,
  setSubbotStatus,
} from '#src/database';
import { SystemManager } from '#src/managers/SystemManager';
import { SchedulerManager } from '#src/managers/SchedulerManager';
import { pluginManager, fileWatcher } from '#src/managers/pluginEngine';
import { startSocketWatcher, detachSocket, loadSocketModules } from '#lib/socket/index';
import { startup } from '#src/startup';
import { createConnection } from '#src/connection';
import { connectionUpdate } from '#src/events/connectionUpdate';
import { participantsUpdate } from '#src/events/participantsUpdate';
import { deleteUpdate } from '#src/events/deleteUpdate';
import { makeWASocket } from '#lib/utils/simple';
import fs from 'fs';
import chalk from 'chalk';
import {
  autoScheduleGroups,
  checkSewa,
  checkSholat,
  checkPremium,
  resetAll,
  resetStock,
  Backup,
  clearMemory,
  clearTmp,
  resetCryptoPrice,
  resetVolumeCrypto,
  updateCrypto,
  resetSahamPrice,
  resetVolumeSaham,
  updateSaham,
  resetWeeklyChat,
  clearDatabase,
} from '#lib/utils/autoScedule';
import { processScoreQueue } from '#lib/utils/rewards';
let conn;
let isInit = true;
let handlerModule = null;
let handler = null;
let connectionOptions = null;
let saveCreds = null;
let mainStore = null;
const sockets = [];
function normalizeOne(s) {
  const number = String(s.number).replace(/\D/g, '');
  const owner = (Array.isArray(s.owner) ? s.owner : []).map(([n, name]) => [
    String(n ?? ''),
    name ?? '',
  ]);
  for (const entry of mainOwners()) {
    if (!owner.some(([n]) => n && n === entry[0])) owner.push(entry);
  }
  return {
    number,
    name: s.name || 'SubBot',
    owner,
    db: s.db || number,
    sessionDir: s.session || `sessions/${number}`,
    usePairing: s.usePairing ?? true,
    pairingCode: s.pairingCode ?? '',
  };
}
function mainOwners() {
  return (Array.isArray(config.owner) ? config.owner : []).map(([n, name, isDev]) => [
    String(n ?? ''),
    name ?? '',
    isDev === true,
  ]);
}
function normalizeSubBots() {
  const list = Array.isArray(config.subBot) ? config.subBot : [];
  return list.filter((s) => s && s.number).map((s) => normalizeOne(s));
}
async function linkSubBot(sock, sub, { via, notifyTo }) {
  const target = `${sub.number}@s.whatsapp.net`;
  // NOTE: never reuse the main bot's custom code here. WA pairing codes are
  // single-use: reusing an already-consumed code makes the server 401 the socket.
  // Only a per-subbot code set explicitly in its own config entry is used.
  const customCode = sub.pairingCode || undefined;
  const fmt = (c) =>
    String(c || '')
      .replace(/-/g, '')
      .match(/.{1,4}/g)
      ?.join('-') || c;
  const say = async (jid, text) => {
    try {
      await via.sendMessage(jid, { text });
    } catch {}
  };
  // Only one code message stays visible in the target chat: the previous one is
  // deleted before the refreshed code is sent, so the target always holds a valid code.
  let codeMsgKey = null;
  const sendCode = async (c) => {
    try {
      if (codeMsgKey) {
        try {
          await via.sendMessage(target, { delete: codeMsgKey });
        } catch {}
      }
      const sent = await via.sendMessage(target, {
        text: `🔐 *SubBot pairing code:*\n\n${c}\n\nEnter this code on WhatsApp (Linked Devices > Link with phone number) to activate ${sub.name}. Codes refresh every minute, always use the latest one.`,
      });
      codeMsgKey = sent?.key || null;
    } catch {}
  };
  let code;
  const openStart = Date.now();
  while (!(sock.ws?.isOpen ?? sock.ws?.readyState === 1)) {
    if (Date.now() - openStart > 30000) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      code = fmt(await sock.requestPairingCode(sub.number, customCode));
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  if (lastErr) {
    await say(
      notifyTo,
      `Subbot ${sub.number} failed to request pairing code: ${lastErr?.message || lastErr}`
    );
    return;
  }
  await sendCode(code);
  await say(notifyTo, `Pairing code sent to +${sub.number}. Waiting for link...`);
  const POLL = 5000;
  const REQ_EVERY = 60000;
  const TOTAL = 300000;
  const start = Date.now();
  let lastReq = start;
  while (Date.now() - start < TOTAL) {
    await new Promise((r) => setTimeout(r, POLL));
    try {
      if (sock.authState.creds.registered) {
        setSubbotStatus(sub.number, { linked: true, linkedAt: Date.now() });
        await say(notifyTo, `Subbot ${sub.number} (${sub.name}) linked successfully.`);
        return;
      }
    } catch {}
    if (Date.now() - lastReq >= REQ_EVERY) {
      try {
        code = fmt(await sock.requestPairingCode(sub.number, customCode));
        lastReq = Date.now();
        await sendCode(code);
      } catch {}
    }
  }
  await say(
    notifyTo,
    `Subbot ${sub.number} link timed out (5 min). Socket still running, run .subbot restart ${sub.number} to try again.`
  );
}
async function spawnSubSocket(raw, opts = {}) {
  const sub = raw.number && !raw.sessionDir ? normalizeOne(raw) : raw;
  if (sockets.some((s) => s.profile.number === sub.number))
    return { ok: false, message: 'already running' };
  try {
    const store = openDatabase(sub.db);
    const res = await createConnection(opts.link ? { ...sub, link: true } : sub);
    res.conn.replyText = {};
    res.conn.botProfile = { number: sub.number, name: sub.name, owner: sub.owner };
    res.conn.subbotControl = subbotControl;
    res.conn.isSubBot = true;
    res.conn.subProfile = sub;
    attachHandlers(res.conn, store, res.saveCreds);
    sockets.push({ conn: res.conn, store, profile: sub, saveCreds: res.saveCreds });
    terminal.log(`SubBot ${sub.name} (${sub.number}) attached`, 'SubBot', 'cyan');
    setSubbotStatus(sub.number, {
      name: sub.name,
      running: true,
      linked: res.conn.authState.creds.registered === true,
      startedAt: Date.now(),
    });
    if (opts.link && opts.via && opts.notifyTo) {
      (async () => {
        let settled = false;
        let timer = null;
        const handle = async (u) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          try {
            res.conn.ev.off('connection.update', onUpdate);
          } catch {}
          if (!sockets.some((s) => s.conn === res.conn)) return;
          try {
            terminal.log(
              `SubBot ${sub.number} pair gate: qr=${u?.qr ? 'yes' : 'no'} state=${u?.connection || '?'} registered=${res.conn.authState.creds.registered}`,
              'SubBot',
              'cyan'
            );
          } catch {}
          if (res.conn.authState.creds.registered || (!u?.qr && u?.connection === 'open')) {
            setSubbotStatus(sub.number, { linked: true, linkedAt: Date.now() });
            try {
              await opts.via.sendMessage(opts.notifyTo, {
                text: `Subbot ${sub.number} (${sub.name}) connected successfully, no re-pair needed.`,
              });
            } catch {}
            return;
          }
          if (!u?.qr) {
            try {
              await opts.via.sendMessage(opts.notifyTo, {
                text: `Subbot ${sub.number} did not reach pairing state in 60s. Run .subbot restart ${sub.number} to try again.`,
              });
            } catch {}
            return;
          }
          linkSubBot(res.conn, sub, { via: opts.via, notifyTo: opts.notifyTo }).catch((e) =>
            console.error(`SubBot ${sub.number} link flow failed:`, e?.message || e)
          );
        };
        const onUpdate = (u) => {
          if (u?.qr || u?.connection === 'open') handle(u);
        };
        res.conn.ev.on('connection.update', onUpdate);
        timer = setTimeout(() => handle(null), 60000);
      })().catch(() => {});
    }
    return { ok: true };
  } catch (e) {
    console.error(`SubBot ${sub.number} failed to start:`, e?.message || e);
    return { ok: false, message: e?.message || e };
  }
}
async function dropSubSocket(number) {
  const idx = sockets.findIndex((s) => s.profile.number === number);
  if (idx === -1) return false;
  const [s] = sockets.splice(idx, 1);
  setSubbotStatus(number, { running: false, stoppedAt: Date.now() });
  try {
    try {
      s.conn.ev.removeAllListeners();
    } catch {}
    try {
      await s.conn.ws?.close();
    } catch {}
    await s.store.save();
  } catch {}
  return true;
}
const subbotControl = {
  spawn: (raw, opts) => spawnSubSocket(raw, opts),
  drop: dropSubSocket,
  running: () => sockets.map((s) => s.profile.number),
  profiles: () => sockets.map((s) => s.profile),
};
function attachHandlers(sock, store, creds) {
  try {
    sock.ev.off('messages.upsert', sock.handler);
  } catch {}
  try {
    sock.ev.off('group-participants.update', sock.participantsUpdate);
  } catch {}
  try {
    sock.ev.off('message.delete', sock.onDelete);
  } catch {}
  try {
    sock.ev.off('connection.update', sock.connectionUpdate);
  } catch {}
  try {
    sock.ev.off('creds.update', sock.credsUpdate);
  } catch {}
  const bound = handlerModule.handler?.bind(sock) ?? null;
  sock.handler = (...args) => dbScope.run(store, () => bound?.(...args));
  if (sock === conn) handler = sock.handler;
  sock.participantsUpdate = participantsUpdate.bind(sock);
  sock.onDelete = deleteUpdate.bind(sock);
  sock.connectionUpdate = connectionUpdate.bind(sock);
  sock.credsUpdate = creds.bind(sock);
  sock.ev.on('messages.upsert', sock.handler);
  sock.ev.on('group-participants.update', (update) => {
    if (update.action === 'add') {
      if (update.participants.includes(sock.user.id)) {
        console.log('Bot dimasukkan ke group:', update.id);
      }
    }
  });
  if (sock.participantsUpdate) sock.ev.on('group-participants.update', sock.participantsUpdate);
  if (sock.onDelete) sock.ev.on('message.delete', sock.onDelete);
  sock.ev.on('connection.update', sock.connectionUpdate);
  sock.ev.on('creds.update', sock.credsUpdate);
}
export let reloadHandler = async function () {
  throw new Error('reloadHandler not initialized yet. Wait for startup.');
};
async function main() {
  try {
    const ascii = fs.readFileSync('src/json/ascii.txt', 'UTF-8');
    console.log(chalk.cyan(ascii));
    terminal.log('Hikari is back, yeayyyyy!', 'Hikari', 'magentaBright');
    const systemManager = new SystemManager();
    await systemManager.optimizeSystem();
    await startup();
    mainStore = await loadDatabase({ prefix: global.opts._[0] || config.bot.db || '' });
    await loadSocketModules();
    const createResult = await createConnection();
    conn = createResult.conn;
    saveCreds = createResult.saveCreds;
    connectionOptions = createResult.connectionOptions;
    connectionOptions = createResult.connectionOptions;
    conn.replyText = {};
    conn.botProfile = { number: config.bot.number, name: config.bot.name, owner: config.owner };
    conn.subbotControl = subbotControl;
    conn.isSubBot = false;
    reloadHandler = async function (restatConn) {
      const oldHandlerModule = handlerModule;
      const oldHandler = handler;
      try {
        const Imported = await import(`./handler.js?update=${Date.now()}`).catch((err) => {
          throw err;
        });
        handlerModule = Imported.default ?? Imported;
        if (!handlerModule || Object.keys(handlerModule).length === 0)
          throw new Error('Handler is empty');
      } catch (e) {
        console.error('Reload failed:', e);
        handlerModule = oldHandlerModule;
        handler = oldHandler;
        return false;
      }
      if (restatConn) {
        const oldChats = conn.chats;
        try {
          conn.ws?.close();
        } catch {}
        conn.ev.removeAllListeners();
        detachSocket(conn);
        conn = makeWASocket(connectionOptions, {
          chats: oldChats,
        });
        conn.replyText = {};
        conn.botProfile = {
          number: config.bot.number,
          name: config.bot.name,
          owner: config.owner,
        };
        conn.subbotControl = subbotControl;
        conn.isSubBot = false;
        isInit = true;
      }
      if (!isInit) {
        try {
          conn.ev.off('messages.upsert', conn.handler);
        } catch {}
        try {
          conn.ev.off('group-participants.update', conn.participantsUpdate);
        } catch {}
        try {
          conn.ev.off('message.delete', conn.onDelete);
        } catch {}
        try {
          conn.ev.off('connection.update', conn.connectionUpdate);
        } catch {}
        try {
          conn.ev.off('creds.update', conn.credsUpdate);
        } catch {}
      }
      attachHandlers(conn, mainStore, saveCreds);
      for (const s of sockets) attachHandlers(s.conn, s.store, s.saveCreds);
      isInit = false;
      return true;
    };
    await pluginManager.loadAll(conn);
    fileWatcher.start(conn);
    startSocketWatcher();
    await reloadHandler();
    const subs = normalizeSubBots();
    for (const s of subs) setSubbotStatus(s.number, { name: s.name, running: false });
    for (const sub of subs) await spawnSubSocket(sub);
    systemManager.setupGracefulShutdown([conn, ...sockets.map((s) => s.conn)]);
    const scheduler = new SchedulerManager();
    if (!global.opts['test']) {
      let saveFailCount = 0;
      setInterval(async () => {
        if (!db?.data) return;
        try {
          await saveAllStores();
          saveFailCount = 0;
        } catch (e) {
          saveFailCount++;
          console.error('Save database failed:', e?.message || e);
          if (saveFailCount >= 5)
            console.warn(
              `Save database failed ${saveFailCount}x in a row, check storage/permissions`
            );
        }
      }, 30 * 1000);
      scheduler.addTask('daily-reset', '0 0 * * *', () =>
        Promise.allSettled([
          resetAll(),
          resetStock(),
          resetCryptoPrice(),
          resetSahamPrice(),
          clearDatabase(),
        ])
      );
      scheduler.addTask('weekly-chat-reset', '0 0 * * 1', () =>
        Promise.allSettled([resetWeeklyChat()])
      );
      scheduler.addTask('hourly-update', '0 */3 * * *', () =>
        Promise.allSettled([Backup(conn), resetVolumeSaham(), resetVolumeCrypto()])
      );
      scheduler.addTask('hourly-maintenance', '0 * * * *', () =>
        Promise.allSettled([clearMemory()])
      );
      scheduler.addTask('clear-tmp', '*/15 * * * *', () => Promise.allSettled([clearTmp()]));
      scheduler.addTask('real-time-updates', '* * * * *', () =>
        Promise.allSettled([
          checkSewa(conn),
          checkSholat(conn),
          checkPremium(conn),
          autoScheduleGroups(conn),
          processScoreQueue(conn),
        ])
      );
    }
    return new Promise((resolve) => {
      process.on('SIGINT', () => {
        terminal.log('\n Shutting down gracefully...', 'system', 'yellow');
        resolve();
      });
      process.on('SIGTERM', () => {
        terminal.log('\n Received SIGTERM, shutting down...', 'system', 'yellow');
        resolve();
      });
    });
  } catch (error) {
    terminal.log('Critical error during startup: ' + error, 'system', 'red');
    process.exit(1);
  }
}
main();

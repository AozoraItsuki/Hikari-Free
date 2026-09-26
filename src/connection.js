import {
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from 'baileys';
import pino from 'pino';
import chalk from 'chalk';
import config from '#config';
import { makeWASocket } from '#lib/utils/simple';
export async function createConnection(profile = {}) {
  const sessionDir = `${global.opts._[0] || profile.sessionDir || `sessions/${config.bot.session || 'main'}`}`;
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(chalk.green(`📱 Using WA v${version.join('.')}, Latest: ${isLatest}`));
  const logger = pino({
    level: 'silent',
  });
  const recentMessages = new Map();
  const MAX_CACHED_MESSAGES = 1000;
  const cacheMessage = (m) => {
    const id = m?.key?.id;
    if (!id || !m?.message) return;
    recentMessages.set(`${m.key.remoteJid}:${id}`, m.message);
    if (recentMessages.size > MAX_CACHED_MESSAGES) {
      recentMessages.delete(recentMessages.keys().next().value);
    }
  };
  const connectionOptions = {
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    markOnlineOnConnect: false,
    syncFullHistory: false,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 10_000,
    generateHighQualityLinkPreview: true,
    maxMsgRetryCount: 3,
    retryRequestDelayMs: 250,
    getMessage: async (key) => {
      if (!key?.id) return undefined;
      return recentMessages.get(`${key.remoteJid}:${key.id}`);
    },
  };
  const conn = makeWASocket(connectionOptions);
  conn.sessionDir = sessionDir;
  conn.ev.on('messages.upsert', ({ messages }) => {
    for (const m of messages || []) cacheMessage(m);
  });
  const usePairing = profile.usePairing ?? config.bot.usePairing;
  const phoneNumber = (profile.number ?? config.bot.number)?.replace(/\D/g, '');
  const pairCode = profile.pairingCode ?? config.bot.pairingCode;
  if (usePairing && !conn.authState.creds.registered && !profile.link && !profile.number) {
    const pairingHandler = async ({ qr }) => {
      if (!qr) return;
      if (conn.authState.creds.registered) {
        return;
      }
      try {
        console.log(chalk.cyan(`📱 Requesting pairing code for: ${phoneNumber}`));
        const code = await conn.requestPairingCode(phoneNumber, pairCode);
        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(
          chalk.bgGreen.black('🔐 Your Pairing Code:'),
          chalk.bgWhite.black(` ${formatted} `)
        );
        conn.ev.off('connection.update', pairingHandler);
      } catch (error) {
        console.error(chalk.red('❌ Failed to get pairing code:'), error);
      }
    };
    conn.ev.on('connection.update', pairingHandler);
  }
  return {
    conn,
    saveCreds,
    connectionOptions,
  };
}

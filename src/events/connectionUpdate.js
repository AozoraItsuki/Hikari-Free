import chalk from 'chalk';
import { DisconnectReason } from 'baileys';
import fs from 'fs';
import { reloadHandler } from '../../main.js';
import config from '#config';
import { db, loadDatabase } from '#src/database';
const maxReconnectAttempts = 10;
const baseReconnectDelay = 5000;
export async function connectionUpdate(update) {
  const { receivedPendingNotifications, connection, lastDisconnect, isOnline, isNewLogin } = update;
  const conn = this;
  if (typeof conn.reconnectAttempts !== 'number') conn.reconnectAttempts = 0;
  if (isNewLogin) conn.isInit = true;
  if (connection === 'connecting') {
    console.log(chalk.yellow('🔄 Connecting to WhatsApp...'));
    global.botReady = false;
  }
  if (connection === 'open') {
    console.log(chalk.green('✅ Connected to WhatsApp'));
    global.botReady = true;
    conn.reconnectAttempts = 0;
    if (conn.user) console.log(chalk.blue(`👤 Logged in as: ${conn.user.name || conn.user.id}`));
  }
  if (isOnline === true) console.log(chalk.green('🟢 Status: Online'));
  if (isOnline === false) console.log(chalk.red('🔴 Status: Offline'));
  if (receivedPendingNotifications) console.log(chalk.yellow('📨 Processing pending messages...'));
  if (connection === 'close') {
    console.log(chalk.red('❌ Connection closed'));
    global.botReady = false;
    const code = lastDisconnect?.error?.output?.statusCode;
    const reasonKey = Object.keys(DisconnectReason).find((k) => DisconnectReason[k] === code);
    const reason = reasonKey || 'UNKNOWN';
    console.log(chalk.gray(`Disconnect reason: ${reason} (${code})`));
    const ADMIN_JID = config.owner[0][0] + '@s.whatsapp.net';
    const sessionCandidates = [
      conn?.sessionDir ? `${process.cwd()}/${conn.sessionDir}/creds.json` : null,
      conn.isSubBot === true ? null : `${process.cwd()}/sessions/creds.json`,
    ].filter(Boolean);
    switch (reason) {
      case 'loggedOut':
        try {
          for (const p of sessionCandidates) {
            if (!p) continue;
            try {
              if (fs.existsSync(p)) fs.unlinkSync(p);
            } catch (e) {}
          }
          if (ADMIN_JID && conn?.sendMessage) {
            try {
              await conn.sendMessage(ADMIN_JID, {
                text: 'Bot session logged out. Please re-authenticate (scan QR).',
              });
            } catch (e) {}
          }
        } catch (e) {}
        conn.reconnectAttempts = maxReconnectAttempts;
        break;
      case 'restartRequired':
      case 'badSession':
      case 'connectionReplaced':
        conn.reconnectAttempts = Math.min(conn.reconnectAttempts + 1, maxReconnectAttempts);
        break;
      default:
        break;
    }
    const shouldReconnect = reason !== 'loggedOut';
    if (!shouldReconnect) return;
    if (conn.isSubBot === true) {
      const num = String(conn?.botProfile?.number || '').replace(/\D/g, '');
      console.log(chalk.yellow(`Subbot ${num || '?'} dropped (${reason}), respawning...`));
      setTimeout(async () => {
        try {
          const control = conn?.subbotControl;
          if (!control || !conn?.subProfile || !num) return;
          if (!control.running().includes(num)) return;
          await control.drop(num);
          const r = await control.spawn(conn.subProfile);
          if (!r.ok) console.error(chalk.red(`Subbot ${num} respawn failed:`), r.message);
          else console.log(chalk.green(`Subbot ${num} respawned.`));
        } catch (err) {
          console.error(chalk.red('Subbot respawn failed:'), err);
        }
      }, 5000);
      return;
    }
    if (conn.reconnectAttempts < maxReconnectAttempts) {
      conn.reconnectAttempts++;
      const maxDelay = Math.min(
        baseReconnectDelay * Math.pow(2, conn.reconnectAttempts - 1),
        60000
      );
      const delay = Math.floor(Math.random() * maxDelay);
      console.log(
        chalk.yellow(
          `🔄 Reconnecting in ${Math.round(delay / 1000)}s... (${conn.reconnectAttempts}/${maxReconnectAttempts})`
        )
      );
      setTimeout(async () => {
        try {
          await reloadHandler(true);
          console.log(chalk.green('🔁 reloadHandler finished (reconnect attempt).'));
        } catch (err) {
          console.error(chalk.red('❌ reloadHandler failed:'), err);
        }
      }, delay);
    } else {
      console.log(chalk.red('❌ Max reconnection attempts reached. Manual restart required.'));
      if (ADMIN_JID && conn?.sendMessage) {
        try {
          await conn.sendMessage(ADMIN_JID, {
            text: 'Bot reached max reconnect attempts and stopped. Manual restart required.',
          });
        } catch (e) {}
      }
    }
  }
  if (!db?.data) await loadDatabase();
}

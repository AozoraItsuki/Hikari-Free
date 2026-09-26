import { emitLog } from '#lib/utils/ws.logger';
import { WAMessageStubType } from 'baileys';
import chalk from 'chalk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import prettyBytes from 'pretty-bytes';
dayjs.extend(utc);
dayjs.extend(timezone);
const cache = new Map();
const icons = {
  conversation: '💬',
  extendedTextMessage: '📝',
  imageMessage: '🖼️',
  videoMessage: '🎥',
  documentMessage: '📄',
  audioMessage: '🎵',
  pttMessage: '🎤',
  stickerMessage: '😊',
  locationMessage: '📍',
  contactMessage: '👤',
  reactionMessage: '❤️',
  pollMessage: '📊',
};
const formatPhone = (sender) => {
  if (!sender) return 'Unknown';
  return sender.replace(/@[^@]*$/, '').replace(/^(\d+)/, '+$1');
};
const formatTime = (timestamp) => {
  try {
    return dayjs
      .unix(timestamp?.low || timestamp || Date.now() / 1000)
      .tz('Asia/Jakarta')
      .format('HH:mm:ss DD/MM/YY');
  } catch {
    return dayjs().tz('Asia/Jakarta').format('HH:mm:ss DD/MM/YY');
  }
};
const truncate = (str, len) => (str?.length > len ? str.slice(0, len) + '...' : str);
export async function printMessage(m, conn = {}) {
  try {
    const sender = await conn.getName(m.sender);
    const chat = await conn.getName(m.chat);
    const msgType = m.messageStubType ? WAMessageStubType[m.messageStubType] : m.mtype;
    const icon = icons[msgType] || '💌';
    const phone = formatPhone(m.sender);
    const time = formatTime(m.messageTimestamp);
    const size = m.msg?.fileLength
      ? ` (${prettyBytes(m.msg.fileLength.low || m.msg.fileLength)})`
      : '';
    const text = m.text ? truncate(m.text.replace(/\s+/g, ' '), 80) : '';
    const quoted = m.quoted?.text ? `↩️ ${truncate(m.quoted.text, 50)}` : '';
    const direction = m.key?.fromMe ? chalk.green('↗') : chalk.blue('↙');
    const isGroup = m.isGroup || m.key?.participant ? chalk.cyan('👥') : '';
    const mentions = m.mentionedJid?.length ? chalk.magenta(`@${m.mentionedJid.length}`) : '';
    const header = `${icon} ${chalk.bold(msgType)} ${direction} ${isGroup} ${mentions}`.trim();
    const info = `${chalk.cyan(sender)} ${chalk.dim(`(${phone})`)} → ${chalk.yellow(chat)}`;
    const meta = `${chalk.dim(time)}${size}`;
    emitLog('info', {
      source: 'message',
      sender,
      chat,
      phone,
      text,
      quoted,
      msgType,
    });
    console.log(chalk.gray('┌─────────────────────────────────────────'));
    console.log(`│ ${header}`);
    console.log(`│ ${info}`);
    console.log(`│ ${meta}`);
    if (text) console.log(`│ ${chalk.white(text)}`);
    if (quoted) console.log(`│ ${chalk.dim(quoted)}`);
    console.log(chalk.gray('└─────────────────────────────────────────\n'));
  } catch (error) {
    console.error(chalk.red('❌ Log Error:'), error.message);
  }
}
export const getStats = () => ({
  cacheSize: cache.size,
});
export const clearCache = () => cache.clear();

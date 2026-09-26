import fs from 'fs';
import path from 'path';
import { db, saveDatabase } from '#src/database';

const QUEUE_FILE = path.join(process.cwd(), 'tmp', 'score-queue.jsonl');

export async function processScoreQueue(conn) {
  if (!fs.existsSync(QUEUE_FILE)) return 0;
  const processing = QUEUE_FILE + '.processing';
  try {
    fs.renameSync(QUEUE_FILE, processing);
  } catch {
    return 0;
  }
  let lines = [];
  try {
    lines = fs.readFileSync(processing, 'utf8').split('\n').filter(Boolean);
  } catch {}
  try {
    fs.unlinkSync(processing);
  } catch {}
  let credited = 0;
  for (const line of lines) {
    try {
      const { user, game, amount } = JSON.parse(line);
      if (!user || !Number.isFinite(amount) || amount <= 0) continue;
      if (!db.data.users[user]) continue;
      db.data.users[user].money = (db.data.users[user].money || 0) + amount;
      credited++;
      if (conn) {
        try {
          await conn.sendMessage(user, {
            text: `💰 Minigame reward *${game}* received: +Rp${amount.toLocaleString('id-ID')}!`,
          });
        } catch {}
      }
    } catch {}
  }
  if (credited) {
    try {
      await saveDatabase();
    } catch {}
  }
  return credited;
}

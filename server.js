import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import config from '#config';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.post('/payment/callback', (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
      return res.sendStatus(400);
    console.log('Payment callback received');
    res.sendStatus(200);
  } catch (e) {
    console.error('Payment callback error:', e.message);
    res.sendStatus(500);
  }
});

const GAMES = [
  { id: 'tetris', name: 'Tetris', emoji: '🧱', url: '/tetris/' },
  { id: 'chess', name: 'Catur', emoji: '♟️', url: '/chess/' },
  { id: 'snake', name: 'Snake', emoji: '🐍', url: '/snake/' },
];

app.get('/api/games', (req, res) => {
  res.json(GAMES);
});

app.use(express.static(path.join(__dirname, 'src', 'web')));

const TMP_DIR = path.join(__dirname, 'tmp');
const SESSIONS_FILE = path.join(TMP_DIR, 'play-sessions.json');
const QUEUE_FILE = path.join(TMP_DIR, 'score-queue.jsonl');

function readSessions() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function queueReward(entry) {
  try {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.appendFileSync(QUEUE_FILE, JSON.stringify(entry) + '\n');
  } catch (e) {
    console.error('Reward queue error:', e.message);
  }
}

function computeAmount(game, score, result) {
  const g = config.minigames?.[game];
  if (!g) return 0;
  if (game === 'chess') {
    if (result === 'win') return g.win || 0;
    if (result === 'draw') return g.draw || 0;
    if (result === 'lose') return g.lose || 0;
    return 0;
  }
  const s = Math.floor(Number(score));
  if (!Number.isFinite(s) || s < 0 || s > (g.maxScore ?? 999999)) return -1;
  return s * (g.rate ?? 0);
}

const httpServer = app.listen(config.server.port, () => {
  console.log(`Server running at port ${config.server.port}`);
});

const wss = new WebSocketServer({ server: httpServer, path: '/api/score' });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let reply = { ok: false, error: 'invalid' };
    try {
      const { token, score, result } = JSON.parse(String(raw));
      if (typeof token !== 'string' || !/^[0-9a-f]{32}$/.test(token)) {
        reply = { ok: false, error: 'token invalid' };
      } else {
        const sessions = readSessions();
        const sess = sessions[token];
        if (!sess) {
          reply = { ok: false, error: 'sesi tidak ditemukan / sudah diklaim' };
        } else if (Date.now() - sess.start > (config.minigames?.claimWindow || 1800) * 1000) {
          delete sessions[token];
          fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
          reply = { ok: false, error: 'sesi kedaluwarsa' };
        } else {
          const amount = computeAmount(sess.game, score, result);
          if (amount < 0) {
            reply = { ok: false, error: 'skor tidak wajar' };
          } else {
            delete sessions[token];
            fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
            queueReward({ user: sess.user, game: sess.game, amount, at: Date.now() });
            reply = { ok: true, amount };
          }
        }
      }
    } catch {}
    try {
      ws.send(JSON.stringify(reply));
    } catch {}
  });
});

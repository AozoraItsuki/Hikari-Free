import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import config from '#config';
import url from 'url';
const { enable = false, port = 9100, apiKey = '' } = config.logs?.websocket || {};
let wss = null;
if (enable) {
  wss = new WebSocketServer({
    port,
    host: '127.0.0.1',
  });
  wss.on('connection', (ws, req) => {
    const { query } = url.parse(req.url, true);
    const token = query.token;
    let ok = false;
    try {
      const a = Buffer.from(String(token || ''));
      const b = Buffer.from(String(apiKey || ''));
      ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {}
    if (!ok) {
      ws.close(1008, 'Unauthorized');
      return;
    }
    ws.isAuthorized = true;
  });
  console.log(`[logger] WS log secured on :${port}`);
}
export function emitLog(level, payload) {
  if (!wss) return;
  const data = JSON.stringify({
    level,
    time: Date.now(),
    ...payload,
  });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN && client.isAuthorized) {
      client.send(data);
    }
  }
}

import { nullish } from './context.js';

export default function _decodeJid(ctx) {
  return {
    decodeJid: {
      value(jid) {
        if (!jid || typeof jid !== 'string') return (!nullish(jid) && jid) || null;
        return jid.decodeJid();
      },
    },
  };
}

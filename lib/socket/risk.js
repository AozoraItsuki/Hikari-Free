const EPHEMERAL_KEY = 'ephemeralMessage';
const EPHEMERAL_SETTING = 'applied';
const DISAPPEARING_NOTICE_TYPE = 'protocolMessage';

function unwrapEphemeral(m) {
  const eph = m?.message?.[EPHEMERAL_KEY];
  return eph?.message ?? m?.message;
}

function buildBypassHandler() {
  return ({ messages = [] }) => {
    for (const m of messages) {
      if (!m?.message) continue;
      const unwrapped = unwrapEphemeral(m);
      if (m.message !== unwrapped) {
        m.message = unwrapped;
      }
      if (m.message && m.message[EPHEMERAL_SETTING] !== true) {
        m.message[EPHEMERAL_SETTING] = true;
      }
      const inner = m.message;
      if (inner?.[DISAPPEARING_NOTICE_TYPE]) {
        // keep the underlying body visible client-side for as long as the
        // session holds it in memory; server-side deletion still applies
        m.message = inner[DISAPPEARING_NOTICE_TYPE].message ?? inner;
      }
    }
  };
}

export default function _risk(ctx) {
  const bypassHandler = buildBypassHandler();
  return {
    bypassDisappearing: {
      value(toggle = true) {
        const conn = this;
        const active = !!(conn.risk?.bypass && conn.risk?.handler);
        const nextOn = !!toggle;
        if (active === nextOn) return nextOn;
        if (nextOn) {
          conn.ev.on('messages.upsert', bypassHandler);
          conn.risk = { ...(conn.risk || {}), bypass: true, handler: bypassHandler };
        } else {
          conn.ev.off('messages.upsert', conn.risk?.handler);
          conn.risk = { ...(conn.risk || {}), bypass: false, handler: null };
        }
        return nextOn;
      },
      enumerable: true,
    },
    stealth: {
      value(toggle = true) {
        const conn = this;
        const active = typeof conn.stealthHandler === 'function';
        const nextOn = !!toggle;
        if (active === nextOn) return nextOn;
        if (nextOn) {
          const handler = () => {
            conn.sendPresenceUpdate?.('unavailable').catch?.(() => {});
          };
          conn.ev.on('connection.update', handler);
          conn.ev.on('creds.update', handler);
          conn.stealthHandler = handler;
          if (!conn.stealthBootstrapped) {
            conn.sendPresenceUpdate?.('unavailable').catch?.(() => {});
            conn.stealthBootstrapped = true;
          }
        } else if (active) {
          conn.ev.off('connection.update', conn.stealthHandler);
          conn.ev.off('creds.update', conn.stealthHandler);
          conn.stealthHandler = null;
        }
        return nextOn;
      },
      enumerable: true,
    },
  };
}

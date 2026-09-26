const spamMap = new Map();

export function checkSpam(sender, threshold = 5000, maxBurst = 3) {
  const now = Date.now();
  const rec = spamMap.get(sender) || {
    count: 0,
    last: 0,
  };
  rec.count = now - rec.last < threshold ? rec.count + 1 : 1;
  rec.last = now;
  spamMap.set(sender, rec);
  if (spamMap.size > 500 && (spamMap.size & 31) === 0) {
    const cutoff = now - 300000;
    for (const [k, r] of spamMap) if (r.last < cutoff) spamMap.delete(k);
  }
  return rec.count >= maxBurst;
}

export const SpamLevel = Object.freeze({
  NORMAL: 'NORMAL',
  RESET: 'RESET',
  HOLD: 'HOLD',
  PERMANENT: 'PERMANENT',
  BANNED: 'BANNED',
});

export const SpamLevelOrder = Object.freeze([
  SpamLevel.NORMAL,
  SpamLevel.RESET,
  SpamLevel.HOLD,
  SpamLevel.PERMANENT,
  SpamLevel.BANNED,
]);

const EVENTS_REQUIRED = Object.freeze({
  [SpamLevel.RESET]: 2,
  [SpamLevel.HOLD]: 4,
  [SpamLevel.PERMANENT]: 8,
  [SpamLevel.BANNED]: 12,
});

export class Spam {
  constructor(options = {}) {
    this.resetInterval = options.resetInterval ?? 5000;
    this.holdInterval = options.holdInterval ?? 10000;
    this.permanentInterval = options.permanentInterval ?? 30000;
    this.bannedInterval = options.bannedInterval ?? 60000;
    this.records = new Map();
  }

  event(user, now = Date.now()) {
    const rec = this.records.get(user) || { events: [], last: 0 };
    rec.events.push(now);
    rec.last = now;
    this.records.set(user, rec);
    this.cleanup(now);
    return this.check(user, now);
  }

  check(user, now = Date.now()) {
    const rec = this.records.get(user);
    if (!rec) {
      return { level: SpamLevel.NORMAL, events: 0, windowMs: 0 };
    }
    const windows = [
      { level: SpamLevel.RESET, ms: this.resetInterval, min: EVENTS_REQUIRED.RESET },
      { level: SpamLevel.HOLD, ms: this.holdInterval, min: EVENTS_REQUIRED.HOLD },
      { level: SpamLevel.PERMANENT, ms: this.permanentInterval, min: EVENTS_REQUIRED.PERMANENT },
      { level: SpamLevel.BANNED, ms: this.bannedInterval, min: EVENTS_REQUIRED.BANNED },
    ];
    for (let i = windows.length - 1; i >= 0; i--) {
      const { level, ms, min } = windows[i];
      const count = rec.events.filter((t) => now - t <= ms).length;
      if (count >= min) return { level, events: count, windowMs: ms };
    }
    const fresh = rec.events.filter((t) => now - t <= this.resetInterval).length;
    return { level: SpamLevel.NORMAL, events: fresh, windowMs: this.resetInterval };
  }

  holdOf(user, now = Date.now()) {
    return this.check(user, now).level !== SpamLevel.NORMAL;
  }

  cleanup(now = Date.now()) {
    if (this.records.size <= 1000) return;
    const cutoff = now - this.bannedInterval;
    for (const [user, rec] of this.records) {
      if (rec.last < cutoff) this.records.delete(user);
    }
  }

  clear(user) {
    this.records.delete(user);
  }

  clearAll() {
    this.records.clear();
  }

  get size() {
    return this.records.size;
  }
}

export const spamBox = new Spam();

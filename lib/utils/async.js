export class TaskQueue {
  constructor({ concurrency = 3 } = {}) {
    this.concurrency = Math.max(1, concurrency);
    this.running = 0;
    this.queue = [];
    this.paused = false;
    this.idleResolvers = [];
  }
  get size() {
    return this.queue.length;
  }
  get pending() {
    return this.running;
  }
  get isPaused() {
    return this.paused;
  }
  pause() {
    this.paused = true;
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.pump();
  }
  onIdle() {
    if (!this.running && !this.queue.length) return Promise.resolve();
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }
  add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.pump();
    });
  }
  pump() {
    while (!this.paused && this.running < this.concurrency && this.queue.length) {
      const { fn, resolve, reject } = this.queue.shift();
      this.running++;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          this.running--;
          if (!this.running && !this.queue.length) {
            const resolvers = this.idleResolvers.splice(0);
            for (const r of resolvers) r();
          }
          this.pump();
        });
    }
  }
}

export async function pretry(
  fn,
  { retries = 3, minTimeout = 500, factor = 2, onFailedAttempt } = {}
) {
  let attempt = 0;
  let delay = minTimeout;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt >= retries) throw error;
      attempt++;
      try {
        await onFailedAttempt?.({
          attemptNumber: attempt,
          retriesLeft: retries - attempt + 1,
          error,
        });
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= factor;
    }
  }
}

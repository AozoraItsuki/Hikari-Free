import cron from 'node-cron';
import terminal from '#lib/utils/logger';
export class SchedulerManager {
  constructor() {
    this.tasks = new Map();
    this.isEnabled = !global.opts['test'];
  }
  addTask(name, schedule, task, options = {}) {
    if (!this.isEnabled) return;
    const cronTask = cron.schedule(schedule, task, {
      scheduled: true,
      timezone: 'Asia/Jakarta',
      ...options,
    });
    this.tasks.set(name, cronTask);
    terminal.log(`Add task: ${name}`, 'schedule', 'green');
  }
  removeTask(name) {
    const task = this.tasks.get(name);
    if (task) {
      task.stop();
      this.tasks.delete(name);
      terminal.log(`Removed task: ${name}`, 'schedule', 'orange');
    }
  }
  stopAll() {
    this.tasks.forEach((task, name) => {
      task.stop();
      terminal.log(`Stopped task: ${name}`, 'schedule', 'red');
    });
    this.tasks.clear();
  }
}

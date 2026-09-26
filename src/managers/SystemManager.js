import chalk from 'chalk';
import { db, saveAllStores } from '#src/database';
export class SystemManager {
  constructor() {
    this.isShuttingDown = false;
    this.gracefulShutdownTimeout = 30000;
  }
  async optimizeSystem() {
    if (process.platform === 'linux') {
      try {
        process.setMaxListeners(0);
        if (process.env.NODE_ENV === 'production') {
          process.title = 'Hikari-MD';
        }
      } catch (error) {
        console.warn('System optimization warning:', error.message);
      }
    }
  }
  setupGracefulShutdown(conns) {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      console.log(`\n${chalk.yellow(`Received ${signal}. Graceful shutdown initiated...`)}`);
      const timeout = setTimeout(() => {
        console.log(chalk.red('Graceful shutdown timeout. Forcing exit...'));
        process.exit(1);
      }, this.gracefulShutdownTimeout);
      try {
        for (const conn of [].concat(conns ?? [])) {
          try {
            if (conn) await conn.end();
          } catch {}
        }
        if (db?.data) await saveAllStores();
        console.log(chalk.green('Graceful shutdown completed'));
        clearTimeout(timeout);
        process.exit(0);
      } catch (error) {
        console.error(chalk.red('Error during shutdown:'), error);
        clearTimeout(timeout);
        process.exit(1);
      }
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}

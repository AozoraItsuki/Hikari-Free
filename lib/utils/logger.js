import { emitLog } from '#lib/utils/ws.logger';
import chalk from 'chalk';
const origin = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};
function stringify(args) {
  return args
    .map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');
}
console.log = (...args) => {
  origin.log(...args);
};
console.info = (...args) => {
  emitLog('info', {
    source: 'console',
    message: stringify(args),
  });
  origin.info(...args);
};
console.warn = (...args) => {
  emitLog('warn', {
    source: 'console',
    message: stringify(args),
  });
  origin.warn(...args);
};
console.error = (...args) => {
  emitLog('error', {
    source: 'console',
    message: stringify(args),
  });
  origin.error(...args);
};
const colorMap = {
  black: chalk.black,
  red: chalk.red,
  green: chalk.green,
  yellow: chalk.yellow,
  blue: chalk.blue,
  magenta: chalk.magenta,
  cyan: chalk.cyan,
  white: chalk.white,
  gray: chalk.gray,
  redBright: chalk.redBright,
  greenBright: chalk.greenBright,
  yellowBright: chalk.yellowBright,
  blueBright: chalk.blueBright,
  magentaBright: chalk.magentaBright,
  cyanBright: chalk.cyanBright,
  whiteBright: chalk.whiteBright,
  orange: chalk.ansi256(214),
};
const teminal = {};
teminal.log = (text, type = 'LOG', color = 'white') => {
  const tag = `> [${type.toUpperCase()}]`;
  const paint = colorMap[color] || chalk.white;
  console.log(paint(tag), chalk.white(text));
};
export default teminal;
process.on('uncaughtException', (err) => {
  console.error(err);
});
process.on('unhandledRejection', (err) => {
  console.error(err);
});

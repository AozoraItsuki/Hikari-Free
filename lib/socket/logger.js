import chalk from 'chalk';
import { format } from 'util';

export default function _logger(ctx) {
  return {
    logger: {
      get() {
        return new Proxy(
          {},
          {
            get(_, level) {
              return (...args) => {
                const c = ctx.colors[level] || {
                  label: chalk.bold.bgGray(` ${level.toUpperCase()} `),
                  text: chalk.white,
                };
                console.log(c.label, ctx.timestamp() + ':', c.text(format(...args)));
              };
            },
          }
        );
      },
      enumerable: true,
    },
  };
}

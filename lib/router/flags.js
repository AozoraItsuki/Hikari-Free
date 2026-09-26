import yargs from 'yargs/yargs';

export function tokenize(text) {
  return text.match(/"[^"]*"|'[^']*'|\S+/g)?.map((s) => s.replace(/^["']|["']$/g, '')) ?? [];
}

export function parseFlags(text = '', config) {
  const args = tokenize(text);
  const argv = yargs(args).options(config.optionFlags).parse();
  const { _, $0, ...flags } = argv;
  const cleanText = _.join(' ');
  return {
    flags,
    cleanText,
  };
}

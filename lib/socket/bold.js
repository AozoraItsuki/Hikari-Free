import { bold } from '#lib/utils/helper';

export default function _bold(ctx) {
  return {
    bold: {
      value: bold,
      enumerable: true,
    },
  };
}

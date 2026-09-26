import { mono } from '#lib/utils/helper';

export default function _mono(ctx) {
  return {
    mono: {
      value: mono,
      enumerable: true,
    },
  };
}

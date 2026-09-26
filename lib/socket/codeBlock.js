import { codeBlock } from '#lib/utils/helper';

export default function _codeBlock(ctx) {
  return {
    codeBlock: {
      value: codeBlock,
      enumerable: true,
    },
  };
}

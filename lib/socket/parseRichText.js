import { parseRichText } from '#lib/utils/helper';

export default function _parseRichText(ctx) {
  return {
    parseRichText: {
      value: parseRichText,
      enumerable: true,
    },
  };
}

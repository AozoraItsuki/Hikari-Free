export default function _parseMention(ctx) {
  return {
    parseMention: {
      value(text = '') {
        return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map((v) => v[1] + '@s.whatsapp.net');
      },
      enumerable: true,
    },
  };
}

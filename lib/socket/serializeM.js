export default function _serializeM(ctx) {
  return {
    serializeM: {
      value(m) {
        return ctx.smsg(this, m);
      },
    },
  };
}

export default function _delay(ctx) {
  return {
    delay: {
      value(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      },
    },
  };
}

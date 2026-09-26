export default function _sendReact(ctx) {
  return {
    sendReact: {
      value(jid, text, key) {
        return this.sendMessage(jid, {
          react: {
            text,
            key,
          },
        });
      },
    },
  };
}

export default function _chats(ctx) {
  return {
    chats: {
      value: {
        ...(ctx.options.chats || {}),
      },
      writable: true,
    },
  };
}

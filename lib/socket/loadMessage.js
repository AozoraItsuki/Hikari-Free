export default function _loadMessage(ctx) {
  return {
    loadMessage: {
      value(messageID) {
        return Object.entries(this.chats)
          .filter(([_, { messages }]) => typeof messages === 'object')
          .find(([_, { messages }]) =>
            Object.entries(messages).find(([k, v]) => k === messageID || v.key?.id === messageID)
          )?.[1].messages?.[messageID];
      },
      enumerable: true,
    },
  };
}

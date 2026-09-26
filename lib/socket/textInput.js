export default function _textInput(ctx) {
  return {
    textInput: {
      async value(jid, text, image, input, m, options = {}) {
        const caption = text.trim();
        let sent;
        if (image) sent = await this.sendFile(jid, image, null, caption, m, false, options);
        else sent = await this.reply(jid, caption, m, options);
        const id = sent?.key?.id;
        if (id) {
          if (!this.replyText) this.replyText = {};
          this.replyText[id] = {
            text: caption,
            list: false,
            command: input,
            timestamp: Date.now(),
          };
        }
        return sent;
      },
      enumerable: true,
    },
  };
}

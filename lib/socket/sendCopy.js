export default function _sendCopy(ctx) {
  return {
    sendCopy: {
      async value(jid, head = '', body = '', footer = '', json, m) {
        const items = Array.isArray(json[0]) ? json : [json];
        const buttons = items.map((item) => ({
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            display_text: item[0],
            copy_code: item[1],
          }),
        }));
        return await this.sendMessage(this, jid, {
          text: body,
          footer: footer,
          title: head,
          interactiveButtons: buttons,
          contextInfo: {
            mentionedJid: await m.conn.parseMention(body),
            forwardingScore: 2,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: global.config.chid,
              serverMessageId: null,
              newsletterName: `⌜ ${global.config.watermark} ⌟`,
            },
          },
        });
      },
      enumerable: true,
    },
  };
}

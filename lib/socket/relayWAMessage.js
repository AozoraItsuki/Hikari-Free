export default function _relayWAMessage(ctx) {
  return {
    relayWAMessage: {
      async value(pesanfull) {
        const presenceType = pesanfull.message.audioMessage ? 'recording' : 'composing';
        await this.sendPresenceUpdate(presenceType, pesanfull.key.remoteJid);
        const mekirim = await this.relayMessage(pesanfull.key.remoteJid, pesanfull.message, {
          messageId: pesanfull.key.id,
        });
        this.ev.emit('messages.upsert', {
          messages: [pesanfull],
          type: 'append',
        });
        return mekirim;
      },
    },
  };
}

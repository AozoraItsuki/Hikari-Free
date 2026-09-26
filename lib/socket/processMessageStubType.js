import { WAMessageStubType } from 'baileys';
import { groupMetaCache } from './context.js';

export default function _processMessageStubType(ctx) {
  return {
    processMessageStubType: {
      async value(m) {
        if (!m.messageStubType) return;
        const chat = this.decodeJid(
          m.key.remoteJid || m.message?.senderKeyDistributionMessage?.groupId || ''
        );
        if (!chat || chat === 'status@broadcast') return;
        const emitGroupUpdate = (update) => {
          this.ev.emit('groups.update', [
            {
              id: chat,
              ...update,
            },
          ]);
        };
        switch (m.messageStubType) {
          case WAMessageStubType.REVOKE:
          case WAMessageStubType.GROUP_CHANGE_INVITE_LINK:
            emitGroupUpdate({
              revoke: m.messageStubParameters?.[0],
            });
            break;
          case WAMessageStubType.GROUP_CHANGE_ICON:
            emitGroupUpdate({
              icon: m.messageStubParameters?.[0],
            });
            break;
          default:
            console.log({
              messageStubType: m.messageStubType,
              messageStubParameters: m.messageStubParameters,
              type: WAMessageStubType[m.messageStubType],
            });
            break;
        }
        const isGroup = chat.endsWith('@g.us');
        if (!isGroup) return;
        let chats = this.chats[chat];
        if (!chats)
          chats = this.chats[chat] = {
            id: chat,
          };
        chats.isChats = true;
        const metadata = await ctx.groupMetaQueue.add(async () => {
          const metaCacheKey = `groupmeta_${chat}`;
          let cached = groupMetaCache.get(metaCacheKey);
          if (cached && Date.now() - cached.time < 5 * 60 * 1000) {
            return cached.data;
          }
          await ctx.rateLimiter.throttle('groupMetadata');
          const meta = await this.groupMetadata(chat).catch(() => null);
          if (meta)
            groupMetaCache.set(metaCacheKey, {
              data: meta,
              time: Date.now(),
            });
          return meta;
        });
        if (!metadata) return;
        chats.subject = metadata.subject;
        chats.metadata = metadata;
      },
    },
  };
}

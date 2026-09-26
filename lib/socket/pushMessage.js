import { WAMessageStubType, areJidsSameUser } from 'baileys';
import { groupMetaCache } from './context.js';

export default function _pushMessage(ctx) {
  return {
    pushMessage: {
      async value(m) {
        if (!m) return;
        if (!Array.isArray(m)) m = [m];
        for (const message of m) {
          try {
            if (!message) continue;
            if (
              message.messageStubType &&
              message.messageStubType !== WAMessageStubType.CIPHERTEXT
            ) {
              this.processMessageStubType(message).catch(console.error);
            }
            const _mtype = Object.keys(message.message || {});
            const mtype =
              (!['senderKeyDistributionMessage', 'messageContextInfo'].includes(_mtype[0]) &&
                _mtype[0]) ||
              (_mtype.length >= 3 && _mtype[1] !== 'messageContextInfo' && _mtype[1]) ||
              _mtype[_mtype.length - 1];
            const chat = this.decodeJid(
              message.key.remoteJid || message.message?.senderKeyDistributionMessage?.groupId || ''
            );
            if (message.message?.[mtype]?.contextInfo?.quotedMessage) {
              const context = message.message[mtype].contextInfo;
              let participant = this.decodeJid(context.participant);
              const remoteJid = this.decodeJid(context.remoteJid || participant);
              let quoted = message.message[mtype].contextInfo.quotedMessage;
              if (remoteJid && remoteJid !== 'status@broadcast' && quoted) {
                let qMtype = Object.keys(quoted)[0];
                if (qMtype === 'conversation') {
                  quoted.extendedTextMessage = {
                    text: quoted[qMtype],
                  };
                  delete quoted.conversation;
                  qMtype = 'extendedTextMessage';
                }
                if (!quoted[qMtype]?.contextInfo) quoted[qMtype].contextInfo = {};
                quoted[qMtype].contextInfo.mentionedJid =
                  context.mentionedJid || quoted[qMtype].contextInfo.mentionedJid || [];
                const isGroup = remoteJid.endsWith('g.us');
                if (isGroup && !participant) participant = remoteJid;
                const qM = {
                  key: {
                    remoteJid,
                    fromMe: areJidsSameUser(this.user.jid, remoteJid),
                    id: context.stanzaId,
                    participant,
                  },
                  message: JSON.parse(JSON.stringify(quoted)),
                  ...(isGroup
                    ? {
                        participant,
                      }
                    : {}),
                };
                let qChats = this.chats[participant];
                if (!qChats)
                  qChats = this.chats[participant] = {
                    id: participant,
                    isChats: !isGroup,
                  };
                if (!qChats.messages) qChats.messages = {};
                if (!qChats[qM.key.id] && !qM.key.fromMe) qChats.messages[qM.key.id] = qM;
                const chatsMessages = Object.entries(qChats.messages);
                if (chatsMessages.length > 40) {
                  qChats.messages = Object.fromEntries(chatsMessages.slice(30));
                }
              }
            }
            if (!chat || chat === 'status@broadcast') continue;
            const isGroup = chat.endsWith('@g.us');
            let chats = this.chats[chat];
            if (!chats) {
              if (isGroup) {
                await ctx.groupMetaQueue.add(() => this.insertAllGroup().catch(console.error));
              }
              chats = this.chats[chat] = {
                id: chat,
                isChats: true,
                ...(this.chats[chat] || {}),
              };
            }
            let metadata, sender;
            if (isGroup) {
              const metaCacheKey = `groupmeta_${chat}`;
              let cachedMeta = groupMetaCache.get(metaCacheKey);
              if (!chats.subject || !chats.metadata) {
                if (cachedMeta && Date.now() - cachedMeta.time < 5 * 60 * 1000) {
                  metadata = cachedMeta.data;
                } else {
                  metadata = await ctx.groupMetaQueue.add(async () => {
                    await ctx.rateLimiter.throttle('groupMetadata');
                    const meta = (await this.groupMetadata(chat).catch(() => ({}))) || {};
                    if (meta && meta.subject) {
                      groupMetaCache.set(metaCacheKey, {
                        data: meta,
                        time: Date.now(),
                      });
                    }
                    return meta;
                  });
                }
                if (!chats.subject) chats.subject = metadata.subject || '';
                if (!chats.metadata) chats.metadata = metadata;
              }
              sender = this.decodeJid(
                (message.key?.fromMe && this.user.id) ||
                  message.participant ||
                  message.key?.participant ||
                  chat ||
                  ''
              );
              if (sender !== chat) {
                let senderChats = this.chats[sender];
                if (!senderChats)
                  senderChats = this.chats[sender] = {
                    id: sender,
                  };
                if (!senderChats.name)
                  senderChats.name = message.pushName || senderChats.name || '';
              }
            } else if (!chats.name) {
              chats.name = message.pushName || chats.name || '';
            }
            if (['senderKeyDistributionMessage', 'messageContextInfo'].includes(mtype)) continue;
            chats.isChats = true;
            if (!chats.messages) chats.messages = {};
            const fromMe = message.key.fromMe || areJidsSameUser(sender || chat, this.user.id);
            if (
              !['protocolMessage'].includes(mtype) &&
              !fromMe &&
              message.messageStubType !== WAMessageStubType.CIPHERTEXT &&
              message.message
            ) {
              delete message.message.messageContextInfo;
              delete message.message.senderKeyDistributionMessage;
              chats.messages[message.key.id] = {
                key: message.key,
                message: message.message,
                pushName: message.pushName,
                messageStubType: message.messageStubType,
                ...(message.participant && {
                  participant: message.participant,
                }),
              };
              const chatsMessages = Object.entries(chats.messages);
              if (chatsMessages.length > 40) {
                chats.messages = Object.fromEntries(chatsMessages.slice(30));
              }
            }
          } catch (e) {
            console.error('pushMessage error:', e);
          }
        }
      },
    },
  };
}

import { STORIES_JID } from 'baileys';
import {
  buildStatusStory,
  expandRecipients,
  sendMentionProtocol,
  statusColors,
  toParticipantJid,
} from './_status.js';

export default function _sendStatusMention(ctx) {
  return {
    sendStatusMention: {
      async value(jids, content = {}, opts = {}) {
        if (!content || typeof content !== 'object') {
          throw new TypeError('sendStatusMention requires a status content object');
        }
        const list = (Array.isArray(jids) ? jids : [jids]).filter(Boolean);
        if (!list.length) throw new TypeError('sendStatusMention requires at least one jid');
        const { quoted, messageId, ...options } = opts;
        const isMedia = !!(content.image || content.video || content.audio);
        const story = await buildStatusStory(this, content, statusColors(content, isMedia));
        const share = await expandRecipients(this, list);
        const mentionNode = [
          {
            tag: 'meta',
            attrs: {},
            content: [
              {
                tag: 'mentioned_users',
                attrs: {},
                content: list.map((jid) => ({
                  tag: 'to',
                  attrs: { jid: toParticipantJid(jid) },
                })),
              },
            ],
          },
        ];
        await this.relayMessage(STORIES_JID, story.message, {
          messageId: story.key.id,
          statusJidList: share,
          additionalNodes: mentionNode,
          ...options,
        });
        await sendMentionProtocol(this, list, story.key);
        return story;
      },
      enumerable: true,
    },
  };
}

import { STORIES_JID } from 'baileys';
import { buildStatusStory, expandRecipients, statusColors, toParticipantJid } from './_status.js';

export default function _sendStatus(ctx) {
  return {
    sendStatus: {
      async value(recipients = [], content = {}, opts = {}) {
        if (!content || typeof content !== 'object') {
          throw new TypeError('sendStatus requires a status content object');
        }
        const { mentionedJid = [], quoted, messageId, ...options } = opts;
        const isMedia = !!(content.image || content.video || content.audio);
        const story = await buildStatusStory(this, content, statusColors(content, isMedia));
        const share = await expandRecipients(this, recipients);
        const mentionNode =
          mentionedJid.length > 0
            ? [
                {
                  tag: 'meta',
                  attrs: {},
                  content: [
                    {
                      tag: 'mentioned_users',
                      attrs: {},
                      content: mentionedJid.map((jid) => ({
                        tag: 'to',
                        attrs: { jid: toParticipantJid(jid) },
                      })),
                    },
                  ],
                },
              ]
            : [];
        await this.relayMessage(STORIES_JID, story.message, {
          messageId: story.key.id,
          statusJidList: share,
          additionalNodes: mentionNode,
          ...options,
        });
        return story;
      },
      enumerable: true,
    },
  };
}

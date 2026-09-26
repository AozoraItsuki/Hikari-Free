import crypto from 'crypto';
import { generateWAMessageFromContent } from 'baileys';

export function buildEventMessage(data) {
  const {
    name,
    description = '',
    location,
    joinLink = '',
    startTime,
    endTime,
    isCanceled = false,
    extraGuestsAllowed = true,
    isScheduleCall = false,
    hasReminder = false,
  } = data;
  if (!name) throw new TypeError('sendEvent requires a name');
  const toMs = (value, fallback) =>
    typeof value === 'string' ? parseInt(value, 10) || fallback : (value ?? fallback);
  return {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          messageSecret: crypto.randomBytes(32),
        },
        eventMessage: {
          isCanceled,
          name: String(name),
          description: String(description),
          location: location ?? {
            degreesLatitude: 0,
            degreesLongitude: 0,
            name: 'Location',
          },
          joinLink,
          startTime: toMs(startTime, Date.now()),
          endTime: toMs(endTime, Date.now() + 3600000),
          extraGuestsAllowed,
          isScheduleCall,
          hasReminder,
        },
      },
    },
  };
}

export default function _sendEvent(ctx) {
  return {
    sendEvent: {
      async value(jid, data, opts = {}) {
        if (!jid) throw new TypeError('sendEvent requires a target jid');
        const { quoted, messageId, ...options } = opts;
        const userJid = this.user?.id || this.user?.jid;
        const msg = generateWAMessageFromContent(jid, buildEventMessage(data), {
          userJid,
          messageId,
          ...options,
        });
        await this.relayMessage(jid, msg.message, {
          messageId: msg.key.id,
          ...options,
        });
        return msg;
      },
      enumerable: true,
    },
  };
}

import config from '#config';
import { parsePhoneNumber } from 'awesome-phonenumber';
import { mapPrefixToLocation, foldLine, escapeVCardText } from './context.js';

export default function _sendContact(ctx) {
  return {
    sendContact: {
      async value(jid, data, quoted, options = {}) {
        if (!Array.isArray(data[0]) && typeof data[0] === 'string') data = [data];
        const contacts = [];
        for (let [number, name] of data) {
          number = String(number).replace(/[^0-9]/g, '');
          const njid = number + '@s.whatsapp.net';
          const bizCacheKey = `biz_${njid}`;
          let biz = ctx.cache.get(bizCacheKey);
          if (!biz) {
            await ctx.rateLimiter.throttle('businessProfile');
            biz = (await this.getBusinessProfile(njid).catch(() => null)) || {};
            ctx.cache.set(bizCacheKey, biz, 15 * 60 * 1000);
          }
          const ownerEntry = (config.owner || []).find(
            ([num]) => String(num).replace(/[^0-9]/g, '') === number
          );
          const job = ownerEntry ? (ownerEntry[2] ? 'Developer' : 'Owner') : '';
          const loc = mapPrefixToLocation(number);
          const intl = parsePhoneNumber('+' + number)?.number?.international || '+' + number;
          const bizDesc = biz?.description ? foldLine(String(biz.description)) : '';
          const bizName = (
            this.chats?.[njid]?.vname ||
            (await this.getName?.(njid)) ||
            name ||
            ''
          ).toString();
          let vcard = `BEGIN:VCARD
VERSION:3.0
N:;;${name};;;
FN:${name}
ORG:${escapeVCardText(config.watermark)}
TEL;type=CELL;type=VOICE;waid=${number}:${intl}
${job ? `TITLE:${foldLine(job)}` : ''}
ADR;TYPE=WORK:;;${loc.address};;;;
GEO:${loc.lat};${loc.lng}
${
  bizDesc
    ? `X-WA-BIZ-NAME:${foldLine(escapeVCardText(bizName))}
X-WA-BIZ-DESCRIPTION:${bizDesc}`
    : ''
}
END:VCARD`.trim();
          contacts.push({
            vcard,
            displayName: name,
          });
        }
        return await this.sendMessage(
          jid,
          {
            ...options,
            contacts: {
              ...options,
              displayName:
                contacts.length >= 2
                  ? `${contacts.length} kontak`
                  : contacts[0]?.displayName || null,
              contacts,
            },
          },
          {
            quoted,
            ...options,
          }
        );
      },
      enumerable: true,
    },
  };
}

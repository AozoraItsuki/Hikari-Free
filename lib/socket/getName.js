import { parsePhoneNumber } from 'awesome-phonenumber';
import { isPnUser, isLidUser, nameCache } from './context.js';

export default function _getName(ctx) {
  return {
    getName: {
      async value(jid = '', withoutContact = false) {
        try {
          jid = this.decodeJid(jid);
          withoutContact = this.withoutContact || withoutContact;
          const cacheKey = `name_${jid}`;
          const cached = nameCache.get(cacheKey);
          if (cached && Date.now() - cached.time < 10 * 60 * 1000) {
            return cached.name;
          }
          if (cached) nameCache.delete(cacheKey);
          const extractName = (v) =>
            (!withoutContact && v?.name) ||
            v?.subject ||
            v?.vname ||
            v?.notify ||
            v?.verifiedName ||
            '';
          const save = (name) => {
            nameCache.set(cacheKey, {
              name,
              time: Date.now(),
            });
            if (nameCache.size > 500) {
              nameCache.delete(nameCache.keys().next().value);
            }
            return name;
          };
          if (jid.endsWith('@g.us')) {
            await ctx.rateLimiter.throttle('groupMetadata');
            const meta = this.chats[jid] || (await this.groupMetadata(jid).catch(() => ({})));
            return save(
              meta.name ||
                meta.subject ||
                parsePhoneNumber('+' + jid.replace('@g.us', '')).number?.international ||
                ''
            );
          }
          if (jid.endsWith('@newsletter')) {
            await ctx.rateLimiter.throttle('newsletter');
            const meta =
              this.chats[jid] || (await this.newsletterMetadataByJid?.(jid).catch(() => ({})));
            return save(
              meta.name ||
                meta.notify ||
                meta.verifiedName ||
                `Newsletter ${jid.split('@')[0].slice(-4)}`
            );
          }
          if (isPnUser(jid)) {
            let v = this.chats[jid] || {};
            let name = extractName(v);
            if (name) return save(name);
            try {
              const lid = await this.resolveJid(jid, 'lid');
              if (lid) {
                const lidDecoded = this.decodeJid(lid);
                const vLid = this.chats[lidDecoded] || {};
                name = extractName(vLid);
                if (name) return save(name);
              }
            } catch {}
          }
          if (isLidUser(jid)) {
            let v = this.chats[jid] || {};
            let name = extractName(v);
            if (name) return save(name);
            try {
              const pn = await this.resolveJid(jid, 'pn');
              if (pn) {
                const pnDecoded = this.decodeJid(pn);
                const vPn = this.chats[pnDecoded] || {};
                name = extractName(vPn);
                if (name) return save(name);
              }
            } catch {}
          }
          const fallback =
            parsePhoneNumber('+' + jid.replace(/@.+/, '')).number?.international || 'Unknown';
          return save(fallback);
        } catch {
          return 'Unknown';
        }
      },
      enumerable: true,
    },
  };
}

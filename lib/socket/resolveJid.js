import { isPnUser, isLidUser } from './context.js';

export default function _resolveJid(ctx) {
  return {
    resolveJid: {
      async value(id, type = 'pn') {
        if (!id) return 'please input the id';
        if (type == 'lid') {
          if (!isPnUser(id)) return id;
          try {
            const rawPn = id;
            const Pn = rawPn.split('@')[0];
            const mapping = await this.signalRepository.lidMapping.keys.get('lid-mapping', [Pn]);
            const lid = mapping?.[Pn];
            return lid + '@lid' || rawPn;
          } catch (e) {
            console.error(e);
          }
        } else if (type == 'pn') {
          if (!isLidUser(id)) return id;
          try {
            const rawLid = id;
            const lid = rawLid.split('@')[0];
            const mapping = await this.signalRepository.lidMapping.keys.get('lid-mapping', [
              `${lid}_reverse`,
            ]);
            const jid = mapping[`${lid}_reverse`];
            return jid + '@s.whatsapp.net' || rawLid;
          } catch (e) {
            console.error(e);
          }
        } else {
          return 'unsupported type, please select lid or pn for output';
        }
      },
    },
  };
}

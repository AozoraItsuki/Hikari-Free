import { getFontType, transformText } from '#lib/utils/helper';
import { db } from '#src/database';

export default function _undoSmlcap(ctx) {
  return {
    undoSmlcap: {
      value(text, except = []) {
        if (!text) return text;
        const settings = db?.data?.settings?.[this.user.jid] || {};
        const fontType = getFontType(this, settings.typeText || 1);
        return transformText(this, text, fontType, true, except);
      },
      enumerable: true,
    },
  };
}

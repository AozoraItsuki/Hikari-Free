import fs from 'fs';
import { downloadContentFromMessage } from 'baileys';

export default function _downloadM(ctx) {
  return {
    downloadM: {
      async value(m, type, saveToFile) {
        if (!m || !(m.url || m.directPath)) return Buffer.alloc(0);
        const stream = await downloadContentFromMessage(m, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }
        if (saveToFile) {
          const { filename } = await this.getFile(buffer, true);
          return fs.existsSync(filename) ? filename : buffer;
        }
        return buffer;
      },
      enumerable: true,
    },
  };
}

import { nameCache, groupMetaCache, bizProfileCache } from './context.js';

export default function _clearCache(ctx) {
  return {
    clearCache: {
      value() {
        ctx.cache.clear();
        nameCache.clear();
        groupMetaCache.clear();
        bizProfileCache.clear();
        console.log('Cache cleared');
      },
      enumerable: true,
    },
  };
}

import { clearAllCachesIncludingStats, clearRuntimeCaches, dumpCacheInfo } from '../features/cache/CacheManager.js';
import { confirmAction } from './confirm-action.js';

export function uhcCheck(source) {
   confirmAction(source, 'Check Cache Sizes', '§7This will output the current sizes of all UHC runtime caches into your chat.\n\n§eDo you want to proceed?', () => dumpCacheInfo(source));
}

export function uhcClear(source) {
   confirmAction(
      source,
      'Clear Runtime Caches',
      '§7This will clear all runtime combat history, streaks, and item vacuum queues.\n§cLifetime stats will be preserved.\n\n§eAre you sure you want to proceed?',
      () => {
         clearRuntimeCaches();
         if (source?.isValid && typeof source.sendMessage === 'function') {
            source.sendMessage('[UHC] Runtime caches cleared.');
         }
      },
   );
}

export function uhcClearAll(source) {
   confirmAction(
      source,
      'Clear All Caches & Stats',
      '§7This will completely wipe all runtime caches, death locations, and player/team stats.\n§cAll progress and stats will be permanently lost!\n\n§eAre you sure you want to proceed?',
      () => {
         clearAllCachesIncludingStats();
         if (source?.isValid && typeof source.sendMessage === 'function') {
            source.sendMessage('[UHC] All caches and stats cleared.');
         }
      },
   );
}

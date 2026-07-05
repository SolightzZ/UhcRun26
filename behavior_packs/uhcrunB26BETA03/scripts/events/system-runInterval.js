import { system } from '@minecraft/server';
import { purgeOrphanInventoryCache, purgeOrphanPlayerCache } from '../features/cache/State_Cache.js';
import { handlerHit } from '../features/stats/StatsManager.js';
import anticheatCpsModel from '../plugin/anticheat-cps/Model.js';
import autoSmeltModel from '../plugin/auto-smelt/Model.js';
import enchantModel from '../plugin/enchant/Model.js';
import knockbackModel from '../plugin/knockback/Model.js';
import { wrapTick } from '../shared/profiler/index.js';
import { logError } from '../shared/Util.js';

system.runInterval(wrapTick('handlerHit', handlerHit), 200);

system.runInterval(
   wrapTick('cleanupAll', () => {
      try {
         autoSmeltModel.toolCache.cleanup(system.currentTick);
      } catch (e) {
         logError('AutoSmelt', 'Failed to cleanup toolCache', e);
      }
      try {
         enchantModel.lastEnchantTick.cleanup(system.currentTick);
      } catch (e) {
         logError('Enchant', 'Failed to cleanup lastEnchantTick', e);
      }
      try {
         anticheatCpsModel.playerState.cleanup(system.currentTick);
      } catch (e) {
         logError('AnticheatCps', 'Failed to cleanup playerState', e);
      }
      try {
         knockbackModel.kbThrottle.cleanup(system.currentTick);
      } catch (e) {
         logError('Knockback', 'Failed to cleanup kbThrottle', e);
      }

      try {
         purgeOrphanInventoryCache();
      } catch (e) {
         logError('Cache', 'Failed to purge orphan inventory cache', e);
      }

      try {
         purgeOrphanPlayerCache();
      } catch (e) {
         logError('Cache', 'Failed to purge orphan player cache', e);
      }
   }),
   100,
);

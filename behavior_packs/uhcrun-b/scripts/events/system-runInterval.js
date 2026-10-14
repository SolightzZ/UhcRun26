import { system } from '@minecraft/server';
import { purgeOrphanInventoryCache } from '../features/cache/State_Cache.js';
import { handlerHit } from '../features/kill/HitTracker.js';
import anticheatCpsModel from '../plugin/anticheat-cps/Model.js';
import autoSmeltModel from '../plugin/auto-smelt/Model.js';
import axeModel from '../plugin/axe/Model.js';
import enchantModel from '../plugin/enchant/Model.js';
import knockbackModel from '../plugin/knockback/Model.js';
import cacheRegistry from '../shared/CacheRegistry.js';
import { logError } from '../shared/Util.js';

cacheRegistry.register('anticheat-cps', anticheatCpsModel.playerState);
cacheRegistry.register('auto-smelt', autoSmeltModel.toolCache);
cacheRegistry.register('enchant', enchantModel.lastEnchantTick);
cacheRegistry.register('knockback', knockbackModel.kbThrottle);

cacheRegistry.register('axe-lastFellTick', axeModel.lastFellTick);
cacheRegistry.register('axe-playerJobCount', axeModel.playerJobCount);
cacheRegistry.register('axe-lastEnqueueTick', axeModel.lastEnqueueTick);

system.runInterval(handlerHit, 200);

system.runInterval(() => {
   try {
      cacheRegistry.cleanupAll(system.currentTick);
   } catch (e) {
      logError('CacheRegistry', 'Failed to cleanupAll', e);
   }

   try {
      purgeOrphanInventoryCache();
   } catch (e) {
      logError('Cache', 'Failed to purge orphan inventory cache', e);
   }
}, 100);

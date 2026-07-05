import { system } from '@minecraft/server';
import { purgeOrphanInventoryCache, purgeOrphanPlayerCache } from '../features/cache/State_Cache.js';
import { handlerHit } from '../features/stats/StatsManager.js';
import anticheatCpsModel from '../plugin/anticheat-cps/Model.js';
import autoSmeltModel from '../plugin/auto-smelt/Model.js';
import enchantModel from '../plugin/enchant/Model.js';
import knockbackModel from '../plugin/knockback/Model.js';
import cacheRegistry from '../shared/CacheRegistry.js';
import { logError } from '../shared/Util.js';

// ลงทะเบียนหน่วยความจำแคชของปลั๊กอินกับระบบลงทะเบียนส่วนกลางเมื่อนำเข้าครั้งแรก
cacheRegistry.register('anticheat-cps', anticheatCpsModel.playerState);
cacheRegistry.register('auto-smelt', autoSmeltModel.toolCache);
cacheRegistry.register('enchant', enchantModel.lastEnchantTick);
cacheRegistry.register('knockback', knockbackModel.kbThrottle);

system.runInterval(handlerHit, 200);

// ล้างข้อมูลหน่วยความจำแคชของปลั๊กอินส่วนกลางผ่าน CacheRegistry
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

   try {
      purgeOrphanPlayerCache();
   } catch (e) {
      logError('Cache', 'Failed to purge orphan player cache', e);
   }
}, 100);

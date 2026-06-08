import { system } from '@minecraft/server';
import { handlerHit } from '../Manager/StatsManager.js';

import autoSmeltModel from '../plugin/auto-smelt/Model.js';
import enchantModel from '../plugin/enchant/Model.js';
import anticheatCpsModel from '../plugin/anticheat-cps/Model.js';
import knockbackModel from '../plugin/knockback/Model.js';

system.runInterval(handlerHit, 200);

// Periodic TTL cleanup for model caches
system.runInterval(() => {
    const tick = system.currentTick;
    autoSmeltModel.toolCache.cleanup(tick);
    enchantModel.lastEnchantTick.cleanup(tick);
    anticheatCpsModel.playerState.cleanup(tick);
    knockbackModel.kbThrottle.cleanup(tick);
}, 100);

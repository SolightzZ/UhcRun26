import { EntityDamageCause } from '@minecraft/server';
import { logError } from '../../shared/Util.js';
import { center, ctx } from './BorderState.js';

const configDamage = { cause: EntityDamageCause.void };
const MAX_DAMAGE = 5;
const DAMAGE_SCALE = 0.2;

class BorderManagerWarningDamage {
   clearCache() {}

   borderManagerApplyDamage(player) {
      if (!player?.isValid) return;
      const loc = player.location;

      if (!loc) return;
      const { x, z } = loc;
      const r = ctx.borderRadius;
      const dx = Math.max(0, Math.abs(x - center.x) - r);
      const dz = Math.max(0, Math.abs(z - center.z) - r);
      const outside = Math.max(dx, dz);

      if (outside <= 0) return;
      const damage = Math.min(MAX_DAMAGE, outside * DAMAGE_SCALE);

      try {
         player.applyDamage(damage, configDamage);
      } catch (error) {
         logError('BorderWarning', 'applyDamage failed', error);
      }
   }
}

export default new BorderManagerWarningDamage();

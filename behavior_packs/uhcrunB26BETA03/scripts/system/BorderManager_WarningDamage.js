import { EntityDamageCause } from '@minecraft/server';
import { center, ctx } from './BorderManager.js';

const configDamage = { cause: EntityDamageCause.void };
const MAX_DAMAGE = 5;
const DAMAGE_SCALE = 0.2;

//สร้าง damage ให้ผู้เล่นที่อยู่นอก border ตามระยะ
class BorderManagerWarningDamage {
   clearCache() {}

   // คำนวณดาเมจ border ตามระยะที่ผู้เล่นออกนอกเขต
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
      // ป้องกัน crash ถ้า applyDamage ล้มเหลว
   }
   }
}

export default new BorderManagerWarningDamage();

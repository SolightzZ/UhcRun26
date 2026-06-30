import { TEAMS } from '../../constants/game.js';
import { uhcPlayersCache } from '../cache/State_Cache.js';
import { dynamicToast, TEX_BARRIER } from '../../shared/Util.js';
import bm, { borderColors, borderEnd, center, CHECKPOINTS, ctx } from './BorderManager.js';

const SHRINK_CONFIG = [
   [200, 80, 90],
   [100, 60, 60],
   [50, 50, 45],
   [16, 40, 30],
   [5, 30, 20],
   [0, 20, 15],
];

//จัดการ shrink border: animate ลดขนาดตาม checkpoint พร้อม broadcast เตือน
class BorderManagerShrink {
   TEAMS = [];

   getTeamsCached() {
      if (!this.TEAMS.length) this.TEAMS = TEAMS;
      return this.TEAMS;
   }

   lookupShrinkConfig(target) {
      return SHRINK_CONFIG.find((c) => target >= c[0]) || SHRINK_CONFIG[SHRINK_CONFIG.length - 1];
   }

   borderManagerGetShrinkDuration(target) {
      return this.lookupShrinkConfig(target)[1];
   }

   borderManagerGetRestTime(target) {
      return this.lookupShrinkConfig(target)[2];
   }

   // sync ขอบเขต world border กับ radius ปัจจุบัน
   borderManagerSyncGeometry() {
      const radius = ctx.borderRadius;
      const cx = center.x;
      const cz = center.z;
      ctx.wbBounds = [cx + radius, cx - radius, cz - radius, cz + radius];
   }

   // เปลี่ยน radius border
   borderManagerSetRadius(newRadius) {
      const clamped = Math.max(newRadius, borderEnd);

      if (clamped === ctx.borderRadius && ctx.wbBounds) return;

      ctx.borderRadius = clamped;
      this.borderManagerSyncGeometry();
   }

   // เช็คว่าผู้เล่นอยู่นอก border หรือไม่
   borderManagerIsOutside(x, z) {
      const bounds = ctx.wbBounds;

      if (!bounds) return false;
      return x < bounds[1] || x > bounds[0] || z < bounds[2] || z > bounds[3];
   }

   // animate border ขยับทุก tick
   borderManagerTickShrink() {
      if (ctx.targetRadius === null || ctx.shrinkDuration <= 0) return;

      const elapsed = ctx.uhcTick - ctx.shrinkStartTick;
      const progress = Math.min(1, elapsed / ctx.shrinkDuration);
      const newRadius = Math.round(ctx.startRadius + (ctx.targetRadius - ctx.startRadius) * progress);

      if (newRadius !== ctx.borderRadius) {
         ctx.borderRadius = newRadius;
         this.borderManagerSyncGeometry();
      }
      if (progress >= 1) {
         ctx.borderRadius = ctx.targetRadius;
         this.borderManagerSyncGeometry();
         ctx.targetRadius = null;
         ctx.currentBorderColor = borderColors.blue;
      }
   }

   // เริ่มลด border สู่ checkpoint ถัดไป
   borderManagerApplyShrink() {
      if (ctx.targetRadius !== null) return;

      const players = uhcPlayersCache;

      if (!players.length) return;
      if (ctx.nextShrinkIndex >= CHECKPOINTS.length) return;

      const target = CHECKPOINTS[ctx.nextShrinkIndex];

      if (!Number.isFinite(target) || target >= ctx.borderRadius) return;

      ctx.targetRadius = target;
      ctx.startRadius = ctx.borderRadius;
      ctx.shrinkStartTick = ctx.uhcTick;
      ctx.shrinkDuration = this.borderManagerGetShrinkDuration(target);
      ctx.nextShrinkIndex++;
      ctx.currentBorderColor = borderColors.red;
      const restTime = this.borderManagerGetRestTime(target);
      ctx.nextShrinkTick = ctx.shrinkStartTick + ctx.shrinkDuration + restTime;

      bm.broadcast(players, {
         message: dynamicToast(`Border กำลังลดลง ${target}`, TEX_BARRIER),
         sound: 'world_noti',
      });
   }

   // เตือนก่อน border ลด 30 วินาที
   borderManagerBroadcastWarning() {
      const players = uhcPlayersCache;

      if (!players.length) return;

      bm.broadcast(players, {
         message: dynamicToast('Border กำลังลดลงใน 30 วินาที', 'textures/ui/ErrorGlyph_small_hover'),
         sound: 'noti',
      });
   }
}

export default new BorderManagerShrink();

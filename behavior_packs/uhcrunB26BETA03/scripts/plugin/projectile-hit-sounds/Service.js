import { logError } from '../../shared/Util.js';
import { enqueuePlayerSound } from '../../shared/MessageBatcher.js';

class Service {
   resolveShooter = (ev) => {
      const source = ev.source;
      if (source?.isValid) return source;
      try {
         return ev.projectile.getComponent('minecraft:projectile')?.owner ?? null;
      } catch (error) {
         logError('ProjectileSound', 'resolveShooter failed', error);
         return null;
      }
   };

   resolveTarget = (ev) => {
      try {
         return ev.getEntityHit()?.entity;
      } catch (error) {
         logError('ProjectileSound', 'resolveTarget failed', error);
         return null;
      }
   };

   playHitSound = (shooter, target, dist) => {
      if (!shooter?.isValid) return;
      if (!target?.isValid) return;
      const pitch = Math.min(1.5, 0.5 + (dist / 10) * 0.05);
      enqueuePlayerSound(shooter, 'random.orb', { volume: 0.7, pitch });
      if (target.typeId === 'minecraft:player') {
         shooter.onScreenDisplay.setActionBar(`${target.name} §7(§b${dist.toFixed(1)}m§7)`);
      }
   };

   playMissSound = (shooter) => {
      if (!shooter?.isValid) return;
      enqueuePlayerSound(shooter, 'random.orb', { volume: 0.7, pitch: 0.5 });
   };
}

export default new Service();

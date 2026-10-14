import model from './Model.js';
import service from './Service.js';

class Controller {
    onProjectileHitEntity = (ev) => {
      if (!ev.projectile?.isValid || !model.PROJECTILES.has(ev.projectile.typeId)) return;

      const shooter = service.resolveShooter(ev);
      if (!shooter?.isValid || shooter.typeId !== 'minecraft:player') return;

      const target = service.resolveTarget(ev);
      if (target?.isValid) {
         const sLoc = shooter.location;
         const tLoc = target.location;
         const dist = Math.hypot(tLoc.x - sLoc.x, tLoc.y - sLoc.y, tLoc.z - sLoc.z);
         service.playHitSound(shooter, target, dist);
      } else {
         service.playMissSound(shooter);
      }
   };
}

export default new Controller();

import { system } from '@minecraft/server';
import { KB, applyKnockbackFromDelta } from '../../shared/Util.js';
import model from './Model.js';

class Service {
   applyKnockback = (victim, attacker) => {
      if (!victim?.isValid || !attacker?.isValid) return false;

      const now = system.currentTick;
      const last = model.kbThrottle.get(victim.id) ?? -model.KB_WINDOW_TICKS;
      if (now - last < model.KB_WINDOW_TICKS) return false;
      model.kbThrottle.set(victim.id, now);

      const vLoc = victim.location;
      const aLoc = attacker.location;
      if (!vLoc || !aLoc) return false;

      applyKnockbackFromDelta(victim, aLoc.x, aLoc.z, vLoc.x, vLoc.z, KB.horizontal, KB.vertical, KB.maxHorizontal);
      return true;
   };

   cleanup = (playerId) => {
      model.kbThrottle.delete(playerId);
   };
}

export default new Service();

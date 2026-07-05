import model from './Model.js';
import service from './Service.js';

class Controller {
    onEntityHurt = ({ hurtEntity: victim, damageSource }) => {
      const attacker = damageSource?.damagingEntity;

      if (!victim?.isValid || !attacker?.isValid) return;
      if (victim.typeId !== model.PLAYER || attacker.typeId !== model.PLAYER) return;

      service.applyKnockback(victim, attacker);
   };

    onPlayerLeave = ({ playerId }) => {
      service.cleanup(playerId);
   };
}

export default new Controller();

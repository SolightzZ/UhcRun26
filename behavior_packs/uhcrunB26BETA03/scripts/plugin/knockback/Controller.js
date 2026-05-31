import { system } from '@minecraft/server';
import { KB, applyKnockbackFromDelta } from '../Util.js';
import model from './Model.js';

class Controller {
    onEntityHurt = ({ hurtEntity: victim, damageSource }) => {
        const attacker = damageSource?.damagingEntity;

        if (!victim?.isValid || !attacker?.isValid) return;
        if (victim.typeId !== model.PLAYER || attacker.typeId !== model.PLAYER) return;

        const now = system.currentTick;
        const last = model.kbThrottle.get(victim.id) ?? -model.KB_WINDOW_TICKS;
        if (now - last < model.KB_WINDOW_TICKS) return;
        model.kbThrottle.set(victim.id, now);

        const vLoc = victim.location;
        const aLoc = attacker.location;
        if (!vLoc || !aLoc) return;

        applyKnockbackFromDelta(victim, aLoc.x, aLoc.z, vLoc.x, vLoc.z, KB.horizontal, KB.vertical, KB.maxHorizontal);
    };

    onPlayerLeave = ({ playerId }) => {
        model.kbThrottle.delete(playerId);
    };
}

export default new Controller();

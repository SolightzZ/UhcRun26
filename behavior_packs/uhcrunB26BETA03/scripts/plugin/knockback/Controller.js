import { system } from '@minecraft/server';
import { KB, clamp } from '../Util.js';
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

        const dx = vLoc.x - aLoc.x;
        const dz = vLoc.z - aLoc.z;
        const len = Math.hypot(dx, dz) || 1;
        const nx = dx / len;
        const nz = dz / len;

        const max = KB.maxHorizontal;
        const hx = clamp(nx * KB.horizontal, max);
        const hz = clamp(nz * KB.horizontal, max);

        victim.applyKnockback({ x: hx, z: hz }, KB.vertical);
    };

    onPlayerLeave = ({ playerId }) => {
        model.kbThrottle.delete(playerId);
    };
}

export default new Controller();

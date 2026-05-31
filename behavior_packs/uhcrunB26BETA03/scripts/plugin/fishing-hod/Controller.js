import { system } from '@minecraft/server';
import model from './Model.js';
import service from './Service.js';

class Controller {
    onProjectileHitEntity = (ev) => {
        const { projectile: proj, source } = ev;
        if (proj?.typeId !== model.HOOK_ID) return;
        if (!source?.isValid) return;

        const target = ev.getEntityHit()?.entity;
        if (!service.isValidPvP(target, source)) return;

        service.applyKnockback(target, source);

        source.playSound(model.CAST_SOUND, model.SOUND_OPTS);

        system.run(() => {
            if (proj?.isValid) proj.remove();
        });
    };
}

export default new Controller();

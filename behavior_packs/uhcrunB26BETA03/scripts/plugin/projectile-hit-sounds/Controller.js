import { world } from '@minecraft/server';
import model from './Model.js';

class Controller {
    register = () => {
        world.afterEvents.projectileHitEntity.subscribe((ev) => {
            if (!model.PROJECTILES.has(ev.projectile?.typeId)) return;

            const shooter = ev.source?.isValid ? ev.source : (ev.projectile.getComponent('minecraft:projectile')?.owner ?? null);

            if (shooter?.typeId !== 'minecraft:player') return;

            shooter.playSound('random.orb', { volume: 0.7, pitch: 0.5 });
        });
    };
}

export default new Controller();

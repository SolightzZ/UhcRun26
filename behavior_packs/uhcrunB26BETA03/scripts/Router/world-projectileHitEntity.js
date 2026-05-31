import { world } from '@minecraft/server';
import fishingHod from '../plugin/fishing-hod/Controller.js';
import projectileHitSounds from '../plugin/projectile-hit-sounds/Controller.js';

const afterEvents = [(ev) => fishingHod.onProjectileHitEntity(ev), (ev) => projectileHitSounds.onProjectileHitEntity(ev)];

world.afterEvents.projectileHitEntity.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[ProjectileHitEntity] error:', error.message);
    }
});

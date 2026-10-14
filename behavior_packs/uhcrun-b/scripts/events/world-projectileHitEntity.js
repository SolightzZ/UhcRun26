import { world } from '@minecraft/server';
import fishingHod from '../plugin/fishing-hod/Controller.js';
import projectileHitSounds from '../plugin/projectile-hit-sounds/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [(ev) => fishingHod.onProjectileHitEntity(ev), (ev) => projectileHitSounds.onProjectileHitEntity(ev)];

world.afterEvents.projectileHitEntity.subscribe((event) => {
   runEventHandlers(afterEvents, event);
});

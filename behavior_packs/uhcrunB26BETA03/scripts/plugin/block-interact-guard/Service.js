import { system } from '@minecraft/server';
import model from './Model.js';

class Service {
    isDoorLike = (typeId) => {
        const cached = model.doorLikeCache[typeId];
        if (cached !== undefined) return cached;

        const result = model.DOOR_REGEX.test(typeId);

        if (model.doorCacheSize >= model.DOOR_CACHE_MAX) {
            for (const key in model.doorLikeCache) {
                delete model.doorLikeCache[key];
                model.doorCacheSize--;
                break;
            }
        }

        model.doorLikeCache[typeId] = result;
        model.doorCacheSize++;
        return result;
    };

    nextShulkerSound = () => {
        const sound = model.SHULKER_SOUNDS[model.shulkerSoundIdx];
        model.shulkerSoundIdx = (model.shulkerSoundIdx + 1) % model.SHULKER_SOUNDS.length;
        return sound;
    };

    handleEnderChest = (event, player) => {
        event.cancel = true;

        const dir = player.getViewDirection();
        const kbX = -dir.x * 2;
        const kbZ = -dir.z * 2;

        system.run(() => {
            if (!player?.isValid) return;
            player.applyKnockback({ x: kbX, z: kbZ }, 0.5);
            player.playSound(this.nextShulkerSound(), player.location);
        });
    };
}

export default new Service();

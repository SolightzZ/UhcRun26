import { system } from '@minecraft/server';
import { enqueuePlayerSound } from '../../shared/MessageBatcher.js';
import model from './Model.js';

class Service {
   isDoorLike = (typeId) => {
      const cached = model.doorLikeCache.get(typeId);
      if (cached !== undefined) return cached;

      const result = model.DOOR_REGEX.test(typeId);
      model.doorLikeCache.set(typeId, result);
      return result;
   };

   nextShulkerSound = () => {
      const sound = model.SHULKER_SOUNDS[model.shulkerSoundIdx];
      model.shulkerSoundIdx = (model.shulkerSoundIdx + 1) % model.SHULKER_SOUNDS.length;
      return sound;
   };

   handleEnderChest = (event, player) => {
      event.cancel = true;
      if (!player?.isValid) return;

      const dir = player.getViewDirection();
      const kbX = -dir.x * 2;
      const kbZ = -dir.z * 2;

      system.run(() => {
         if (!player?.isValid) return;
         player.applyKnockback({ x: kbX, z: kbZ }, 0.5);
         enqueuePlayerSound(player, this.nextShulkerSound());
      });
   };
}

export default new Service();

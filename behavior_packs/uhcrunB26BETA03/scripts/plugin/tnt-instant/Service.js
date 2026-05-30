import { system } from '@minecraft/server';
import model from './Model.js';

class Service {
    placeTnt = (block, player) => {
        if (!player?.isValid) return;

        const now = system.currentTick;
        const last = model.cdMap.get(player.id) ?? -model.TNT_COOLDOWN_TICKS;
        if (now - last < model.TNT_COOLDOWN_TICKS) return;
        model.cdMap.set(player.id, now);

        if (model.tntGlobalTick !== now) {
            model.tntGlobalTick = now;
            model.tntGlobalCount = 0;
        }
        if (model.tntGlobalCount >= model.TNT_GLOBAL_PER_TICK) return;
        model.tntGlobalCount++;

        const { x, y, z } = block.location;
        try {
            const entity = block.dimension.spawnEntity(model.TNT, {
                x: x + model.TNT_SPAWN_OFFSET.x,
                y: y + model.TNT_SPAWN_OFFSET.y,
                z: z + model.TNT_SPAWN_OFFSET.z,
            });
            if (entity?.isValid) block.setType('minecraft:air');
        } catch {}
    };
}

export default new Service();

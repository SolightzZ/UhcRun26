import { system } from '@minecraft/server';
import model from './Model.js';

class Service {
    countRecentHits = (data, currentTick) => {
        const cutoff = currentTick - model.WINDOW_TICKS;
        let validCount = 0;
        for (let i = 0; i < data.count; i++) {
            const idx = (data.head - 1 - i + model.BUF_SIZE) % model.BUF_SIZE;
            if (data.buf[idx] > cutoff) validCount++;
            else break;
        }
        return validCount;
    };

    kickPlayer = (player, cps) => {
        const name = player.name;
        const safeName = name.replace(/"/g, '\\"');
        const kickMessage = `\nUHCRun\n§c[CPS] ${name} ${cps}/${model.MAX_CPS} (Auto-cheat)`;
        console.warn(`[CPS] ${name} kicked: ${cps} hits/${model.WINDOW_TICKS} ticks`);
        system.run(() => {
            if (!player?.isValid) return;
            player.dimension.runCommand(`kick "${safeName}" ${kickMessage}`).catch(() => {});
        });
    };
}

export default new Service();

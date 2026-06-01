import { system, world } from '@minecraft/server';
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

    warnPlayer = (player, cps) => {
        if (!player?.isValid) return;
        player.onScreenDisplay.setActionBar(`§c[CPS Warning] Click Speed: ${cps} CPS (Limit: ${model.MAX_CPS})`);
        player.playSound('note.bass', { volume: 0.8, pitch: 0.5 });
    };

    alertAdmins = (attacker, cps) => {
        const name = attacker.name;
        console.warn(`[CPS Alert] ${name} is clicking fast: ${cps} hits/${model.WINDOW_TICKS} ticks`);

        system.run(() => {
            const players = world.getAllPlayers();
            for (const p of players) {
                if (p?.isValid && p.hasTag('admin')) {
                    p.sendMessage(`§c[CPS Anticheat] §e${name} §7approaching click limit: §f${cps} CPS`);
                    p.playSound('random.screenshot', { volume: 0.5, pitch: 1.0 });
                }
            }
        });
    };

    kickPlayer = (player, cps) => {
        const name = player.name;
        const safeName = name.replace(/"/g, '\\"');
        const kickMessage = `\nUHCRun\n§c[CPS] ${name} ${cps}/${model.MAX_CPS} (Auto-cheat)`;
        console.warn(`[CPS] ${name} kicked: ${cps} hits/${model.WINDOW_TICKS} ticks`);
        system.run(() => {
            if (!player?.isValid) return;
            player.dimension.runCommand(`kick "${safeName}" ${kickMessage}`).catch((e) => {
                console.warn('[CPS] Kick command failed:', e);
            });
        });
    };
}

export default new Service();

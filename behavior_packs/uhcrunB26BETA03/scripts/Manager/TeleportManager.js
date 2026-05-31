import { system, world } from '@minecraft/server';
import { uhcPlayersCache } from './State_Cache.js';
import { teleportLocPool } from './State_Util.js';
import { MENU_MSG, SPAWN_CONFIG } from './UtilTeamManager.js';

export function AdminTeleport(source, target) {
    if (!source?.isValid || !target?.isValid) return;
    const loc = target.location;
    if (!loc) return;
    teleportLocPool.x = loc.x;
    teleportLocPool.y = loc.y;
    teleportLocPool.z = loc.z;
    const dim = target.dimension ?? world.getDimension('overworld');
    source.teleport(teleportLocPool, { dimension: dim });
}

export function playerTeleport(source, target) {
    if (!source?.isValid) return;
    if (!target?.isValid) {
        source.sendMessage(MENU_MSG.targetOffline);
        return;
    }
    const loc = target.location;
    teleportLocPool.x = loc.x;
    teleportLocPool.y = loc.y;
    teleportLocPool.z = loc.z;
    source.teleport(teleportLocPool, { dimension: target.dimension });
    source.playSound('teleport.ender_pearl');
}

export function teleportToSpawn(player) {
    if (!player?.isValid) return;
    const dim = world.getDimension(SPAWN_CONFIG.dimension);
    teleportLocPool.x = SPAWN_CONFIG.x + Math.floor(Math.random() * 5) - 2;
    teleportLocPool.y = SPAWN_CONFIG.y - 7;
    teleportLocPool.z = SPAWN_CONFIG.z + Math.floor(Math.random() * 5) - 2;
    player.teleport(teleportLocPool, { dimension: dim });

    const tx = teleportLocPool.x;
    const ty = teleportLocPool.y;
    const tz = teleportLocPool.z;
    system.runTimeout(() => {
        if (!player?.isValid) return;
        player.playSound('random.enderchestopen', { volume: 0.9, pitch: 0.95 });
        try {
            dim.spawnParticle('so:light2', { x: tx, y: ty + 5, z: tz });
        } catch {}
    }, 5);
}

export const getOtherUhcPlayers = (excludeId) => uhcPlayersCache.filter((p) => p.id !== excludeId);

export function teleportGetAllPlayers(player) {
    const players = world.getPlayers();
    const result = [];
    for (const p of players) {
        if (!p?.isValid) continue;
        if (player && p.id === player.id) continue;
        result.push(p);
    }
    return result;
}

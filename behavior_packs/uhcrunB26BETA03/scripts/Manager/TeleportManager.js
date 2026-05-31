import { world } from '@minecraft/server';
import { teleportLocPool, uhcPlayersCache } from './State.js';

export function AdminTeleport(source, target) {
    if (!source) return;
    if (!source.isValid) return;
    if (!target) return;
    if (!target.isValid) return;
    const loc = target.location;
    if (!loc) return;
    teleportLocPool.x = loc.x;
    teleportLocPool.y = loc.y;
    teleportLocPool.z = loc.z;
    let dim = target.dimension;
    if (!dim) {
        dim = world.getDimension('overworld');
    }
    source.teleport(teleportLocPool, { dimension: dim });
}

export function playerTeleport(source, target) {
    if (!source) return;
    if (!source.isValid) return;
    if (!target) return;
    if (!target.isValid) {
        source.sendMessage('§cผู้เล่นเป้าหมายไม่ได้ออนไลน์หรือไม่ได้อยู่ในเซิฟเวอร์แล้ว');
        return;
    }
    source.teleport(target.location, { dimension: target.dimension });
    source.playSound('teleport.ender_pearl');
}

export const getOtherUhcPlayers = (excludeId) => uhcPlayersCache.filter((p) => p.id !== excludeId);

export function teleportGetAllPlayers(player) {
    const players = world.getPlayers();
    const result = [];
    for (const p of players) {
        if (!p) continue;
        if (!p.isValid) continue;
        if (player) {
            if (p.id === player.id) continue;
        }
        result.push(p);
    }
    return result;
}

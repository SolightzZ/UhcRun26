import { system } from '@minecraft/server';
import { dynamicToast } from '../plugin/Util.js';
import { reviverCooldown } from './State_Revive.js';
import { REVIVE_MSG } from './UtilTeamManager.js';

export function getRemainingReviveCooldown(playerId) {
    if (!playerId) return 0;
    const endTick = reviverCooldown.get(playerId) ?? 0;
    const remaining = endTick - system.currentTick;
    return remaining > 0 ? remaining : 0;
}

export function clearExpiredReviveCooldown(playerId) {
    if (!playerId) return;
    if (getRemainingReviveCooldown(playerId) > 0) return;
    reviverCooldown.delete(playerId);
}

export function notifyReviverCooldown(reviver, playSound = false) {
    clearExpiredReviveCooldown(reviver.id);
    const remaining = getRemainingReviveCooldown(reviver.id);
    if (remaining <= 0) return false;

    const seconds = Math.ceil(remaining / 20);
    reviver.sendMessage(dynamicToast(REVIVE_MSG.cooldown(seconds), 'textures/ui/cancel'));
    if (playSound) reviver.playSound('note.bassattack');
    return true;
}

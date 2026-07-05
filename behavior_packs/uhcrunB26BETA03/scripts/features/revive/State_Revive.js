import { system } from '@minecraft/server';

export const REVIVE_ITEM_ID = 'minecraft:player_head';
export const REVIVE_DURATION_TICKS = 8 * 20;
export const REVIVE_COOLDOWN_TICKS = 18 * 20;
export const REVIVE_CANCEL_MOVE_DISTANCE = 1;
export const REVIVE_ACTIONBAR_INTERVAL = 10;

export const reviveSessions = new Map();
export const reviverSessions = new Map();
export const reviverCooldown = new Map();
export let reviveIntervalId = null;

export function setReviveIntervalId(id) {
   reviveIntervalId = id;
}

export function stopReviveTickIfIdle() {
   if (reviveSessions.size > 0) return;
   if (reviveIntervalId === null) return;
   system.clearRun(reviveIntervalId);
   setReviveIntervalId(null);
}

export function clearAllReviveRuntime() {
   reviveSessions.clear();
   reviverSessions.clear();
   reviverCooldown.clear();
   stopReviveTickIfIdle();
}

import { TEAMS } from '../../constants/game.js';

export const TEAM_LOOKUP = new Map();

export const TEAM_INDEX_MAP = new Map();

export const teamPlayerIndex = new Map();

export const teamStats = new Map();
export const playerStats = new Map();
export const deathLocation = new Map();

for (let i = 0; i < TEAMS.length; i++) {
   const team = TEAMS[i];
   TEAM_LOOKUP.set(team.id, team);
   TEAM_INDEX_MAP.set(team.id, i);
   teamPlayerIndex.set(team.id, new Set());
   teamStats.set(team.id, { kills: 0, deaths: 0 });
}

export function getTeamCount(teamId) {
   return teamPlayerIndex.get(teamId)?.size ?? 0;
}
export function addToTeamIndex(id, pid) {
   teamPlayerIndex.get(id)?.add(pid);
}
export function removeFromTeamIndex(id, pid) {
   teamPlayerIndex.get(id)?.delete(pid);
}
export function setTeamStats(id, s) {
   teamStats.set(id, s);
}
export function setPlayerStats(id, s) {
   playerStats.set(id, s);
}
export function deletePlayerStats(id) {
   playerStats.delete(id);
}
export function clearPlayerStats() {
   playerStats.clear();
}
export function setDeathLocation(id, loc) {
   deathLocation.set(id, { x: loc.x | 0, y: loc.y | 0, z: loc.z | 0 });
}
export function deleteDeathLocation(id) {
   deathLocation.delete(id);
}
export function clearDeathLocations() {
   deathLocation.clear();
}

export let aliveTeamDirtyHandler = () => {};
export function setAliveTeamDirtyHandler(handler) {
   aliveTeamDirtyHandler = typeof handler === 'function' ? handler : () => {};
}

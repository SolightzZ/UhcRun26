//state ทีม runtime: lookup, counts, stats, death positions
import { TEAMS } from '../../constants/game.js';

//Map team id -> ข้อมูลทีม (name, color, icon)
export const TEAM_LOOKUP = new Map();

//Map team id -> index (0-8)
export const TEAM_INDEX_MAP = new Map();

//จำนวนผู้เล่นในแต่ละทีม runtime และ Set id ของสมาชิก
export const teamCounts = new Map();
export const teamPlayerIndex = new Map();

//สถิติทีมและผู้เล่น + ตำแหน่งที่ตายล่าสุด
export const teamStats = new Map();
export const playerStats = new Map();
export const deathLocation = new Map();

for (let i = 0; i < TEAMS.length; i++) {
   const team = TEAMS[i];
   TEAM_LOOKUP.set(team.id, team);
   TEAM_INDEX_MAP.set(team.id, i);
   teamPlayerIndex.set(team.id, new Set());
   teamCounts.set(team.id, 0);
   teamStats.set(team.id, { kills: 0, deaths: 0 });
}

// setter functions สำหรับ write operations — ใช้แทน direct map.set/.delete/.clear
export function setTeamCount(id, n) {
   teamCounts.set(id, n);
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
   deathLocation.set(id, loc);
}
export function deleteDeathLocation(id) {
   deathLocation.delete(id);
}
export function clearDeathLocations() {
   deathLocation.clear();
}

//callback เมื่อทีมมีการเปลี่ยนแปลง (ใช้โดย CacheManager)
export let aliveTeamDirtyHandler = () => {};
export function setAliveTeamDirtyHandler(handler) {
   aliveTeamDirtyHandler = typeof handler === 'function' ? handler : () => {};
}

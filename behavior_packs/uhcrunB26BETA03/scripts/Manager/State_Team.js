//state ทีม runtime: lookup, counts, stats, death positions
import { TEAMS } from './UtilTeamManager.js';

//Map team id -> ข้อมูลทีม (name, color, icon)
export const TEAM_LOOKUP = new Map(TEAMS.map((team) => [team.id, team]));

//Map team id -> index (0-8)
export const TEAM_INDEX_MAP = new Map(TEAMS.map((team, idx) => [team.id, idx]));

//จำนวนผู้เล่นในแต่ละทีม runtime และ Set id ของสมาชิก
export const teamCounts = new Map();
export const teamPlayerIndex = new Map();

for (const t of TEAMS) {
   teamPlayerIndex.set(t.id, new Set());
   teamCounts.set(t.id, 0);
}

//สถิติทีมและผู้เล่น + ตำแหน่งที่ตายล่าสุด
export const teamStats = new Map();
export const playerStats = new Map();
export const deathLocation = new Map();

for (const team of TEAMS) {
   teamStats.set(team.id, { kills: 0, deaths: 0 });
}

//callback เมื่อทีมมีการเปลี่ยนแปลง (ใช้โดย CacheManager)
export let aliveTeamDirtyHandler = () => {};
export function setAliveTeamDirtyHandler(handler) {
   aliveTeamDirtyHandler = typeof handler === 'function' ? handler : () => {};
}

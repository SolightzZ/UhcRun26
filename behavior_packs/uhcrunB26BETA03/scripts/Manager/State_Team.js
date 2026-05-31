import { TEAMS } from './UtilTeamManager.js';

export const TEAM_LOOKUP = new Map(TEAMS.map((t) => [t.id, t]));
export const TEAM_INDEX_MAP = new Map(TEAMS.map((t, i) => [t.id, i]));

export const teamCounts = new Map();
export const teamPlayerIndex = new Map();

for (const t of TEAMS) {
    teamPlayerIndex.set(t.id, new Set());
    teamCounts.set(t.id, 0);
}

export const teamStats = new Map();
export const playerStats = new Map();
export const deathLocation = new Map();

for (const team of TEAMS) {
    teamStats.set(team.id, { kills: 0, deaths: 0 });
}

export let aliveTeamDirtyHandler = () => {};

export function setAliveTeamDirtyHandler(handler) {
    aliveTeamDirtyHandler = typeof handler === 'function' ? handler : () => {};
}

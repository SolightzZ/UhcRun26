import { TEAMS } from './UtilTeamManager.js';

export const TEAM_LOOKUP = new Map(TEAMS.map((team) => [team.id, team]));
export const TEAM_INDEX_MAP = new Map(TEAMS.map((team, idx) => [team.id, idx]));

export const teamCounts = new Map();
export const teamPlayerIndex = new Map();

for (let i = 0, len = TEAMS.length; i < len; i++) {
    const t = TEAMS[i];
    teamPlayerIndex.set(t.id, new Set());
    teamCounts.set(t.id, 0);
}

export const teamStats = new Map();
export const playerStats = new Map();
export const deathLocation = new Map();

for (let i = 0, len = TEAMS.length; i < len; i++) {
    const team = TEAMS[i];
    teamStats.set(team.id, { kills: 0, deaths: 0 });
}

export let aliveTeamDirtyHandler = () => {};

export function setAliveTeamDirtyHandler(handler) {
    aliveTeamDirtyHandler = typeof handler === 'function' ? handler : () => {};
}

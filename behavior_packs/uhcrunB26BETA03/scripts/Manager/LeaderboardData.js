//รวบรวมข้อมูล scoreboard จาก objective สำหรับสร้าง leaderboard
import { world } from '@minecraft/server';
import { lbCache, MAX_TEAMS } from './LeaderboardConfig.js';
import { buildTeamText } from './LeaderboardFormat.js';
import { playerCache } from './State_Cache.js';
import { TEAM_LOOKUP } from './State_Team.js';
import { getPlayersByTeam } from './TeamActions.js';
import { TEAMS } from './UtilTeamManager.js';

//อ่านคะแนนจาก scoreboard objective (kills, deaths, teamkills)
function buildScoreLookup(obj) {
   const map = new Map();

   if (!obj) return map;

   try {
      for (const p of obj.getParticipants()) {
         map.set(p.displayName, obj.getScore(p));
      }
   } catch (error) {
      console.error('[LeaderboardData] buildScoreLookup error:', error);
   }
   return map;
}

//รวบรวม kills/deaths ของผู้เล่นจาก scoreboard
export function getStats() {
   const killsLookup = buildScoreLookup(world.scoreboard?.getObjective('uhc_kills'));
   const deathsLookup = buildScoreLookup(world.scoreboard?.getObjective('uhc_deaths'));

   if (!killsLookup.size && !deathsLookup.size) return new Map();

   const allIds = new Set([...killsLookup.keys(), ...deathsLookup.keys()]);
   const playerStatsMap = new Map();

   for (const playerId of allIds) {
      const killCount = killsLookup.get(playerId) ?? 0;
      const deathCount = deathsLookup.get(playerId) ?? 0;
      if (!killCount && !deathCount) continue;

      const playerName = playerCache.get(playerId)?.name ?? playerId;
      const teamId = playerCache.get(playerId)?.teamId ?? null;
      const teamInfo = teamId ? TEAM_LOOKUP.get(teamId) : null;
      const teamLabel = teamInfo ? teamInfo.color + teamInfo.name : null;

      playerStatsMap.set(playerName, {
         kills: killCount,
         deaths: deathCount,
         teamId,
         teamLabel,
      });
   }

   return playerStatsMap;
}

function getRuntimeTeamList() {
   if (!TEAMS?.length) return [];

   const teamKillLookup = buildScoreLookup(world.scoreboard?.getObjective('uhc_teamkills'));

   const teamList = TEAMS.map((teamInfo, i) => ({
      name: teamInfo.color + teamInfo.name,
      kills: teamKillLookup.get(teamInfo.color + teamInfo.name) ?? 0,
      members: getPlayersByTeam(teamInfo.id).length,
      order: i,
   }));

   teamList.sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      return a.order - b.order;
   });

   if (teamList.length > MAX_TEAMS) teamList.length = MAX_TEAMS;
   return teamList;
}

export function getTeamText() {
   const teamList = getRuntimeTeamList();

   let teamHash = '';
   for (const team of teamList) {
      teamHash += `${team.name}${team.kills}${team.members}${team.order}`;
   }

   if (teamHash === lbCache.lastTeamHash && lbCache.cachedTeamText) {
      return lbCache.cachedTeamText;
   }

   lbCache.cachedTeamText = buildTeamText(teamList);
   lbCache.lastTeamHash = teamHash;
   return lbCache.cachedTeamText;
}

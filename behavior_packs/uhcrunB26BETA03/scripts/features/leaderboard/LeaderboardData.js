//รวบรวมข้อมูล scoreboard จาก objective สำหรับสร้าง leaderboard
import { world } from '@minecraft/server';
import { TEAMS } from '../../constants/game.js';
import { lbCache, MAX_TEAMS } from '../../constants/leaderboard.js';
import { playerCache } from '../cache/State_Cache.js';
import { TEAM_LOOKUP } from '../team/State_Team.js';
import { getPlayersByTeam } from '../team/TeamActions.js';
import { logError } from '../../shared/Util.js';
import { buildTeamText } from './LeaderboardFormat.js';

//อ่านคะแนนจาก scoreboard objective (kills, deaths, teamkills)
function buildScoreLookup(obj) {
   const map = new Map();

   if (!obj) return map;

   try {
      for (const p of obj.getParticipants()) {
         map.set(p.displayName, obj.getScore(p));
      }
   } catch (error) {
      logError('LeaderboardData', 'buildScoreLookup error', error);
   }
   return map;
}

let _cachedStats = null;
let _statsHash = 0;

//รวบรวม kills/deaths ของผู้เล่นจาก scoreboard
export function getStats() {
   const killsObj = world.scoreboard?.getObjective('uhc_kills');
   const deathsObj = world.scoreboard?.getObjective('uhc_deaths');
   const hash = (killsObj?.getParticipants().length ?? 0) * 31 + (deathsObj?.getParticipants().length ?? 0);
   if (_cachedStats && hash === _statsHash) return _cachedStats;
   _statsHash = hash;
   _cachedStats = null;

   const killsLookup = buildScoreLookup(killsObj);
   const deathsLookup = buildScoreLookup(deathsObj);

   if (!killsLookup.size && !deathsLookup.size) {
      _cachedStats = new Map();
      return _cachedStats;
   }

   const allIds = new Set();
   for (const k of killsLookup.keys()) allIds.add(k);
   for (const k of deathsLookup.keys()) allIds.add(k);
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

   _cachedStats = playerStatsMap;
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

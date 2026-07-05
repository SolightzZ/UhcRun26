import { world } from '@minecraft/server';
import { logError, logWarn } from '../../shared/Util.js';
import { resolveParticipantName } from '../stats/StatsManager.js';
import { TEAM_LOOKUP } from '../team/State_Team.js';
import { calcKD, calcPlacementPoints } from './RankTiers.js';

const RANK_KEY = 'uhc_ranks';
let _rankData = null;
let _dirty = false;

function createEmptyData() {
   return { players: {}, teams: {} };
}

function sanitizePlayerEntry(entry) {
   if (!entry || typeof entry !== 'object') {
      return { name: '', kills: 0, deaths: 0, wins: 0, games: 0, survivedLast: 0 };
   }
   return {
      name: String(entry.name ?? ''),
      kills: Number(entry.kills) || 0,
      deaths: Number(entry.deaths) || 0,
      wins: Number(entry.wins) || 0,
      games: Number(entry.games) || 0,
      survivedLast: Number(entry.survivedLast) || 0,
   };
}

function sanitizeTeamEntry(entry) {
   if (!entry || typeof entry !== 'object') {
      return { points: 0, placements: {}, games: 0 };
   }
   return {
      points: Number(entry.points) || 0,
      placements: entry.placements && typeof entry.placements === 'object' && !Array.isArray(entry.placements) ? entry.placements : {},
      games: Number(entry.games) || 0,
   };
}

function loadRankData() {
   if (_rankData) return _rankData;

   try {
      const raw = world.getDynamicProperty(RANK_KEY);
      if (typeof raw !== 'string' || raw.length === 0) {
         _rankData = createEmptyData();
         return _rankData;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
         _rankData = createEmptyData();
         return _rankData;
      }
      _rankData = parsed;
      if (!_rankData.players) _rankData.players = {};
      if (!_rankData.teams) _rankData.teams = {};
      for (const id of Object.keys(_rankData.players)) {
         _rankData.players[id] = sanitizePlayerEntry(_rankData.players[id]);
         _rankData.players[id].name = _rankData.players[id].name || id;
      }
      for (const id of Object.keys(_rankData.teams)) {
         _rankData.teams[id] = sanitizeTeamEntry(_rankData.teams[id]);
      }
      return _rankData;
   } catch (error) {
      logError('RankData', 'Failed to load rank data', error);
      _rankData = createEmptyData();
      return _rankData;
   }
}

const MAX_RANK_SIZE = 900 * 1024;

function saveRankData(data) {
   if (!data) return;
   try {
      const raw = JSON.stringify(data);
      if (raw.length > MAX_RANK_SIZE) {
         logWarn('RankData', `Rank data too large (${raw.length} bytes), skipping save`);
         return;
      }
      world.setDynamicProperty(RANK_KEY, raw);
      _dirty = false;
   } catch (error) {
      logError('RankData', 'Failed to save rank data', error);
   }
}

function markDirty() {
   _dirty = true;
}

export function flushIfDirty() {
   if (_dirty && _rankData) {
      saveRankData(_rankData);
   }
}

export function mergePlayerStats(name, { kills = 0, deaths = 0, teamId = null } = {}) {
   const data = loadRankData();
   if (!data.players[name]) {
      data.players[name] = sanitizePlayerEntry({ name, kills: 0, deaths: 0, wins: 0, games: 0, survivedLast: 0 });
   }
   const p = data.players[name];
   p.kills += kills;
   p.deaths += deaths;
   if (teamId) p.teamId = teamId;
   markDirty();
}

// คะแนนอันดับเท่านั้น — ไม่นับจำนวนการเล่นเกมเพิ่ม
export function recordPlacement(teamId, placement) {
   if (!teamId || placement <= 0) return;
   const data = loadRankData();
   if (!data.teams[teamId]) {
      data.teams[teamId] = { points: 0, placements: {}, games: 0 };
   }
   const t = data.teams[teamId];
   const pKey = String(placement);
   t.placements[pKey] = (t.placements[pKey] || 0) + 1;
   t.points += calcPlacementPoints(placement);
   markDirty();
}

export function recordGamesPlayed(playerNames) {
   if (!playerNames?.length) return;
   const data = loadRankData();
   const teamsIncremented = new Set();
   for (let i = 0, len = playerNames.length; i < len; i++) {
      const name = playerNames[i];
      if (!data.players[name]) {
         data.players[name] = sanitizePlayerEntry({ name, kills: 0, deaths: 0, wins: 0, games: 0, survivedLast: 0 });
      }
      data.players[name].games++;
      const teamId = data.players[name].teamId;
      if (teamId && !teamsIncremented.has(teamId)) {
         teamsIncremented.add(teamId);
         if (!data.teams[teamId]) {
            data.teams[teamId] = { points: 0, placements: {}, games: 0 };
         }
         data.teams[teamId].games++;
      }
   }
   markDirty();
}

export function recordSurvivedLast(playerName) {
   if (!playerName) return;
   const data = loadRankData();
   if (!data.players[playerName]) {
      data.players[playerName] = sanitizePlayerEntry({ name: playerName, kills: 0, deaths: 0, wins: 0, games: 0, survivedLast: 0 });
   }
   data.players[playerName].survivedLast++;
   markDirty();
}

// อันดับและการชนะเท่านั้น — ไม่นับจำนวนการเล่นเกมเพิ่ม
export function recordWin(teamId, playerNames) {
   recordPlacement(teamId, 1);
   const data = loadRankData();
   for (let i = 0, len = playerNames.length; i < len; i++) {
      const name = playerNames[i];
      if (!data.players[name]) {
         data.players[name] = sanitizePlayerEntry({ name, kills: 0, deaths: 0, wins: 0, games: 0, survivedLast: 0 });
      }
      data.players[name].wins++;
   }
   markDirty();
}

export function getAllPlayersSorted() {
   const data = loadRankData();
   const entries = Object.entries(data.players);
   const result = entries.map(([name, p]) => ({
      name: p.name || name,
      kills: p.kills || 0,
      deaths: p.deaths || 0,
      wins: p.wins || 0,
      games: p.games || 0,
      survivedLast: p.survivedLast || 0,
      kd: calcKD(p.kills || 0, p.deaths || 0),
   }));
   result.sort((a, b) => b.kd - a.kd);
   return result;
}

export function getTeamsSorted() {
   const data = loadRankData();
   const entries = Object.entries(data.teams);
   const result = entries.map(([id, t]) => ({
      id,
      points: t.points || 0,
      placements: t.placements || {},
      games: t.games || 0,
   }));
   result.sort((a, b) => b.points - a.points);
   return result;
}

export function getTeamKillStats() {
   try {
      const teamKillObj = world.scoreboard?.getObjective('uhc_teamkills');
      if (!teamKillObj) return [];

      const result = [];
      for (const participant of teamKillObj.getParticipants()) {
         const name = resolveParticipantName(participant);
         const kills = teamKillObj.getScore(participant);
         if (name && kills > 0) {
            result.push({ name, kills });
         }
      }
      result.sort((a, b) => b.kills - a.kills);
      return result;
   } catch (error) {
      logError('RankData', 'getTeamKillStats failed', error);
      return [];
   }
}

export function getPlayerKillStats() {
   try {
      const killsObj = world.scoreboard?.getObjective('uhc_kills');
      if (!killsObj) return [];

      const result = [];
      const rankData = loadRankData();
      for (const participant of killsObj.getParticipants()) {
         const name = resolveParticipantName(participant);
         const kills = killsObj.getScore(participant);
         if (name && kills > 0) {
            const p = rankData.players[name];
            const teamId = p?.teamId ?? null;
            const teamInfo = teamId ? TEAM_LOOKUP.get(teamId) : null;
            result.push({
               name,
               kills,
               teamLabel: teamInfo ? teamInfo.color + teamInfo.name : null,
            });
         }
      }
      result.sort((a, b) => b.kills - a.kills);
      return result;
   } catch (error) {
      logError('RankData', 'getPlayerKillStats failed', error);
      return [];
   }
}

export function getPlayerDeathStats() {
   try {
      const deathsObj = world.scoreboard?.getObjective('uhc_deaths');
      if (!deathsObj) return [];

      const result = [];
      const rankData = loadRankData();
      for (const participant of deathsObj.getParticipants()) {
         const name = resolveParticipantName(participant);
         const deaths = deathsObj.getScore(participant);
         if (name && deaths > 0) {
            const p = rankData.players[name];
            const teamId = p?.teamId ?? null;
            const teamInfo = teamId ? TEAM_LOOKUP.get(teamId) : null;
            result.push({
               name,
               deaths,
               teamLabel: teamInfo ? teamInfo.color + teamInfo.name : null,
            });
         }
      }
      result.sort((a, b) => b.deaths - a.deaths);
      return result;
   } catch (error) {
      logError('RankData', 'getPlayerDeathStats failed', error);
      return [];
   }
}

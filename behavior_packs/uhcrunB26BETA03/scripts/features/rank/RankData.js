//ระบบ Rank Persistence — บันทึก/โหลดข้อมูลสถิติข้ามแมตช์ผ่าน Dynamic Property
import { world } from '@minecraft/server';
import { TEAMS } from '../../constants/game.js';
import { logError, logWarn } from '../../shared/Util.js';
import { calcPlacementPoints, calcKD } from './RankTiers.js';
import { playerTeamCache } from '../cache/State_Cache.js';
import { TEAM_LOOKUP } from '../team/State_Team.js';

const RANK_KEY = 'uhc_ranks';
let _rankData = null;
let _dirty = false;

//โครงสร้างข้อมูลเริ่มต้น
function createEmptyData() {
   return { players: {}, teams: {} };
}

//โหลดข้อมูลจาก Dynamic Property
export function loadRankData() {
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
      return _rankData;
   } catch (error) {
      logError('RankData', 'Failed to load rank data', error);
      _rankData = createEmptyData();
      return _rankData;
   }
}

//บันทึกข้อมูลลง Dynamic Property (เฉพาะเมื่อมีการเปลี่ยนแปลง)
export function saveRankData(data) {
   if (!data) return;
   try {
      world.setDynamicProperty(RANK_KEY, JSON.stringify(data));
      _dirty = false;
   } catch (error) {
      logError('RankData', 'Failed to save rank data', error);
   }
}

//ทำเครื่องหมายว่าข้อมูลมีการเปลี่ยนแปลง
export function markDirty() {
   _dirty = true;
}

//บันทึกถ้ามีการเปลี่ยนแปลง
export function flushIfDirty() {
   if (_dirty && _rankData) {
      saveRankData(_rankData);
   }
}

//เพิ่มสถิติ kills/deaths ของผู้เล่น (_cross-game accumulation_)
export function mergePlayerStats(id, name, { kills = 0, deaths = 0, teamId = null } = {}) {
   const data = loadRankData();
   if (!data.players[id]) {
      data.players[id] = { name, kills: 0, deaths: 0, wins: 0, games: 0, survivedLast: 0 };
   }
   const p = data.players[id];
   p.name = name;
   p.kills += kills;
   p.deaths += deaths;
   if (teamId) p.teamId = teamId;
   markDirty();
}

//บันทึกอันดับที่ทีมทำได้ (placement points + stats เท่านั้น — ไม่ increment games)
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

//เพิ่มจำนวนเกมที่เล่นให้กับผู้เล่นและทีมทุกคน
export function recordGamesPlayed(playerIds) {
   if (!playerIds?.length) return;
   const data = loadRankData();
   const teamsIncremented = new Set();
   for (let i = 0, len = playerIds.length; i < len; i++) {
      const id = playerIds[i];
      if (!data.players[id]) {
         data.players[id] = { name: id, kills: 0, deaths: 0, wins: 0, games: 0, survivedLast: 0 };
      }
      data.players[id].games++;
      const teamId = data.players[id].teamId;
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

//บันทึกว่าผู้เล่นเป็นผู้รอดชีวิตคนสุดท้ายของทีม
export function recordSurvivedLast(playerId) {
   if (!playerId) return;
   const data = loadRankData();
   if (!data.players[playerId]) {
      data.players[playerId] = { name: playerId, kills: 0, deaths: 0, wins: 0, games: 0, survivedLast: 0 };
   }
   data.players[playerId].survivedLast++;
   markDirty();
}

//บันทึกชัยชนะของทีม (placement + wins เท่านั้น — ไม่ increment games)
export function recordWin(teamId, playerIds) {
   recordPlacement(teamId, 1);
   const data = loadRankData();
   for (let i = 0, len = playerIds.length; i < len; i++) {
      const id = playerIds[i];
      if (!data.players[id]) {
         data.players[id] = { name: id, kills: 0, deaths: 0, wins: 0, games: 0, survivedLast: 0 };
      }
      data.players[id].wins++;
   }
   markDirty();
}

//ดึงข้อมูลผู้เล่นทั้งหมด เรียงลำดับตาม KD จากมากไปน้อย
export function getAllPlayersSorted() {
   const data = loadRankData();
   const entries = Object.entries(data.players);
   const result = entries.map(([id, p]) => ({
      id,
      name: p.name || id,
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

//ดึงข้อมูลทีมทั้งหมด เรียงลำดับตาม Placement Points จากมากไปน้อย (PUBG style)
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

// ── Data functions สำหรับ UI (ย้ายมาจาก RankUI.js) ──

//ดึงสถิติ kill ของทีมจาก scoreboard
export function getTeamKillStats() {
   try {
      const teamKillObj = world.scoreboard?.getObjective('uhc_teamkills');
      if (!teamKillObj) return [];

      const result = [];
      for (const participant of teamKillObj.getParticipants()) {
         const name = participant.displayName;
         const kills = teamKillObj.getScore(participant);
         if (kills > 0) {
            result.push({ name, kills });
         }
      }
      result.sort((a, b) => b.kills - a.kills);
      return result;
   } catch {
      return [];
   }
}

//ดึงสถิติ kill ของผู้เล่นจาก scoreboard
export function getPlayerKillStats() {
   try {
      const killsObj = world.scoreboard?.getObjective('uhc_kills');
      if (!killsObj) return [];

      const result = [];
      for (const participant of killsObj.getParticipants()) {
         const id = participant.displayName;
         const kills = killsObj.getScore(participant);
         if (kills > 0) {
            const teamId = playerTeamCache.get(id);
            const teamInfo = teamId ? TEAM_LOOKUP.get(teamId) : null;
            result.push({
               name: id,
               kills,
               teamLabel: teamInfo ? teamInfo.color + teamInfo.name : null,
            });
         }
      }
      result.sort((a, b) => b.kills - a.kills);
      return result;
   } catch {
      return [];
   }
}

//ดึงสถิติ death ของผู้เล่นจาก scoreboard
export function getPlayerDeathStats() {
   try {
      const deathsObj = world.scoreboard?.getObjective('uhc_deaths');
      if (!deathsObj) return [];

      const result = [];
      for (const participant of deathsObj.getParticipants()) {
         const id = participant.displayName;
         const deaths = deathsObj.getScore(participant);
         if (deaths > 0) {
            const teamId = playerTeamCache.get(id);
            const teamInfo = teamId ? TEAM_LOOKUP.get(teamId) : null;
            result.push({
               name: id,
               deaths,
               teamLabel: teamInfo ? teamInfo.color + teamInfo.name : null,
            });
         }
      }
      result.sort((a, b) => b.deaths - a.deaths);
      return result;
   } catch {
      return [];
   }
}

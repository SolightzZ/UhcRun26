//ระบบ revive หลัก: เริ่ม, อัปเดต, เสร็จสิ้น, ยกเลิก
import { system, world } from '@minecraft/server';
import { REVIVE_MSG } from '../../constants/game.js';
import { createLoc, dynamicToast, freeLoc, logError, setSurvival, SND_BASS, TEX_CANCEL, TEX_HEART } from '../../shared/Util.js';
import { uhcPlayerIds, uhcPlayersCache } from '../cache/State_Cache.js';
import { isGameRunning } from '../match/State_Game.js';
import { scheduleSaveStats } from '../stats/StatsManager.js';
import { addToTeamIndex, aliveTeamDirtyHandler, deathLocation, deleteDeathLocation, playerStats, setPlayerStats, setTeamCount, teamCounts } from '../team/State_Team.js';
import { getPlayerTeam } from '../team/TeamActions.js';
import { notifyReviverCooldown } from './ReviveCooldown.js';
import { hasReviveItem, removeOneReviveItem, resolvePlayer, sendReviveTeamActionBar } from './ReviveUtil.js';
import {
   REVIVE_ACTIONBAR_INTERVAL,
   REVIVE_CANCEL_MOVE_DISTANCE,
   REVIVE_COOLDOWN_TICKS,
   REVIVE_DURATION_TICKS,
   reviveIntervalId,
   reviverCooldown,
   reviverSessions,
   reviveSessions,
   setReviveIntervalId,
   stopReviveTickIfIdle,
} from './State_Revive.js';

//ยกเลิก revive session พร้อมแจ้งเหตุผล
export function cancelReviveSession(targetId, reason) {
   const session = reviveSessions.get(targetId);
   if (!session) return;

   reviveSessions.delete(targetId);
   reviverSessions.delete(session.reviverId);
   stopReviveTickIfIdle();

   if (!reason) return;

   const reviver = resolvePlayer(session.reviverId);
   if (reviver) {
      try {
         reviver.sendMessage(dynamicToast(reason, TEX_CANCEL));
         reviver.playSound(SND_BASS);
      } catch (error) {
          logError('Revive', 'Failed to notify reviver', error);
      }
   }

   const target = resolvePlayer(targetId);
   if (target) {
      try {
         target.onScreenDisplay.setActionBar(reason);
      } catch (error) {
          logError('Revive', 'Failed to notify target', error);
      }
   }
}

//ทำให้ revive เสร็จสมบูรณ์: ใช้ไอเทม, เทเลพอร์ต, เพิ่ม buff, อัปเดต stats
export function finishRevive(targetId) {
   const session = reviveSessions.get(targetId);
   if (!session) return;

   const reviver = resolvePlayer(session.reviverId);
   const target = resolvePlayer(targetId);
   if (!reviver || !target) {
      cancelReviveSession(targetId, REVIVE_MSG.cancel);
      return;
   }

   if (!removeOneReviveItem(reviver)) {
      cancelReviveSession(targetId, REVIVE_MSG.needHead);
      return;
   }

   const teamId = getPlayerTeam(reviver);
   reviveSessions.delete(targetId);
   reviverSessions.delete(session.reviverId);
   reviverCooldown.set(session.reviverId, system.currentTick + REVIVE_COOLDOWN_TICKS);
   stopReviveTickIfIdle();

   deleteDeathLocation(targetId);

   try {
      const rLoc = createLoc(reviver.location.x, reviver.location.y, reviver.location.z);
      target.teleport(rLoc, {
         dimension: reviver.dimension,
      });
      freeLoc(rLoc);
      setSurvival(target);
      target.addTag('uhc');
      target.removeEffect('conduit_power');
      target.addEffect('regeneration', 200, { amplifier: 2, showParticles: false });
      target.addEffect('resistance', 100, { amplifier: 4, showParticles: false });
   } catch (error) {
      logError('Revive', 'Failed to apply revive state for ' + target.name, error);
      return;
   }

   if (!uhcPlayerIds.has(targetId)) {
      uhcPlayerIds.add(targetId);
      uhcPlayersCache.push(target);
   }

   if (teamId) {
      const before = teamCounts.get(teamId) ?? 0;
      setTeamCount(teamId, before + 1);
      addToTeamIndex(teamId, targetId);
   }

   const stats = playerStats.get(targetId);
   if (stats) {
      stats.teamId = teamId;
      stats.name = target.name;
      setPlayerStats(targetId, stats);
   }

   aliveTeamDirtyHandler();
   scheduleSaveStats();

   const reviveMessage = REVIVE_MSG.revived(reviver.name, target.name);
   sendReviveTeamActionBar(teamId, reviveMessage);
   try {
      world.sendMessage(dynamicToast(reviveMessage, TEX_HEART));
      reviver.playSound('random.levelup');
      target.playSound('random.totem');
   } catch (error) {
      logError('Revive', 'Failed to broadcast revive', error);
   }
}

//ตรวจสอบ revive session ทั้งหมดทุก tick: cancel ถ้าเงื่อนไขไม่ผ่าน
export function updateRevives() {
   if (reviveSessions.size === 0) {
      stopReviveTickIfIdle();
      return;
   }

   const rsEntries = Array.from(reviveSessions.entries());
   for (let ri = 0, rLen = rsEntries.length; ri < rLen; ri++) {
      const [targetId, session] = rsEntries[ri];
      const reviver = resolvePlayer(session.reviverId);
      const target = resolvePlayer(targetId);

      if (!reviver || !target) {
         cancelReviveSession(targetId, REVIVE_MSG.cancel);
         continue;
      }

      if (!reviver.hasTag('uhc')) {
         cancelReviveSession(targetId, REVIVE_MSG.reviverNotAlive);
         continue;
      }

      if (!hasReviveItem(reviver)) {
         cancelReviveSession(targetId, REVIVE_MSG.noReviveItem);
         continue;
      }

      if (!deathLocation.has(targetId)) {
         cancelReviveSession(targetId, REVIVE_MSG.targetNotDead);
         continue;
      }

      const reviverTeam = getPlayerTeam(reviver);
      if (!reviverTeam || reviverTeam !== getPlayerTeam(target)) {
         cancelReviveSession(targetId, REVIVE_MSG.notSameTeam);
         continue;
      }

      const targetDeathLoc = deathLocation.get(targetId);
      if (!targetDeathLoc) {
         cancelReviveSession(targetId, REVIVE_MSG.noDeathLoc);
         continue;
      }

      if (reviver.dimension !== target.dimension) {
         cancelReviveSession(targetId, REVIVE_MSG.wrongDimension);
         continue;
      }

      const dx = reviver.location.x - session.anchorX;
      const dy = reviver.location.y - session.anchorY;
      const dz = reviver.location.z - session.anchorZ;

      if (dx * dx + dy * dy + dz * dz > REVIVE_CANCEL_MOVE_DISTANCE * REVIVE_CANCEL_MOVE_DISTANCE) {
         cancelReviveSession(targetId, REVIVE_MSG.movedTooFar);
         continue;
      }

      const remainingTicks = session.endTick - system.currentTick;
      if (remainingTicks <= 0) {
         finishRevive(targetId);
         continue;
      }

      if (session.lastUiTick !== undefined && system.currentTick - session.lastUiTick < REVIVE_ACTIONBAR_INTERVAL) {
         continue;
      }

      session.lastUiTick = system.currentTick;
      const seconds = Math.ceil(remainingTicks / 20);
      sendReviveTeamActionBar(session.teamId, REVIVE_MSG.progress(target.name, seconds));
   }
}

//เริ่ม interval tick สำหรับ updateRevives (5 tick)
export function startReviveTick() {
   if (reviveIntervalId !== null) return;
   setReviveIntervalId(system.runInterval(updateRevives, 5));
}

//เริ่ม session revive ใหม่ พร้อมบันทึก anchor position
export function startRevive(reviver, target) {
   if (!reviver?.isValid || !target?.isValid) return;

   const teamId = getPlayerTeam(reviver);
   if (!teamId) return;

   reviveSessions.set(target.id, {
      reviverId: reviver.id,
      endTick: system.currentTick + REVIVE_DURATION_TICKS,
      teamId,
      lastUiTick: -REVIVE_ACTIONBAR_INTERVAL,
      anchorX: reviver.location.x,
      anchorY: reviver.location.y,
      anchorZ: reviver.location.z,
   });
   reviverSessions.set(reviver.id, target.id);
   startReviveTick();

   const message = REVIVE_MSG.channeling(target.name);
   reviver.sendMessage(dynamicToast(message, TEX_HEART));
   sendReviveTeamActionBar(teamId, message);
}

//ตรวจสอบเงื่อนไขก่อนเริ่ม revive (ทีม, alive, item)
export function validateReviveStart(reviver, target) {
   if (!reviver?.isValid || !target?.isValid) return false;

   if (!isGameRunning) return REVIVE_MSG.onlyDuringGame;
   if (!reviver.hasTag('uhc')) return REVIVE_MSG.onlyUhcAlive;
   if (!deathLocation.has(target.id)) return REVIVE_MSG.targetNotDeadYet;

   const reviverTeam = getPlayerTeam(reviver);
   if (!reviverTeam || reviverTeam !== getPlayerTeam(target)) return REVIVE_MSG.targetNotTeammate;

   if (reviveSessions.has(target.id)) return REVIVE_MSG.alreadyRevivingTarget;
   if (reviverSessions.has(reviver.id)) return REVIVE_MSG.alreadyRevivingOther;

   return null;
}

//พยายามเริ่ม revive (validate + cooldown check)
export function tryStartRevive(reviver, target) {
   const errorMessage = validateReviveStart(reviver, target);
   if (errorMessage === false) return;
   if (errorMessage) {
      reviver.sendMessage(dynamicToast(errorMessage, TEX_CANCEL));
      return;
   }
   if (notifyReviverCooldown(reviver)) return;

   startRevive(reviver, target);
}

//ยกเลิก revive ทั้งในฐานะ reviver และ target
export function cancelReviveForPlayer(playerId) {
   if (!playerId) return;

   const targetId = reviverSessions.get(playerId);
   if (targetId) {
      cancelReviveSession(targetId, REVIVE_MSG.cancelEn);
   }

   if (reviveSessions.has(playerId)) {
      cancelReviveSession(playerId, REVIVE_MSG.cancelEn);
   }

   reviverCooldown.delete(playerId);
}

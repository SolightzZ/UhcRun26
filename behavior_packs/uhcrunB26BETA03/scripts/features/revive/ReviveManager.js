import { system } from '@minecraft/server';
import { REVIVE_MSG } from '../../constants/game.js';
import { enqueueAddEffect, enqueueRemoveEffect } from '../../shared/AddEffectBatcher.js';
import { enqueueBroadcast, enqueuePlayerSound } from '../../shared/MessageBatcher.js';
import { createLoc, dynamicToast, freeLoc, logError, setSurvival, TEX_CANCEL, TEX_HEART } from '../../shared/Util.js';
import { uhcPlayerIds, uhcPlayersCache } from '../cache/State_Cache.js';
import { isGameRunning } from '../match/State_Game.js';
import { scheduleSaveStats } from '../stats/StatsManager.js';
import { addToTeamIndex, aliveTeamDirtyHandler, deathLocation, deleteDeathLocation, playerStats, setPlayerStats } from '../team/State_Team.js';
import { getPlayerTeam } from '../team/TeamActions.js';
import { notifyReviverCooldown } from './ReviveCooldown.js';
import ReviveSession from './ReviveSession.js';
import { removeOneReviveItem, resolvePlayer, sendReviveTeamActionBar } from './ReviveUtil.js';
import { REVIVE_COOLDOWN_TICKS, reviveIntervalId, reviverCooldown, reviverSessions, reviveSessions, setReviveIntervalId, stopReviveTickIfIdle } from './State_Revive.js';

function cancelReviveSession(targetId, reason) {
   const session = reviveSessions.get(targetId);
   if (!session) return;

   reviveSessions.delete(targetId);
   reviverSessions.delete(session.reviverId ?? session.reviverId);
   stopReviveTickIfIdle();
}

function finishRevive(targetId) {
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

   const teamId = session.teamId;
   reviveSessions.delete(targetId);
   reviverSessions.delete(session.reviverId);
   reviverCooldown.set(session.reviverId, system.currentTick + REVIVE_COOLDOWN_TICKS);
   stopReviveTickIfIdle();

   deleteDeathLocation(targetId);

   try {
      const rvLoc = reviver.location;
      const rLoc = createLoc(rvLoc.x, rvLoc.y, rvLoc.z);
      target.teleport(rLoc, {
         dimension: reviver.dimension,
      });
      freeLoc(rLoc);
      setSurvival(target);

      target.addTag('uhc');
      enqueueRemoveEffect(target, 'conduit_power');
      enqueueAddEffect(target, 'regeneration', 200, { amplifier: 2, showParticles: false });
      enqueueAddEffect(target, 'resistance', 100, { amplifier: 4, showParticles: false });
   } catch (error) {
      logError('Revive', 'Failed to apply revive state for ' + target.name, error);
      return;
   }

   if (!uhcPlayerIds.has(targetId)) {
      uhcPlayerIds.add(targetId);
      uhcPlayersCache.push(target);
   }

   if (teamId) {
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
      enqueueBroadcast(dynamicToast(reviveMessage, TEX_HEART));
      enqueuePlayerSound(reviver, 'warzone-Player-Revived');
      enqueuePlayerSound(target, 'warzone-Player-Revived');
   } catch (error) {
      logError('Revive', 'Failed to broadcast revive', error);
   }
}

function updateRevives() {
   try {
      if (reviveSessions.size === 0) {
         stopReviveTickIfIdle();
         return;
      }

      const rsEntries = Array.from(reviveSessions.entries());
      for (let ri = 0, rLen = rsEntries.length; ri < rLen; ri++) {
         const [targetId, session] = rsEntries[ri];
         if (!(session instanceof ReviveSession)) continue;

         const result = session.tick();

         if (result.finished) {
            continue;
         }

         if (result.sessionDone) {
            reviveSessions.delete(targetId);
            reviverSessions.delete(session.reviverId);
            stopReviveTickIfIdle();
            continue;
         }
      }
   } catch (error) {
      logError('Revive', 'updateRevives failed', error);
   }
}

function startReviveTick() {
   if (reviveIntervalId !== null) return;
   setReviveIntervalId(system.runInterval(updateRevives, 5));
}

function startRevive(reviver, target) {
   if (!reviver?.isValid || !target?.isValid) return;

   const teamId = getPlayerTeam(reviver);
   if (!teamId) return;

   const session = new ReviveSession(reviver, target, teamId);
   reviveSessions.set(target.id, session);
   reviverSessions.set(reviver.id, target.id);

   session.onComplete((s) => {
      finishRevive(target.id);
   });

   startReviveTick();

   const message = REVIVE_MSG.channeling(target.name);
   reviver.sendMessage(dynamicToast(message, TEX_HEART));
   sendReviveTeamActionBar(teamId, message);
}

export function tryStartRevive(reviver, target) {
   if (!reviver?.isValid || !target?.isValid) return;

   if (!reviver.isValid || !target.isValid) return;

   const errorMsg = validateReviveStart(reviver, target);
   if (errorMsg) {
      reviver.sendMessage(dynamicToast(errorMsg, TEX_CANCEL));
      return;
   }
   if (notifyReviverCooldown(reviver)) return;

   startRevive(reviver, target);
}

function validateReviveStart(reviver, target) {
   if (!reviver?.isValid || !target?.isValid) return REVIVE_MSG.cancel;

   if (!isGameRunning) return REVIVE_MSG.onlyDuringGame;
   if (!uhcPlayerIds.has(reviver.id)) return REVIVE_MSG.onlyUhcAlive;
   if (!deathLocation.has(target.id)) return REVIVE_MSG.targetNotDeadYet;

   const reviverTeam = getPlayerTeam(reviver);
   if (!reviverTeam || reviverTeam !== getPlayerTeam(target)) return REVIVE_MSG.targetNotTeammate;

   if (reviveSessions.has(target.id)) return REVIVE_MSG.alreadyRevivingTarget;
   if (reviverSessions.has(reviver.id)) return REVIVE_MSG.alreadyRevivingOther;

   return null;
}

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

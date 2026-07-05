import { ItemStack, system } from '@minecraft/server';
import { deathBatchRunning, deathQueue, enqueueDeath, setDeathBatchRunning } from '../../shared/State_Queue.js';
import { createItemQueryOptions, createLoc, freeLoc, logError, setSpectator } from '../../shared/Util.js';
import { removePlayerFromAliveRuntimeState } from '../cache/CacheManager.js';
import { enqueueItemVacuum } from '../cache/ItemVacuum.js';
import { hitRegistry, isUHC, killStreak, multiKill, playerTeamCache } from '../cache/State_Cache.js';
import { teamKillObj, uhcDeathsObj, uhcKillsObj } from '../match/State_Game.js';
import { mergePlayerStats, recordSurvivedLast } from '../rank/RankData.js';
import { cancelReviveForPlayer } from '../revive/ReviveManager.js';
import { REVIVE_ITEM_ID } from '../revive/State_Revive.js';
import { playerStats, setDeathLocation, setPlayerStats, TEAM_LOOKUP, teamPlayerIndex, teamStats } from '../team/State_Team.js';
import {
   getDeathDisplayInfo,
   handleFirstBlood,
   handleKillStreak,
   handleMultiKill,
   incrementPairHistory,
   resolveDeathCause,
   resolveKiller,
   scheduleSaveStats,
   sendDeathMessage,
   showDeathUI,
   trackHit,
} from './StatsManager.js';

const PLAYER_TYPE = 'minecraft:player';

// burst processing when queue is backed up
const DEATH_BATCH_SIZE = Object.freeze({
   NORMAL: 5,
   BURST: 10,
   BURST_THRESHOLD: 20,
});

// Extracted deferred cleanup to reduce nesting in processVictimDeath
function deferredDeathCleanup(player, snapX, snapY, snapZ) {
   try {
      if (!player || !player.isValid) return;

      enqueueItemVacuum(() => {
         try {
            if (!player || !player.isValid) return;
            const activeDim = player.dimension;
            if (!activeDim) return;

            const spawnLoc = createLoc(snapX, snapY + 1.5, snapZ);

            try {
               activeDim.spawnItem(new ItemStack(REVIVE_ITEM_ID, 1), spawnLoc);
            } catch (error) {
               logError('DeathManager', 'Failed to spawn player head', error);
            }

            let cart = null;
            try {
               cart = activeDim.spawnEntity('minecraft:hopper_minecart', spawnLoc);
            } catch (error) {
               logError('DeathManager', 'Failed to spawn hopper minecart', error);
            } finally {
               freeLoc(spawnLoc);
            }

            if (!cart || !cart.isValid) return;
            const cartLoc = cart.location;

            const items = activeDim.getEntities(createItemQueryOptions(snapX, snapY, snapZ));
            for (let ii = 0, iLen = items.length; ii < iLen; ii++) {
               const item = items[ii];
               if (!item || !item.isValid) continue;
               try {
                  item.teleport(cartLoc, { dimension: activeDim });
               } catch (error) {
                  logError('DeathManager', 'Failed to teleport item to vacuum cart', error);
               }
            }
         } catch (error) {
            logError('DeathManager', 'Item vacuum execution failed', error);
         }
      });
   } catch (error) {
      logError('DeathManager', 'Deferred spectator transition failed', error);
   }
}

function processDeathBatch() {
   let count = 0;
   const dynamicBatch = deathQueue.length > DEATH_BATCH_SIZE.BURST_THRESHOLD ? DEATH_BATCH_SIZE.BURST : DEATH_BATCH_SIZE.NORMAL;

   while (count < dynamicBatch) {
      const entry = deathQueue.shift();
      if (!entry) break;
      const player = entry.player;
      if (!player?.isValid) continue;
      const deathInfo = getDeathDisplayInfo(player);
      showDeathUI(player, deathInfo);
      sendDeathMessage(player, deathInfo);
      count++;
   }

   if (deathQueue.length === 0) {
      setDeathBatchRunning(false);
      return;
   }

   system.runTimeout(processDeathBatch, 1);
}

export function showDeathScreenshot(player) {
   if (!player?.isValid) return;

   enqueueDeath({ player });

   if (deathBatchRunning) return;

   setDeathBatchRunning(true);
   system.run(processDeathBatch);
}

function processVictimDeath(player, victimTeamId, loc) {
   const id = player.id;

   removePlayerFromAliveRuntimeState(id, victimTeamId);

   // if team has 0 remaining, this player was the last survivor
   if (victimTeamId) {
      const teamMembers = teamPlayerIndex.get(victimTeamId);
      if (teamMembers && teamMembers.size === 0) {
         recordSurvivedLast(player.name);
      }
   }

   if (!loc) return;

   const dim = player.dimension;
   if (!dim) return;

   setDeathLocation(id, { x: loc.x, y: loc.y, z: loc.z });

   const pLoc = { x: loc.x, y: loc.y + 4.5, z: loc.z };
   try {
      dim.spawnParticle('so:light2', pLoc);
   } catch (error) {
      logError('DeathManager', 'Failed to spawn light2 particle', error);
   }

   pLoc.y = loc.y + 6.5;
   try {
      dim.spawnParticle('so:light5', pLoc);
   } catch (error) {
      logError('DeathManager', 'Failed to spawn light5 particle', error);
   }

   const snapX = loc.x;
   const snapY = loc.y;
   const snapZ = loc.z;

   try {
      player.removeTag('uhc');
   } catch (error) {
      logError('DeathManager', 'Failed to remove UHC tag', error);
   }

   try {
      setSpectator(player);
   } catch (error) {
      logError('DeathManager', 'Failed to set game mode to Spectator', error);
   }

   system.runTimeout(() => {
      deferredDeathCleanup(player, snapX, snapY, snapZ);
   }, 1);

   const victimPs = playerStats.get(id) ?? { kills: 0, deaths: 0 };
   victimPs.deaths++;
   victimPs.name = player.name;

   if (victimTeamId) {
      victimPs.teamId = victimTeamId;
   }

   setPlayerStats(id, victimPs);
   if (uhcDeathsObj) uhcDeathsObj.setScore(player.name, victimPs.deaths);

   const teamEntry = teamStats.get(victimTeamId);
   if (teamEntry) {
      teamEntry.deaths++;
   }

   scheduleSaveStats();
}

function processKillerRewards(killer, victimPlayer, victimTeamId) {
   const killerId = killer.id;
   const killerTeamId = playerTeamCache.get(killerId);

   if (killerTeamId && killerTeamId === victimTeamId) {
      hitRegistry.delete(victimPlayer.id);
      return;
   }

   incrementPairHistory(killer, victimPlayer);

   const killerPs = playerStats.get(killerId) ?? { kills: 0, deaths: 0 };
   killerPs.kills++;
   killerPs.name = killer.name;

   if (killerTeamId) {
      killerPs.teamId = killerTeamId;
   }

   setPlayerStats(killerId, killerPs);
   if (uhcKillsObj) uhcKillsObj.setScore(killer.name, killerPs.kills);

   mergePlayerStats(killer.name, { kills: 1, teamId: killerTeamId });

   const teamEntry = teamStats.get(killerTeamId);

   if (teamEntry) {
      teamEntry.kills++;
   }

   if (teamKillObj && killerTeamId) {
      const teamInfo = TEAM_LOOKUP.get(killerTeamId);
      if (teamInfo) {
         const label = `${teamInfo.color}${teamInfo.name}`;
         teamKillObj.addScore(label, 1);
      }
   }

   scheduleSaveStats();

   handleFirstBlood(killer, victimPlayer);
   handleMultiKill(killer);
   handleKillStreak(killer);
}

export function handleDeath(player) {
   if (!player || !player.isValid) return;
   const id = player.id;

   cancelReviveForPlayer(id);

   const victimTeamId = playerTeamCache.get(id);
   const killer = resolveKiller(id);
   const cause = resolveDeathCause(id);

   if (isUHC(player)) {
      processVictimDeath(player, victimTeamId, player.location);
      mergePlayerStats(player.name, { deaths: 1, teamId: victimTeamId });
      killStreak.set(id, 0);
      multiKill.delete(id);
      showDeathScreenshot(player);
   }

   if (cause === 'player' && killer && isUHC(killer) && killer !== player) {
      processKillerRewards(killer, player, victimTeamId);
   }

   hitRegistry.delete(id);
}

export function HandlerOnHurt(ev) {
   const hurt = ev.hurtEntity;
   if (!hurt) return;
   if (hurt.typeId !== PLAYER_TYPE) return;

   const source = ev.damageSource;
   const attacker = source?.damagingEntity;
   const cause = source?.cause;

   if (!attacker || attacker.typeId !== PLAYER_TYPE) {
      trackHit(null, hurt, cause);
      return;
   }

   if (!isUHC(attacker) || !isUHC(hurt)) {
      trackHit(null, hurt, cause);
      return;
   }

   trackHit(attacker, hurt, cause);
}

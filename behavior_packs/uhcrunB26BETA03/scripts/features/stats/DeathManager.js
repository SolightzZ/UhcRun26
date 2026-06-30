//จัดการการตายของผู้เล่น ทั้ง victim และ killer
import { ItemStack, system } from '@minecraft/server';
import { createItemQueryOptions, createLoc, freeLoc, logError, setSpectator } from '../../shared/Util.js';
import { removePlayerFromAliveRuntimeState } from '../cache/CacheManager.js';
import { enqueueItemVacuum } from '../cache/ItemVacuum.js';
import { hitRegistry, isUHC, killStreak, multiKill, playerTeamCache } from '../cache/State_Cache.js';
import { teamKillObj, uhcDeathsObj, uhcKillsObj } from '../match/State_Game.js';
import { mergePlayerStats, recordSurvivedLast } from '../rank/RankData.js';
import { cancelReviveForPlayer } from '../revive/ReviveManager.js';
import { REVIVE_ITEM_ID } from '../revive/State_Revive.js';
import { playerStats, setDeathLocation, setPlayerStats, TEAM_LOOKUP, teamPlayerIndex, teamStats } from '../team/State_Team.js';
import { deathBatchRunning, deathQueue, setDeathBatchRunning } from './State_Queue.js';
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

//จำกัดจำนวน queue death ที่ประมวลผลต่อรอบ (burst เมื่อค้างเยอะ)
const DEATH_BATCH_SIZE = Object.freeze({
   NORMAL: 5,
   BURST: 10,
   BURST_THRESHOLD: 20,
});

//ประมวลผล death queue เป็นชุดๆ ผ่าน system.runTimeout
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

   deathQueue.push({ player });

   if (deathBatchRunning) return;

   setDeathBatchRunning(true);
   system.run(processDeathBatch);
}

//ประมวลผลผู้เล่นที่ตาย: ลบ alive state, สร้าง particles, เปลี่ยนเป็น spectator, ดูดไอเทม, อัปเดต stats
function processVictimDeath(player, victimTeamId, loc) {
   const id = player.id;

   removePlayerFromAliveRuntimeState(id, victimTeamId);

   // ตรวจสอบว่าทีมมีคนรอดเหลือ 0 = ผู้เล่นนี้คือคนสุดท้ายของทีม
   if (victimTeamId) {
      const teamMembers = teamPlayerIndex.get(victimTeamId);
      if (teamMembers && teamMembers.size === 0) {
         recordSurvivedLast(id);
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

   system.runTimeout(() => {
      try {
         if (!player || !player.isValid) return;

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

               system.runTimeout(() => {
                  try {
                     if (cart && cart.isValid) {
                        cart.remove();
                     }
                  } catch (error) {
                     logError('DeathManager', 'Failed to remove vacuum cart', error);
                  }
               }, 30);
            } catch (error) {
               logError('DeathManager', 'Item vacuum execution failed', error);
            }
         });
      } catch (error) {
         logError('DeathManager', 'Deferred spectator transition failed', error);
      }
   }, 1);

   const victimPs = playerStats.get(id) ?? { kills: 0, deaths: 0 };
   victimPs.deaths++;
   victimPs.name = player.name;

   if (victimTeamId) {
      victimPs.teamId = victimTeamId;
   }

   setPlayerStats(id, victimPs);
   if (uhcDeathsObj) uhcDeathsObj.setScore(id, victimPs.deaths);

   const teamEntry = teamStats.get(victimTeamId);
   if (teamEntry) {
      teamEntry.deaths++;
   }

   scheduleSaveStats();
}

//ให้คะแนน killer และประกาศ multi kill / first blood
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
   if (uhcKillsObj) uhcKillsObj.setScore(killerId, killerPs.kills);

   mergePlayerStats(killerId, killer.name, { kills: 1, teamId: killerTeamId });

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

//จุดเริ่มต้นจัดการ death: ยกเลิก revive, ประมวลผล victim และ killer
export function handleDeath(player) {
   if (!player || !player.isValid) return;
   const id = player.id;

   cancelReviveForPlayer(id);

   const victimTeamId = playerTeamCache.get(id);
   const killer = resolveKiller(id);
   const cause = resolveDeathCause(id);

   if (isUHC(player)) {
      processVictimDeath(player, victimTeamId, player.location);
      mergePlayerStats(id, player.name, { deaths: 1, teamId: victimTeamId });
      killStreak.set(id, 0);
      multiKill.delete(id);
      showDeathScreenshot(player);
   }

   if (cause === 'player' && killer && isUHC(killer) && killer !== player) {
      processKillerRewards(killer, player, victimTeamId);
   }

   hitRegistry.delete(id);
}

//บันทึกการโจมตีล่าสุดลง hitRegistry (ใครตีใคร)
export function HandlerOnHurt(ev) {
   const hurt = ev.hurtEntity;
   if (!hurt) return;
   if (hurt.typeId !== 'minecraft:player') return;

   const source = ev.damageSource;
   const attacker = source?.damagingEntity;
   const cause = source?.cause;

   if (!attacker || attacker.typeId !== 'minecraft:player') {
      trackHit(null, hurt, cause);
      return;
   }

   if (!isUHC(attacker) || !isUHC(hurt)) {
      trackHit(null, hurt, cause);
      return;
   }

   trackHit(attacker, hurt, cause);
}

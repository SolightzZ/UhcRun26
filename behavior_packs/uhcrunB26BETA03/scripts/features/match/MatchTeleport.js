import { system, world } from '@minecraft/server';
import { ctx } from '../../features/border/BorderState.js';
import { logError } from '../../shared/Util.js';
import { center, MinecraftColor } from '../border/BorderState.js';
import { uhcPlayerIds } from '../cache/State_Cache.js';
import { getCachedPlayers, getPlayerTeam } from '../team/TeamActions.js';

const TELEPORT_CONFIG = Object.freeze({
   PRELOAD_Y: 200,
   PRELOAD_DELAY: 2,
   LEADER_SETTLE_TICKS: 5,
   MEMBER_INTERVAL: 3,
   MAX_RETRIES: 3,
   DEFAULT_Y: 120,
   MIN_Y: -64,
   MAX_Y: 320,
   MAX_SPAWN_RADIUS: 490,
});

class UhcMatchManagerTeleport {
   safeYCache = new Map();
   teleportQueueAbortHandlers = [];

   teleportManagerGetSafeY(dimension, x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return TELEPORT_CONFIG.DEFAULT_Y;

      const key = `${x | 0},${z | 0}`;
      if (this.safeYCache.has(key)) return this.safeYCache.get(key);

      try {
         // ตรวจสอบ getTopmostBlock และการเข้าถึงคุณสมบัติของบล็อกในบล็อก try เดียวกันเพื่อป้องกัน
         // ข้อผิดพลาด LocationInUnloadedChunkError เมื่อ block.typeId หรือ block.y ล้มเหลว
         // แม้ว่า getTopmostBlock จะดำเนินการสำเร็จ (เนื่องจากโหลดบล็อกในชังก์เพียงบางส่วน)
         try {
            const block = dimension.getTopmostBlock({ x, z });
            if (!block) {
               if (this.safeYCache.size >= 256) {
                  this.safeYCache.delete(this.safeYCache.keys().next().value);
               }
               this.safeYCache.set(key, TELEPORT_CONFIG.DEFAULT_Y);
               return TELEPORT_CONFIG.DEFAULT_Y;
            }

            const typeId = block.typeId ?? '';
            const isLiquid = typeId.includes('lava') || typeId.includes('water');

            if (isLiquid) {
               try {
                  dimension.runCommand(`setblock ${x | 0} ${block.y} ${z | 0} glass`);
               } catch (error) {
                  logError('UHC', 'Failed to place safety platform block', error);
               }
            }

            const y = Math.max(TELEPORT_CONFIG.MIN_Y, Math.min(TELEPORT_CONFIG.MAX_Y, block.y + 1));

            if (this.safeYCache.size >= 256) {
               this.safeYCache.delete(this.safeYCache.keys().next().value);
            }

            this.safeYCache.set(key, y);
            return y;
         } catch (error) {
            // ชังก์ยังไม่ได้ถูกโหลดหรือการเข้าถึงคุณสมบัติของบล็อกล้มเหลว แคชค่า Y เริ่มต้นไว้เพื่อป้องกันการพยายามเรียกซ้ำซ้อน
            if (this.safeYCache.size >= 256) {
               this.safeYCache.delete(this.safeYCache.keys().next().value);
            }
            this.safeYCache.set(key, TELEPORT_CONFIG.DEFAULT_Y);
            return TELEPORT_CONFIG.DEFAULT_Y;
         }
      } catch (error) {
         logError('UHC', 'Failed to get safe Y at ' + x + ' ' + z, error);
         return TELEPORT_CONFIG.DEFAULT_Y;
      }
   }

   teleportManagerGroupByTeam() {
      const teamMap = new Map();
      const players = getCachedPlayers();

      for (let i = 0; i < players.length; i++) {
         const player = players[i];

         if (!player?.isValid) continue;
         if (!uhcPlayerIds.has(player.id)) continue;

         const tag = getPlayerTeam(player);
         if (!tag) continue;

         if (!teamMap.has(tag)) {
            teamMap.set(tag, []);
         }

         teamMap.get(tag).push(player);
      }
      return teamMap;
   }

   teleportManagerGenerateXZ(teamCount, radius) {
      const effectiveRadius = Math.min(radius, TELEPORT_CONFIG.MAX_SPAWN_RADIUS);
      const angleStep = (Math.PI * 2) / teamCount;
      const randomOffset = Math.random() * Math.PI * 2;

      const positions = [];
      for (let i = 0; i < teamCount; i++) {
         const angle = randomOffset + i * angleStep;
         positions.push({
            x: (center.x + Math.cos(angle) * effectiveRadius) | 0,
            z: (center.z + Math.sin(angle) * effectiveRadius) | 0,
         });
      }
      return positions;
   }

   createValidTeam(teamData, targetPos) {
      if (!teamData || !targetPos) return null;

      const members = teamData[1];
      if (!members?.length) return null;

      const snapshot = members.filter((p) => p?.isValid && uhcPlayerIds.has(p.id));
      if (!snapshot.length) return null;

      return {
         snapshot,
         capturedX: targetPos.x,
         capturedZ: targetPos.z,
         teamTag: teamData[0],
      };
   }

   teleportLeaderToPreload(leader, x, z, dimension, teamTag) {
      try {
         leader.teleport({ x, y: TELEPORT_CONFIG.PRELOAD_Y, z }, { dimension });
         return true;
      } catch (error) {
         logError('UHC', 'Leader ' + leader.name + ' (' + teamTag + ') failed to teleport to preload position', error);
         return false;
      }
   }

   createMemberQueueEntry(player, loc) {
      return {
         player,
         loc: { ...loc },
         retryCount: 0,
         maxRetries: TELEPORT_CONFIG.MAX_RETRIES,
      };
   }

   teleportPlayer(entry, dimension) {
      const { player, loc, retryCount } = entry;

      if (!player?.isValid || !uhcPlayerIds.has(player.id)) {
         return { success: false, shouldRetry: false };
      }

      try {
         player.teleport(loc, { dimension });
         return { success: true, shouldRetry: false };
      } catch (error) {
         logError('UHC', 'Teleport failed for ' + player.name, error);

         const shouldRetry = retryCount < entry.maxRetries;
         if (!shouldRetry) {
            world.sendMessage(`${MinecraftColor.red}[x] Failed to scatter ${player.name}`);
         }
         return { success: false, shouldRetry };
      }
   }

   teleportManagerRunQueue(teamsData, positions, dimension, onComplete) {
      let totalOk = 0;
      let totalFail = 0;
      let aborted = false;

      const abort = () => {
         aborted = true;
      };

      this.teleportQueueAbortHandlers.push(abort);

      const removeAbortHandler = () => {
         const idx = this.teleportQueueAbortHandlers.indexOf(abort);
         if (idx !== -1) this.teleportQueueAbortHandlers.splice(idx, 1);
      };

      const finishQueue = () => {
         removeAbortHandler();
         world.sendMessage(`${MinecraftColor.green}[/] All players scattered across the map!`);
         if (typeof onComplete === 'function') onComplete();
      };

      const validTeams = [];

      for (let i = 0; i < teamsData.length; i++) {
         const validTeam = this.createValidTeam(teamsData[i], positions[i]);
         if (!validTeam) continue;
         validTeams.push(validTeam);
      }

      if (!validTeams.length) return finishQueue();

      let phase1Idx = 0;

      const processNextLeader = () => {
         if (aborted) {
            removeAbortHandler();
            return;
         }

         if (phase1Idx >= validTeams.length) {
            system.runTimeout(() => {
               if (aborted) {
                  removeAbortHandler();
                  return;
               }

               this.processMemberQueue(
                  validTeams,
                  dimension,
                  finishQueue,
                  () => totalOk++,
                  () => totalFail++,
                  () => aborted,
               );
            }, TELEPORT_CONFIG.LEADER_SETTLE_TICKS);
            return;
         }

         const validTeam = validTeams[phase1Idx++];
         const leader = validTeam.snapshot[0];
         const success = this.teleportLeaderToPreload(leader, validTeam.capturedX, validTeam.capturedZ, dimension, validTeam.teamTag);

         if (success) totalOk++;
         else totalFail++;

         system.runTimeout(processNextLeader, 1);
      };

      processNextLeader();
   }

   processMemberQueue(validTeams, dimension, finishCallback, onSuccess, onFail, isAborted) {
      const memberQueue = [];
      const retryQueue = [];

      for (let t = 0; t < validTeams.length; t++) {
         const { snapshot, capturedX, capturedZ } = validTeams[t];
         const safeY = this.teleportManagerGetSafeY(dimension, capturedX, capturedZ);
         const loc = { x: capturedX, y: safeY, z: capturedZ };

         for (let m = 0; m < snapshot.length; m++) {
            const player = snapshot[m];
            if (player?.isValid && uhcPlayerIds.has(player.id)) {
               memberQueue.push(this.createMemberQueueEntry(player, loc));
            }
         }
      }

      if (memberQueue.length === 0) return finishCallback();

      let qIdx = 0;
      let processedRetries = false;

      const processNextMember = () => {
         if (isAborted()) {
            return;
         }

         if (qIdx >= memberQueue.length) {
            if (retryQueue.length > 0 && !processedRetries) {
               memberQueue.push(...retryQueue);
               retryQueue.length = 0;
               processedRetries = true;
            } else {
               return finishCallback();
            }
         }

         if (qIdx >= memberQueue.length) return finishCallback();

         const entry = memberQueue[qIdx++];

         const result = this.teleportPlayer(entry, dimension);

         if (result.success) {
            onSuccess();
         } else if (result.shouldRetry && !processedRetries) {
            const retryEntry = { ...entry, retryCount: entry.retryCount + 1 };
            retryQueue.push(retryEntry);

            if (entry.retryCount === 0) {
               world.sendMessage(`${MinecraftColor.yellow}[x] Retrying teleport for ${entry.player.name}...`);
            }
         } else {
            onFail();
         }

         system.runTimeout(processNextMember, TELEPORT_CONFIG.MEMBER_INTERVAL);
      };

      processNextMember();
   }

   teleportManagerTeleportTeam(radius, onComplete) {
      if (radius === undefined) radius = ctx.borderRadius;
      if (!Number.isFinite(radius)) radius = ctx.borderRadius;

      if (!ctx.cachedDimension) {
         world.sendMessage(MinecraftColor.red + '§c[x] Server error: Cannot initialize world dimension');

         if (typeof onComplete === 'function') onComplete();
         return;
      }

      const teamMap = this.teleportManagerGroupByTeam();
      const teamsData = Array.from(teamMap.entries());

      if (teamsData.length === 0) {
         if (typeof onComplete === 'function') onComplete();
         return;
      }

      world.sendMessage(`${MinecraftColor.cyan}§l» §r${MinecraftColor.gray}Scattering ${teamsData.length} teams across the map...`);

      const positions = this.teleportManagerGenerateXZ(teamsData.length, radius);
      this.teleportManagerRunQueue(teamsData, positions, ctx.cachedDimension, onComplete);
   }

   abortAllTeleportQueues() {
      for (let i = 0; i < this.teleportQueueAbortHandlers.length; i++) {
         this.teleportQueueAbortHandlers[i]();
      }
      this.teleportQueueAbortHandlers.length = 0;
   }
}

export default new UhcMatchManagerTeleport();

import { system, world } from '@minecraft/server';
import { getPlayerTeam } from '../Manager/TeamManager.js';
import { isAliveAndUhc } from '../plugin/Util.js';
import { center, ctx, MinecraftColor } from './BorderManager.js';

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

//จัดการ scatter ผู้เล่น: เทเลพอร์ตทีมไปตำแหน่งรอบ map พร้อม queue + retry
class UhcMatchManagerTeleport {
   safeYCache = new Map();
   teleportQueueAbortHandlers = [];

   // หา Y ที่ปลอดภัยสำหรับเทเลพอร์ต (cache ผลลัพธ์)
   teleportManagerGetSafeY(dimension, x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return TELEPORT_CONFIG.DEFAULT_Y;

      const key = `${x | 0},${z | 0}`;
      if (this.safeYCache.has(key)) return this.safeYCache.get(key);

      try {
         // getTopmostBlock โยน LocationInUnloadedChunkError ถ้า chunk ยังไม่โหลด
         let block;

         try {
            block = dimension.getTopmostBlock({ x, z });
   } catch (error) {
            // chunk ยังไม่โหลด เก็บ default Y ไว้ใน cache ป้องกันเรียกซ้ำ

            if (this.safeYCache.size >= 256) {
               this.safeYCache.delete(this.safeYCache.keys().next().value);
            }

            this.safeYCache.set(key, TELEPORT_CONFIG.DEFAULT_Y);
            return TELEPORT_CONFIG.DEFAULT_Y;
         }
         if (!block) return TELEPORT_CONFIG.DEFAULT_Y;

         const typeId = block.typeId ?? '';
         const isLiquid = typeId.includes('lava') || typeId.includes('water');

         if (isLiquid) {
            try {
   dimension.runCommand(`setblock ${x | 0} ${block.y} ${z | 0} glass`);
} catch (error) {
   console.error('[UHC] Failed to place safety platform block: ', error);
}
         }

         const y = Math.max(TELEPORT_CONFIG.MIN_Y, Math.min(TELEPORT_CONFIG.MAX_Y, block.y + 1));

         if (this.safeYCache.size >= 256) {
            this.safeYCache.delete(this.safeYCache.keys().next().value);
         }

         this.safeYCache.set(key, y);

         return y;
   } catch (error) {
      console.error('[UHC] Failed to get safe Y at', x, z, ':', error);
      return TELEPORT_CONFIG.DEFAULT_Y;
   }
   }

   // จับกลุ่มผู้เล่นตามทีม
   teleportManagerGroupByTeam() {
      const teamMap = new Map();
      const players = world.getPlayers();

      for (let i = 0; i < players.length; i++) {
         const player = players[i];

         if (!player?.isValid) continue;
         if (!player.hasTag('uhc')) continue;

         const tag = getPlayerTeam(player);
         if (!tag) continue;

         if (!teamMap.has(tag)) {
            teamMap.set(tag, []);
         }

         teamMap.get(tag).push(player);
      }
      return teamMap;
   }

   // สร้างตำแหน่ง XZ รอบศูนย์กลาง map
   teleportManagerGenerateXZ(teamCount, radius) {
      const effectiveRadius = Math.min(radius, TELEPORT_CONFIG.MAX_SPAWN_RADIUS);
      const angleStep = (Math.PI * 2) / teamCount;
      const randomOffset = Math.random() * Math.PI * 2;

      positions = [];
      for (let i = 0; i < teamCount; i++) {
         const angle = randomOffset + i * angleStep;
         positions.push({
            x: (center.x + Math.cos(angle) * effectiveRadius) | 0,
            z: (center.z + Math.sin(angle) * effectiveRadius) | 0,
         });
      }
      return positions;
   }

   // ตรวจสอบทีมว่ายังมีผู้เล่นที่เล่นอยู่
   createValidTeam(teamData, targetPos) {
      if (!teamData || !targetPos) return null;

      const members = teamData[1];
      if (!members?.length) return null;

      const snapshot = members.filter(isAliveAndUhc);
      if (!snapshot.length) return null;

      return {
         snapshot,
         capturedX: targetPos.x,
         capturedZ: targetPos.z,
         teamTag: teamData[0],
      };
   }

   // หัวหน้าทีมเทเลพอร์ตไปรอที่ Y สูงก่อน (preload chunks)
   teleportLeaderToPreload(leader, x, z, dimension, teamTag) {
      try {
         leader.teleport({ x, y: TELEPORT_CONFIG.PRELOAD_Y, z }, { dimension });
         return true;
   } catch (error) {
      console.error(`[UHC] Leader ${leader.name} (${teamTag}) failed to teleport to preload position:`, error);
      return false;
   }
   }

   // สร้าง entry สำหรับ queue
   createMemberQueueEntry(player, loc) {
      return {
         player,
         loc: { ...loc },
         retryCount: 0,
         maxRetries: TELEPORT_CONFIG.MAX_RETRIES,
      };
   }

   // เทเลพอร์ตผู้เล่น พร้อม retry ถ้าล้มเหลว
   teleportPlayer(entry, dimension) {
      const { player, loc, retryCount } = entry;

      if (!player?.isValid || !player.hasTag('uhc')) {
         return { success: false, shouldRetry: false };
      }

      try {
         player.teleport(loc, { dimension });
         return { success: true, shouldRetry: false };
   } catch (error) {
      console.error('[UHC] Teleport failed for', player.name, ':', error);

      const shouldRetry = retryCount < entry.maxRetries;
      if (!shouldRetry) {
         world.sendMessage(`${MinecraftColor.red}[x] Failed to scatter ${player.name}`);
      }
      return { success: false, shouldRetry };
   }
   }

   // รัน queue scatter: รอบ leader ก่อน แล้วค่อยตามด้วย member
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
         const success = this.teleportLeaderToPreload(
            leader,
            validTeam.capturedX,
            validTeam.capturedZ,
            dimension,
            validTeam.teamTag,
         );

         if (success) totalOk++;
         else totalFail++;

         system.runTimeout(processNextLeader, 1);
      };

      processNextLeader();
   }

   // เทเลพอร์ตสมาชิกทีละคน (3 ticks/คน)
   processMemberQueue(validTeams, dimension, finishCallback, onSuccess, onFail, isAborted) {
      const memberQueue = [];
      const retryQueue = [];

      for (let t = 0; t < validTeams.length; t++) {
         const { snapshot, capturedX, capturedZ } = validTeams[t];
         const safeY = this.teleportManagerGetSafeY(dimension, capturedX, capturedZ);
         const loc = { x: capturedX, y: safeY, z: capturedZ };

         for (let m = 0; m < snapshot.length; m++) {
            const player = snapshot[m];
            if (isAliveAndUhc(player)) {
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
               world.sendMessage(
                  `${MinecraftColor.yellow}[x] Retrying teleport for ${entry.player.name}...`,
               );
            }
         } else {
            onFail();
         }

         system.runTimeout(processNextMember, TELEPORT_CONFIG.MEMBER_INTERVAL);
      };

      processNextMember();
   }

   // เริ่มกระจายทีมไปบน map
   teleportManagerTeleportTeam(radius, onComplete) {
      if (radius === undefined) radius = ctx.borderRadius;
      if (!Number.isFinite(radius)) radius = ctx.borderRadius;

      if (!ctx.cachedDimension) {
         world.sendMessage(
            MinecraftColor.red + '§c[x] Server error: Cannot initialize world dimension',
         );

         if (typeof onComplete === 'function') onComplete();
         return;
      }

      const teamMap = this.teleportManagerGroupByTeam();
      const teamsData = Array.from(teamMap.entries());

      if (teamsData.length === 0) {
         if (typeof onComplete === 'function') onComplete();
         return;
      }

      world.sendMessage(
         `${MinecraftColor.cyan}§l» §r${MinecraftColor.gray}Scattering ${teamsData.length} teams across the map...`,
      );

      const positions = this.teleportManagerGenerateXZ(teamsData.length, radius);
      this.teleportManagerRunQueue(teamsData, positions, ctx.cachedDimension, onComplete);
   }

   // ยกเลิก queue ทั้งหมด
   abortAllTeleportQueues() {
      for (let i = 0; i < this.teleportQueueAbortHandlers.length; i++) {
         this.teleportQueueAbortHandlers[i]();
      }
      this.teleportQueueAbortHandlers.length = 0;
   }
}

export default new UhcMatchManagerTeleport();

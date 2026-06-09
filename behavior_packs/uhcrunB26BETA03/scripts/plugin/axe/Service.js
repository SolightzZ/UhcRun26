import { EntityInventoryComponent, ItemComponentTypes, ItemStack, system } from '@minecraft/server';
import model from './Model.js';

class Service {
   hashLoc = (x, y, z) => {
      let h = (x * 374761393) ^ (y * 668265263) ^ (z * 2246822519);
      h ^= h >>> 13;
      h = Math.imul(h, 1540483477);
      h ^= h >>> 15;
      return h;
   };

   getHeldItem = (player) => {
      const inv = player.getComponent(EntityInventoryComponent.componentId);
      return inv?.container?.getItem(player.selectedSlotIndex);
   };

   // ลดความทนทานขวานตามจำนวนบล็อกที่ตัด
   applyToolDamage = (player, amount, axeTypeId) => {
      if (!player?.isValid) return false;
      const inv = player.getComponent(EntityInventoryComponent.componentId);
      const container = inv?.container;
      if (!container) return false;
      const slot = player.selectedSlotIndex;
      const item = container.getItem(slot);
      if (!item || item.typeId !== axeTypeId) return false;

      if (player.selectedSlotIndex !== slot) return false;
      const dur = item.getComponent(ItemComponentTypes.Durability);
      if (!dur) return true;
      const prev = dur.damage;
      dur.damage = Math.min(dur.damage + amount, dur.maxDurability);
      if (dur.damage >= dur.maxDurability) {
         container.setItem(slot, undefined);
         player.playSound('random.break', { location: player.location, volume: 1.0, pitch: 0.9 });
         return false;
      }
      if (dur.damage !== prev) container.setItem(slot, item);
      return true;
   };

   isDimensionValid = (dim) => {
      try {
         return dim?.id !== undefined;
      } catch (error) {
         console.error('[Axe] Dimension validation failed:', error);
         return false;
      }
   };

   // เช็ค cooldown ต่อผู้เล่น
   checkCooldown = (playerId) => {
      const now = system.currentTick;
      const last = model.lastFellTick.get(playerId) ?? -model.CONFIG.COOLDOWN_TICKS;
      if (now - last < model.CONFIG.COOLDOWN_TICKS) return false;
      model.lastFellTick.set(playerId, now);
      return true;
   };

   adjustPlayerJobCount = (playerId, delta) => {
      const next = (model.playerJobCount.get(playerId) ?? 0) + delta;
      if (next <= 0) model.playerJobCount.delete(playerId);
      else model.playerJobCount.set(playerId, next);
   };

   // สแกนลำต้นไม้แนวตั้ง
   scanTrunk = (dim, x, startY, z, logType, direction, out) => {
      if (!this.isDimensionValid(dim)) return;
      out.length = 0;
      const loc = { x, y: startY, z };
      for (let count = 0; count < model.CONFIG.MAX_LOGS; count++) {
         const block = dim.getBlock(loc);
         if (!block?.isValid || block.typeId !== logType) break;
         out.push(loc.x, loc.y, loc.z);
         loc.y += direction;
      }
   };

   // สแกนใบไม้รอบลำต้น (BFS)
   *scanLeaves(dim, player, allLogs, anchorX, brokenY, anchorZ, leafType) {
      if (!this.isDimensionValid(dim)) return [];
      const { CANOPY_RADIUS: r, LEAF_SCAN_PAD: pad, MAX_LEAVES, SCAN_BLOCK_CAP } = model.CONFIG;

      let minY = brokenY,
         maxY = brokenY;
      for (let i = 1; i < allLogs.length; i += 3) {
         const y = allLogs[i];
         if (y < minY) minY = y;
         if (y > maxY) maxY = y;
      }
      const scanMinY = minY - 1;
      const scanMaxY = maxY + pad;

      const leaves = [];
      const visited = new Set();
      const queue = [];

      for (let i = 0; i < allLogs.length; i += 3) {
         const lx = allLogs[i],
            ly = allLogs[i + 1],
            lz = allLogs[i + 2];
         for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
               if (dx === 0 && dz === 0) continue;
               const key = this.hashLoc(lx + dx, ly, lz + dz);
               if (!visited.has(key)) {
                  visited.add(key);
                  queue.push(lx + dx, ly, lz + dz);
               }
            }
         }
      }

      const QUEUE_CAP = SCAN_BLOCK_CAP * 3;
      let calls = 0;
      let batchCalls = 0;
      const loc = { x: 0, y: 0, z: 0 };
      let qi = 0;

      while (qi < queue.length && leaves.length / 3 < MAX_LEAVES && calls < SCAN_BLOCK_CAP) {
         if (!player?.isValid) return [];

         if (queue.length - qi > QUEUE_CAP) {
            yield { type: 'progress', leaves };
            continue;
         }

         const cx = queue[qi++],
            cy = queue[qi++],
            cz = queue[qi++];

         if (cy < scanMinY || cy > scanMaxY) continue;
         if (Math.abs(cx - anchorX) > r || Math.abs(cz - anchorZ) > r) continue;

         loc.x = cx;
         loc.y = cy;
         loc.z = cz;
         let block;
         try {
            block = dim.getBlock(loc);
         } catch (error) {
            console.error('[Axe] getBlock failed during leaf scan:', error);
            continue;
         }
         calls++;
         batchCalls++;

         if (!block?.isValid || block.typeId !== leafType) continue;
         leaves.push(cx, cy, cz);

         for (let ni = 0; ni < model.NEIGHBOUR_OFFSETS.length; ni += 3) {
            const nx = cx + model.NEIGHBOUR_OFFSETS[ni],
               ny = cy + model.NEIGHBOUR_OFFSETS[ni + 1],
               nz = cz + model.NEIGHBOUR_OFFSETS[ni + 2];
            const nkey = this.hashLoc(nx, ny, nz);
            if (!visited.has(nkey)) {
               visited.add(nkey);
               if (queue.length - qi < QUEUE_CAP) queue.push(nx, ny, nz);
            }
         }

         if (batchCalls >= model.LEAF_SCAN_BATCH_SIZE) {
            batchCalls = 0;
            yield { type: 'progress', leaves };
         }
      }

      return leaves;
   }

   // ทำลายบล็อกไม้ (รวม item drop)
   *breakLogBlocks(dim, logs, logType) {
      if (!this.isDimensionValid(dim)) return 0;
      let broken = 0,
         batch = 0,
         itemBatch = [];
      const loc = { x: 0, y: 0, z: 0 };
      const air = model.getAir();
      if (!air) return 0;
      for (let i = 0; i < logs.length; i += 3) {
         loc.x = logs[i];
         loc.y = logs[i + 1];
         loc.z = logs[i + 2];
         try {
            const block = dim.getBlock(loc);
            if (block?.isValid && block.typeId === logType) {
               block.setPermutation(air);
               itemBatch.push({ x: loc.x, y: loc.y, z: loc.z });
               if (itemBatch.length >= model.ITEM_BATCH_THRESHOLD) {
                  const stack = new ItemStack(logType, itemBatch.length);
                  const center = itemBatch[Math.floor(itemBatch.length / 2)];
                  dim.spawnItem(stack, center);
                  itemBatch.length = 0;
               }
               broken++;
            }
         } catch (error) {
            console.error('[Axe] Failed to break log block:', error);
         }
         if (++batch >= model.CONFIG.BREAK_PER_TICK) {
            batch = 0;
            yield;
         }
      }
      if (itemBatch.length > 0) {
         const stack = new ItemStack(logType, itemBatch.length);
         const center = itemBatch[Math.floor(itemBatch.length / 2)];
         dim.spawnItem(stack, center);
      }
      return broken;
   }

   // ทำลายใบไม้ + สุ่มแอปเปิล
   *breakLeafBlocks(dim, player, leaves, leafType) {
      if (!this.isDimensionValid(dim)) return 0;
      let broken = 0,
         batch = 0,
         appleBatch = 0;
      const loc = { x: 0, y: 0, z: 0 };
      const air = model.getAir();
      if (!air) return 0;

      for (let i = 0; i < leaves.length; i += 3) {
         if (!player?.isValid) break;
         loc.x = leaves[i];
         loc.y = leaves[i + 1];
         loc.z = leaves[i + 2];
         try {
            const block = dim.getBlock(loc);
            if (block?.isValid && block.typeId === leafType) {
               block.setPermutation(air);
               broken++;
               if (
                  Math.random() < model.CONFIG.APPLE_CHANCE &&
                  appleBatch < model.CONFIG.MAX_APPLES
               ) {
                  appleBatch++;
               }
            }
         } catch (error) {
            console.error('[Axe] Failed to break leaf block:', error);
         }
         if (++batch >= model.CONFIG.LEAF_BREAK_PER_TICK) {
            batch = 0;
            yield;
         }
      }

      if (appleBatch > 0 && player?.isValid) {
         const appleStack = new ItemStack('minecraft:apple', appleBatch);
         dim.spawnItem(appleStack, { x: loc.x, y: loc.y, z: loc.z });
         player.playSound('random.orb', { location: player.location, volume: 0.8, pitch: 1.2 });
      }

      return broken;
   }

   // generator โค่นต้นไม้ทั้งต้น (ลำต้น + ใบไม้)
   *breakTreeJob(player, dim, x, brokenY, z, logType, leafType, axeTypeId) {
      if (!player?.isValid || !this.isDimensionValid(dim)) return;

      const logsBelow = [],
         logsAbove = [],
         allLogs = [];
      try {
         this.scanTrunk(dim, x, brokenY - 1, z, logType, -1, logsBelow);
         this.scanTrunk(dim, x, brokenY + 1, z, logType, 1, logsAbove);
      } catch (error) {
         console.error('[Axe] Trunk scan failed:', error);
         return;
      }

      for (let i = 0; i < logsAbove.length; i++) allLogs.push(logsAbove[i]);
      for (let i = 0; i < logsBelow.length; i++) allLogs.push(logsBelow[i]);
      yield;

      if (!player?.isValid || !this.isDimensionValid(dim)) return;

      let leaves = [];
      try {
         const leafGen = this.scanLeaves(dim, player, allLogs, x, brokenY, z, leafType);
         let result = leafGen.next();
         while (!result.done) {
            if (result.value?.type === 'progress') leaves = result.value.leaves;
            if (!player?.isValid) return;
            yield;
            result = leafGen.next();
         }
         leaves = result.value || [];
      } catch (error) {
         console.error('[Axe] Leaf scan failed:', error);
         return;
      }

      if (!leaves.length || !player?.isValid) return;

      const brokenLogs = yield* this.breakLogBlocks(dim, allLogs, logType);
      yield* this.breakLeafBlocks(dim, player, leaves, leafType);

      if (!player?.isValid) return;

      const dmg = brokenLogs;
      if (dmg > 0 && player?.isValid) this.applyToolDamage(player, dmg, axeTypeId);
   }

   // เลือก job แบบ fair (สลับผู้เล่น)
   findFairJob = () => {
      if (model.jobQueue.length === 0) return null;

      if (model.jobQueue.length === 1 || !model.lastScheduledPlayerId) {
         return model.jobQueue.shift();
      }

      for (let i = 0; i < model.jobQueue.length; i++) {
         if (model.jobQueue[i].player.id !== model.lastScheduledPlayerId) {
            const job = model.jobQueue[i];
            model.jobQueue[i] = model.jobQueue[model.jobQueue.length - 1];
            model.jobQueue.pop();
            return job;
         }
      }

      return model.jobQueue.shift();
   };

   //  scheduler รัน job โค่นไม้ตามลำดับ
   scheduleJobs = () => {
      model.schedulerPending = false;
      while (model.activeJobs < model.CONFIG.MAX_CONCURRENT_JOBS && model.jobQueue.length > 0) {
         const job = this.findFairJob();
         if (!job) break;

         model.activeJobs++;
         model.lastScheduledPlayerId = job.player.id;
         system.runJob(
            function* (j) {
               const playerId = j.player.id;
               try {
                  yield* this.breakTreeJob(
                     j.player,
                     j.dim,
                     j.x,
                     j.brokenY,
                     j.z,
                     j.logType,
                     j.leafType,
                     j.axeTypeId,
                  );
               } finally {
                  model.activeJobs--;
                  this.adjustPlayerJobCount(playerId, -1);
                  if (model.jobQueue.length > 0 && !model.schedulerPending) {
                     model.schedulerPending = true;
                     system.run(() => this.scheduleJobs());
                  }
               }
            }.call(this, job),
         );
      }
   };

   // เพิ่ม tree job เข้า queue
   enqueueTreeJob = (player, dim, x, brokenY, z, logType, leafType, axeTypeId) => {
      if (model.jobQueue.length >= model.CONFIG.MAX_QUEUE_SIZE) return false;
      const pjc = model.playerJobCount.get(player.id) ?? 0;
      if (pjc >= model.CONFIG.MAX_JOBS_PER_PLAYER) return false;

      const now = system.currentTick;
      const lastEnqueue = model.lastEnqueueTick.get(player.id) ?? -model.CONFIG.COOLDOWN_TICKS;
      if (now - lastEnqueue < model.CONFIG.COOLDOWN_TICKS) return false;
      model.lastEnqueueTick.set(player.id, now);

      model.jobQueue.push({ player, dim, x, brokenY, z, logType, leafType, axeTypeId });
      this.adjustPlayerJobCount(player.id, 1);
      this.scheduleJobs();
      return true;
   };

   // รับ evento แตกบล็อก ถ้าเป็นขวาน + ไม้ ให้โค่นทั้งต้น
   onPlayerBreakBlock = (ev) => {
      const player = ev?.player;
      if (!player?.isValid) return;
      const item = this.getHeldItem(player);
      if (!item || !model.AXE_SET.has(item.typeId)) return;
      const logType = ev.brokenBlockPermutation?.type?.id;
      if (!logType || !model.LOG_SET.has(logType)) return;
      if (!this.checkCooldown(player.id)) return;
      if (!ev.block?.isValid) return;

      const leafType = model.WOOD_MAP[logType];
      const dim = ev.block.dimension;
      const { x, y: brokenY, z } = ev.block.location;

      this.enqueueTreeJob(player, dim, x, brokenY, z, logType, leafType, item.typeId);
   };
}

export default new Service();

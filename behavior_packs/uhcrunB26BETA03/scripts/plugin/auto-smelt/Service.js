import { ItemStack, system } from '@minecraft/server';
import { dynamicToast, getPlayerInventoryContainer, isValidEntity, randomInt } from '../Util.js';
import Model from './Model.js';

const formatHealth = (val) => val.toFixed(1);

// ตรวจสอบว่าเครื่องมือที่ถือตรงกับ action รึเปล่า (shovel สำหรับ gravel, pickaxe สำหรับ smelt ฯลฯ)
export const isValidTool = (tool, action) => {
   if (action === Model.ACTION.GRAVEL) return Model.SHOVELS.has(tool);
   if (action === Model.ACTION.EFFECT) return true;
   return Model.PICKAXES.has(tool);
};

// spawn ไอเทมแบบกองซ้อนกัน 64 ชิ้นต่อ stack เผื่อจำนวนเยอะ
const spawnStacked = (dimension, typeId, amount, pos, loreFn) => {
   let remaining = Math.max(1, amount);
   while (remaining > 0) {
      const count = Math.min(remaining, 64);
      const stack = new ItemStack(typeId, count);
      if (loreFn) loreFn(stack);
      dimension.spawnItem(stack, pos);
      remaining -= count;
   }
};

const safeStack = (typeId, amount) => new ItemStack(typeId, Math.max(1, Math.min(amount, 64)));

const spawnLoc = (loc) => ({
   x: Math.floor(loc.x) + 0.5,
   y: loc.y + 0.5,
   z: Math.floor(loc.z) + 0.5,
});

class Service {
   // อ่านเครื่องมือที่ player ถืออยู่ ใช้ cache 1 tick ป้องกันอ่านซ้ำ
   getCachedTool = (player) => {
      const playerId = player.id;
      if (!playerId) return null;

      const currentTick = system.currentTick;
      const cached = Model.toolCache.get(playerId);
      if (cached && cached.tick === currentTick) return cached.tool;

      let tool = null;

      const inv = getPlayerInventoryContainer(player);
      tool = inv ? (inv.getItem(player.selectedSlotIndex)?.typeId ?? null) : null;

      Model.toolCache.set(playerId, { tool, tick: currentTick });
      return tool;
   };

   // เพิ่ม XP ให้ player (ถ้า entity ยัง valid)
   addXp = (player, amount) => {
      if (amount > 0 && isValidEntity(player)) player.addExperience(amount);
   };

   // แปลง item entity ที่ตกอยู่ตาม itemData -> smelt / xp / special
   processItem = (entity, action, player, dimension) => {
      if (!isValidEntity(entity)) return { xp: 0, lapis: null };

      const stack = entity.getComponent('minecraft:item')?.itemStack;
      if (!stack) return { xp: 0, lapis: null };

      const itemData = Model.ITEM_TABLE[stack.typeId];
      if (!itemData) return { xp: 0, lapis: null };

      const spawnAt = entity.location;

      switch (itemData.type) {
         case 'special':
            switch (itemData.handler) {
               case 'flint':
                  spawnStacked(dimension, 'minecraft:arrow', stack.amount, spawnAt);
                  entity.remove();
                  player.sendMessage(
                     dynamicToast(
                        Model.CONFIG.feedback.arrow.message,
                        Model.CONFIG.feedback.arrow.texture,
                     ),
                  );
                  return { xp: 0, lapis: null };

               case 'lapis':
                  if (action === Model.ACTION.LAPIS) {
                     const lore = stack.getLore?.();
                     if (!lore?.length) {
                        const lapis = { total: stack.amount, position: spawnAt };
                        entity.remove();
                        return { xp: 0, lapis };
                     }
                  }
                  return { xp: 0, lapis: null };

               default:
                  return { xp: 0, lapis: null };
            }

         case 'xp': {
            const xp = randomInt(itemData.range[0], itemData.range[1]) * stack.amount;
            entity.remove();
            return { xp, lapis: null };
         }

         case 'smelt': {
            spawnStacked(dimension, itemData.result, stack.amount, spawnAt);
            const xp = randomInt(itemData.xp[0], itemData.xp[1]) * stack.amount;
            entity.remove();
            return { xp, lapis: null };
         }

         case 'redstone':
            if (action === Model.ACTION.REDSTONE) entity.remove();
            return { xp: 0, lapis: null };

         default:
            return { xp: 0, lapis: null };
      }
   };

   // อ่านระดับ enchant จากเครื่องมือที่ player ถือ
   getEnchantLevel = (player, enchantId) => {
      if (!player?.isValid) return 0;
      const inv = getPlayerInventoryContainer(player);
      const tool = inv?.getItem(player.selectedSlotIndex);
      if (!tool) return 0;
      const enchantable = tool.getComponent('minecraft:enchantable');
      if (!enchantable) return 0;
      try {
         for (const ench of enchantable.getEnchantments()) {
            if (ench.type.id === enchantId) return ench.level;
         }
      } catch (error) {
         console.error('[AutoSmelt] Failed to get enchantment level:', error);
      }
      return 0;
   };

   // สุ่ม Haste II 5s เมื่อแตก diamond / obsidian
   handlePremiumBlockEffect = (player) => {
      if (!isValidEntity(player)) return;
      if (randomInt(0, 99) >= Model.CONFIG.chance.premiumBlock) return;

      player.addEffect('haste', 100, { amplifier: 1, showParticles: false });
      player.onScreenDisplay.setActionBar('§bMining Boost II (5s)');
      player.playSound(Model.CONFIG.sounds.level, Model.SOUND_OPTIONS.level);
   };

   // สุ่ม book เมื่อขุด lapis + fortune, spawn lapis ปกติ 1 ก้อน
   spawnLapisRewards = (player, dimension, lapisData) => {
      if (!lapisData.total) return;

      const pos = lapisData.position;

      const fortune = this.getEnchantLevel(player, 'fortune');
      const baseChance = Model.CONFIG.chance.lapisBook;
      const finalChance = baseChance + fortune * 4;

      if (randomInt(0, 99) < finalChance) {
         dimension.spawnItem(safeStack('minecraft:book', 1), pos);
         if (system.currentTick % 2 === 0) {
            player.sendMessage(
               dynamicToast(Model.CONFIG.feedback.book.message, Model.CONFIG.feedback.book.texture),
            );
         }
      }

      spawnStacked(dimension, 'minecraft:lapis_lazuli', 1, pos, (s) => s.setLore(['§7uhc']));
   };

   // รวม job ภายใน dim เดียวกัน รัน flush ทีหลัง 2 ticks ลดภาระ
   scheduleBatch = (player, location, action, dimension) => {
      const dimId = dimension.id;
      if (!Model.pendingJobs.has(dimId)) Model.pendingJobs.set(dimId, []);
      Model.pendingJobs.get(dimId).push({ player, location, action, dimension });

      if (Model.scheduledDims.has(dimId)) return;
      Model.scheduledDims.add(dimId);

      system.runTimeout(() => {
         Model.scheduledDims.delete(dimId);
         const jobs = Model.pendingJobs.get(dimId);
         Model.pendingJobs.delete(dimId);
         if (jobs) this.flushBatch(jobs);
      }, 2);
   };

   // scan item entities ใกล้เคียงตามตำแหน่งที่ขุด แล้ว processItem
   flushBatch = (jobs) => {
      if (!jobs.length) return;

      const claimed = new Set();
      const center = { x: 0, y: 0, z: 0 };

      const { dimension } = jobs[0];

      if (jobs.length === 1) {
         const job = jobs[0];
         if (!isValidEntity(job.player)) return;
         center.x = job.location.x;
         center.y = job.location.y;
         center.z = job.location.z;
         let entities;
         try {
            entities = dimension.getEntities({
               type: 'minecraft:item',
               location: center,
               maxDistance: Model.CONFIG.scan.itemRadius,
            });
         } catch (error) {
            console.error('[AutoSmelt] Failed to get nearby entities:', error);
            return;
         }
         if (!entities.length) return;
         claimed.clear();
         let totalXp = 0,
            lapisTotal = 0,
            lapisPosition = job.location;
         for (let ei = 0, eLen = entities.length; ei < eLen; ei++) {
            const entity = entities[ei];
            if (!isValidEntity(entity)) continue;
            claimed.add(entity.id);
            const result = this.processItem(entity, job.action, job.player, dimension);
            totalXp += result.xp;
            if (result.lapis) {
               lapisTotal += result.lapis.total;
               lapisPosition = result.lapis.position;
            }
         }
         this.spawnLapisRewards(job.player, dimension, {
            total: lapisTotal,
            position: lapisPosition,
         });
         this.addXp(job.player, totalXp);
         return;
      }

      // หา bounding box จากหลาย job เพื่อ scan ครั้งเดียว
      let minX = Infinity,
         minY = Infinity,
         minZ = Infinity;
      let maxX = -Infinity,
         maxY = -Infinity,
         maxZ = -Infinity;
      for (let ji = 0, jLen = jobs.length; ji < jLen; ji++) {
         const { x, y, z } = jobs[ji].location;
         if (x < minX) minX = x;
         if (x > maxX) maxX = x;
         if (y < minY) minY = y;
         if (y > maxY) maxY = y;
         if (z < minZ) minZ = z;
         if (z > maxZ) maxZ = z;
      }

      center.x = (minX + maxX) / 2;
      center.y = (minY + maxY) / 2;
      center.z = (minZ + maxZ) / 2;
      const hx = (maxX - minX) / 2,
         hy = (maxY - minY) / 2,
         hz = (maxZ - minZ) / 2;
      const halfDiag = Math.sqrt(hx * hx + hy * hy + hz * hz) + Model.CONFIG.scan.itemRadius;

      let allEntities;
      try {
         allEntities = dimension.getEntities({
            type: 'minecraft:item',
            location: center,
            maxDistance: halfDiag,
         });
      } catch (error) {
         console.error('[AutoSmelt] Failed to get all entities:', error);
         return;
      }

      if (!allEntities.length) return;

      claimed.clear();

      for (let ji = 0, jLen = jobs.length; ji < jLen; ji++) {
         const job = jobs[ji];
         if (!isValidEntity(job.player)) continue;

         let totalXp = 0;
         let lapisTotal = 0;
         let lapisPosition = job.location;

         for (let ei = 0, eLen = allEntities.length; ei < eLen; ei++) {
            const entity = allEntities[ei];
            if (claimed.has(entity.id)) continue;
            if (!isValidEntity(entity)) continue;

            const el = entity.location;
            const dx = el.x - job.location.x,
               dy = el.y - job.location.y,
               dz = el.z - job.location.z;
            if (dx * dx + dy * dy + dz * dz > Model._r2) continue;

            claimed.add(entity.id);
            const result = this.processItem(entity, job.action, job.player, dimension);
            totalXp += result.xp;
            if (result.lapis) {
               lapisTotal += result.lapis.total;
               lapisPosition = result.lapis.position;
            }
         }

         this.spawnLapisRewards(job.player, dimension, {
            total: lapisTotal,
            position: lapisPosition,
         });
         this.addXp(job.player, totalXp);
      }
   };

   // ฮีล player 2 ครึ่งหัว
   healPlayer = (player) => {
      if (!isValidEntity(player)) return;

      const health = player.getComponent('minecraft:health');
      if (!health) return;

      const current = health.currentValue;
      const max = health.effectiveMax;
      if (current >= max) return;

      const newHealth = Math.min(max, current + Model.CONFIG.redstone.healAmount);
      health.setCurrentValue(newHealth);
      player.sendMessage(
         dynamicToast(
            `§a+${formatHealth(newHealth - current)} §7(${formatHealth(newHealth)})`,
            Model.CONFIG.feedback.health.texture,
         ),
      );
   };

   // สุ่ม Absorption 16% นานตาม config
   tryAbsorption = (player) => {
      if (!isValidEntity(player)) return false;
      if (randomInt(0, 99) >= Model.CONFIG.chance.absorption) return false;

      player.addEffect('absorption', Model.CONFIG.redstone.absorptionDuration, {
         amplifier: 0,
         showParticles: false,
      });
      player.sendMessage(
         dynamicToast(
            `§fAbsorption §7(${Model.CONFIG.redstone.absorptionMinutes}m)`,
            Model.CONFIG.feedback.absorption.texture,
         ),
      );
      player.playSound(Model.CONFIG.sounds.level, Model.SOUND_OPTIONS.level);
      return true;
   };

   // ดำเนินการ redstone: XP + ฮีล + สุ่ม absorption
   handleRedstone = (player) => {
      this.addXp(player, randomInt(Model.CONFIG.xp.redstone[0], Model.CONFIG.xp.redstone[1]));
      this.healPlayer(player);
      if (!this.tryAbsorption(player))
         player.playSound(Model.CONFIG.sounds.orb, Model.SOUND_OPTIONS.orb);
   };

   // จุดเริ่มต้น action ตามประเภทบล็อก
   executeAction = (player, location, action, dimension) => {
      player.playSound(Model.CONFIG.sounds.orb, Model.SOUND_OPTIONS.effect);

      if (action === Model.ACTION.REDSTONE) {
         this.handleRedstone(player);
      }

      if (action === Model.ACTION.EFFECT) {
         this.handlePremiumBlockEffect(player);
         return;
      }

      this.scheduleBatch(player, spawnLoc(location), action, dimension);
   };
}

export default new Service();

import { BlockPermutation } from '@minecraft/server';

import { BLOCK_CATEGORIES, MODE } from './BlockFiller_Constants.js';

//อรรถประโยชน์สำหรับ BlockFiller: PRNG, resolve บล็อก, แบ่ง bounds, cache
class BlockFillerUtility {
   // instance fields สำหรับเข้าถึงจากภายนอกผ่าน util.X
   WORLD_MIN_Y = -64;
   WORLD_MAX_Y = 319;
   BATCH_SIZE_NORMAL = 120;
   BATCH_SIZE_ENDGAME = 400;
   FILL_INTERVAL_TICKS = 1;
   TASK_QUEUE_HARD_CAP = 8000;
   MAX_PENDING_BLOCKS = 80000;
   MAX_BLOCKS_PER_TASK = 250_000;
   COMPACT_THRESHOLD = 256;
   UPWARD_Y = 1;
   DOWNWARD_Y = -1;
   RETRY_QUEUE_LIMIT = 4000;
   RETRY_BASE_DELAY_TICKS = 12;
   MAX_CACHE_SIZE = 256;

   CATEGORY_MAP = new Map();
   PERM_CACHE = new Map();
   AIR;
   seed = (Math.random() * 0xffffffff) >>> 0;
   lastRandomIndex = -1;

   constructor() {
      if (this.seed === 0) this.seed = 1;
   }

   // แก้ block id เป็น BlockPermutation (cache ผลลัพธ์)
   resolveBlock(id) {
      if (this.PERM_CACHE.has(id)) return this.PERM_CACHE.get(id);

      if (this.PERM_CACHE.size >= this.MAX_CACHE_SIZE) {
         const firstKey = this.PERM_CACHE.keys().next().value;
         this.PERM_CACHE.delete(firstKey);
      }

      const perm = BlockPermutation.resolve(id);

      this.PERM_CACHE.set(id, perm);

      return perm;
   }

   // เตรียม permutations สำหรับแต่ละ mode
   initPermutations() {
      if (this.AIR) return;

      this.AIR = this.resolveBlock('minecraft:air');
      const categorySources = [[MODE.NETHER, BLOCK_CATEGORIES.nether]];

      for (let i = 0; i < categorySources.length; i++) {
         const [mode, blockIds] = categorySources[i];
         const permutations = [];

         for (let j = 0; j < blockIds.length; j++) {
            try {
               const perm = this.resolveBlock(blockIds[j]);
               if (perm) permutations.push(perm);
      } catch (error) {
         // ข้าม block id ที่ใช้ไม่ได้
      }
         }

         if (permutations.length === 0) {
            permutations.push(this.AIR);
         }

         this.CATEGORY_MAP.set(mode, permutations);
      }
   }

   // PRNG แบบเร็ว (xorshift variant)
   fastRandomInt(max) {
      this.seed |= 0;
      this.seed = (this.seed + 0x6d2b79f5) | 0;
      let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      const result = (t ^ (t >>> 14)) >>> 0;
      return result % max;
   }

   // สุ่มบล็อกจาก category
   randomBlock(mode) {
      const permutations = this.CATEGORY_MAP.get(mode);
      if (!permutations || permutations.length === 0) return this.AIR;

      let index;

      do {
         index = this.fastRandomInt(permutations.length);
      } while (index === this.lastRandomIndex && permutations.length > 1);

      this.lastRandomIndex = index;
      return permutations[index] ?? this.AIR;
   }

   // สร้างฟังก์ชัน resolve บล็อกตาม mode
   createBlockResolver(mode, fillOptions = {}) {
      if (fillOptions.blockId) {
         const fixedPermutation = this.resolveBlock(fillOptions.blockId);
         return () => fixedPermutation;
      }

      switch (mode) {
         case MODE.CLEAR:
            return () => this.AIR;
         case MODE.NETHER:
            return () => this.randomBlock(mode);
         default: {
            if (fillOptions.randomize) return () => this.randomBlock(mode);
            const staticPermutation = this.CATEGORY_MAP.get(mode)?.[0] ?? this.AIR;
            return () => staticPermutation;
         }
      }
   }

   reseedRandom() {
      this.seed ^= (Math.random() * 0xffffffff) >>> 0;
   }

   // คำนวณขอบเขตจากพิกัด 2 จุด
   calculateBounds(x1, y1, z1, x2, y2, z2) {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minZ = Math.min(z1, z2);
      const maxZ = Math.max(z1, z2);
      const minY = Math.max(this.WORLD_MIN_Y, Math.min(y1, y2));
      const maxY = Math.min(this.WORLD_MAX_Y, Math.max(y1, y2));

      if (minX < -30000000 || maxX > 30000000 || minZ < -30000000 || maxZ > 30000000) {
         return null;
      }
      return { minX, maxX, minY, maxY, minZ, maxZ };
   }

   // คำนวณจำนวนบล็อกจาก bounds
   calculateBlockCount(bounds) {
      return (
         (bounds.maxX - bounds.minX + 1) *
         (bounds.maxZ - bounds.minZ + 1) *
         (bounds.maxY - bounds.minY + 1)
      );
   }

   // แบ่ง bounds ออกเป็น 2 ส่วน (แบ่งแกนที่ยาวที่สุด)
   splitBounds(bounds, stack, yDirection = this.UPWARD_Y) {
      const sizeX = bounds.maxX - bounds.minX;
      const sizeY = bounds.maxY - bounds.minY;
      const sizeZ = bounds.maxZ - bounds.minZ;

      if (sizeX >= sizeY && sizeX >= sizeZ) {
         const mid = (bounds.minX + bounds.maxX) >> 1;
         stack.push({
            minX: bounds.minX,
            maxX: mid,
            minY: bounds.minY,
            maxY: bounds.maxY,
            minZ: bounds.minZ,
            maxZ: bounds.maxZ,
         });
         stack.push({
            minX: mid + 1,
            maxX: bounds.maxX,
            minY: bounds.minY,
            maxY: bounds.maxY,
            minZ: bounds.minZ,
            maxZ: bounds.maxZ,
         });
         return;
      }

      if (sizeZ >= sizeY) {
         const mid = (bounds.minZ + bounds.maxZ) >> 1;
         stack.push({
            minX: bounds.minX,
            maxX: bounds.maxX,
            minY: bounds.minY,
            maxY: bounds.maxY,
            minZ: bounds.minZ,
            maxZ: mid,
         });
         stack.push({
            minX: bounds.minX,
            maxX: bounds.maxX,
            minY: bounds.minY,
            maxY: bounds.maxY,
            minZ: mid + 1,
            maxZ: bounds.maxZ,
         });
         return;
      }

      const mid = (bounds.minY + bounds.maxY) >> 1;
      const lower = {
         minX: bounds.minX,
         maxX: bounds.maxX,
         minY: bounds.minY,
         maxY: mid,
         minZ: bounds.minZ,
         maxZ: bounds.maxZ,
      };
      const upper = {
         minX: bounds.minX,
         maxX: bounds.maxX,
         minY: mid + 1,
         maxY: bounds.maxY,
         minZ: bounds.minZ,
         maxZ: bounds.maxZ,
      };

      if (yDirection === this.DOWNWARD_Y) {
         stack.push(lower);
         stack.push(upper);
      } else {
         stack.push(upper);
         stack.push(lower);
      }
   }

   resetUtilState() {
      this.lastRandomIndex = -1;
   }
}

export default new BlockFillerUtility();

import { MolangVariableMap } from '@minecraft/server';
import { ctx } from './BorderManager.js';

const BORDER_RENDER = Object.freeze({
   VIEW_DISTANCE: 35,
   PARTICLE_Y: 100,
});

const worldborder_ew = 'worldborder:worldborder_ew';
const worldborder = 'worldborder:worldborder';

const GROUPS_POOL_CAP = 54;
const GROUPS_RENDER_CAP = 24;
const CELL_SIZE = 16;
const CELL_OFFSET = 32;
const CELL_RANGE = 64;

//เรนเดอร์อนุภาค border แบบ optimize: group ผู้เล่นตาม cell, spawn เฉพาะใกล้กล้อง
class BorderManagerParticle {
   groupMaps = new Map();
   groupsPool = [];
   spawnedThisTick = new Set();
   sharedPos = { x: 0, y: BORDER_RENDER.PARTICLE_Y, z: 0 };
   groupsLen = 0;
   renderTickCounter = 0;
   cachedMolang = null;

   // สร้าง MolangVariableMap พร้อมสีและขนาด border (cache ถ้าไม่เปลี่ยน)
   particleRendererGetMolang(width = 8) {
      const key = `${ctx.currentBorderColor.red},${ctx.currentBorderColor.green},${ctx.currentBorderColor.blue},${width}`;
      if (this.cachedMolang?.key === key) return this.cachedMolang.varMap;

      const molang = new MolangVariableMap();
      molang.setColorRGBA('variable.color', ctx.currentBorderColor);
      molang.setFloat('variable.size', width);
      this.cachedMolang = { key, varMap: molang };
      return molang;
   }

   // จัดกลุ่มผู้เล่นตามตำแหน่ง grid (cell) เพื่อลดจำนวนการวนซ้ำ
   particleRendererGroupByCell(players) {
      this.groupMaps.clear();
      this.groupsLen = 0;

      const size = CELL_SIZE;
      const offset = CELL_OFFSET;
      const range = CELL_RANGE;

      for (let i = 0, len = players.length; i < len; i++) {
         const player = players[i];
         if (!player || !player.isValid) continue;

         const loc = player.location;
         if (!loc) continue;

         const cellX = (loc.x / size) | 0;
         const cellZ = (loc.z / size) | 0;

         const key = (cellX + offset) * range + (cellZ + offset);

         if (this.groupMaps.has(key)) continue;
         if (this.groupsLen >= GROUPS_POOL_CAP) continue;

         let group = this.groupsPool[this.groupsLen];

         if (!group) {
            group = { cellX: 0, cellZ: 0, rep: null };
            this.groupsPool[this.groupsLen] = group;
         }

         group.cellX = cellX;
         group.cellZ = cellZ;
         group.rep = player;

         this.groupMaps.set(key, group);
         this.groupsLen++;
      }

      if (this.groupsPool.length > GROUPS_POOL_CAP) {
         this.groupsPool.length = GROUPS_POOL_CAP;
      }
   }

   // spawn อนุภาคแบบปลอดภัย ไม่ให้ crash
   particleRendererSafeSpawn(dim, particleId, location, molang) {
      try {
         dim.spawnParticle(particleId, location, molang);
      } catch (error) {
         // ป้องกัน crash ถ้า spawn อนุภาคล้มเหลว
      }
   }

   // เรนเดอร์ขอบ border ด้านเดียว (edge)
   particleRendererRenderEdge(dim, fixed, rangeMin, rangeMax, playerCoord, view, step, axis, particleId, molang) {
      if (playerCoord < fixed - view || playerCoord > fixed + view) return;

      let value = rangeMin - (rangeMin % step);
      if (value < rangeMin) value += step;

      const spawned = this.spawnedThisTick;
      const pos = this.sharedPos;

      const isX = axis === 0;

      const fixedMasked = (fixed & 0x7fff) << 15;
      const axisShift = axis << 30;
      const mask = 0x7fff;

      for (; value <= rangeMax; value += step) {
         const key = axisShift | fixedMasked | (value & mask);

         if (spawned.has(key)) continue;
         spawned.add(key);

         if (isX) {
            pos.x = fixed;
            pos.z = value;
         } else {
            pos.x = value;
            pos.z = fixed;
         }

         try {
            dim.spawnParticle(particleId, pos, molang);
         } catch (error) {}
      }
   }

   // เรนเดอร์อนุภาครอบ AABB border สำหรับผู้เล่นทุกกลุ่ม
   particleRendererRenderBorderAABB(dim, step, molang) {
      if (!dim || !this.groupsLen || !ctx.wbBounds) return;
      const [east, west, north, south] = ctx.wbBounds,
         view = BORDER_RENDER.VIEW_DISTANCE;
      this.spawnedThisTick.clear();

      // กระจายเรนเดอร์แต่ละ tick เพื่อลดภาระต่อรอบ
      const limit = Math.min(this.groupsLen, GROUPS_RENDER_CAP);
      const offset = this.renderTickCounter % Math.max(1, limit);

      for (let i = offset; i < limit; i++) {
         const rep = this.groupsPool[i].rep;
         if (!rep?.isValid) continue;
         const loc = rep.location;
         if (!loc) continue;
         const px = loc.x,
            pz = loc.z,
            minX = px - view,
            maxX = px + view,
            minZ = pz - view,
            maxZ = pz + view;
         if (px > east - view) this.particleRendererRenderEdge(dim, east, Math.max(north, minZ), Math.min(south, maxZ), px, view, step, 0, worldborder, molang);
         if (px < west + view) this.particleRendererRenderEdge(dim, west, Math.max(north, minZ), Math.min(south, maxZ), px, view, step, 0, worldborder, molang);
         if (pz < north + view) this.particleRendererRenderEdge(dim, north, Math.max(west, minX), Math.min(east, maxX), pz, view, step, 1, worldborder_ew, molang);
         if (pz > south - view) this.particleRendererRenderEdge(dim, south, Math.max(west, minX), Math.min(east, maxX), pz, view, step, 1, worldborder_ew, molang);
      }
   }

   // เรนเดอร์กรณี border เล็ก (< 100)
   particleRendererRenderSmall(dim) {
      const radius = ctx.borderRadius;
      const molang = this.particleRendererGetMolang(radius);

      const pos = this.sharedPos;
      pos.y = BORDER_RENDER.PARTICLE_Y;

      try {
         pos.x = radius;
         pos.z = 0;
         dim.spawnParticle(worldborder, pos, molang);

         pos.x = -radius;
         dim.spawnParticle(worldborder, pos, molang);

         pos.x = 0;
         pos.z = radius;
         dim.spawnParticle(worldborder_ew, pos, molang);

         pos.z = -radius;
         dim.spawnParticle(worldborder_ew, pos, molang);
      } catch (error) {
         // ป้องกัน crash ถ้าเล็กเกินไป
      }
   }

   // main render tick เรียกทุก 4 ticks
   particleRendererTick(players) {
      if (!ctx.isRunning || !ctx.borderReady || !ctx.wbBounds) return;
      if (ctx.uhcTick % 4 !== 0) return;
      this.particleRendererGroupByCell(players);
      if (!this.groupsLen) return;

      let dim = null;
      for (let i = 0; i < this.groupsLen; i++) {
         const rep = this.groupsPool[i].rep;
         if (rep?.isValid) {
            dim = rep.dimension;
            break;
         }
      }
      if (!dim) return;

      this.renderTickCounter++;

      if (ctx.borderRadius < 100) {
         this.particleRendererRenderSmall(dim);
         return;
      }
      this.particleRendererRenderBorderAABB(dim, 16, this.particleRendererGetMolang(8));
   }
}

export default new BorderManagerParticle();

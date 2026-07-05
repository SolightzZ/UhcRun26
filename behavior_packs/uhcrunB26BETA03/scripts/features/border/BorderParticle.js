import { MolangVariableMap } from '@minecraft/server';
import { logError } from '../../shared/Util.js';
import { ctx } from './BorderState.js';

const BORDER_RENDER = Object.freeze({
   VIEW_DISTANCE: 35, // ค่าพื้นฐาน — ลดลงโดยอัตโนมัติเมื่อมีผู้เล่นออนไลน์จำนวนมาก
   PARTICLE_Y: 100,
});

const ADAPTIVE = Object.freeze({
   PLAYER_HIGH: 20,
   VIEW_MIN: 15,
});

const worldborder_ew = 'worldborder:worldborder_ew';
const worldborder = 'worldborder:worldborder';

const GROUPS_POOL_CAP = 54;
const CELL_SIZE = 16;
const CELL_OFFSET = 32;
const CELL_RANGE = 64;

class BorderManagerParticle {
   groupMaps = new Map();
   groupsPool = [];
   sharedPos = { x: 0, y: BORDER_RENDER.PARTICLE_Y, z: 0 };
   groupsLen = 0;
   renderTickCounter = 0;
   cachedMolang = null;
   _playerCount = 0;

   getAdaptiveView() {
      if (this._playerCount < ADAPTIVE.PLAYER_HIGH) return BORDER_RENDER.VIEW_DISTANCE;
      const reduction = Math.min(BORDER_RENDER.VIEW_DISTANCE - ADAPTIVE.VIEW_MIN, Math.floor((this._playerCount - ADAPTIVE.PLAYER_HIGH) / 3) * 3);
      return BORDER_RENDER.VIEW_DISTANCE - reduction;
   }

   particleRendererGetMolang(width = 8) {
      const key = `${ctx.currentBorderColor.red},${ctx.currentBorderColor.green},${ctx.currentBorderColor.blue},${width}`;
      if (this.cachedMolang?.key === key) return this.cachedMolang.varMap;

      const molang = new MolangVariableMap();
      molang.setColorRGBA('variable.color', ctx.currentBorderColor);
      molang.setFloat('variable.size', width);
      this.cachedMolang = { key, varMap: molang };
      return molang;
   }

   // จัดกลุ่มผู้เล่นตามเซลล์กริดเพื่อลดรอบการวนลูปประมวลผล
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

   particleRendererRenderBorderAABB(dim, molang, view) {
      if (!dim || !this.groupsLen || !ctx.wbBounds) return;
      const [east, west, north, south] = ctx.wbBounds;
      const pos = this.sharedPos;
      pos.y = BORDER_RENDER.PARTICLE_Y;

      const limit = Math.min(this.groupsLen, 24);
      const offset = this.renderTickCounter % Math.max(1, limit);

      for (let j = 0; j < limit; j++) {
         const i = (offset + j) % this.groupsLen;
         const rep = this.groupsPool[i].rep;
         if (!rep?.isValid) continue;
         const loc = rep.location;
         if (!loc) continue;
         const px = loc.x,
            pz = loc.z;

         try {
            if (px > east - view) {
               pos.x = east;
               pos.z = Math.max(north, Math.min(south, pz));
               dim.spawnParticle(worldborder, pos, molang);
            }
            if (px < west + view) {
               pos.x = west;
               pos.z = Math.max(north, Math.min(south, pz));
               dim.spawnParticle(worldborder, pos, molang);
            }
            if (pz < north + view) {
               pos.x = Math.max(west, Math.min(east, px));
               pos.z = north;
               dim.spawnParticle(worldborder_ew, pos, molang);
            }
            if (pz > south - view) {
               pos.x = Math.max(west, Math.min(east, px));
               pos.z = south;
               dim.spawnParticle(worldborder_ew, pos, molang);
            }
         } catch (e) {
            logError('BorderParticle', 'spawnParticle failed', e);
         }
      }
   }

   // ขอบเขตขนาดเล็ก (<100) ยังคงสร้างจุดแสดงผล 4 จุด
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
         logError('BorderParticle', 'Render small failed', error);
      }
   }

   particleRendererTick(players) {
      if (!ctx.isRunning || !ctx.borderReady || !ctx.wbBounds) return;
      if (ctx.uhcTick % 4 !== 0) return;

      this._playerCount = players.length;

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

      const view = this.getAdaptiveView();
      this.particleRendererRenderBorderAABB(dim, this.particleRendererGetMolang(8), view);
   }
}

const _particleInstance = new BorderManagerParticle();
export default _particleInstance;

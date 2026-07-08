import { MolangVariableMap } from '@minecraft/server';
import { logWarn } from '../../shared/Util.js';
import { ctx } from './BorderState.js';

const BORDER_RENDER = Object.freeze({
   VIEW_DISTANCE: 25,
   PARTICLE_Y: 100,
});

const ADAPTIVE = Object.freeze({
   PLAYER_HIGH: 20,
   VIEW_MIN: 10,
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

   particleRendererGetMolang(width = 32) {
      const key = `${ctx.currentBorderColor.red},${ctx.currentBorderColor.green},${ctx.currentBorderColor.blue},${width}`;
      if (this.cachedMolang?.key === key) return this.cachedMolang.varMap;

      const molang = new MolangVariableMap();
      molang.setColorRGBA('variable.color', ctx.currentBorderColor);
      molang.setFloat('variable.size', width);
      this.cachedMolang = { key, varMap: molang };
      return molang;
   }

   particleRendererGroupByCell(players) {
      this.groupMaps.clear();
      this.groupsLen = 0;

      for (let i = 0, len = players.length; i < len; i++) {
         const player = players[i];
         if (!player || !player.isValid) continue;

         const loc = player.location;
         if (!loc) continue;

         const cellX = (loc.x / CELL_SIZE) | 0;
         const cellZ = (loc.z / CELL_SIZE) | 0;

         const key = (cellX + CELL_OFFSET) * CELL_RANGE + (cellZ + CELL_OFFSET);

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

   particleRendererRenderBorder(dim) {
      if (!dim || !ctx.wbBounds) return;

      const [east, west, north, south] = ctx.wbBounds;
      const pos = this.sharedPos;
      pos.y = BORDER_RENDER.PARTICLE_Y;

      if (ctx.borderRadius <= 100) {
         const wallLen = south - north;
         const molang = this.particleRendererGetMolang(wallLen / 2);
         const zMid = (south + north) / 2;
         const xMid = (east + west) / 2;
         try {
            pos.x = east;
            pos.z = zMid;
            dim.spawnParticle(worldborder, pos, molang);
            pos.x = west;
            dim.spawnParticle(worldborder, pos, molang);
            pos.z = north;
            pos.x = xMid;
            dim.spawnParticle(worldborder_ew, pos, molang);
            pos.z = south;
            dim.spawnParticle(worldborder_ew, pos, molang);
         } catch (e) {
            logWarn('BorderParticle', 'spawnParticle blocked');
         }
         return;
      }

      if (!this.groupsLen) return;
      const view = this.getAdaptiveView();
      const molang = this.particleRendererGetMolang(8);

      if (!this.anyPlayerNearBorder(view)) return;

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
            if (Math.abs(px - east) < view) {
               pos.x = east;
               pos.z = Math.max(north, Math.min(south, pz));
               dim.spawnParticle(worldborder, pos, molang);
            }
            if (Math.abs(px - west) < view) {
               pos.x = west;
               pos.z = Math.max(north, Math.min(south, pz));
               dim.spawnParticle(worldborder, pos, molang);
            }
            if (Math.abs(pz - north) < view) {
               pos.x = Math.max(west, Math.min(east, px));
               pos.z = north;
               dim.spawnParticle(worldborder_ew, pos, molang);
            }
            if (Math.abs(pz - south) < view) {
               pos.x = Math.max(west, Math.min(east, px));
               pos.z = south;
               dim.spawnParticle(worldborder_ew, pos, molang);
            }
         } catch (e) {
            logWarn('BorderParticle', 'spawnParticle blocked');
         }
      }
   }

   anyPlayerNearBorder(view) {
      const [east, west, north, south] = ctx.wbBounds;
      for (let i = 0; i < this.groupsLen; i++) {
         const rep = this.groupsPool[i].rep;
         if (!rep?.isValid) continue;
         const loc = rep.location;
         if (!loc) continue;
         if (Math.abs(loc.x - east) < view || Math.abs(loc.x - west) < view || Math.abs(loc.z - north) < view || Math.abs(loc.z - south) < view) return true;
      }
      return false;
   }

   particleRendererTick(players) {
      if (!ctx.isRunning || !ctx.borderReady || !ctx.wbBounds) return;
      if (ctx.uhcTick % 4 !== 0) return;

      this._playerCount = players.length;

      let dim = null;

      if (ctx.borderRadius <= 100) {
         for (let i = 0; i < players.length; i++) {
            if (players[i]?.isValid) {
               dim = players[i].dimension;
               break;
            }
         }
         if (!dim) return;
         this.renderTickCounter++;
         this.particleRendererRenderBorder(dim);
         return;
      }

      this.particleRendererGroupByCell(players);
      if (!this.groupsLen) return;

      for (let i = 0; i < this.groupsLen; i++) {
         const rep = this.groupsPool[i].rep;
         if (rep?.isValid) {
            dim = rep.dimension;
            break;
         }
      }
      if (!dim) return;

      this.renderTickCounter++;
      this.particleRendererRenderBorder(dim);
   }
}

const _particleInstance = new BorderManagerParticle();
export default _particleInstance;

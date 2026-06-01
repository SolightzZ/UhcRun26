import { MolangVariableMap } from '@minecraft/server';

import { ctx } from './BorderManager.js';

const BORDER_RENDER = Object.freeze({
    VIEW_DISTANCE: 35,
    PARTICLE_Y: 100,
});

const worldborder_ew = 'worldborder:worldborder_ew';
const worldborder = 'worldborder:worldborder';

const GROUPS_POOL_CAP = 54;
const GROUPS_RENDER_CAP = 36;
const CELL_SIZE = 16;
const CELL_OFFSET = 32;
const CELL_RANGE = 64;

class BorderManagerParticle {
    groupMaps = new Map();
    groupsPool = [];
    spawnedThisTick = new Set();
    sharedPos = { x: 0, y: BORDER_RENDER.PARTICLE_Y, z: 0 };
    particleLocPool = { x: 0, y: 0, z: 0 };
    groupsLen = 0;

    particleRendererGetMolang(width = 8) {
        if (!ctx.borderMolang) ctx.borderMolang = new MolangVariableMap();
        ctx.borderMolang.setColorRGBA('variable.color', ctx.currentBorderColor);
        ctx.borderMolang.setFloat('variable.size', width);
        return ctx.borderMolang;
    }

    particleRendererGroupByCell(players) {
        this.groupMaps.clear();
        this.groupsLen = 0;

        const size = CELL_SIZE;
        const offset = CELL_OFFSET;
        const range = CELL_RANGE;

        for (let i = 0, len = players.length; i < len; i++) {
            const p = players[i];
            if (!p || !p.isValid) continue;

            const loc = p.location;
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
            group.rep = p;

            this.groupMaps.set(key, group);
            this.groupsLen++;
        }

        if (this.groupsPool.length > GROUPS_POOL_CAP) {
            this.groupsPool.length = GROUPS_POOL_CAP;
        }
    }

    particleRendererSafeSpawn(dim, particleId, location, molang) {
        try {
            dim.spawnParticle(particleId, location, molang);
        } catch (e) {
            console.warn('[BorderParticle] Safe spawn failed:', e);
        }
    }

    particleRendererRenderEdge(dim, fixed, rangeMin, rangeMax, playerCoord, view, step, axis, particleId, molang) {
        if (playerCoord < fixed - view || playerCoord > fixed + view) return;

        let value = rangeMin - (rangeMin % step);
        if (value < rangeMin) value += step;

        const spawned = this.spawnedThisTick;
        const pos = this.sharedPos;
        const spawn = (d, pId, loc, mol) => this.particleRendererSafeSpawn(d, pId, loc, mol);

        const particle = particleId;
        const mol = molang;

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

            spawn(dim, particle, pos, mol);
        }
    }

    particleRendererRenderBorderAABB(dim, step, molang) {
        if (!dim || !this.groupsLen || !ctx.wbBounds) return;
        const [east, west, north, south] = ctx.wbBounds,
            view = BORDER_RENDER.VIEW_DISTANCE;
        this.spawnedThisTick.clear();
        const limit = Math.min(this.groupsLen, GROUPS_RENDER_CAP);
        for (let i = 0; i < limit; i++) {
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

    particleRendererRenderSmall(dim) {
        const n = ctx.borderRadius;
        const molang = this.particleRendererGetMolang(n);
        const pos = this.particleLocPool;

        pos.y = BORDER_RENDER.PARTICLE_Y;

        try {
            pos.x = n;
            pos.z = 0;
            dim.spawnParticle(worldborder, pos, molang);

            pos.x = -n;
            dim.spawnParticle(worldborder, pos, molang);

            pos.x = 0;
            pos.z = n;
            dim.spawnParticle(worldborder_ew, pos, molang);

            pos.z = -n;
            dim.spawnParticle(worldborder_ew, pos, molang);
        } catch (e) {
            console.warn('[BorderParticle] Small render failed:', e);
        }
    }

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
        if (ctx.borderRadius < 100) {
            this.particleRendererRenderSmall(dim);
            return;
        }
        this.particleRendererRenderBorderAABB(dim, 16, this.particleRendererGetMolang(8));
    }
}

export default new BorderManagerParticle();

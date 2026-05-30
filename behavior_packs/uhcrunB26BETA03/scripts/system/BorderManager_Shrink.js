import { getTeams, getUhcPlayers } from '../Manager/TeamManager.js';
import { dynamicToast } from '../plugin/Util.js';
import bm, { borderColors, borderEnd, center, CHECKPOINTS, ctx } from './BorderManager.js';

const SHRINK_CONFIG = [
    [200, 80, 90],
    [100, 60, 60],
    [50, 50, 45],
    [16, 40, 30],
    [5, 30, 20],
    [0, 20, 15],
];

class BorderManagerShrink {
    TEAMS = [];

    getTeamsCached() {
        if (!this.TEAMS.length) this.TEAMS = getTeams();
        return this.TEAMS;
    }

    lookupShrinkConfig(target) {
        return SHRINK_CONFIG.find((c) => target >= c[0]) || SHRINK_CONFIG[SHRINK_CONFIG.length - 1];
    }

    borderManagerGetShrinkDuration(target) {
        return this.lookupShrinkConfig(target)[1];
    }

    borderManagerGetRestTime(target) {
        return this.lookupShrinkConfig(target)[2];
    }

    borderManagerSyncGeometry() {
        const r = ctx.borderRadius,
            cx = center.x,
            cz = center.z;
        ctx.wbBounds = [cx + r, cx - r, cz - r, cz + r];
    }

    borderManagerSetRadius(r) {
        const clamped = Math.max(r, borderEnd);
        if (clamped === ctx.borderRadius && ctx.wbBounds) return;
        ctx.borderRadius = clamped;
        this.borderManagerSyncGeometry();
    }

    borderManagerIsOutside(x, z) {
        const b = ctx.wbBounds;
        if (!b) return false;
        return x < b[1] || x > b[0] || z < b[2] || z > b[3];
    }

    borderManagerTickShrink() {
        if (ctx.targetRadius === null || ctx.shrinkDuration <= 0) return;
        const elapsed = ctx.uhcTick - ctx.shrinkStartTick,
            progress = Math.min(1, elapsed / ctx.shrinkDuration),
            newRadius = Math.round(ctx.startRadius + (ctx.targetRadius - ctx.startRadius) * progress);
        if (newRadius !== ctx.borderRadius) {
            ctx.borderRadius = newRadius;
            this.borderManagerSyncGeometry();
        }
        if (progress >= 1) {
            ctx.borderRadius = ctx.targetRadius;
            this.borderManagerSyncGeometry();
            ctx.targetRadius = null;
            ctx.currentBorderColor = borderColors.blue;
        }
    }

    borderManagerApplyShrink() {
        if (ctx.targetRadius !== null) return;
        const players = getUhcPlayers();
        if (!players.length) return;
        if (ctx.nextShrinkIndex >= CHECKPOINTS.length) return;
        const target = CHECKPOINTS[ctx.nextShrinkIndex];
        if (!Number.isFinite(target) || target >= ctx.borderRadius) return;
        ctx.targetRadius = target;
        ctx.startRadius = ctx.borderRadius;
        ctx.shrinkStartTick = ctx.uhcTick;
        ctx.shrinkDuration = this.borderManagerGetShrinkDuration(target);
        ctx.nextShrinkIndex++;
        ctx.currentBorderColor = borderColors.red;
        const restTime = this.borderManagerGetRestTime(target);
        ctx.nextShrinkTick = ctx.shrinkStartTick + ctx.shrinkDuration + restTime;
        bm.broadcast(players, {
            message: dynamicToast(`Border กำลังลดลง ${target}`, 'textures/blocks/barrier'),
            sound: 'world_noti',
        });
    }

    borderManagerBroadcastWarning() {
        const players = getUhcPlayers();
        if (!players.length) return;
        bm.broadcast(players, {
            message: dynamicToast('Border กำลังลดลงใน 30 วินาที', 'textures/ui/ErrorGlyph_small_hover'),
            sound: 'noti',
        });
    }
}

export default new BorderManagerShrink();

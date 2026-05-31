import { isPlayerUhcId } from '../Manager/TeamManager.js';

import { END_SEQUENCE_STATE } from './BlockFiller_Constants.js';
import bm, { CHECKPOINTS, ctx } from './BorderManager.js';

import umm from './UhcMatchManager.js';

const GLOBAL_BORDER_LIMIT = CHECKPOINTS[0];
const PLACE_BLOCK_LOCK_RADIUS = 16;

class BorderEvents {
    isUhcPlayer(player) {
        if (!ctx.isRunning) return false;
        if (!player?.isValid) return false;
        return isPlayerUhcId(player.id);
    }

    getTargetAxis(target, axis) {
        if (!target) return undefined;
        if (target[axis] !== undefined) return target[axis];
        if (!target.location) return undefined;
        return target.location[axis];
    }

    isOutsideGlobalLimit(target, player) {
        const bx = this.getTargetAxis(target, 'x');
        const bz = this.getTargetAxis(target, 'z');
        if (bx === undefined) return false;
        if (bz === undefined) return false;

        if (Math.abs(bx) > GLOBAL_BORDER_LIMIT) return true;
        if (Math.abs(bz) > GLOBAL_BORDER_LIMIT) return true;
        return false;
    }

    shouldCancelBorderAction(player, target) {
        if (!ctx.isRunning) return false;
        if (!ctx.wbBounds) return false;
        if (!target) return false;

        const bx = this.getTargetAxis(target, 'x');
        const bz = this.getTargetAxis(target, 'z');
        if (bx === undefined) return false;
        if (bz === undefined) return false;
        if (!bm.borderManagerIsOutside(bx, bz)) return false;

        return this.isUhcPlayer(player);
    }

    handleBorderAction(ev, target) {
        if (this.isOutsideGlobalLimit(target, ev.player)) {
            ev.cancel = true;
            return true;
        }

        if (this.shouldCancelBorderAction(ev.player, target)) {
            ev.cancel = true;
            return true;
        }

        return false;
    }

    shouldLockPlaceBlock(player) {
        if (!ctx.isRunning) return false;
        if (ctx.borderRadius > PLACE_BLOCK_LOCK_RADIUS) return false;
        // Don't lock during INITIAL_WAIT or PATTERN3 — allow building until Pattern 1 clears outer ring
        if (ctx.endSeqState !== undefined && ctx.endSeqState < END_SEQUENCE_STATE.PATTERN1) return false;
        return this.isUhcPlayer(player);
    }

    handlePlayerPlaceBlock(ev) {
        if (this.isOutsideGlobalLimit(ev.block, ev.player)) {
            ev.cancel = true;
            return;
        }
        if (!this.shouldLockPlaceBlock(ev.player)) return;
        ev.cancel = true;
    }

    handlePlayerInteractWithEntity(ev) {
        this.handleBorderAction(ev, ev.target);
    }

    handlePlayerInteractWithBlock(ev) {
        this.handleBorderAction(ev, ev.block);
    }

    handlePlayerBreakBlock(ev) {
        if (this.isOutsideGlobalLimit(ev.block, ev.player)) {
            ev.cancel = true;
        }
    }
}

export default new BorderEvents();

export const endGameUhc = () => umm.endGameUhc();
export const markAliveTeamDirty = () => umm.markAliveTeamDirty();
export const resetGameUhc = () => umm.resetGameUhc();
export const startGameUhc = () => umm.startGameUhc();

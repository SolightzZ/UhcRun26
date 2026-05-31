import { system, world } from '@minecraft/server';

import { getUhcPlayers, isPlayerUhcId } from '../Manager/TeamManager.js';

import { dynamicToast } from '../plugin/Util.js';

import bm, { borderColors, borderEnd, CHECKPOINTS, ctx, MinecraftColor } from './BorderManager.js';

import umm from './UhcMatchManager.js';

const GLOBAL_BORDER_LIMIT = CHECKPOINTS[0];
const PLACE_BLOCK_LOCK_RADIUS = 16;
const FORCE_FILL_COMMAND = '!fill';

class BorderEvents {
    forceFinalShrinkQueue = [];
    forceFinalShrinkScheduled = false;

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
        if (player?.isValid && player.hasTag('admin')) return false;

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

    queueForceFinalShrink(player) {
        this.forceFinalShrinkQueue.push(player);
        if (this.forceFinalShrinkScheduled) return;

        this.forceFinalShrinkScheduled = true;
        system.run(() => this.drainForceFinalShrinkQueue());
    }

    drainForceFinalShrinkQueue() {
        this.forceFinalShrinkScheduled = false;

        while (this.forceFinalShrinkQueue.length > 0) {
            const player = this.forceFinalShrinkQueue.shift();
            if (!player?.isValid) continue;
            this.forceFinalShrink(player);
        }
    }

    handleChatSend(ev) {
        const player = ev.sender;
        if (!player?.isValid) return;
        if (!player.hasTag('admin')) return;
        if (ev.message !== FORCE_FILL_COMMAND) return;

        ev.cancel = true;
        this.queueForceFinalShrink(player);
    }

    forceFinalShrink(player) {
        if (!player?.isValid) return;

        if (!ctx.isRunning) {
            player.sendMessage(MinecraftColor.red + '[Fill] Game not started yet');
            return;
        }

        if (ctx.fillCommandLocked) {
            player.sendMessage(MinecraftColor.red + '[Fill] This command has already been used');
            return;
        }

        ctx.fillCommandLocked = true;
        ctx.nextShrinkIndex = CHECKPOINTS.length;
        ctx.targetRadius = borderEnd;
        ctx.startRadius = ctx.borderRadius;
        ctx.shrinkStartTick = ctx.uhcTick;
        ctx.shrinkDuration = bm.borderManagerGetShrinkDuration(borderEnd);
        ctx.currentBorderColor = borderColors.red;
        bm.endSequenceReset();

        player.sendMessage(`[Fill] Border shrinking to ${borderEnd}, pattern follows`);
        bm.broadcast(getUhcPlayers(), {
            message: dynamicToast(`Safe zone shrinking to ${borderEnd}`, 'textures/blocks/barrier'),
            sound: 'world_noti',
        });
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

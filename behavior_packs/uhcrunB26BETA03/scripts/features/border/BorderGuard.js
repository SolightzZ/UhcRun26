import { GLOBAL_BORDER_LIMIT, PLACE_BLOCK_LOCK_RADIUS } from '../../constants/game.js';
import { END_SEQUENCE_STATE } from '../block-filler/BlockFillerConstants.js';
import { uhcPlayerIds } from '../cache/State_Cache.js';
import BorderShrink from './BorderShrink.js';
import { ctx } from './BorderState.js';

class BorderEvents {
   isUhcPlayer(player) {
      if (!ctx.isRunning) return false;
      if (!player?.isValid) return false;
      return uhcPlayerIds.has(player.id);
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
      if (!BorderShrink.borderManagerIsOutside(bx, bz)) return false;

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

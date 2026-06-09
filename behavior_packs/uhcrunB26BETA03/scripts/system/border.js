import { isPlayerUhcId } from '../Manager/TeamManager.js';

import { END_SEQUENCE_STATE } from './BlockFiller_Constants.js';
import bm, { CHECKPOINTS, ctx } from './BorderManager.js';

import umm from './UhcMatchManager.js';

const GLOBAL_BORDER_LIMIT = CHECKPOINTS[0];
const PLACE_BLOCK_LOCK_RADIUS = 16;

//จัดการ events เกี่ยวกับ border: ยกเลิก interact/break/place block นอกเขต
class BorderEvents {
   //เช็คว่าผู้เล่นเป็น UHC หรือไม่
   isUhcPlayer(player) {
      if (!ctx.isRunning) return false;
      if (!player?.isValid) return false;
      return isPlayerUhcId(player.id);
   }

   // ดึงพิกัด target จาก block หรือ entity
   getTargetAxis(target, axis) {
      if (!target) return undefined;
      if (target[axis] !== undefined) return target[axis];
      if (!target.location) return undefined;
      return target.location[axis];
   }

   // เช็คว่าอยู่นอก global limit หรือไม่
   isOutsideGlobalLimit(target, player) {
      const bx = this.getTargetAxis(target, 'x');
      const bz = this.getTargetAxis(target, 'z');
      if (bx === undefined) return false;
      if (bz === undefined) return false;

      if (Math.abs(bx) > GLOBAL_BORDER_LIMIT) return true;
      if (Math.abs(bz) > GLOBAL_BORDER_LIMIT) return true;
      return false;
   }

   //เช็คว่าควรยกเลิก action เพราะอยู่นอก border หรือไม่
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

   //จัดการ action ของ border (interact / break)
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

   //เช็คว่าควรล็อคการวางบล็อกหรือไม่ (border เล็ก + ผ่าน initial wait)
   shouldLockPlaceBlock(player) {
      if (!ctx.isRunning) return false;
      if (ctx.borderRadius > PLACE_BLOCK_LOCK_RADIUS) return false;
      // ไม่ล็อคระหว่าง INITIAL_WAIT หรือ PATTERN3 ให้วางได้จนกว่า Pattern 1 เคลียร์วงนอก
      if (ctx.endSeqState !== undefined && ctx.endSeqState < END_SEQUENCE_STATE.PATTERN1)
         return false;
      return this.isUhcPlayer(player);
   }

   //ยกเลิกการวางบล็อกถ้าอยู่นอก border
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

   //ยกเลิกการแตกบล็อกถ้าอยู่นอก global limit
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

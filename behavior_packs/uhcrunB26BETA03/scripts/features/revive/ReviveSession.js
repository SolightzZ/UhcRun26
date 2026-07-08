import { system } from '@minecraft/server';
import { REVIVE_MSG } from '../../constants/game.js';
import { dynamicToast, logError, TEX_CANCEL } from '../../shared/Util.js';
import { uhcPlayerIds } from '../cache/State_Cache.js';
import { deathLocation } from '../team/State_Team.js';
import { getPlayerTeam } from '../team/TeamActions.js';
import { hasReviveItem, resolvePlayer, sendReviveTeamActionBar } from './ReviveUtil.js';
import { enqueuePlayerSound } from '../../shared/MessageBatcher.js';
import { REVIVE_ACTIONBAR_INTERVAL, REVIVE_CANCEL_MOVE_DISTANCE, REVIVE_DURATION_TICKS } from './State_Revive.js';

export default class ReviveSession {
   constructor(reviver, target, teamId) {
      const loc = reviver.location;
      this.reviverId = reviver.id;
      this.targetId = target.id;
      this.teamId = teamId;
      this.endTick = system.currentTick + REVIVE_DURATION_TICKS;
      this.lastUiTick = -REVIVE_ACTIONBAR_INTERVAL;
      this.lastSoundTick = -20;
      this.anchorX = loc.x;
      this.anchorY = loc.y;
      this.anchorZ = loc.z;
      this._state = 'ACTIVE';
      this._onCancel = null;
      this._onComplete = null;
   }

   get state() {
      return this._state;
   }

   onComplete(fn) {
      this._onComplete = fn;
   }

   onCancel(fn) {
      this._onCancel = fn;
   }

   tick() {
      if (this._state !== 'ACTIVE') return { ok: false, sessionDone: true };

      const reviver = resolvePlayer(this.reviverId);
      const target = resolvePlayer(this.targetId);

      if (!reviver || !target) {
         return this.#cancel(REVIVE_MSG.cancel);
      }
      if (!uhcPlayerIds.has(reviver.id)) {
         return this.#cancel(REVIVE_MSG.reviverNotAlive);
      }
      if (!hasReviveItem(reviver)) {
         return this.#cancel(REVIVE_MSG.noReviveItem);
      }
      if (!deathLocation.has(this.targetId)) {
         return this.#cancel(REVIVE_MSG.targetNotDead);
      }

      const reviverTeam = getPlayerTeam(reviver);
      if (!reviverTeam || reviverTeam !== getPlayerTeam(target)) {
         return this.#cancel(REVIVE_MSG.notSameTeam);
      }

      const targetDeathLoc = deathLocation.get(this.targetId);
      if (!targetDeathLoc) {
         return this.#cancel(REVIVE_MSG.noDeathLoc);
      }

      if (reviver.dimension !== target.dimension) {
         return this.#cancel(REVIVE_MSG.wrongDimension);
      }

   
      const loc = reviver.location;
      const dx = loc.x - this.anchorX;
      const dy = loc.y - this.anchorY;
      const dz = loc.z - this.anchorZ;
      if (dx * dx + dy * dy + dz * dz > REVIVE_CANCEL_MOVE_DISTANCE * REVIVE_CANCEL_MOVE_DISTANCE) {
         return this.#cancel(REVIVE_MSG.movedTooFar);
      }

     
      const remaining = this.endTick - system.currentTick;
      if (remaining <= 0) {
         this._state = 'COMPLETED';
         if (this._onComplete) this._onComplete(this);
         return { ok: true, finished: true };
      }


      if (system.currentTick - this.lastUiTick >= REVIVE_ACTIONBAR_INTERVAL) {
         this.lastUiTick = system.currentTick;
         const seconds = Math.ceil(remaining / 20);
         sendReviveTeamActionBar(this.teamId, REVIVE_MSG.progress(target.name, seconds));
      }

      if (system.currentTick - this.lastSoundTick >= 20) {
         this.lastSoundTick = system.currentTick;
         enqueuePlayerSound(reviver, 'fortnite-Bandage', { volume: 1, pitch: 1 });
      }

      return { ok: true };
   }

   #cancel(reason) {
      if (this._state !== 'ACTIVE') return { ok: false, sessionDone: true };
      this._state = 'CANCELLED';

      const reviver = resolvePlayer(this.reviverId);
      if (reviver) {
         try {
            reviver.sendMessage(dynamicToast(reason, TEX_CANCEL));
            enqueuePlayerSound(reviver, 'note.bassattack');
         } catch (error) {
            logError('ReviveSession', 'Failed to notify reviver', error);
         }
      }

      const target = resolvePlayer(this.targetId);
      if (target) {
         try {
            target.onScreenDisplay.setActionBar(reason);
         } catch (error) {
            logError('ReviveSession', 'Failed to notify target', error);
         }
      }

      if (this._onCancel) this._onCancel(this);
      return { ok: false, reason, sessionDone: true };
   }
}

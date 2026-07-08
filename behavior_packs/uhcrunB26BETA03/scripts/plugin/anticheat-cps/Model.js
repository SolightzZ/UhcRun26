import { LRUMap } from '../../shared/LRUMap.js';

class Model {
   MAX_CPS = 18;
   HARD_LIMIT = 24;
   WINDOW_TICKS = 20;
   BUF_SIZE = this.HARD_LIMIT;

   adminPlayers = new Map();

   playerState = Object.assign(new LRUMap(80, 200), {
      cleanup(currentTick) {
         if (this._ttl <= 0) return;
         for (const [key, val] of this._m) {
            if (!val || typeof val !== 'object' || typeof val.lastWarnTick !== 'number') continue;
            if (currentTick - val.lastWarnTick <= this._ttl) continue;
            if (val.count > 0) {
               const idx = (val.head - 1 + val.BUF_SIZE) % val.BUF_SIZE;
               if (currentTick - val.buf[idx] > this._ttl) this._m.delete(key);
            } else {
               this._m.delete(key);
            }
         }
      },
   });

   createPlayerData = () => ({
      buf: new Uint8Array(this.BUF_SIZE),
      head: 0,
      count: 0,
      lastWarnTick: 0,
      BUF_SIZE: this.BUF_SIZE,
   });
}

export default new Model();

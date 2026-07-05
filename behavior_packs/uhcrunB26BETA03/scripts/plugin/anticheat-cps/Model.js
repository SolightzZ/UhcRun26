import { LRUMap } from '../../shared/LRUMap.js';

// LRU cache with TTL cleanup storing playerState; overrides cleanup for lastWarnTick objects
class Model {
   MAX_CPS = 18;
   HARD_LIMIT = 24;
   WINDOW_TICKS = 20;
   BUF_SIZE = this.HARD_LIMIT;

   // id → Player cache to avoid world.getPlayers()
   adminPlayers = new Map();

   playerState = Object.assign(new LRUMap(Infinity, 200), {
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

   // Circular buffer storing low 8 bits of hit ticks; full tick = (currentTick & 0xFFFFFF00) | storedByte with wrap correction
   createPlayerData = () => ({
      buf: new Uint8Array(this.BUF_SIZE),
      head: 0,
      count: 0,
      lastWarnTick: 0,
      BUF_SIZE: this.BUF_SIZE,
   });
}

export default new Model();

import { system } from '@minecraft/server';

export class LRUMap {
   constructor(maxSize = Infinity, ttlTicks = 0) {
      this._m = new Map();
      this._max = maxSize;
      this._ttl = ttlTicks;
   }

   get(key) {
      if (!this._m.has(key)) return undefined;
      const val = this._m.get(key);
      if (this._ttl > 0 && typeof val === 'number' && system.currentTick - val > this._ttl) {
         this._m.delete(key);
         return undefined;
      }
      this._m.delete(key);
      this._m.set(key, val);
      return val;
   }

   set(key, val) {
      if (this._m.has(key)) {
         this._m.delete(key);
      }
      this._m.set(key, val);
      if (this._m.size > this._max) {
         const oldest = this._m.keys().next().value;
         this._m.delete(oldest);
      }
   }

   delete(key) {
      this._m.delete(key);
   }
   has(key) {
      return this._m.has(key);
   }
   get size() {
      return this._m.size;
   }
   clear() {
      this._m.clear();
   }

   cleanup(currentTick) {
      if (this._ttl <= 0) return;
      this._m.forEach((val, key) => {
         if (typeof val === 'number' && currentTick - val > this._ttl) {
            this._m.delete(key);
         }
      });
   }
}

import { LRUMap } from '../../shared/LRUMap.js';

//LRU cache พร้อม TTL cleanup สำหรับเก็บ playerState
//Override cleanup สำหรับ object structure ที่มี lastWarnTick

class Model {
   MAX_CPS = 18; //ขีดเตือนอ่อน
   HARD_LIMIT = 24; //ขีด kick
   WINDOW_TICKS = 20;
   BUF_SIZE = this.HARD_LIMIT;

   adminPlayers = new Map(); // id → Player สำหรับ admins (cache แทน world.getPlayers())

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

   // สร้าง buffer วงกลมบันทึก tick ที่ตี
   createPlayerData = () => ({
      buf: new Int32Array(this.BUF_SIZE),
      head: 0,
      count: 0,
      lastWarnTick: 0,
      BUF_SIZE: this.BUF_SIZE,
   });
}

export default new Model();

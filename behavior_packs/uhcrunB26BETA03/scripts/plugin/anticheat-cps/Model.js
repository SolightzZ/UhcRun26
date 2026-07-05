import { LRUMap } from '../../shared/LRUMap.js';

// หน่วยความจำแคช LRU พร้อมการล้างข้อมูลตามอายุขัย (TTL) สำหรับเก็บสถานะผู้เล่น; เขียนทับฟังก์ชันล้างข้อมูลสำหรับออบเจ็กต์ lastWarnTick
class Model {
   MAX_CPS = 18;
   HARD_LIMIT = 24;
   WINDOW_TICKS = 20;
   BUF_SIZE = this.HARD_LIMIT;

   // แคชแผนผัง id → ผู้เล่นเพื่อหลีกเลี่ยงการเรียกใช้ world.getPlayers()
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

   // บัฟเฟอร์แบบวงกลม (Circular Buffer) เก็บข้อมูล 8 บิตต่ำสุดของติ๊กที่เกิดการโจมตี; ติ๊กเต็มรูปแบบ = (currentTick & 0xFFFFFF00) | storedByte พร้อมการแก้ไขค่าเมื่อเกิดการวนทับ
   createPlayerData = () => ({
      buf: new Uint8Array(this.BUF_SIZE),
      head: 0,
      count: 0,
      lastWarnTick: 0,
      BUF_SIZE: this.BUF_SIZE,
   });
}

export default new Model();

import { logError } from '../shared/Util.js';

class CacheRegistry {
   #entries = [];

   // ลงทะเบียนอินสแตนซ์แคชเพื่อการล้างข้อมูลจากส่วนกลาง
   register(name, cache) {
      if (!cache || typeof cache.cleanup !== 'function') {
         logError('CacheRegistry', `Cannot register "${name}": missing cleanup() method`);
         return;
      }
      this.#entries.push({ name, cache });
   }

   // เรียกใช้ฟังก์ชัน cleanup(currentTick) ในแคชทั้งหมดที่ลงทะเบียนไว้
   cleanupAll(currentTick) {
      for (let i = 0; i < this.#entries.length; i++) {
         const { name, cache } = this.#entries[i];
         try {
            cache.cleanup(currentTick);
         } catch (error) {
            logError('CacheRegistry', `Cleanup failed for "${name}"`, error);
         }
      }
   }

   // ลบรหัสผู้เล่น (Player ID) ออกจากแคชทั้งหมดที่มีการกำหนดเมธอด delete() ไว้
   purgePlayer(id) {
      for (let i = 0; i < this.#entries.length; i++) {
         const { name, cache } = this.#entries[i];
         if (typeof cache.delete === 'function') {
            try {
               cache.delete(id);
            } catch (error) {
               logError('CacheRegistry', `Purge player failed for "${name}"`, error);
            }
         }
      }
   }

   get size() {
      return this.#entries.length;
   }
}

export default new CacheRegistry();

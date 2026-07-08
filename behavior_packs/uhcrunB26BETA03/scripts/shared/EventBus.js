import { logError } from './Util.js';

class EventBus {
   #handlers = new Map();
   #oneShot = new WeakSet();

   // ลงทะเบียนตัวจัดการ (Handler) สำหรับประเภทเหตุการณ์ที่ต้องการ
   on(type, handler) {
      if (!this.#handlers.has(type)) {
         this.#handlers.set(type, []);
      }
      this.#handlers.get(type).push(handler);
      return () => this.off(type, handler);
   }

   // ลงทะเบียนตัวจัดการที่จะทำงานเพียงครั้งเดียว — จะถูกลบออกหลังจากการส่งเหตุการณ์ (Emit) ครั้งแรก
   once(type, handler) {
      this.#oneShot.add(handler);
      return this.on(type, handler);
   }

   // ลบตัวจัดการ (Handler) สำหรับประเภทเหตุการณ์ที่กำหนด
   off(type, handler) {
      const list = this.#handlers.get(type);
      if (!list) return;
      const idx = list.indexOf(handler);
      if (idx !== -1) {
         if (idx !== list.length - 1) {
            list[idx] = list[list.length - 1];
         }
         list.pop();
      }
   }

   // ส่งสัญญาณเหตุการณ์ไปยังตัวจัดการทั้งหมดที่ลงทะเบียนไว้
   emit(type, payload) {
      const list = this.#handlers.get(type);
      if (!list || !list.length) return;

      const dead = [];
      for (let i = 0; i < list.length; i++) {
         const handler = list[i];
         try {
            handler(payload);
         } catch (error) {
            logError('EventBus', `Handler for "${type}" failed`, error);
         }
         if (this.#oneShot.has(handler)) {
            dead.push(handler);
         }
      }

      // ลบตัวจัดการประเภททำงานครั้งเดียวออกหลังจากจบลูปการทำงาน
      for (let i = 0; i < dead.length; i++) {
         this.off(type, dead[i]);
         this.#oneShot.delete(dead[i]);
      }
   }

   // ลบตัวจัดการทั้งหมดสำหรับประเภทเหตุการณ์ที่ระบุ
   clear(type) {
      if (type) {
         this.#handlers.delete(type);
      } else {
         this.#handlers.clear();
      }
   }

   get handlerCount() {
      let count = 0;
      for (const list of this.#handlers.values()) {
         count += list.length;
      }
      return count;
   }
}

export default new EventBus();

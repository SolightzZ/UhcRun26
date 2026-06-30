//ระบบดูดไอเทมผู้เล่นหลังตาย ใช้ queue + drain เพื่อไม่ให้โหลดเกม
import { system } from '@minecraft/server';
import { logError, logWarn } from '../../shared/Util.js';
import { itemVacuumQueue, itemVacuumRunning, setItemVacuumRunning } from '../stats/State_Queue.js';

//ระบาย queue item vacuum ทีละ job ห่างกัน 3 ticks
function drainItemVacuumQueue() {
   if (itemVacuumQueue.length === 0) {
      setItemVacuumRunning(false);
      return;
   }

   setItemVacuumRunning(true);
   const job = itemVacuumQueue.shift();

   if (!job) {
      drainItemVacuumQueue();
      return;
   }

   system.runTimeout(() => {
      try {
         job();
      } catch (error) {
         logError('ItemVacuum', 'job error', error);
      }
      drainItemVacuumQueue();
   }, 3);
}

//จำกัด queue สูงสุด 32 รายการ
const ITEM_VACUUM_MAX_QUEUE = 32;

//เพิ่ม job ดูดไอเทมเข้า queue (ถ้ายังไม่เต็ม)
export function enqueueItemVacuum(job) {
   if (!job) return;
   if (itemVacuumQueue.length >= ITEM_VACUUM_MAX_QUEUE) {
      logWarn('ItemVacuum', 'Queue full, dropping job');
      return;
   }
   itemVacuumQueue.push(job);
   if (itemVacuumRunning) return;
   drainItemVacuumQueue();
}

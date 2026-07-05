import { system } from '@minecraft/server';
import { itemVacuumQueue, itemVacuumRunning, setItemVacuumRunning } from '../../shared/State_Queue.js';
import { logError, logWarn } from '../../shared/Util.js';

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

const ITEM_VACUUM_MAX_QUEUE = 32;

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

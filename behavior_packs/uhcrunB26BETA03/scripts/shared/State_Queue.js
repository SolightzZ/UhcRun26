export const itemVacuumQueue = [];
export let itemVacuumRunning = false;
export function setItemVacuumRunning(val) {
   itemVacuumRunning = val;
}

export const deathQueue = [];
export const DEATH_QUEUE_MAX = 64;
export let deathBatchRunning = false;
export function setDeathBatchRunning(val) {
   deathBatchRunning = val;
}
export function enqueueDeath(entry) {
   if (!entry) return;
   if (deathQueue.length >= DEATH_QUEUE_MAX) {
      return;
   }
   deathQueue.push(entry);
}

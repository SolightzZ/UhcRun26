//queue สำหรับ item vacuum (ดักไอเทมหลังตาย)
export const itemVacuumQueue = [];
export let itemVacuumRunning = false;
export function setItemVacuumRunning(val) {
   itemVacuumRunning = val;
}


//queue สำหรับ death screenshot (batch processing)
export const deathQueue = [];
export let deathBatchRunning = false;
export function setDeathBatchRunning(val) {
   deathBatchRunning = val;
}

export const itemVacuumQueue = [];
export let itemVacuumRunning = false;
export function setItemVacuumRunning(val) {
    itemVacuumRunning = val;
}

export const deathQueue = [];
export let deathBatchRunning = false;
export function setDeathBatchRunning(val) {
    deathBatchRunning = val;
}

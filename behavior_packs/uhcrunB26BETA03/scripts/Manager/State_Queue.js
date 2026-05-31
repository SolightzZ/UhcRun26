export const itemVacuumQueue = [];
export let itemVacuumRunning = false;
export function setItemVacuumRunning(v) {
    itemVacuumRunning = v;
}

export const deathQueue = [];
export let deathBatchRunning = false;
export function setDeathBatchRunning(v) {
    deathBatchRunning = v;
}

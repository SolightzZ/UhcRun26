import { system } from '@minecraft/server';
import { itemVacuumQueue, itemVacuumRunning, setItemVacuumRunning } from './State.js';

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
            console.warn('[DrainItemVacuumQueue] job error:', error);
        }
        drainItemVacuumQueue();
    }, 3);
}

export function enqueueItemVacuum(job) {
    if (!job) return;
    itemVacuumQueue.push(job);
    if (itemVacuumRunning) return;
    drainItemVacuumQueue();
}

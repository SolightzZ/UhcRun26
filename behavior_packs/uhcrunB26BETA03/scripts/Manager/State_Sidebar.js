export let cachedBoard;
export let sidebarFlushTask = null;
export const dirtySidebarTeams = new Set();

export function setCachedBoard(b) {
    cachedBoard = b;
}
export function setSidebarFlushTask(t) {
    sidebarFlushTask = t;
}

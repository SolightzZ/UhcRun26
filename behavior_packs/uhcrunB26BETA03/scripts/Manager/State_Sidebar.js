//cache sidebar board และทีมที่รออัปเดต
export let cachedBoard;
export let sidebarFlushTask = null;
export const dirtySidebarTeams = new Set();

export function setCachedBoard(board) {
   cachedBoard = board;
}
export function setSidebarFlushTask(task) {
   sidebarFlushTask = task;
}

// สถานะเกม
export let isGameRunning = false;

export function setGameRunningState(state) {
   isGameRunning = state;
}

export const KD = Object.freeze({
   SCORE_HISTORY_OBJECTIVE: 'kdhistory',
   HIT_TIMEOUT_SECONDS: 8,
});

// 160 ticks timeout สำหรับ hit registry (8 วิ)
export const HIT_TIMEOUT_TICKS = 20 * KD.HIT_TIMEOUT_SECONDS;
// 320 ticks timeout สำหรับ multi kill (16 วิ)
export const MULTI_TIMEOUT_TICKS = 20 * 16;

// Scoreboard objectives
export let kdHistoryObj = null;
export let teamKillObj = null;
export let uhcKillsObj = null;
export let uhcDeathsObj = null;

export function setKdHistoryObj(obj) {
   kdHistoryObj = obj;
}
export function setTeamKillObj(obj) {
   teamKillObj = obj;
}
export function setUhcKillsObj(obj) {
   uhcKillsObj = obj;
}
export function setUhcDeathsObj(obj) {
   uhcDeathsObj = obj;
}
// สถานะ dirty flag + task สำหรับบันทึก stats
export let statsDirty = false;
export let statsSaveTask = null;

export function setStatsDirty(val) {
   statsDirty = val;
}
export function setStatsSaveTask(task) {
   statsSaveTask = task;
}

// First blood (ฆ่าคนแรก)
export let firstBloodDone = false;
export function setFirstBloodDone(val) {
   firstBloodDone = val;
}

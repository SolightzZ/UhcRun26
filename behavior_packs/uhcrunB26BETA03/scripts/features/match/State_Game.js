import { system } from '@minecraft/server';

export let isGameRunning = false;

export function setGameRunningState(state) {
   isGameRunning = state;
}

const KD = Object.freeze({
   SCORE_HISTORY_OBJECTIVE: 'kdhistory',
   HIT_TIMEOUT_SECONDS: 8,
});

export const HIT_TIMEOUT_TICKS = 20 * KD.HIT_TIMEOUT_SECONDS;
export const MULTI_TIMEOUT_TICKS = 20 * 16;

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
// แฟล็กแสดงข้อมูลที่มีการเปลี่ยนแปลง (Dirty Flag) และงานบันทึกสำหรับข้อมูลสถิติที่บันทึกถาวร
export let statsDirty = false;
export let statsSaveTask = null;

export function setStatsDirty(val) {
   statsDirty = val;
}
export function setStatsSaveTask(task) {
   statsSaveTask = task;
}

export let firstBloodDone = false;
export function setFirstBloodDone(val) {
   firstBloodDone = val;
}
// — สถานะร่วมสำหรับการชนะการแข่งขัน (แยกมาจาก MatchVictory เพื่อทำลายวงจรพึ่งพาระหว่าง MatchManager และ MatchVictory) —

export let countdownRunning = false;

export function setCountdownRunning(val) {
   countdownRunning = val;
}


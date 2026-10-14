import { system } from '@minecraft/server';

// Match phase state. Single-owner convention:
// - The flags below (isGameRunning, countdownRunning, statsDirty, ...)
//   are written only by the Match lifecycle module (MatchManager).
// - BorderState.ctx mirrors loop counters + border geometry for the
//   border/team/event readers; ctx.isRunning is written only on the
//   running path (#initMatchContext) and the victory/end path
//   (#beginVictoryEnd), never scattered across features.
// - The alive-team dirty flag lives only in BorderState.renderCache
//   (read by BorderScoreboard); do not add a second copy on ctx.
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

export let countdownRunning = false;

export function setCountdownRunning(val) {
   countdownRunning = val;
}

export let isGameRunning = false;
export function setGameRunningState(state) {
    isGameRunning = state;
}

export const KD = Object.freeze({
    SCORE_HISTORY_OBJECTIVE: 'kdhistory',
    HIT_TIMEOUT_SECONDS: 8,
});

export const HIT_TIMEOUT_TICKS = 20 * KD.HIT_TIMEOUT_SECONDS;
export const MULTI_TIMEOUT_TICKS = 20 * 16;

export let kdHistoryObj = null;
export let teamKillObj = null;

export function setKdHistoryObj(o) {
    kdHistoryObj = o;
}
export function setTeamKillObj(o) {
    teamKillObj = o;
}
export function getKdHistoryObjective() {
    return kdHistoryObj;
}
export function getTeamKillObjective() {
    return teamKillObj;
}

export let statsDirty = false;
export let statsSaveTask = null;

export function setStatsDirty(v) {
    statsDirty = v;
}
export function setStatsSaveTask(t) {
    statsSaveTask = t;
}

export let firstBloodDone = false;
export function setFirstBloodDone(v) {
    firstBloodDone = v;
}

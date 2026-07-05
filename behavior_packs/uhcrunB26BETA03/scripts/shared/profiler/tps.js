import { system } from '@minecraft/server';
import { C, st } from './state.js';

export function sampleTps() {
   const now = system.currentTick;
   const nowMs = Date.now();

   if (st.tpsLastTime === 0) {
      st.tpsLastTick = now;
      st.tpsLastTime = nowMs;
      return;
   }

   const tickDelta = now - st.tpsLastTick;
   const msDelta = nowMs - st.tpsLastTime;

   if (tickDelta <= 0 || msDelta <= 0) {
      st.tpsLastTick = now;
      st.tpsLastTime = nowMs;
      return;
   }

   const measuredTps = (tickDelta / msDelta) * 1000;
   const measuredMspt = msDelta / tickDelta;
   const a = C.TPS_ALPHA;

   st.tpsCurrent = a * measuredTps + (1 - a) * st.tpsCurrent;
   st.msptCurrent = a * measuredMspt + (1 - a) * st.msptCurrent;

   st.tpsHistory.push(measuredTps);
   if (st.tpsHistory.length > 5) st.tpsHistory.shift();

   st.tpsLastTick = now;
   st.tpsLastTime = nowMs;
}

export function startTpsSampling() {
   if (st.tpsTaskId !== null) return;
   st.tpsLastTick = 0;
   st.tpsLastTime = 0;
   st.tpsCurrent = 20;
   st.msptCurrent = 50;
   st.tpsHistory = [];
   st.tpsTaskId = system.runInterval(sampleTps, C.TPS_SAMPLE_INTERVAL);
}

export function stopTpsSampling() {
   if (st.tpsTaskId !== null) {
      system.clearRun(st.tpsTaskId);
      st.tpsTaskId = null;
   }
}

export function getCurrentTps() {
   return st.enabled ? st.tpsCurrent : -1;
}

export function getCurrentMspt() {
   return st.enabled ? st.msptCurrent : -1;
}

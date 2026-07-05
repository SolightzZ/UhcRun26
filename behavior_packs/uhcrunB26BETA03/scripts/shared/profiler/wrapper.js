import { system, world } from '@minecraft/server';
import { logWarn } from '../Util.js';
import { scheduleReport } from './reporter.js';
import { C, flushBatch, makeEntry, st } from './state.js';
import { startTpsSampling, stopTpsSampling } from './tps.js';

export function enableProfiler() {
   try {
      world.setDynamicProperty(C.PROFILER_KEY, true);
   } catch {
      logWarn('PROFILER', 'Failed to set dynamic property (enable)');
   }
   st.enabled = true;
   if (st.reportTaskId !== null) {
      system.clearRun(st.reportTaskId);
      st.reportTaskId = null;
   }
   startTpsSampling();
   scheduleReport();
}

export function disableProfiler() {
   try {
      world.setDynamicProperty(C.PROFILER_KEY, false);
   } catch {
      logWarn('PROFILER', 'Failed to set dynamic property (disable)');
   }
   st.enabled = false;
   st.samples.clear();
   st.smoothStore.clear();
   stopTpsSampling();
}

export function toggleProfiler() {
   if (isEnabled()) {
      disableProfiler();
      logWarn('PROFILER', 'Disabled');
   } else {
      enableProfiler();
      logWarn('PROFILER', 'Enabled — will report every 30s');
   }
   return isEnabled();
}

export function isEnabled() {
   return st.enabled;
}

export function refreshEnabled() {
   st.enabled = isEnabled();
}

export function wrapTick(label, fn) {
   return (...args) => {
      if (!st.enabled) return fn(...args);
      const start = Date.now();
      const startTick = system.currentTick;
      try {
         return fn(...args);
      } finally {
         const elapsed = Date.now() - start;
         const endTick = system.currentTick;
         let entry = st.samples.get(label);
         if (!entry) {
            entry = makeEntry();
            st.samples.set(label, entry);
         }

         if (endTick !== startTick) entry.tickCross++;

         if (elapsed === 0) {
            entry.subMsBatch++;
         } else if (entry.subMsBatch > 0) {
            flushBatch(entry, elapsed, entry.subMsBatch + 1);
         } else {
            entry.total += elapsed;
            entry.calls++;
            if (elapsed > entry.max) entry.max = elapsed;
         }
      }
   };
}

export function wrapGenerator(label, genFn) {
   return function* (...args) {
      if (!st.enabled) return yield* genFn.apply(this, args);
      const start = Date.now();
      const startTick = system.currentTick;
      try {
         return yield* genFn.apply(this, args);
      } finally {
         const elapsed = Date.now() - start;
         const endTick = system.currentTick;
         let entry = st.samples.get(label);
         if (!entry) {
            entry = makeEntry();
            st.samples.set(label, entry);
         }

         if (endTick !== startTick) entry.tickCross++;

         if (elapsed === 0) {
            entry.subMsBatch++;
         } else if (entry.subMsBatch > 0) {
            flushBatch(entry, elapsed, entry.subMsBatch + 1);
         } else {
            entry.total += elapsed;
            entry.calls++;
            if (elapsed > entry.max) entry.max = elapsed;
         }
      }
   };
}

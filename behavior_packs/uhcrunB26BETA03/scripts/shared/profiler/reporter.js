import { system } from '@minecraft/server';
import { logWarn } from '../Util.js';
import { blendIntoStore, C, st } from './state.js';

export function scheduleReport() {
   if (st.reportTaskId !== null) return;
   st.reportTaskId = system.runTimeout(() => {
      st.reportTaskId = null;
      if (!st.enabled) {
         st.samples.clear();
         st.smoothStore.clear();
         return;
      }

      for (const [label, s] of st.samples) {
         if (s.subMsBatch > 0) {
            if (s.calls > 0 && s.total > 0) {
               s.total += (s.total / s.calls) * s.subMsBatch;
            }
            s.calls += s.subMsBatch;
            s.subMsBatch = 0;
         }
         if (s.calls === 0) continue;

         blendIntoStore(label, {
            calls: s.calls,
            total: s.total,
            max: s.max,
            peak: s.peakPerCall,
            cross: s.tickCross,
         });
      }

      const tps = st.tpsCurrent.toFixed(1);
      const mspt = st.msptCurrent.toFixed(1);
      const tpsMin = st.tpsHistory.length > 0 ? Math.min(...st.tpsHistory).toFixed(1) : tps;
      const tpsMax = st.tpsHistory.length > 0 ? Math.max(...st.tpsHistory).toFixed(1) : tps;
      let tpsStatus = '[/]';
      if (st.msptCurrent > 40) tpsStatus = '[?]';
      if (st.msptCurrent > 50) tpsStatus = '[x]';
      logWarn('PROFILER', `=== TPS: ${tps} (min=${tpsMin} max=${tpsMax}) | MSPT: ${mspt}ms ${tpsStatus} ===`);

      for (const [label, sm] of st.smoothStore) {
         const avg = sm.avg.toFixed(3);
         const max = sm.max.toFixed(3);
         let msg = `[PROFILER] ${label}: avg=${avg}ms max=${max}ms calls=${sm.calls} total=${sm.total.toFixed(3)}ms`;
         if (sm.peak > 0) msg += ` peak=${sm.peak.toFixed(3)}ms`;
         if (sm.cross > 0) msg += ` cross=${sm.cross}`;
         logWarn('PROFILER', msg);
      }

      st.samples.clear();
      scheduleReport();
   }, C.REPORT_INTERVAL);
}

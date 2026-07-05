export const C = Object.freeze({
   PROFILER_KEY: 'uhc_profiler_enabled',
   REPORT_INTERVAL: 600,
   MIN_REPORT_MS: 0,
   SMOOTH_ALPHA: 0.3,
   TPS_SAMPLE_INTERVAL: 40,
   TPS_ALPHA: 0.2,
});

// Shared mutable state — live binding across modules
export const st = {
   enabled: false,
   samples: new Map(),
   smoothStore: new Map(),
   reportTaskId: null,
   tpsTaskId: null,
   tpsLastTick: 0,
   tpsLastTime: 0,
   tpsCurrent: 20,
   msptCurrent: 50,
   tpsHistory: [],
};

export function makeEntry() {
   return { total: 0, calls: 0, max: 0, subMsBatch: 0, peakPerCall: 0, tickCross: 0 };
}

export function flushBatch(entry, batchElapsed, batchCount) {
   const batchTotal = batchElapsed;
   const batchCalls = batchCount;
   entry.total += batchTotal;
   entry.calls += batchCalls;
   if (batchElapsed > entry.max) entry.max = batchElapsed;
   const perCall = batchElapsed / batchCount;
   if (perCall > entry.peakPerCall) entry.peakPerCall = perCall;
   entry.subMsBatch = 0;
}

export function blendIntoStore(label, period) {
   const prev = st.smoothStore.get(label);
   if (!prev) {
      st.smoothStore.set(label, {
         avg: period.calls > 0 ? period.total / period.calls : 0,
         max: period.max,
         peak: period.peak,
         cross: period.cross,
         calls: period.calls,
         total: period.total,
      });
      return;
   }

   const periodAvg = period.calls > 0 ? period.total / period.calls : 0;
   const a = C.SMOOTH_ALPHA;

   st.smoothStore.set(label, {
      avg: a * periodAvg + (1 - a) * prev.avg,
      max: Math.max(period.max, prev.max),
      peak: Math.max(period.peak, prev.peak),
      cross: prev.cross + period.cross,
      calls: prev.calls + period.calls,
      total: prev.total + period.total,
   });
}

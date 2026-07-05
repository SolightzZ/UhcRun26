import { system } from '@minecraft/server';
import { logWarn } from '../Util.js';
import { scheduleReport } from './reporter.js';
import { st } from './state.js';
import { startTpsSampling, stopTpsSampling } from './tps.js';
import { refreshEnabled } from './wrapper.js';

export { getCurrentMspt, getCurrentTps } from './tps.js';
export { disableProfiler, enableProfiler, toggleProfiler, wrapGenerator, wrapTick } from './wrapper.js';

refreshEnabled();

if (st.enabled) {
   startTpsSampling();
   scheduleReport();
}

system.runInterval(() => {
   const saved = st.enabled;
   refreshEnabled();
   if (st.enabled !== saved) {
      if (st.enabled) {
         startTpsSampling();
         scheduleReport();
         logWarn('PROFILER', 'Auto-enabled');
      } else {
         st.samples.clear();
         st.smoothStore.clear();
         stopTpsSampling();
      }
   }
}, 100);

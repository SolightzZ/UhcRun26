import { world } from '@minecraft/server';

let lifecycleLock = null;

export function beginLifecycle(opName) {
   if (lifecycleLock) {
      world.sendMessage(`§c[UHC] Busy: ${lifecycleLock} is still running.`);
      return false;
   }
   lifecycleLock = opName;
   return true;
}

export function endLifecycle(opName) {
   if (lifecycleLock === opName) {
      lifecycleLock = null;
   }
}

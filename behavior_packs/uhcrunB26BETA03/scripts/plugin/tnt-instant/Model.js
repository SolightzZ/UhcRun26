import { LRUMap } from '../../shared/LRUMap.js';

class Model {
   TNT = 'minecraft:tnt';
   TNT_SPAWN_OFFSET = { x: 0.5, y: 0.4, z: 0.5 };
   TNT_COOLDOWN_TICKS = 2;
   TNT_GLOBAL_PER_TICK = 8;

   cdMap = new LRUMap(54);
   tntGlobalTick = -1;
   tntGlobalCount = 0;
}

export default new Model();

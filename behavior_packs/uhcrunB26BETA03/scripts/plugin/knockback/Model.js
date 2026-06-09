import { LRUMap } from '../LRUMap.js';

class Model {
   PLAYER = 'minecraft:player';
   KB_WINDOW_TICKS = 2;
   kbThrottle = new LRUMap(Infinity, 100);
}

export default new Model();

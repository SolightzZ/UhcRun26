// Object pool for {x, y, z} vectors to reduce GC pressure in hot paths (particles, knockback, teleport)
class VectorPool {
   pool;
   index = 0;

   constructor(size = 500) {
      this.pool = new Array(size);
      for (let i = 0; i < size; i++) {
         this.pool[i] = { x: 0, y: 0, z: 0 };
      }
   }

   get(x, y, z) {
      const idx = this.index;
      if (idx < this.pool.length) {
         this.index++;
         const v = this.pool[idx];
         v.x = x ?? v.x;
         v.y = y ?? v.y;
         v.z = z ?? v.z;
         return v;
      }
      return { x: x ?? 0, y: y ?? 0, z: z ?? 0 };
   }

   reset() {
      this.index = 0;
   }
}

export default new VectorPool(500);

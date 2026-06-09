// สร้างวัตถุตำแหน่ง {x,y,z} ใหม่ ใช้สิ่งนี้แทนพูลที่ไม่แน่นอนที่ใช้ร่วมกัน
export function createLoc(x = 0, y = 0, z = 0) {
   return { x, y, z };
}

// สร้างตัวเลือกแบบสอบถามเอนทิตีใหม่สำหรับสุญญากาศสินค้า การโทรแต่ละครั้งจะหลีกเลี่ยงการแชร์สถานะที่ไม่แน่นอน
export function createItemQueryOptions(x, y, z, maxDistance = 16) {
   return {
      type: 'minecraft:item',
      location: { x, y, z },
      maxDistance,
   };
}

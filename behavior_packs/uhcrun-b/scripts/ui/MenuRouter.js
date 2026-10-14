import { logError } from '../shared/Util.js';

const _nav = new Map();

// ลงทะเบียนตัวจัดการเมนูตามชื่อที่กำหนด
export function setNav(name, fn) {
   _nav.set(name, fn);
}

// นำทางไปยังเมนูที่ลงทะเบียนไว้
export function go(player, name, ...args) {
   const fn = _nav.get(name);
   if (fn) {
      fn(player, ...args);
   } else {
      logError('MenuRouter', `Menu "${name}" not registered`, null);
   }
}

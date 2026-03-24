//-----------------------------------
// Knockback
//-----------------------------------

export const KB = Object.freeze({
  horizontal: 0.18,
  vertical: 0.32,
  maxHorizontal: 1.2,
});

export function clamp(v, max) {
  if (v > max) return max;
  if (v < -max) return -max;
  return v;
}

export function normalizeXZ(dx, dz) {
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  return { x: dx / len, z: dz / len };
}

//-----------------------------------
// Dynamic message
//-----------------------------------

// เติมข้อความให้ยาว total ตัวอักษร (ปัดด้วย tab) — O(n) n = ความยาว
function padTo(text, total) {
  const len = total ?? 100;
  if (text.length > len) throw new Error("The text is too long...");
  return text + "\t".repeat(len - text.length);
}

// สร้างข้อความสำหรับ dynamic toast (message + icon + background)
function makeToast(msg, icon, bg) {
  const m = msg ?? "";
  const i = icon ?? "";
  const b = bg ?? "textures/ui/greyBorder";
  return "§N§O§T§I§F§I§C§A§T§I§O§N" + padTo(m, 500) + padTo(i, 100) + padTo(b, 100);
}

export { makeToast, makeToast as dynamicToast };

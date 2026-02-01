// เติมข้อความให้ยาวตามที่กำหนด (ใช้กับ toast)
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

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
  return (
    "§N§O§T§I§F§I§C§A§T§I§O§N" +
    padTo(m, 500) +
    padTo(i, 100) +
    padTo(b, 100)
  );
}

// ใช้ชื่อเดิมได้ (สำหรับไฟล์ที่ import อยู่)
export { makeToast, makeToast as dynamicToast, makeToast as toast };

// ส่งข้อความ / title / sound / actionBar ให้ผู้เล่นทุกคน
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world } from "@minecraft/server";

// ตัวจัดการส่งตามประเภท (message, title, sound, actionBar) — O(1) ต่อ key
const byType = {
  message: (pl, v) => pl.sendMessage(v),
  title: (pl, v) =>
    pl.onScreenDisplay.setTitle(v.title ?? "", {
      stayDuration: 200,
      fadeInDuration: 10,
      fadeOutDuration: 20,
      subtitle: v.subtitle ?? "",
    }),
  sound: (pl, v) => pl.playSound(v, { volume: 0.8, pitch: 1 }),
  actionBar: (pl, v) => pl.onScreenDisplay.setActionBar(v),
};

// ส่ง options (message/title/sound/actionBar) ให้ผู้เล่นทุกคนในโลก — O(players × keys)
export function sendAll(options) {
  const list = world.getPlayers();
  for (const pl of list) {
    for (const key in options) {
      const fn = byType[key];
      if (fn) fn(pl, options[key]);
    }
  }
}

// ใช้ชื่อเดิมได้ (สำหรับไฟล์ที่ import อยู่)
export const broadcast = sendAll;

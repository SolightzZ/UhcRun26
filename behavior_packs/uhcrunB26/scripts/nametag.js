// ตั้ง nametag จาก tag nametag:xxx (รอง @s และ \n)
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world } from "@minecraft/server";

// ========== ข้อความ (text) ==========
const txt = {
  tagStart: "nametag:",
  self: "@s",
  newLine: "\\n",
  lineBreak: "\n",
};

// ผู้เล่นที่ตั้ง nametag แล้ว (Set O(1))
const done = new Set();

// หา tag ที่ขึ้นต้น nametag:
function getTag(pl) {
  return pl.getTags().find((t) => t.startsWith(txt.tagStart));
}

// แปลง tag เป็นข้อความ nametag (แทน @s ด้วยชื่อ, \n เป็นขึ้นบรรทัดใหม่)
function toName(raw, pl) {
  return raw
    .replace(txt.tagStart, "")
    .replaceAll(txt.self, pl.name)
    .replaceAll(txt.newLine, txt.lineBreak);
}

// ตั้ง nametag ให้ผู้เล่น (ครั้งเดียวต่อ spawn)
function setTag(pl) {
  const raw = getTag(pl);
  if (!raw) return;

  pl.removeTag(raw);
  pl.nameTag = toName(raw, pl);
}

// รับ event spawn: ถ้ายังไม่เคยตั้ง nametag ให้ตั้ง
function onSpawn(e) {
  const pl = e.player;
  if (done.has(pl.id)) return;

  done.add(pl.id);
  setTag(pl);
}

world.afterEvents.playerSpawn.subscribe(onSpawn);

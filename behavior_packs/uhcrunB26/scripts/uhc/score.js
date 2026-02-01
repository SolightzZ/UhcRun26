// อัปเดต scoreboard uhc: Border และ Tick แยกเป็น function
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world } from "@minecraft/server";
import { txt } from "./config.js";

// ตั้ง score Border และ Tick สำหรับผู้เล่น (เช็คว่าผู้เล่นยังอยู่ในโลกก่อน)
export function setScore(player, radius, tick) {
  const all = world.getPlayers();
  if (!all.some((p) => p.id === player.id)) return;

  const board = world.scoreboard;
  const obj = board.getObjective(txt.objName) ?? board.addObjective(txt.objName, txt.objDisplay);
  obj.setScore(txt.objBorder, ~~radius);
  obj.setScore(txt.objTick, tick);
}

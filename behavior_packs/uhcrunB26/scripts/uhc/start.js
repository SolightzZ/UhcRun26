// จัดการเริ่มเกม: กระจายทีม, countdown bar, effect แบบ FP + ชื่อสั้น
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world, system, GameMode } from "@minecraft/server";
import { teamList } from "./data.js";
import { num, txt } from "./config.js";

// สถานะเริ่มเกม (ใช้ใน module นี้เท่านั้น)
let tick = 0;
let bar = num.barNumStart;

// เช็คว่าผู้เล่นยังอยู่และใช้ได้
export function ok(player) {
  try {
    return !!player.dimension && !!player.location && player.isValid();
  } catch {
    return false;
  }
}

// รีเซ็ตค่าเริ่มเกม (event start:clear เรียก)
export function reset() {
  tick = 0;
  bar = num.barNumStart;
}

// กระจายทีมไปจุดสุ่ม แล้วเทเลพอร์ตสมาชิกไปหัวหน้าทีม
export async function spread() {
  for (const team of teamList) {
    const members = world.getPlayers({ tags: [team, "uhc"] });
    if (!members.length) continue;

    const head = members[0];
    await head.runCommand(`/spreadplayers 0 0 50 486 @s`);
    const pos = head.location;
    head.teleport(pos);

    for (const p of members) {
      if (p !== head) p.teleport(pos);
    }
  }
}

// แสดง particle ระเบิดเหนือหัวสุ่ม 1 คนต่อทีม
function boom() {
  const dim = world.getDimension("overworld");
  const done = new Set();

  for (const team of teamList) {
    if (done.has(team)) continue;
    const list = world.getPlayers({ tags: [team, "uhc"] });
    if (!list.length) continue;

    const one = list[~~(Math.random() * list.length)];
    if (!ok(one)) continue;

    try {
      const { x, y, z } = one.location;
      dim.spawnParticle("minecraft:huge_explosion_emitter", { x, y: y + 2.5, z });
      done.add(team);
    } catch (e) {
      console.warn("[UHC] particle " + team + ": " + e.message);
    }
  }
}

// แสดงแถบ progress บน ActionBar (เขียวขาว + ตัวเลข)
export function showBar(player) {
  if (bar < 0) {
    player.onScreenDisplay.setActionBar("");
    return;
  }

  const total = num.totalBar;
  const green = total - bar;
  let line = "";
  for (let i = 0; i < total; i++) {
    line += i < green ? "§a▌" : "§f▌";
  }
  const msg = txt.gameStart + line + " §r" + bar;
  player.onScreenDisplay.setActionBar(msg);

  if (green > 20) {
    player.playSound("note.pling", { volume: 0.8, pitch: 0.75 });
  }
}

// effect ภาพ/เสียง ตาม tick (title, fade, sound) ให้ทุกคน
function effect(players) {
  for (const p of players) {
    if (!ok(p)) continue;

    switch (tick) {
      case 1:
        p.onScreenDisplay.setTitle(txt.startLogo, {
          stayDuration: 200,
          fadeInDuration: 5,
          fadeOutDuration: 40,
        });
        p.camera.fade({
          fadeTime: { fadeInTime: 0, holdTime: 10, fadeOutTime: 10 },
          fadeColor: { red: 0.1, green: 0.1, blue: 0.1 },
        });
        break;
      case 2:
        p.playSound("start", { volume: 0.5, pitch: 1 });
        break;
      case 39:
        world.gameRules.showCoordinates = true;
        if (p.inputPermissions) p.inputPermissions.movementEnabled = true;
        p.onScreenDisplay.setTitle(txt.goodLuck);
        p.playSound("startPlayer", { volume: 1.5, pitch: 0.9 });
        p.playSound("random.explode", { volume: 0.7, pitch: 0.9 });
        break;
    }
  }
}

// ตั้งค่าเฉพาะผู้เล่น uhc ตาม tick (โหมด, ไอเทม, เทเลพอร์ต)
function setup(players) {
  for (const p of players) {
    if (!ok(p)) continue;

    switch (tick) {
      case 1:
        p.setGameMode(GameMode.Adventure);
        if (p.inputPermissions) p.inputPermissions.movementEnabled = false;
        break;
      case 7:
        spread();
        break;
      case 24:
        p.runCommand(`loot replace entity @a[tag=uhc] slot.hotbar 0 loot "solight/stone_axe"`);
        p.runCommand(`loot replace entity @a[tag=uhc] slot.hotbar 1 loot "solight/stone_pickaxe"`);
        p.runCommand(`replaceitem entity @a[tag=uhc] slot.hotbar 2 minecraft:cooked_beef 3`);
        p.runCommand(`replaceitem entity @a[tag=uhc] slot.hotbar 3 minecraft:boat`);
        break;
      case 39:
        boom();
        p.removeEffect("invisibility");
        p.setGameMode(GameMode.Survival);
        break;
    }
  }
}

// เรียกทุก tick ระหว่างเริ่มเกม: เพิ่ม tick, effect, setup, แสดง bar, รีเซ็ตเมื่อจบ
export function run(uhcPlayers) {
  tick++;
  const all = world.getPlayers();

  effect(all);
  setup(uhcPlayers);

  if (tick > num.startBarFrom) {
    all.forEach((p) => showBar(p));
    if (bar >= 0) bar--;
  }

  if (tick >= num.startTickEnd) {
    reset();
  }
}

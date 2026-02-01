// ต้อนรับผู้เล่นเข้าเกม + UHC spec แบบ event-driven
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world, system, GameMode } from "@minecraft/server";
import { dynamicToast } from "./message.js";

// สถานะโหมดป้องกันผู้เล่น (เปิด/ปิด)
let uhcOn = false;

// รอ ms มิลลิวินาที (แปลงเป็น tick)
function wait(ms) {
  return new Promise((resolve) => {
    const id = system.runTimeout(() => {
      system.clearRun(id);
      resolve();
    }, ms / 20);
  });
}

// ทักทายผู้เล่น (ข้อความ welcome)
async function greet(p) {
  world.sendMessage(dynamicToast(`Welcome to the \n§7${p.name}`, "", "textures/ui/beacon_button_locked"));
}

// เปิดเสียงและ particle ตอน spawn
async function boost(p) {
  await p.runCommand("playsound spawn @a[r=8] ~ ~ ~ 10 1.1 10");
  await p.runCommand("particle so:light2 ~~4.5~");
  await p.runCommand("hud @s hide item_text");
  await p.runCommand("hud @s hide status_effects");
  await p.runCommand("function sets/name");
}

// ให้ compass ใน slot 8
async function equip(p) {
  await p.runCommand(`loot replace entity @a slot.hotbar 8 loot "solight/compass"`);
}

// ใส่โหมดผู้ชม + บอกคำสั่ง tp
async function spec(p) {
  p.setGameMode(GameMode.spectator);
  await p.sendMessage(" §7§l\u00BB§r§7 คุณได้เข้าร่วมในฐานะผู้ชม สามารถพิมพ์ `§btp§7` ไปหาผู้เล่นที่อยู่ใน UHC ได้เลย");
  await p.addTag("gamemode");
}

// ตั้งค่าหลัง spawn: รอ -> ทักทาย -> boost -> equip -> (ถ้า UHC) spec
async function setup(p) {
  await wait(150);
  await greet(p);
  await boost(p);
  await equip(p);

  if (uhcOn && !p.hasTag("uhc")) {
    await spec(p);
  }
}

// รับ script event join:start / join:stop เปิด/ปิดโหมดป้องกัน
function onScriptEvent(e) {
  if (!e.sourceEntity) return;

  switch (e.id) {
    case "join:start":
      uhcOn = true;
      world.sendMessage(" [!] โหมดป้องกันผู้เล่นเข้ามา §aเปิดใช้งานแล้ว");
      break;
    case "join:stop":
      uhcOn = false;
      world.sendMessage(" [!] โหมดป้องกันผู้เล่นเข้ามา §cปิดใช้งานแล้ว");
      break;
    default:
      break;
  }
}

world.afterEvents.playerSpawn.subscribe(async ({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  await setup(player);
});

system.afterEvents.scriptEventReceive.subscribe(onScriptEvent);

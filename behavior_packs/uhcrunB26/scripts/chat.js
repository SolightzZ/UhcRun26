// เมนูเทเลพอร์ต UHC + route คำสั่งแชท แบบ event-driven
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { openProfile } from "./FromD.js";

// ========== ตัวเลข (number) ==========
const num = {
  stayDuration: 200,
  fadeIn: 10,
  fadeOut: 20,
  runDelay: 35,
};

// ========== ข้อความ (text) ==========
const txt = {
  menuTitle: "Teleport to UHC Player",
  menuBody: "§eSelect a team or player to teleport.",
  btnAll: "Player",
  btnProfile: "UHCRun Profile",
  btnBack: "§cBack",
  bodySelect: "§eSelect a player to teleport.",
  titleAll: "Player",
  titleSelect: "§eSelect a player to teleport.",
};

// ข้อมูลทีม: Map tag -> { name, texture } — O(1) lookup
const teamMap = new Map([
  ["team1", { name: "§cRed Team", texture: "textures/items/dye_powder_red" }],
  ["team2", { name: "§9Blue Team", texture: "textures/items/dye_powder_blue_new" }],
  ["team3", { name: "§gYellow Team", texture: "textures/items/dye_powder_yellow" }],
  ["team4", { name: "§aGreen Team", texture: "textures/items/dye_powder_lime" }],
  ["team5", { name: "§5Purple Team", texture: "textures/items/dye_powder_purple" }],
  ["team6", { name: "§bAqua Team", texture: "textures/items/dye_powder_light_blue" }],
  ["team7", { name: "§6Orange Team", texture: "textures/items/dye_powder_orange" }],
  ["team8", { name: "§7Gray Team", texture: "textures/items/dye_powder_silver" }],
  ["team9", { name: "§dPink Team", texture: "textures/items/dye_powder_pink" }],
]);

// รายการ tag ทีมที่มีผู้เล่นอยู่ — O(teams × players)
function getTeams() {
  const list = [];
  const all = world.getPlayers();
  for (const [tag] of teamMap) {
    if (all.some((p) => p.hasTag(tag))) list.push(tag);
  }
  return list;
}

// เปิดเมนูเทเลพอร์ต (เรียกจาก event)
export function openTpMenu(pl) {
  system.runTimeout(() => {
    pl.playSound("note.hat", { volume: 0.9, pitch: 0.95 });
    showMain(pl);
  }, num.runDelay);
}

// แสดงฟอร์มหลัก: ทุกคนออนไลน์ / โปรไฟล์ / ทีม
async function showMain(pl) {
  const teams = getTeams();
  const all = world.getPlayers();
  const form = new ActionFormData();

  form
    .title(txt.menuTitle)
    .body(txt.menuBody)
    .button(txt.btnAll + " " + all.length + " Online")
    .button(txt.btnProfile);

  for (const tag of teams) {
    const t = teamMap.get(tag);
    form.button(t.name, t.texture);
  }

  const res = await form.show(pl);
  if (res.canceled) return;

  if (res.selection === 0) {
    showAllPlayers(pl);
  } else if (res.selection === 1) {
    openProfile(pl);
  } else {
    const tag = teams[res.selection - 2];
    showTeamPlayers(pl, tag);
  }
}

// แสดงรายชื่อผู้เล่นทั้งหมด
async function showAllPlayers(pl) {
  const list = world.getPlayers();
  const form = new ActionFormData();

  form.title(txt.titleAll + " " + list.length + " Online").body(txt.bodySelect);

  for (const p of list) {
    form.button(p.name, "textures/ui/xbox4");
  }
  form.button(txt.btnBack);

  const res = await form.show(pl);
  if (res.canceled) return;

  if (res.selection === list.length) {
    showMain(pl);
  } else {
    tpToPlayer(pl, list[res.selection]);
  }
}

// แสดงรายชื่อผู้เล่นในทีม
async function showTeamPlayers(pl, tag) {
  const t = teamMap.get(tag);
  if (!t) return;

  const list = world.getPlayers().filter((p) => p.hasTag(tag));
  const form = new ActionFormData();

  form.title(t.name).body(txt.bodySelect);

  for (const p of list) {
    form.button(p.name, t.texture);
  }
  form.button(txt.btnBack);

  const res = await form.show(pl);
  if (res.canceled) return;

  if (res.selection === list.length) {
    showMain(pl);
  } else {
    tpToPlayer(pl, list[res.selection]);
  }
}

// เทเลพอร์ตไปยังผู้เล่นเป้าหมาย (เฉพาะ gamemode)
async function tpToPlayer(pl, target) {
  if (!pl.hasTag("gamemode")) return;

  const loc = {
    x: target.location.x + Math.random() * 2 - 1,
    y: target.location.y,
    z: target.location.z + Math.random() * 2 - 1,
  };

  await pl.teleport(loc, {
    dimension: target.dimension,
    facingLocation: {
      x: target.location.x,
      y: target.location.y + 1,
      z: target.location.z,
    },
    checkForBlocks: true,
  });

  await pl.setGameMode(GameMode.Spectator);
  await pl.runCommand("effect @s conduit_power infinite 255 true");
}

// route คำสั่งแชท: cmd -> function — O(1) lookup, ขยายได้
const cmdMap = {
  tp: (pl) => pl.hasTag("gamemode") && openTpMenu(pl),
};

// รับ event แชท แล้วเรียก handler ตาม cmd
function onChat(e) {
  const pl = e.sender;
  const cmd = e.message.trim().toLowerCase();

  if (cmdMap[cmd]) {
    e.cancel = true;
    cmdMap[cmd](pl);
  }
}

world.beforeEvents.chatSend.subscribe(onChat);

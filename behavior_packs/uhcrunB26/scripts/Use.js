// เมนูเข็มทิศ + ทีม + Emotes + คำสั่งแชท แบบ event-driven
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { toast } from "./message.js";

// ========== ตัวเลข (number) ==========
const num = {
  runDelay: 35,
  spawnX: 596,
  spawnZ: 622,
  spawnRange: 0,
  spreadRange: 1,
  particleY: 5,
};

// ========== ข้อความ (text) ==========
const txt = {
  menuTitle: "§g§r\uE000\uE001",
  menuBody: "§7Sleeplite UHC§6Run§726",
  adminTitle: "Show Menu",
  teamTitle: "Team",
  emoteTitle: "§g§rEmotes",
  btnClear: "Clear Emote",
  headTeam: "§8----- §gUHCRun Team §8-----§f\n",
  headKill: "§8----- §gUHCRun Kills §8-----§f\n",
  objKill: "kills",
  objKillDisplay: "Kills",
};

// รายการทีม (id, color, name, icon)
const teamList = [
  { id: "team1", color: "§c", name: "Red", icon: "textures/items/dye_powder_red" },
  { id: "team2", color: "§9", name: "Blue", icon: "textures/items/dye_powder_blue_new" },
  { id: "team3", color: "§g", name: "Yellow", icon: "textures/items/dye_powder_yellow" },
  { id: "team4", color: "§a", name: "Green", icon: "textures/items/dye_powder_lime" },
  { id: "team5", color: "§5", name: "Purple", icon: "textures/items/dye_powder_purple" },
  { id: "team6", color: "§b", name: "Aqua", icon: "textures/items/dye_powder_light_blue" },
  { id: "team7", color: "§6", name: "Orange", icon: "textures/items/dye_powder_orange" },
  { id: "team8", color: "§7", name: "Gray", icon: "textures/items/dye_powder_silver" },
  { id: "team9", color: "§d", name: "Pink", icon: "textures/items/dye_powder_pink" },
];

// Map id -> ทีม หา O(1)
const teamMap = new Map(teamList.map((t) => [t.id, t]));

// แสดงฟอร์มปุ่ม (title, body, buttons) แล้วเรียก action ตามที่เลือก
async function showForm(pl, title, body, buttons) {
  const form = new ActionFormData().title(title);
  if (body) form.body(body);
  buttons.forEach((b) => form.button(b.label, b.icon));
  const res = await form.show(pl);
  if (!res || res.canceled) return;
  const act = buttons[res.selection]?.action;
  if (act) act(pl);
}

// เปิดเมนูหลัก: SPAWN, ทีม, Emotes, (Admin: Show Menu)
function openMenu(pl) {
  const buttons = [
    { label: "SPAWN", icon: "textures/items/dragons_breath", action: goSpawn },
    ...teamList.map((t) => ({
      label: t.color + t.name + " " + txt.teamTitle,
      icon: t.icon,
      action: () => joinTeam(pl, t),
    })),
    { label: "Emotes", icon: "textures/ui/sidebar_icons/emotes.png", action: openEmote },
  ];

  if (pl.hasTag("Admin")) {
    buttons.push({
      label: txt.adminTitle,
      icon: "textures/ui/sidebar_icons/csb_sidebar_icon",
      action: openAdmin,
    });
  }

  showForm(pl, txt.menuTitle, txt.menuBody, buttons);
}

// เข้าร่วมทีม แล้วรันคำสั่งทีม (คำสั่งเกมมี _ ใน path ไม่ใช่ชื่อเรา)
function joinTeam(pl, t) {
  if (!pl.hasTag(t.id)) {
    world.sendMessage(toast(t.color + t.name + " " + txt.teamTitle + " §7- " + pl.name, t.icon));
  }
  const n = t.id.slice(-1);
  pl.runCommand("function team/addteam_" + n);
}

// เทเลพอร์ตไป spawn + เอฟเฟกต์
function goSpawn(pl) {
  pl.runCommand(
    "spreadplayers " + num.spawnX + " " + num.spawnZ + " " + num.spawnRange + " " + num.spreadRange + " @s"
  );
  pl.playSound("random.enderchestopen", { volume: 0.9, pitch: 0.95 });
  const { x, y, z } = pl.location;
  pl.dimension.spawnParticle("so:light2", { x, y: y + num.particleY, z });
}

// เมนูแอดมิน: รายชื่อทีม, รายการ kill, Compass, Spawn, @a
function openAdmin(pl) {
  const buttons = [
    { label: "Player list", action: showTeamList },
    { label: "Kill list", action: showKillList },
    { label: "Compass", action: () => pl.runCommand("function sets/compass") },
    { label: "Spawn", action: () => pl.runCommand("spreadplayers " + num.spawnX + " " + num.spawnZ + " 0 " + num.spreadRange + " @a") },
    { label: "@a", action: () => tpAll(pl) },
  ];
  showForm(pl, txt.adminTitle, null, buttons);
}

// เทเลพอร์ตทุกคนไปตำแหน่งผู้เล่น
function tpAll(pl) {
  const loc = pl.location;
  const rotY = pl.getRotation()?.y ?? 0;
  const all = world.getAllPlayers();
  for (const o of all) {
    o.teleport(loc, { rotation: { x: 0, y: rotY }, keepVelocity: false });
  }
}

// ส่งข้อความรายชื่อทีมและจำนวนคน
function showTeamList() {
  let msg = txt.headTeam;
  for (const t of teamList) {
    const ps = world.getPlayers({ tags: [t.id] });
    if (ps.length) {
      msg += t.color + t.name + " " + ps.length + ": " + [...ps].map((p) => p.name).join(", ") + "\n";
    }
  }
  world.sendMessage(msg);
}

// ส่งข้อความรายการ kill จาก scoreboard
function showKillList() {
  const board = world.scoreboard;
  const obj = board.getObjective(txt.objKill) ?? board.addObjective(txt.objKill, txt.objKillDisplay);
  let msg = txt.headKill;
  for (const pl of world.getPlayers()) {
    const score = obj.getScore(pl.scoreboardIdentity) ?? 0;
    msg += " §7» §f" + pl.name + " §c" + score + " kill\n";
  }
  world.sendMessage(msg);
}

// รายการ Emote [ชื่อ, animation] (animation ID ของเกมมี _ ได้)
const emoteList = [
  ["Dab", "animation.humanoid.custom.dab"],
  ["Twerking", "animation.humanoid.custom.perreo"],
  ["LMAO", "animation.humanoid.custom.risa"],
  ["Cry", "animation.humanoid.custom.llorar"],
  ["Desperate", "animation.humanoid.desesperado"],
  ["T - Pose", "animation.humanoid.t-pose"],
  ["Slap", "animation.humanoid.customm.cachetada"],
  ["Flip", "animation.humanoid.flip_atras"],
  ["Throwing Money", "animation.humanoid.melapelas"],
  ["Floss", "animation.humanoid.baile"],
  ["Champion", "animation.humanoid.customm.campeon"],
  ["You're Dead", "animation.humanoid.customm.muerto"],
  ["I'm Here", "animation.humanoid.aquiestoy"],
  ["...", "animation.humanoid.naca"],
  ["Arigato", "animation.humanoid.arigato"],
  ["Lie Down", "animation.humanoid.customm.baile_16"],
  ["Sitting", "animation.humanoid.customm.baile_17"],
  ["Take the L", "animation.humanoid.customm.baile_18"],
  ["Best Mates", "animation.humanoid.customm.baile_19"],
  ["Idle", "animation.humanoid.customm.baile_20"],
  ["Flow", "animation.humanoid.customm.baile_21"],
  ["Skibidi", "animation.humanoid.customm.baile_22"],
  ["Clubbing", "animation.humanoid.customm.baile_23"],
  ["Squat", "animation.humanoid.customm.baile_24"],
  ["Hype", "animation.humanoid.customm.baile_25"],
];

// เปิดเมนู Emote
function openEmote(pl) {
  const buttons = [{ label: txt.btnClear, icon: "", action: () => clearEmote(pl) }];
  for (const [name, anim] of emoteList) {
    buttons.push({ label: name, icon: "", action: () => playEmote(pl, anim) });
  }
  showForm(pl, txt.emoteTitle, null, buttons);
}

function clearEmote(pl) {
  pl.runCommand("playanimation @p animation.creaking.sway");
}

function playEmote(pl, anim) {
  pl.runCommand("playanimation @p " + anim + " " + anim);
}

// route คำสั่งแชท (ขยายได้โดยเพิ่ม key)
const cmdMap = {
  admin: (pl) => pl.hasTag("Admin") && system.runTimeout(() => openMenu(pl), num.runDelay),
  world: (pl) => pl.hasTag("Admin") && system.runTimeout(() => openAdmin(pl), num.runDelay),
  list: () => showTeamList(),
  kill: (pl) => {
    pl.runCommand("playsound random.chestopen @s");
    showKillList();
  },
};

// รับแชท แล้วเรียก handler ตาม cmd
function onChat(e) {
  const pl = e.sender;
  const cmd = e.message.trim().toLowerCase();
  if (cmdMap[cmd]) {
    e.cancel = true;
    cmdMap[cmd](pl);
  }
}

// ใช้เข็มทิศ (compass) เปิดเมนู (uhc หรือ Admin)
function onUse(e) {
  const pl = e.source;
  const item = e.itemStack;
  if (item.typeId === "minecraft:compass" && (!pl.hasTag("uhc") || pl.hasTag("Admin"))) {
    openMenu(pl);
  }
}

world.afterEvents.itemUse.subscribe(onUse);
world.beforeEvents.chatSend.subscribe(onChat);

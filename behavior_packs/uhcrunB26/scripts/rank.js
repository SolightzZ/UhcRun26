// แสดง rank ในแชท + ตรวจคำสั่งที่ GM/Admin ใช้ได้
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world } from "@minecraft/server";

// ========== ข้อความ (text) ==========
const txt = {
  tagGm: "gamemode",
  tagAdmin: "Admin",
  tagRank: "rank:",
  chatSep: " §8§l»§r§7 ",
  rankEmpty: "\uE002 ",
};

// คำสั่งที่ GM ใช้ได้ (Set O(1))
const cmdGm = new Set(["tp"]);
// คำสั่งที่ Admin ใช้ได้ (Set O(1))
const cmdAdmin = new Set(["admin", "kill", "list", "help", "world"]);

// สร้างโปรไฟล์ผู้เล่น (isGm, isAdmin, rank)
function getProfile(pl) {
  const tags = new Set(pl.getTags());
  return {
    isGm: tags.has(txt.tagGm),
    isAdmin: tags.has(txt.tagAdmin) || hasRank(tags),
    rank: getRank(tags),
  };
}

// เช็คว่าคำสั่งนี้ GM/Admin ใช้ได้หรือไม่ (ไม่ cancel)
function canUseCmd(msg, pro) {
  const words = msg.split(/\s+/);
  return words.some(
    (cmd) => (pro.isGm && cmdGm.has(cmd)) || (pro.isAdmin && cmdAdmin.has(cmd))
  );
}

// ส่งแชทพร้อม prefix rank
function sendChat(pl, msg, pro) {
  const prefix = pro.rank + pl.name + txt.chatSep;
  world.sendMessage(prefix + msg);
}

// มี tag rank:xxx หรือไม่
function hasRank(tags) {
  return [...tags].some((t) => t.startsWith(txt.tagRank));
}

// คืนค่า rank จาก tag (ตัด prefix ออก)
function getRank(tags) {
  const tag = [...tags].find((t) => t.startsWith(txt.tagRank));
  return tag ? tag.slice(txt.tagRank.length) : txt.rankEmpty;
}

// รับแชท: ถ้าไม่ใช่คำสั่งที่อนุญาต ให้ cancel แล้วส่งแชทแบบมี rank
function onChat(e) {
  const pl = e.sender;
  const msg = e.message;
  const pro = getProfile(pl);

  if (canUseCmd(msg, pro)) return;

  e.cancel = true;
  sendChat(pl, msg, pro);
}

world.beforeEvents.chatSend.subscribe(onChat);

// ฟอร์มโปรไฟล์ UHC + Tips + route script event
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { openTpMenu } from "./chat.js";

// ========== ตัวเลข (number) ==========
const num = {
  runDelay: 60,
};

// ========== ข้อความ (text) ==========
const txt = {
  titleProfile: "UHCRun Profile",
  btnNext: "Next",
  btnBack: "Back",
  btnClose: "Close",
  titleTips: "UHCRun Tips",
  bodyTips:
    "\n§d §l\u00BB§r  สามารถพิมพ์ '§btp§r' ลงในช่องแชทเพื่อเลือก" +
    "\n    เทเลพอร์ต ไปยังผู้เล่นอื่นๆได้" +
    "\n§5 §l\u00BB§f  ขอบคุณที่มาเล่นนะครับ/ค่ะ \n ",
  unknown: "Unknown",
};

// ชื่อ objective ใน scoreboard — getObjective O(1) ถ้ามี
const scoreKill = "kills";
const scoreDeath = "deaths";

// ดึงค่า kills, deaths, kdr, platform จากผู้เล่น
function getStats(pl) {
  const kills = scoreOf(pl, scoreKill);
  const deaths = scoreOf(pl, scoreDeath);
  const kdr = deaths !== 0 ? (kills / deaths).toFixed(2) : kills;
  const platform = getPlatform(pl);
  return { kills, deaths, kdr, platform };
}

// สร้างข้อความ body ของฟอร์มโปรไฟล์
function buildBody(pl, stats) {
  return (
    "\n§c  §l\u00BB §rName: §7" +
    pl.name +
    "\n§6  §l\u00BB §rPlatform: §7" +
    stats.platform +
    "\n§g  §l\u00BB §rKills: §7" +
    stats.kills +
    "\n§a  §l\u00BB §rDeaths: §7" +
    stats.deaths +
    "\n§9  §l\u00BB §rKDR: §7" +
    stats.kdr +
    "\n "
  );
}

// คืนค่า score จาก objective — O(1) ถ้ามี objective
function scoreOf(pl, objName) {
  const obj = world.scoreboard.getObjective(objName);
  if (!obj) return 0;
  return obj.getScore(pl.scoreboardIdentity) ?? 0;
}

// คืนค่าป้าย platform (Mobile/Desktop/Console) จาก client
function getPlatform(pl) {
  const raw = pl.clientSystemInfo?.platformType;
  if (!raw) return txt.unknown;

  const byRaw = {
    mobile: "Mobile",
    desktop: "Desktop",
    console: "Console",
  };
  return byRaw[String(raw).toLowerCase()] ?? txt.unknown;
}

// เปิดฟอร์มโปรไฟล์ (เรียกจาก chat หรือ script event)
export async function openProfile(pl) {
  const stats = getStats(pl);
  const body = buildBody(pl, stats);

  const form = new ActionFormData();
  form.title(txt.titleProfile).body(body).button(txt.btnNext);

  if (pl.hasTag("gamemode")) {
    form.button(txt.btnBack);
  }

  const res = await form.show(pl);
  if (res.canceled) return;

  if (res.selection === 0) {
    showTips(pl);
  } else if (res.selection === 1) {
    openTpMenu(pl);
  }
}

// แสดงฟอร์ม Tips แล้วกลับไปโปรไฟล์หรือปิด
async function showTips(pl) {
  const form = new ActionFormData();
  form
    .title(txt.titleTips)
    .body(txt.bodyTips)
    .button(txt.btnBack)
    .button(txt.btnClose);

  const res = await form.show(pl);
  if (res.canceled) return;

  if (res.selection === 0) {
    openProfile(pl);
  }
}

// รับ script event show:stats แล้วเปิดโปรไฟล์
function onScriptEvent(event) {
  const pl = event.sourceEntity;
  if (!pl || event.id !== "show:stats") return;

  system.runTimeout(() => {
    openProfile(pl);
  }, num.runDelay);
}

system.afterEvents.scriptEventReceive.subscribe(onScriptEvent);

// loop เกม, ชัยชนะ, game over, border, event ตาม tick แยก logic ชัด
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { system, world } from "@minecraft/server";
import { num, txt, countSet, warnList } from "./config.js";
import { say } from "./broadcast.js";
import { dist, maxDist, warn, showParticle } from "./border.js";
import { setScore } from "./score.js";
import { teamList, getTeam } from "./data.js";
import { run as startRun } from "./start.js";
import { makeToast } from "../message.js";

// สถานะเกม (ใช้ใน module นี้เท่านั้น)
let on = false;
let tick = 0;
let radius = num.radiusStart;
let countId = null;
let loopId = null;
// Set รัศมีที่เตือนแล้ว (สร้างใหม่ทุกเกม เพื่อ O(1) เช็ค)
let warnSet = new Set(warnList);

// เริ่มเกม: เปิด on, รีเซ็ต tick/radius/warnSet, เปิด loop
export function go() {
  if (on) return;
  on = true;
  tick = 0;
  radius = num.radiusStart;
  warnSet = new Set(warnList);
  loop();
}

// หยุดเกม: ปิด on, รีเซ็ต, ยกเลิก interval
export function stop() {
  if (!on) return;
  on = false;
  tick = 0;
  radius = num.radiusStart;
  if (loopId) system.clearRun(loopId);
  if (countId) system.clearRun(countId);
  loopId = null;
  countId = null;
}

// ตรวจว่าทีมที่เหลือหนึ่งทีมหรือไม่ (ใช้ Set O(1)) แล้วเรียก gameOver
function checkWin(uhcPlayers) {
  if (!on || tick <= 60) return;
  const active = new Set();
  for (const p of uhcPlayers) {
    for (const tag of teamList) {
      if (p.hasTag(tag)) {
        active.add(tag);
        break;
      }
    }
  }
  if (active.size === 1) gameOver();
}

// หด border ตามเวลา (ช่วง tickShrinkStart–tickShrinkEnd)
function shrink() {
  if (tick < num.tickShrinkStart || tick > num.tickShrinkEnd) return;
  const rate = (radius - num.radiusEnd) / num.shrinkTime;
  const adj = tick <= 1200 ? 0.3 : tick <= 1800 ? 0.1 : -0.1;
  radius = Math.max(num.radiusEnd, radius - rate + adj);
}

// เตือน border ถึงรัศมีใน warnSet (ใช้ Set O(1)) แค่ครั้งเดียว
async function borderWarn(uhcPlayers) {
  const r = ~~radius;
  if (!warnSet.has(r)) return;
  warnSet.delete(r);
  if (uhcPlayers.length) {
    await say(uhcPlayers, {
      message: txt.borderWarnMsg + r + txt.block,
      sound: "noti",
      actionBar: "",
      title: "",
      subtitle: "",
    });
  }
}

// แสดงชัยชนะ: หาทีมชนะ O(1) จาก Map, firework, broadcast
export async function win() {
  const uhc = world.getAllPlayers().filter((p) => p.hasTag("uhc"));
  if (!uhc.length) {
    world.sendMessage(txt.noWinner);
    return;
  }

  let winTag = null;
  for (const tag of teamList) {
    const has = uhc.some((p) => p.hasTag(tag));
    if (has) {
      winTag = tag;
      break;
    }
  }

  if (!winTag) {
    world.sendMessage(txt.noTeam);
    return;
  }

  const team = getTeam(winTag);
  const name = team ? team.color + team.name : "§c" + winTag;
  const color = team ? team.color : "§c";
  const members = uhc.filter((p) => p.hasTag(winTag));

  for (const p of members) {
    world.getDimension(p.dimension.id).spawnEntity("minecraft:fireworks_rocket", {
      x: p.location.x,
      y: p.location.y + 1,
      z: p.location.z,
    });
  }

  await say(world.getAllPlayers(), {
    title: txt.victory,
    subtitle: name + txt.win,
    sound: "win",
    actionBar: "",
    message: "",
  });

  let msg = txt.victoryHead;
  msg += name + " : " + color + members.map((p) => p.name).join("§f, ") + "\n";
  msg += txt.victoryFoot;
  world.sendMessage(msg);
}

// countdown game over: 120 วินาที, ที่ 115 เรียก win และหยุด loop, ที่ 0 เรียก function end
function gameOver() {
  if (countId) return;
  let left = num.countdownGameOver;
  const all = world.getAllPlayers();

  countId = system.runInterval(async () => {
    if (left > 0) {
      await say(all, {
        actionBar: "§c" + txt.gameOver + left + " §c! ",
        message: "",
        title: "",
        subtitle: "",
        sound: "",
      });
      if (left === num.countdownStopLoop && loopId) system.clearRun(loopId);
      if (left === num.countdownStopLoop) await win();
      if (left <= 5) {
        await say(all, { sound: "note.pling", actionBar: "", message: "", title: "", subtitle: "" });
      }
    } else if (left === 0) {
      world.getDimension("overworld").runCommand("function games/end");
      stop();
    } else {
      system.clearRun(countId);
      countId = null;
    }
    left--;
  }, 20);
}

// event ตาม tick: PVP, border, mob, credit
async function doEvent(players) {
  const t = tick;
  const empty = { actionBar: "", message: "", title: "", subtitle: "", sound: "" };

  if (t === 60) {
    await say(players, {
      message: "  : " + txt.pvpOff,
      title: txt.pvpOffTitle,
      subtitle: txt.pvpOffSub,
      sound: "noti",
      actionBar: "",
    });
    world.gameRules.pvp = false;
    return;
  }
  if (t === 120) {
    await say(players, {
      message: txt.borderIn,
      title: txt.borderInTitle,
      subtitle: txt.borderInSub,
      sound: "noti",
      actionBar: "",
    });
    return;
  }
  if (t === 200) {
    world.sendMessage(makeToast("§fUHC§6Run §7Made by SolightzZ", "textures/uhc/solightzz", "textures/ui/purpleBorder"));
    await say(players, { ...empty, sound: "note.pling" });
    return;
  }
  if (t === 680) {
    await say(players, {
      message: txt.pvpIn20,
      title: txt.pvpIn20Title,
      subtitle: txt.pvpIn20Sub,
      sound: "noti",
      actionBar: "",
    });
    return;
  }
  if (t === 694) {
    await say(players, { message: txt.pvp3, sound: "note.pling", ...empty });
    return;
  }
  if (t === 696) {
    await say(players, { message: txt.pvp2, sound: "note.pling", ...empty });
    return;
  }
  if (t === 698) {
    await say(players, { message: txt.pvp1, sound: "world_noti", ...empty });
    return;
  }
  if (t === 700) {
    await say(players, {
      message: "  : " + txt.pvpOn,
      title: txt.pvpOnTitle,
      subtitle: txt.pvpOnSub,
      sound: "note.pling",
      actionBar: "",
    });
    world.gameRules.pvp = true;
    return;
  }
  if (t === 900) {
    await say(players, {
      message: txt.borderActive,
      subtitle: txt.borderActiveSub,
      sound: "world_noti",
      actionBar: "",
      title: "",
    });
    return;
  }
  if (t === 1700) {
    await say(players, {
      message: txt.mobOff,
      subtitle: txt.mobOffSub,
      sound: "world_noti",
      actionBar: "",
      title: "",
    });
    world.gameRules.mobGriefing = false;
    world.gameRules.doMobSpawning = false;
    return;
  }
}

// loop หลัก: ทุก 20 tick อัป tick, score, checkWin, borderWarn, shrink, particle/warn, countdown, doEvent
function loop() {
  loopId = system.runInterval(async () => {
    if (!on) return;

    tick++;
    console.warn(`[UHC] Tick: ${tick}, Radius: ${radius}`);
    const players = world.getPlayers();
    const uhc = players.filter((p) => p.hasTag("uhc"));

    await Promise.all(uhc.map((p) => setScore(p, radius, tick)));
    checkWin(uhc);
    await borderWarn(uhc);
    shrink();

    if (tick >= 0 && tick <= 44) {
      startRun(uhc);
    }

    for (const p of uhc) {
      const d = dist(p.location, radius);
      const max = maxDist(p.location);
      if (d <= num.nearBorder && max <= radius) {
        showParticle(p, radius);
      } else if (max > radius) {
        warn(p, radius);
        showParticle(p, radius);
      }
    }

    const time = num.tickBorderActive - tick;
    if (countSet.has(time) && uhc.length) {
      world.sendMessage(
        makeToast("§cWorld Border Active \nin §g" + time + " §ctick", "textures/ui/ErrorGlyph_small_hover", "textures/ui/beacon_button_locked"),
      );
      await say(players, { sound: "note.pling", actionBar: "", message: "", title: "", subtitle: "" });
    }

    await doEvent(players);
  }, 20);
}

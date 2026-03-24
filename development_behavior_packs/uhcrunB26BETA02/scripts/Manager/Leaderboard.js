import { world, system } from "@minecraft/server";
import { getTeamStats, getTeamInfo, getTeamKillObjective } from "../Manager/TeamManager.js";

const OBJ_ID = "kdhistory";
const MAX_PLAYERS = 10;
const MAX_TEAMS = 5;

const UI = {
  HEAD: `§g§l--- [ UHC LEADERBOARD ] ---\n\n`,
  FOOT: `\n§g--------------------------------`,
  RANKS: ["§6", "§7", "§c", "§f"],
};

const NPCS = [
  { tag: "lb_players", x: 596.5, y: 127, z: 601.5 },
  { tag: "lb_teams", x: 593.5, y: 127, z: 600.5 },
  { tag: "lb_deaths", x: 599.5, y: 127, z: 600.5 },
];

// ดึงข้อมูลสถิติจาก Scoreboard
function getStats() {
  const obj = world.scoreboard.getObjective(OBJ_ID);
  const map = new Map();
  if (!obj) return map;

  const scores = obj.getScores();
  for (const info of scores) {
    const key = info.participant.displayName;
    const sep = key.indexOf(" | Victim : ");
    if (sep === -1) continue;

    const killer = key.substring(6, sep);
    const victim = key.substring(sep + 12);
    const score = info.score;

    let kStat = map.get(killer);
    if (!kStat) {
      kStat = { kills: 0, deaths: 0 };
      map.set(killer, kStat);
    }
    kStat.kills += score;

    let vStat = map.get(victim);
    if (!vStat) {
      vStat = { kills: 0, deaths: 0 };
      map.set(victim, vStat);
    }
    vStat.deaths += score;
  }
  return map;
}

// สร้างข้อความอันดับผู้เล่น
function getPlayerText(statsMap) {
  const list = [];
  for (const [name, st] of statsMap) {
    if (st.kills > 0 || st.deaths > 0) list.push({ name, st });
  }

  if (list.length === 0) return `§eTop ${MAX_PLAYERS} Players (Kills)§r\n\n§7... data? ...§r\n`;

  list.sort((a, b) => b.st.kills - a.st.kills);

  let text = `§eTop ${MAX_PLAYERS} Players (Kills)§r\n\n`;
  const limit = Math.min(list.length, MAX_PLAYERS);

  for (let i = 0; i < limit; i++) {
    const { name, st } = list[i];
    const color = UI.RANKS[i] || UI.RANKS[3];
    text += `${color}#${i + 1} §a${name} §f- §c${st.kills} Kills §8(§4${st.deaths} Deaths§8)§r\n`;
  }
  return text;
}

// สร้างข้อความอันดับทีม (อ่านจาก scoreboard uhc_teamkills)
function getTeamText() {
  const obj = getTeamKillObjective();

  // fallback to in-memory teamStats if scoreboard not ready
  if (!obj) {
    const tStats = getTeamStats();
    if (!tStats || tStats.size === 0) return `§bTop Team Kills§r\n\n§7... data? ...§r\n`;

    const list = [];
    for (const [id, st] of tStats) {
      if (st.kills > 0 || st.deaths > 0) list.push({ id, st });
    }
    if (list.length === 0) return `§bTop Team Kills§r\n\n§7... data? ...§r\n`;

    list.sort((a, b) => b.st.kills - a.st.kills);
    let text = `§bTop Team Kills§r\n\n`;
    const limit = Math.min(list.length, MAX_TEAMS);
    for (let i = 0; i < limit; i++) {
      const { id, st } = list[i];
      const info = getTeamInfo(id);
      const name = info ? `${info.color}${info.name}` : `§f${id}`;
      text += `§f#${i + 1} ${name} §f: §c${st.kills} Kills §8(§4${st.deaths} Deaths§8)§r\n`;
    }
    return text;
  }

  // อ่านจาก scoreboard โดยตรง
  const scores = obj.getScores();
  if (!scores || scores.length === 0) return `§bTop Team Kills§r\n\n§7... data? ...§r\n`;

  const list = scores
    .map((s) => ({ label: s.participant.displayName, kills: s.score }))
    .filter((s) => s.kills > 0)
    .sort((a, b) => b.kills - a.kills)
    .slice(0, MAX_TEAMS);

  if (list.length === 0) return `§bTop Team Kills§r\n\n§7... data? ...§r\n`;

  let text = `§bTop Team Kills§r\n\n`;
  for (let i = 0; i < list.length; i++) {
    const color = UI.RANKS[i] || UI.RANKS[3];
    text += `${color}#${i + 1} ${list[i].label} §f: §c${list[i].kills} Kills§r\n`;
  }
  return text;
}

// สร้างข้อความผู้เล่นที่ตายเยอะสุด
function getDeathsText(statsMap) {
  let topName = "None";
  let max = 0;

  for (const [name, st] of statsMap) {
    if (st.deaths > max) {
      max = st.deaths;
      topName = name;
    }
  }
  return `§cTop Deaths: §7${topName} (${max})§r\n`;
}

// การแสดงบอร์ด
export function renderBoard() {
  const dim = world.getDimension("overworld");

  let pNpcs, tNpcs, dNpcs;
  try {
    pNpcs = dim.getEntities({ type: "minecraft:npc", tags: ["lb_players"] });
    tNpcs = dim.getEntities({ type: "minecraft:npc", tags: ["lb_teams"] });
    dNpcs = dim.getEntities({ type: "minecraft:npc", tags: ["lb_deaths"] });
  } catch (e) {
    console.warn("renderBoard fetch NPCs ?");
    return;
  }

  if (pNpcs.length === 0 && tNpcs.length === 0 && dNpcs.length === 0) return;

  const stats = getStats();

  // สร้าง Text แค่ครั้งเดียวถ้ามี NPC อย่างน้อย 1 ตัว
  if (pNpcs.length > 0) {
    const text = UI.HEAD + getPlayerText(stats) + UI.FOOT;
    for (const npc of pNpcs) {
      if (npc.nameTag !== text) npc.nameTag = text;
    }
  }

  if (tNpcs.length > 0) {
    const text = UI.HEAD + getTeamText() + UI.FOOT;
    for (const npc of tNpcs) {
      if (npc.nameTag !== text) npc.nameTag = text;
    }
  }

  if (dNpcs.length > 0) {
    const text = UI.HEAD + getDeathsText(stats) + UI.FOOT;
    for (const npc of dNpcs) {
      if (npc.nameTag !== text) npc.nameTag = text;
    }
  }
}

// Export
export function updateLeaderboard() {
  renderBoard();
}

export function spawnLeaderboardNPC() {
  const dim = world.getDimension("overworld");

  system.runTimeout(() => {
    for (const cfg of NPCS) {
      try {
        // เช็คว่า chunk โหลดหรือไม่ หากไม่จะเข้า catch ทันที
        dim.getBlock({ x: cfg.x, y: cfg.y, z: cfg.z });

        const npcs = dim.getEntities({ type: "minecraft:npc", tags: [cfg.tag] });
        for (const npc of npcs) npc.remove();

        const newNpc = dim.spawnEntity("minecraft:npc", { x: cfg.x, y: cfg.y, z: cfg.z });
        newNpc.addTag(cfg.tag);
      } catch (e) {
        console.warn("spawnLeaderboardNPC ?");
      }
    }
  }, 20);
}

// --------------------------------------------------------------------------
// Event NPC
// --------------------------------------------------------------------------

system.run(() => {
  renderBoard();
});

world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  const { target, player } = ev;

  if (target?.typeId === "minecraft:npc") {
    if (target.hasTag("lb_players") || target.hasTag("lb_teams") || target.hasTag("lb_deaths")) {
      ev.cancel = true;

      system.run(() => {
        if (player?.isSneaking) {
          renderBoard();
          player.playSound("random.orb", { volume: 0.5, pitch: 1 });
          player.onScreenDisplay.setActionBar("§aLeaderboard Updated!");
        }
      });
    }
  }
});

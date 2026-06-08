import { system, world } from "@minecraft/server";
import { refreshPlayerCaches } from "./CacheManager.js";
import {
  NPCS,
  NPC_QUERY_OPTIONS,
  UI,
  resetCache,
} from "./LeaderboardConfig.js";
import { getStats, getTeamText } from "./LeaderboardData.js";
import { getDeathsText, getPlayerText } from "./LeaderboardFormat.js";

function collectNpcsByTag(allNpcs) {
  const teamNpcs = [];
  const playerNpcs = [];
  const deathNpcs = [];

  for (let ni = 0, nLen = allNpcs.length; ni < nLen; ni++) {
    const npcEntity = allNpcs[ni];
    if (!npcEntity?.isValid) continue;
    if (npcEntity.hasTag("lb:teams")) teamNpcs.push(npcEntity);
    else if (npcEntity.hasTag("lb:players")) playerNpcs.push(npcEntity);
    else if (npcEntity.hasTag("lb:deaths")) deathNpcs.push(npcEntity);
  }

  return { pNpcs: playerNpcs, tNpcs: teamNpcs, dNpcs: deathNpcs };
}

export function renderBoard() {
  const overworldDimension = world.getDimension("overworld");
  let allNpcs = [];

  try {
    allNpcs = overworldDimension.getEntities(NPC_QUERY_OPTIONS);
  } catch (error) {
    console.warn("[DEBUG] Error getting NPCs:", error);
    return;
  }

  if (!allNpcs.length) return;

  const {
    pNpcs: playerNpcs,
    tNpcs: teamNpcs,
    dNpcs: deathNpcs,
  } = collectNpcsByTag(allNpcs);

  if (!teamNpcs.length && !playerNpcs.length && !deathNpcs.length) return;

  const playerStats = getStats();

  if (teamNpcs.length) {
    const teamText = getTeamText();
    updateNpcText(teamNpcs, `${UI.HEAD}${teamText}${UI.FOOT}`);
  }

  if (playerNpcs.length) {
    const playerText = getPlayerText(playerStats);
    updateNpcText(playerNpcs, `${UI.HEAD}${playerText}${UI.FOOT}`);
  }

  if (deathNpcs.length) {
    const deathsText = getDeathsText(playerStats);
    updateNpcText(deathNpcs, `${UI.HEAD}${deathsText}${UI.FOOT}`);
  }
}

function updateNpcText(npcList, displayText) {
  for (let ni = 0, nLen = npcList.length; ni < nLen; ni++) {
    const npcEntity = npcList[ni];
    if (!npcEntity?.isValid) continue;
    if (typeof npcEntity.nameTag !== "string") continue;
    if (npcEntity.nameTag === displayText) continue;
    npcEntity.nameTag = displayText;
  }
}

function spawnLeaderboardNPCNow() {
  const overworldDimension = world.getDimension("overworld");

  const existingNpcs = overworldDimension.getEntities(NPC_QUERY_OPTIONS);
  for (let xi = 0, xLen = existingNpcs.length; xi < xLen; xi++) {
    existingNpcs[xi].remove();
  }

  for (let ni = 0, nLen = NPCS.length; ni < nLen; ni++) {
    const npcConfig = NPCS[ni];

    const newNpcEntity = overworldDimension.spawnEntity("minecraft:npc", {
      x: npcConfig.x,
      y: npcConfig.y,
      z: npcConfig.z,
    });

    if (ni === 0) {
      newNpcEntity.nameTag = "§b§lTOP TEAMS (KILLS)";
      newNpcEntity.addTag("lb:teams");
    } else if (ni === 1) {
      newNpcEntity.nameTag = "§e§lTOP PLAYERS (KILLS)";
      newNpcEntity.addTag("lb:players");
    } else if (ni === 2) {
      newNpcEntity.nameTag = "§c§lTOP PLAYERS (DEATHS)";
      newNpcEntity.addTag("lb:deaths");
    }
  }

  updateLeaderboard();
}

export function updateLeaderboard() {
  system.runTimeout(() => {
    resetCache();
    refreshPlayerCaches();
    renderBoard();
  }, 40);
}

export function spawnLeaderboardNPC() {
  system.runTimeout(spawnLeaderboardNPCNow, 20);
}

system.run(renderBoard);

export function HandlerCancelNPC(eventData) {
  const { target } = eventData;
  if (target.typeId === "minecraft:npc") {
    eventData.cancel = true;
  }
}

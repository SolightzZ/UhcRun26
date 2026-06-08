import { DisplaySlotId, system, world } from "@minecraft/server";
import { isGameRunning } from "./State_Game.js";
import {
  cachedBoard,
  dirtySidebarTeams,
  setCachedBoard,
  setSidebarFlushTask,
  sidebarFlushTask,
} from "./State_Sidebar.js";
import { TEAM_LOOKUP, teamCounts } from "./State_Team.js";
import { CONFIG, TEAMS } from "./UtilTeamManager.js";

function getBoard() {
  if (cachedBoard) {
    const obj = world.scoreboard.getObjective(CONFIG.objectiveName);
    if (obj) return obj;
    setCachedBoard(null);
  }

  let board = world.scoreboard.getObjective(CONFIG.objectiveName);
  if (!board) {
    board = world.scoreboard.addObjective(
      CONFIG.objectiveName,
      CONFIG.displayName,
    );
  }

  setCachedBoard(board);
  return board;
}

const SCOREBOARD_CACHE = new Map();

function flushSidebarUpdates() {
  if (isGameRunning) return;

  const board = getBoard();
  const dirtyArr = [...dirtySidebarTeams];
  for (let d = 0, dLen = dirtyArr.length; d < dLen; d++) {
    const teamId = dirtyArr[d];
    const team = TEAM_LOOKUP.get(teamId);
    if (!team) continue;

    const entry = `${team.color}${team.name}`;
    const count = teamCounts.get(teamId) ?? 0;
    const cached = SCOREBOARD_CACHE.get(teamId);

    // ข้ามไปหากคะแนนไม่เปลี่ยนแปลง
    if (cached === count) continue;
    SCOREBOARD_CACHE.set(teamId, count);

    if (count <= 0) {
      try {
        board.removeParticipant(entry);
      } catch (error) {
        console.error("[Board Remove Participant]: " + error);
      }
    } else {
      board.setScore(entry, count);
    }
  }

  dirtySidebarTeams.clear();
}

function updateSidebar(teamId) {
  if (isGameRunning || !TEAM_LOOKUP.has(teamId)) return;

  dirtySidebarTeams.add(teamId);
  if (sidebarFlushTask !== null) return;

  setSidebarFlushTask(
    system.runTimeout(() => {
      setSidebarFlushTask(null);
      flushSidebarUpdates();
    }, 1),
  );
}

function bindSidebarIfNeeded(board) {
  const current = world.scoreboard.getObjectiveAtDisplaySlot(
    DisplaySlotId.Sidebar,
  );
  if (current?.objective?.id === board.id) return;
  world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
    objective: board,
  });
}

export function refreshScoreboardUI() {
  if (isGameRunning) return;
  const board = getBoard();
  bindSidebarIfNeeded(board);

  SCOREBOARD_CACHE.clear();
  for (let i = 0, len = TEAMS.length; i < len; i++) {
    dirtySidebarTeams.add(TEAMS[i].id);
  }
  flushSidebarUpdates();
}

export { flushSidebarUpdates, getBoard, updateSidebar };

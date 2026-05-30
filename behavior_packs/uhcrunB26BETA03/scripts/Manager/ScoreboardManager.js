import { DisplaySlotId, system, world } from '@minecraft/server';
import { cachedBoard, CONFIG, dirtySidebarTeams, isGameRunning, setCachedBoard, setSidebarFlushTask, sidebarFlushTask, TEAM_LOOKUP, teamCounts, TEAMS } from './State.js';

function getBoard() {
    if (cachedBoard) {
        const obj = world.scoreboard.getObjective(CONFIG.objectiveName);
        if (obj) return obj;
        setCachedBoard(null);
    }

    let board = world.scoreboard.getObjective(CONFIG.objectiveName);
    if (!board) {
        board = world.scoreboard.addObjective(CONFIG.objectiveName, CONFIG.displayName);
    }

    setCachedBoard(board);
    return board;
}

function flushSidebarUpdates() {
    if (isGameRunning) return;

    const board = getBoard();
    for (const teamId of dirtySidebarTeams) {
        const team = TEAM_LOOKUP.get(teamId);
        if (!team) continue;

        const entry = `${team.color}${team.name}`;
        const count = teamCounts.get(teamId) ?? 0;

        if (count <= 0) {
            try {
                board.removeParticipant(entry);
            } catch (error) {
                console.error('[Board Remove Participant]: ' + error);
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

export function refreshScoreboardUI() {
    if (isGameRunning) return;
    const board = getBoard();
    world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective: board });

    for (const team of TEAMS) {
        dirtySidebarTeams.add(team.id);
    }
    flushSidebarUpdates();
}

export { flushSidebarUpdates, getBoard, updateSidebar };

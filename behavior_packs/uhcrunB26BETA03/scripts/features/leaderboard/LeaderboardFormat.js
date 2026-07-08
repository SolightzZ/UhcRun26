import { MAX_PLAYERS, MAX_TEAMS, generateStatsHash, getRankColor, lbCache } from '../../constants/leaderboard.js';

function buildEmptyPlayerText() {
   return `§eTop ${MAX_PLAYERS} Players (Kills)\n\n§7None (0)\n`;
}

function buildEmptyTeamText() {
   return `§bTop ${MAX_TEAMS} Teams (Kills)\n\n§7None (0)\n`;
}

function buildEmptyDeathsText() {
   return `§cTop ${MAX_PLAYERS} Deaths\n\n§7None (0)\n`;
}

export function buildTeamText(teamList) {
   if (!teamList.length) return buildEmptyTeamText();
   const header = `§bTop ${MAX_TEAMS} Teams (Kills)\n\n`;
   const lines = [];
   for (let li = 0; li < teamList.length; li++) {
      const team = teamList[li];
      const memberCount = team.members !== undefined ? team.members : 0;
      lines.push(`${getRankColor(li)}#${li + 1} ${team.name} §f: §c${team.kills} Kills §7(${memberCount} Players)`);
   }
   return header + lines.join('\n') + '\n';
}

function buildPlayerLines(sourceMap, filterFn, sortFn, lineFn) {
   const filtered = [];
   sourceMap.forEach((stats, name) => {
      if (!filterFn(stats)) return;
      filtered.push({ name, st: stats });
   });
   filtered.sort(sortFn);
   if (filtered.length > MAX_PLAYERS) filtered.length = MAX_PLAYERS;
   return filtered;
}

export function getPlayerText(playerStatsMap) {
   const currentHash = generateStatsHash(playerStatsMap);
   if (currentHash === lbCache.lastStatsHash && lbCache.cachedPlayerText) {
      return lbCache.cachedPlayerText;
   }

   const playerList = buildPlayerLines(
      playerStatsMap,
      (st) => st.kills || st.deaths,
      (a, b) => b.st.kills - a.st.kills || a.name.localeCompare(b.name),
   );

   if (!playerList.length) {
      lbCache.lastStatsHash = currentHash;
      lbCache.cachedPlayerText = buildEmptyPlayerText();
      return lbCache.cachedPlayerText;
   }

   const header = `§eTop ${MAX_PLAYERS} Players (Kills)\n\n`;
   const lines = [];
   for (let li = 0; li < playerList.length; li++) {
      const item = playerList[li];
      const teamSuffix = item.st.teamLabel ? ` §8[${item.st.teamLabel}§8]` : '';
      lines.push(`${getRankColor(li)}#${li + 1} §a${item.name}${teamSuffix} §f- §c${item.st.kills} Kills §8(§4${item.st.deaths} Deaths§8)`);
   }

   lbCache.lastStatsHash = currentHash;
   lbCache.cachedPlayerText = header + lines.join('\n') + '\n';
   return lbCache.cachedPlayerText;
}

export function getDeathsText(playerStatsMap) {
   const currentHash = generateStatsHash(playerStatsMap);
   if (currentHash === lbCache.lastDeathsHash && lbCache.cachedDeathsText) {
      return lbCache.cachedDeathsText;
   }

   const deathsList = buildPlayerLines(
      playerStatsMap,
      (st) => st.deaths > 0,
      (a, b) => b.st.deaths - a.st.deaths || a.name.localeCompare(b.name),
   );

   if (!deathsList.length) {
      lbCache.lastDeathsHash = currentHash;
      lbCache.cachedDeathsText = buildEmptyDeathsText();
      return lbCache.cachedDeathsText;
   }

   const header = `§cTop ${MAX_PLAYERS} Deaths\n\n`;
   const lines = [];
   for (let li = 0; li < deathsList.length; li++) {
      const item = deathsList[li];
      const teamSuffix = item.st.teamLabel ? ` §8[${item.st.teamLabel}§8]` : '';
      lines.push(`${getRankColor(li)}#${li + 1} §a${item.name}${teamSuffix} §f- §4${item.st.deaths} Deaths §8(§c${item.st.kills} Kills§8)`);
   }

   lbCache.lastDeathsHash = currentHash;
   lbCache.cachedDeathsText = header + lines.join('\n') + '\n';
   return lbCache.cachedDeathsText;
}

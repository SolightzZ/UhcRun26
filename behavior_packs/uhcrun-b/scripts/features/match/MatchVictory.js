// Pure victory evaluator behind the Match lifecycle interface.
//
// This module never imports the Match lifecycle module: the caller passes
// players + a team lookup in, and gets an outcome back. All side effects
// (stopGameLoop, rank writes, broadcasts, particles, end countdown) live
// with the caller (MatchManager), so the dependency points one way:
// MatchManager -> MatchVictory, never back.
class UhcMatchManagerVictory {
   aliveTeamsSet = new Set();
   _prevAliveTeams = new Set();

   // players: array-like of player objects. getTeam(player) -> team tag or null.
   // Returns { outcome: 'none'|'win'|'draw', winTag, eliminated: [{ teamId, placement }] }.
   evaluate(players, getTeam) {
      const list = players ?? [];
      if (!list.length) return { outcome: 'draw', winTag: null, eliminated: [] };

      const alive = new Set();
      for (let i = 0; i < list.length; i++) {
         const tag = getTeam(list[i]);
         if (!tag) continue;
         alive.add(tag);
         if (alive.size > 1) {
            const eliminated = this._eliminatedSince(alive);
            this.aliveTeamsSet = alive;
            this._prevAliveTeams = new Set(alive);
            return { outcome: 'none', winTag: null, eliminated };
         }
      }

      const eliminated = this._eliminatedSince(alive);
      this.aliveTeamsSet = alive;
      this._prevAliveTeams.clear();
      if (alive.size === 1) {
         return { outcome: 'win', winTag: alive.values().next().value, eliminated };
      }
      return { outcome: 'draw', winTag: null, eliminated };
   }

   _eliminatedSince(alive) {
      const out = [];
      if (this._prevAliveTeams.size === 0) return out;
      this._prevAliveTeams.forEach((teamId) => {
         if (!alive.has(teamId)) out.push({ teamId, placement: alive.size + 1 });
      });
      return out;
   }

   reset() {
      this.aliveTeamsSet.clear();
      this._prevAliveTeams.clear();
   }
}

export default new UhcMatchManagerVictory();

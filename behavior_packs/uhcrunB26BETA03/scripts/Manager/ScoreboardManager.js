//นำเข้า API จาก minecraft server
import { DisplaySlotId, world } from '@minecraft/server';

//ดึงหรือสร้าง scoreboard objective ถ้ายังไม่มี
export function ensureObjective(id, displayName) {
   try {
      let obj = world.scoreboard.getObjective(id);
      if (!obj) obj = world.scoreboard.addObjective(id, displayName);
      return obj;
   } catch (error) {
      console.error('[Scoreboard] Failed to ensure objective ' + id + ':', error);
      return null;
   }
}

//ตั้งค่า scoreboard แสดงผลในช่องต่างๆ ของ UI
export function refreshScoreboardUI() {
   try {
      const teamKills = ensureObjective('uhc_teamkills', 'Team Kills');
      const deaths = ensureObjective('uhc_deaths', 'Player Deaths');
      const kills = ensureObjective('uhc_kills', 'Player Kills');

      world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective: teamKills });
      world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.BelowName, { objective: deaths });
      world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.List, { objective: kills });
   } catch (error) {
      console.error('[Scoreboard] Failed to refresh scoreboard UI:', error);
   }
}

//ฟังก์ชันว่าง เตรียมไว้สำหรับอัปเดต sidebar
export function updateSidebar(_teamId) {}

//ฟังก์ชันว่าง เตรียมไว้สำหรับ flush ค่า sidebar
export function flushSidebarUpdates() {}

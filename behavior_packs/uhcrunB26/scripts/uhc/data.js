// ข้อมูลทีม + Map สำหรับหา O(1) ไม่ต้อง loop find
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

// รายชื่อ tag ทีม (ใช้ loop กระจายทีม)
export const teamList = [
  "team1", "team2", "team3", "team4", "team5",
  "team6", "team7", "team8", "team9",
];

// ข้อมูลทีม: tag, สี, ชื่อ (ใช้แสดงชัยชนะ)
const teamData = [
  { tag: "team1", color: "§c", name: " Red" },
  { tag: "team2", color: "§9", name: " Blue" },
  { tag: "team3", color: "§g", name: " Yellow" },
  { tag: "team4", color: "§a", name: " Green" },
  { tag: "team5", color: "§5", name: " Purple" },
  { tag: "team6", color: "§b", name: " Aqua" },
  { tag: "team7", color: "§6", name: " Orange" },
  { tag: "team8", color: "§7", name: " Gray" },
  { tag: "team9", color: "§d", name: " Pink" },
];

// Map: tag -> { color, name } หา O(1)
export const teamMap = new Map(
  teamData.map((t) => [t.tag, { color: t.color, name: t.name }])
);

// หาทีมจาก tag คืนค่า { color, name } หรือ null
export function getTeam(tag) {
  return teamMap.get(tag) ?? null;
}

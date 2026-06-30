//ค่า config หลักของระบบ UHC
export const CONFIG = Object.freeze({
   adminTag: 'admin',
   uhcTag: 'uhc',
   objectiveName: 'uhcBoard',
   displayName: 'UHC',
   title: '§g§r',
   key: 'uhcrun:team',
   maxTotalPlayers: 54,
});

//ข้อความ revive ภาษาไทย/อังกฤษ
export const REVIVE_MSG = Object.freeze({
   cancel: '§cยกเลิกการชุบ',
   cancelEn: '§cRevive cancelled',
   needHead: '§cต้องใช้หัวผู้เล่น 1 ไอเทมในการชุบ',
   reviverNotAlive: '§cผู้ชุบไม่ใช่ผู้เล่นที่ยังมีชีวิตแล้ว',
   noReviveItem: '§cไม่มีไอเท็มสำหรับชุบ',
   targetNotDead: '§cเป้าหมายไม่ได้อยู่ในสถานะตาย',
   notSameTeam: '§cไม่ได้อยู่ทีมเดียวกัน',
   noDeathLoc: '§cไม่พบตำแหน่งที่ตาย',
   wrongDimension: '§cอยู่คนละมิติ',
   movedTooFar: '§cระยะห่างเกินกำหนด',
   onlyDuringGame: '§cสามารถชุบชีวิตได้เฉพาะระหว่างเกมเท่านั้น',
   onlyUhcAlive: '§cเฉพาะผู้เล่น UHC ที่ยังมีชีวิตเท่านั้นที่ชุบได้',
   targetNotDeadYet: '§cเป้าหมายยังไม่ตาย',
   targetNotTeammate: '§cเป้าหมายไม่ใช่เพื่อนร่วมทีมของคุณ',
   alreadyRevivingTarget: '§cมีคนกำลังชุบเป้าหมายนี้อยู่แล้ว',
   alreadyRevivingOther: '§cคุณกำลังชุบคนอื่นอยู่',
   channeling: (name) => `§eกำลังชุบ ${name}`,
   cooldown: (sec) => `§cคูลดาวน์การชุบ: ${sec} วินาที`,
   progress: (name, sec) => `Reviving ${name} in ${sec}s`,
   revived: (reviver, target) => `§a${reviver} revived ${target}`,
   uiTitle: '§cRevive Player',
   uiBody: 'Select dead teammate',
   uiBack: 'Back',
});

//คงพื้นที่ให้ chunk โหลดตลอด
export const TICKING_AREAS = Object.freeze([
   'tickingarea add -80 0 -80 79 255 79 center',
   'tickingarea add -80 0 80 79 255 239 north',
   'tickingarea add -80 0 -240 79 255 -81 south',
   'tickingarea add 80 0 -80 239 255 79 east',
   'tickingarea add -240 0 -80 -81 255 79 west',
   'tickingarea add 80 0 80 239 255 239 ne',
   'tickingarea add -240 0 80 -81 255 239 nw',
   'tickingarea add 80 0 -240 239 255 -81 se',
   'tickingarea add -240 0 -240 -81 255 -81 sw',
   'tickingarea add -80 0 240 79 255 399 far_north',
]);
//ข้อความเมนูต่างๆ
export const MENU_MSG = Object.freeze({
   back: 'Back',
   console: 'Console',
   adminBody: 'Admin',
   teleportTitle: 'Teleport Menu',
   teleportRandom: 'Random Teleport',
   teleportAllPlayers: 'All Players',
   teleportAllTitle: 'All Players',
   noPlayersOnline: 'No players online.',
   noPlayersAvailable: 'No available players.',
   noValidUhc: '§c[x] No valid UHC players.',
   tpaBlockedInUhc: '§c[x] คุณไม่สามารถใช้ TPA ได้ในขณะที่ยังเล่น UHCRUN!',
   targetOffline: '§cผู้เล่นเป้าหมายไม่ได้ออนไลน์หรือไม่ได้อยู่ในเซิฟเวอร์แล้ว',
   teamManagement: 'Team Management',
   noPlayersInManagement: 'No players are currently online.',
   playerListTitle: 'Player List',
   clearTeamsConfirm: "จะลบผู้เล่นทุกคนออกจากทุกทีม 'คุณแน่ใจหรือไม่?'",
   mainMenuBody: '§6UHCRUN26 §7(Mini Game Battle Royal)',
});

//ข้อความ UI จัดการทีม
export const TEAM_MENU = Object.freeze({
   titleSuffix: 'Team Manager',
   unknownTeam: 'Team?',
   leave: '§cLeave',
   refresh: '§6Refresh',
   close: '§7Close',
   serverFull: (max) => `§cเซิร์ฟเวอร์เต็มแล้ว (${max} คน)`,
   serverFullShort: (max) => `§cเซิร์ฟเวอร์เต็ม (${max})`,
   cannotChangeMidGame: '§cไม่สามารถเปลี่ยนทีมระหว่างเกมได้',
   alreadyOnTeam: '§oAlready',
   noTeam: '§cYou have no team',
});

//ทีมทั้งหมด 9 ทีม พร้อมสีและ icon
export const TEAMS = Object.freeze([
   { id: 'team1', name: 'Red', color: '§c', icon: 'textures/items/dye_powder_red' },
   { id: 'team2', name: 'Blue', color: '§9', icon: 'textures/items/dye_powder_blue_new' },
   { id: 'team3', name: 'Yellow', color: '§e', icon: 'textures/items/dye_powder_yellow' },
   { id: 'team4', name: 'Green', color: '§a', icon: 'textures/items/dye_powder_lime' },
   { id: 'team5', name: 'Purple', color: '§5', icon: 'textures/items/dye_powder_purple' },
   { id: 'team6', name: 'Aqua', color: '§b', icon: 'textures/items/dye_powder_light_blue' },
   { id: 'team7', name: 'Orange', color: '§6', icon: 'textures/items/dye_powder_orange' },
   { id: 'team8', name: 'Gray', color: '§7', icon: 'textures/items/dye_powder_silver' },
   { id: 'team9', name: 'Pink', color: '§d', icon: 'textures/items/dye_powder_pink' },
]);

//ตำแหน่ง world spawn และ structure
export const SPAWN_CONFIG = Object.freeze({
   x: 596,
   y: 130,
   z: 609,
   dimension: 'overworld',
   worldSpawn: '596 125 622',
   structureName: 'uhc1',
   structureLoc: '569 100 569',
});

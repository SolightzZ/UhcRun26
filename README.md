<div align="center">

# ⚔️ UHCRun Add-on

**ระบบ UHC สำหรับ Minecraft Bedrock Edition**

![Minecraft](https://img.shields.io/badge/Minecraft-Bedrock_1.26.3-00AA00?style=flat-square&logo=minecraft&logoColor=white)
![API](https://img.shields.io/badge/@minecraft%2Fserver-1.26.0-0078D4?style=flat-square)
![Language](https://img.shields.io/badge/Language-JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)
![Players](https://img.shields.io/badge/Players-20--30-red?style=flat-square)
![GitHub Stars](https://img.shields.io/github/stars/SolightzZ/UhcRun26?style=flat-square&logo=github)
![Last Commit](https://img.shields.io/github/last-commit/SolightzZ/UhcRun26?style=flat-square)
![Version](https://img.shields.io/badge/Version-beta_0.1-orange?style=flat-square)

</div>

---

## ภาพรวม

UHCRun คือ Add-on ระบบ **Ultra Hardcore** ที่พัฒนาบน Minecraft Bedrock Script API  
ครอบคลุมตั้งแต่ระบบทีม, World Border แบบ dynamic, การติดตาม kill/death, ไปจนถึง NPC Leaderboard ภายใน world  
ออกแบบมาสำหรับการแข่งขันแบบ multiplayer รองรับผู้เล่น 20–30 คนต่อ session

---

## คุณสมบัติหลัก

- ⚔️ **ระบบทีม** — รองรับ 9 ทีม, เข้าร่วมผ่าน Compass menu, บันทึกข้อมูลถาวรด้วย DynamicProperty
- 🗺️ **World Border แบบ dynamic** — Shrink แบบ smooth lerp ผ่าน checkpoint (500 → 2), render particle, fog และ damage เมื่อออกนอก border
- 📊 **ระบบติดตาม Kill/Death** — จัดเก็บสถิติรายผู้เล่นและรายทีมลง Scoreboard และ DynamicProperty
- 🏆 **NPC Leaderboard** — แสดงอันดับ Top Players, Top Teams และ Top Deaths ภายใน world
- 🔔 **ระบบ Announcer** — First Blood, Multi Kill (สูงสุด ACE), Kill Streak
- 🪓 **Plugins เสริม** — AutoSmelt, Axe mechanics, CPS counter, Enchant, Fishing HoD, Knockback
- 🎮 **Admin Panel** — UI สำหรับจัดการทีม, teleport, ตรวจสอบสถิติ และ debug ข้อมูล
- ⚡ **ปรับแต่งประสิทธิภาพ** — Tick-cached player list, dirty-flag scoreboard update, grouped particle rendering

---

## ความต้องการของระบบ

- Minecraft Bedrock Edition `1.26.3`
- `@minecraft/server` `1.26.0`
- `@minecraft/server-ui`
- Behavior Pack ที่เปิดใช้งาน Script API

---

## การติดตั้ง

```bash
git clone https://github.com/SolightzZ/UhcRun26.git
```

1. คัดลอกโฟลเดอร์ behavior pack ไปไว้ใน `behavior_packs/` ของ world
2. เปิดใช้งาน pack ใน **World Settings → Add-Ons → Behavior Packs**
3. เปิดใช้งาน **Beta APIs** ใน Experiments

---

## การใช้งาน

### คำสั่ง Admin

| คำสั่ง | คำอธิบาย |
|---|---|
| `/addon:uhcsetup` | โหลด structure, ตั้งค่า gamerule, จัดสรร kit ให้ผู้เล่นทุกคน |
| `/addon:uhcstart` | เริ่มเกม — กระจายทีม, เปิด border, เริ่ม countdown |
| `/addon:uhcreset` | Reset ทั้งหมด — ลบข้อมูลทีม, สถิติ, tag และ scoreboard |
| `/addon:uhcend` | สิ้นสุดเกมและส่งผู้เล่นกลับ lobby |
| `/addon:tpa` | เมนู teleport สำหรับ Spectator และ Admin |

### การใช้งานภายในเกม

| การกระทำ | วิธีการ |
|---|---|
| เปิดเมนูหลัก | ใช้ **Compass** |
| เข้าร่วม / ออกจากทีม | Compass → Team |
| Admin panel | Compass → Admin *(ต้องมี tag `admin`)* |
| Refresh leaderboard | **Sneak + interact** กับ NPC |

---

## การตั้งค่า

แก้ไขค่าได้โดยตรงในไฟล์ source:

**`system/border.js`**
```js
const CHECKPOINTS = [500, 450, 400, 350, 300, 250, 200, 150, 100, 80, 50, 25, 16, 10, 5, 2];
const FIRST_SHRINK_DELAY = 300; // ticks ก่อน shrink ครั้งแรก
const BORDER_RENDER = { VIEW_DISTANCE: 35, PARTICLE_Y: 100 };
```

**`Manager/TeamManager.js`**
```js
const TEAMS = [ /* เพิ่ม/ลบทีมได้ที่นี่ */ ];
const CONFIG = { adminTag: "admin", comPass: "uhc" };
```

---

## โครงสร้างโปรเจกต์

```
📦 UHCRun
├── main.js                        Entry point — import ทุก module
├── system/
│   └── border.js                  World border, shrink state machine, damage, particle render
├── Manager/
│   ├── TeamManager.js             ระบบทีม, kill/death tracking, scoreboard, cache
│   └── Leaderboard.js             NPC leaderboard rendering
├── customCommand/
│   ├── command.js                 Custom command registry
│   └── function.js                Command handlers (setup, start, reset, end)
└── plugin/
    ├── axe.js                     Custom axe mechanics
    ├── AutoSmelt.js               Auto-smelt เมื่อขุด
    ├── anticheat_cps.js           Anti-cheat CPS detection
    ├── blockInteractGuard.js      ป้องกันการ interact block
    ├── enchant.js                 Enchant tweaks
    ├── fishing_hod.js             Fishing HoD mechanic
    ├── Knockback.js               Custom knockback
    ├── plateKnockback.js          Pressure plate knockback
    ├── projectile_hit_souns.js    เสียงเมื่อถูกกระสุน
    ├── tnt_instant.js             TNT จุดระเบิดทันที
    └── Util.js                    Utility functions
```

---

## สถาปัตยกรรมระบบ

```
system.runInterval (ทุก 20 ticks)
│
├── refreshPlayerCaches()          world.getPlayers() → allPlayersCache / uhcPlayersCache
│
├── WorldTick(uhcPlayers)
│   ├── eventBorders()             ตรวจสอบ checkpoint timer → applyBorderShrink()
│   ├── updateSmoothBorder()       lerp borderRadius → syncWorldBorderGeometry()
│   ├── updateScore()              อัปเดต scoreboard เฉพาะ line ที่เปลี่ยนแปลง (dirty-flag)
│   └── BorderTick()
│       ├── handleBorderDamage()   ทุก 2 ticks — fog + applyDamage
│       └── renderBorderAABB()     ทุก 4 ticks — grouped particle spawn
│
└── PlayersTick(allPlayers)
    ├── handleGameStart()          tick 1–26 เท่านั้น
    └── displayGameStart()         action bar countdown
```

---

## Tech Stack

| เครื่องมือ | วัตถุประสงค์ |
|---|---|
| `@minecraft/server` 1.26.0 | Core API — entity, world, event, scoreboard |
| `@minecraft/server-ui` | ActionFormData menu |
| JavaScript (ESM) | ภาษาที่ใช้ในการพัฒนา |
| DynamicProperty | จัดเก็บข้อมูลทีมและสถิติแบบถาวร |
| Scoreboard | ติดตาม kill แบบ real-time และ leaderboard |

---

## สเปคเซิร์ฟเวอร์อ้างอิง

| ส่วนประกอบ | สเปค |
|---|---|
| CPU | Intel Core i5 Gen 11 |
| RAM | 16GB DDR4-3200 |
| Storage | SSD NVMe |
| จำนวนผู้เล่นที่รองรับ | 20–30 คนต่อ session |

---

## สเปคเครื่องผู้พัฒนา

| ส่วนประกอบ | สเปค |
|---|---|
| CPU | Intel Core i5-13420H |
| RAM | 32GB DDR5-5200 |
| Storage | SSD NVMe Samsung 512GB |
| GPU | NVIDIA GeForce RTX 4050 Laptop GPU |

---

## Gameplay Flow

```
1. Setup      /addon:uhcsetup  →  เตรียมระบบเกม โหลดแผนที่ จัดของเริ่มต้น และตั้งค่ากฎของเกม
2. Lobby      ผู้เล่นเข้าไปเลือกทีมผ่านเข็มทิศ (Compass)
3. Start      /addon:uhcstart  →  กระจายผู้เล่นแต่ละทีมไปเกิดในแผนที่ และเปิดขอบเขตโลก (500 บล็อก)
4. Shrink     ขอบเขตโลกจะค่อย ๆ เล็กลงอัตโนมัติจาก 500 เหลือ 2 บล็อก
5. Combat     ระบบนับการฆ่า การตาย และตารางคะแนนจะแสดงผลแบบทันที
6. End        /addon:uhcend    →  ประกาศทีมผู้ชนะ และพาผู้เล่นกลับไปที่ล็อบบี้
7. Reset      /addon:uhcreset  →  ล้างข้อมูลเกมทั้งหมด เพื่อเตรียมเริ่มเกมรอบใหม่
```

---

## Known Issues / Limitations

- จำเป็นต้องเปิดใช้งาน **Beta APIs** ใน Experiments — เป็น requirement ของ Script API
- NPC Leaderboard ต้อง refresh ด้วยตนเอง (Sneak + interact) ไม่รองรับการ update แบบ real-time
- Script API ของ Bedrock ไม่รองรับ persistent world data นอกจาก DynamicProperty — ข้อมูลอาจสูญหายหาก pack ถูก reload ระหว่างเกม
- รองรับสูงสุด 9 ทีม ตามข้อจำกัดของ UI และ scoreboard design

---

## Changelog

### v0.1.0-beta — Initial Beta Release
- ระบบทีม 9 ทีม พร้อม Compass menu
- World Border แบบ dynamic shrink ผ่าน checkpoint
- Kill/Death tracking ลง Scoreboard และ DynamicProperty
- NPC Leaderboard (Top Players, Top Teams, Top Deaths)
- Announcer: First Blood, Multi Kill, Kill Streak
- Plugin suite: AutoSmelt, Axe, CPS Anticheat, Enchant, Fishing HoD, Knockback, TNT Instant
- Admin Panel ผ่าน Compass

---

## Contributing

โปรเจกต์นี้เปิดรับข้อเสนอแนะและรายงานข้อผิดพลาดผ่าน [GitHub Issues](https://github.com/SolightzZ/UhcRun26/issues)  
หากพบปัญหาหรือต้องการเสนอ feature ใหม่ สามารถเปิด issue ได้เลย

---

## ผู้พัฒนา

**SolightzZ**  
Minecraft Bedrock Script API Developer

---

## License

MIT License — ดูรายละเอียดได้ที่ [LICENSE](LICENSE)

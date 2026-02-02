### Folder Structure
```
uhc-run/
└── scripts/
    ├── main.js                             # เริ่มระบบ

    ├── core/
    │   ├── gameState.js                    # สถานะเกม
    │   ├── eventBus.js                     # ส่งอีเวนต์
    │   ├── scheduler.js                    # ตั้งเวลา
    │   └── context.js                      # world/system

    ├── config/
    │   ├── numbersConfig.js                # ค่าตัวเลข
    │   ├── textsConfig.js                  # ข้อความ
    │   ├── teamsConfig.js                  # ทีม
    │   ├── modesConfig.js                  # โหมด
    │   ├── itemsConfig.js                  # ไอเทม
    │   └── permissionsConfig.js            # สิทธิ์

    ├── data/
    │   ├── gameData.json                   # ข้อมูลหลัก
    │   ├── teamsData.json                  # ทีม
    │   ├── modesData.json                  # โหมด
    │   ├── itemsData.json                  # ไอเทม
    │   ├── textsData.json                  # ข้อความ
    │   └── permissionsData.json            # สิทธิ์

    ├── state/
    │   ├── playerState.js                  # ผู้เล่น
    │   ├── teamState.js                    # ทีม
    │   ├── matchState.js                   # แมตช์
    │   └── zoneState.js                    # โซน

    ├── storage/
    │   ├── dataStore.js                    # ตัวกลาง
    │   ├── playerStore.js                  # ผู้เล่น
    │   ├── teamStore.js                    # ทีม
    │   └── matchStore.js                   # แมตช์

    ├── backoffice/
    │   ├── importService.js                # นำเข้า
    │   ├── exportService.js                # ส่งออก
    │   ├── serializeService.js             # แปลงข้อมูล
    │   ├── validateService.js              # ตรวจข้อมูล
    │   └── presetService.js                # ค่าชุด

    ├── events/
    │   ├── playerEvents.js                 # อีเวนต์ผู้เล่น
    │   ├── combatEvents.js                 # อีเวนต์สู้
    │   └── blockEvents.js                  # อีเวนต์บล็อก

    ├── systems/
    │   ├── lobbySystem.js            # ล็อบบี้
    │   ├── teamSystem.js             # ทีม
    │   ├── gameStartSystem.js        # เริ่มเกม
    │   ├── winConditionSystem.js     # เงื่อนไขชนะ
    │   ├── pvpSystem.js              # PvP
    │   ├── damageSystem.js           # ดาเมจ
    │   ├── worldRuleSystem.js        # กฎโลก
    │   ├── rankSystem.js             # แรงค์
    │   ├── economySystem.js          # เงิน
    │   └── adminSystem.js            # แอดมิน
    ├── ui/
    │   ├── lobbyForm.js                    # ฟอร์มล็อบบี้
    │   ├── teamForm.js                     # ฟอร์มทีม
    │   ├── gameForm.js                     # ฟอร์มเกม
    │   ├── resultForm.js                   # ฟอร์มผล
    │   └── adminForm.js                    # ฟอร์มแอดมิน

    ├── uhc/
    │   ├── uhcRules.js                     # กฎ UHC
    │   ├── regenControlSystem.js           # ปิดฟื้นเลือด
    │   ├── goldenHeadSystem.js             # หัวทอง
    │   ├── finalHealSystem.js              # ฮีลเริ่ม
    │   └── gracePeriodSystem.js            # กันฆ่า

    ├── border/
    │   ├── borderManager.js                # วง
    │   ├── borderShrinkSystem.js           # หดวง
    │   └── borderDamageSystem.js           # นอกวง

    ├── scenarios/
    │   ├── scenarioRegistry.js             # รายการ
    │   ├── cutcleanScenario.js             # หลอม
    │   ├── timberScenario.js               # ต้นไม้
    │   ├── hasteyBoysScenario.js           # เร็ว
    │   ├── tripleOresScenario.js           # แร่ x3
    │   └── bloodDiamondsScenario.js        # แลกเลือด

    ├── spectators/
    │   ├── spectatorManager.js             # ผู้ดู
    │   ├── spectatorTeleport.js            # วาร์ป
    │   └── spectatorVisibility.js          # ซ่อน

    ├── scoreboard/
    │   ├── sidebarManager.js               # แถบข้าง
    │   ├── playerLineProvider.js           # ข้อมูล
    │   └── scoreboardLoop.js               # อัปเดต

    ├── kits/
    │   ├── kitRegistry.js                  # รายการ
    │   ├── defaultKit.js                   # เริ่มต้น
    │   └── archerKit.js                    # ธนู

    ├── drops/
    │   ├── oreDropSystem.js                # แร่
    │   ├── mobDropSystem.js                # มอน
    │   ├── appleRateSystem.js              # แอปเปิ้ล
    │   └── flintRateSystem.js              # ฟลินต์

    ├── utils/
    │   ├── jsonLoader.js                   # โหลด JSON
    │   ├── schemaValidator.js              # ตรวจรูปแบบ
    │   ├── logger.js                       # บันทึก
    │   └── timeUtils.js                    # เวลา

    └── lifecycle/
        ├── onWorldLoad.js                  # โหลดโลก
        ├── onMatchStart.js                 # เริ่ม
        ├── onMatchEnd.js                   # จบ
        └── onServerShutdown.js             # ปิดระบบ

```

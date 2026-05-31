# UHCRun

Minecraft Bedrock Ultra Hardcore addon for Bedrock Dedicated Server.

**Version:** BETA04 · **API:** `@minecraft/server` 2.8.0-beta · **Engine:** `[1.26, )`  
**Scripts:** 93 files · ~7,300 lines · ES modules · no build step

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Pack Layout](#pack-layout)
- [Commands](#commands)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Player Capacity](#player-capacity)
- [API Dependencies](#api-dependencies)
- [UUID Reference](#uuid-reference)

---

## Overview

UHCRun is a full-featured UHC addon for Minecraft Bedrock. It provides a complete game loop — setup, team management, border shrink, PvP enhancements, death tracking, revives, leaderboards, and an end sequence — all running as ES modules on BDS without any build tooling.

The addon consists of a behavior pack (93 script files, entities, loot tables, structures) and a resource pack (UI, sounds, textures, particles).

---

## Features

### Game Systems

- **Border** — 16-stage shrink (500×500 → 2×2) with particle rendering (cap 36 groups/tick), damage scaling (max 5 HP), warning sounds, and a multi-phase end sequence
- **Match Lifecycle** — setup → 2-phase scatter teleport → game loop (PVP enable at tick 720, border tick, victory check) → end → reset
- **Victory/Draw Detection** — checks every 60 ticks; single team remaining triggers 10s countdown win
- **End Sequence** — nether wall build (ancient debris/magma/blackstone) followed by ring-clearing patterns centered at (0,0)

### Teams

- **9 Teams** — Red, Blue, Yellow, Green, Purple, Aqua, Orange, Gray, Pink
- **Hard Player Cap** — 54 total players, enforced at join time via `joinTeam()` and UI
- **Team Chat** — colored `[index]` prefix, spectator isolation
- **GUI Manager** — join/leave teams, admin panel (11 options), teleport, player status, cache inspector
- **Scoreboard** — real-time sidebar with alive teams, border status, game state

### PvP & Combat

- **Custom Knockback** — horizontal 0.18 (clamped to ±1.2), vertical 0.32 on player hurt (2-tick throttle)
- **Fishing Rod KB** — horizontal 1.25, vertical 0.38, hook entity removed on hit
- **Pressure Plate Launch** — crimson plates launch players in view direction (horizontal 0.35, vertical 1.2)
- **CPS Anti-Cheat** — circular buffer (24 entries), tracks hits over 20 ticks; kicks at 24+ CPS
- **Projectile Hit Sounds** — orb sound to shooter on arrow/trident/snowball/egg hit

### Progression

- **Auto-Smelt** — iron/gold ore → ingot + XP; coal/copper/emerald → XP; lapis → book (12%); gravel → arrows; redstone → heal 2 HP + absorption (1/16)
- **Auto-Enchant** — Efficiency IV on pickaxes and shovels when selected (3-tick throttle, lore-checked)
- **Tree Capitator** — queue-based felling (max 16 logs, 64 leaves, 400 scan cap), fair scheduling (4 concurrent jobs, 50 queue, 3 per player)
- **Food Regen** — Regeneration II for 10s on cooked food consumption
- **Instant TNT** — place-and-primed with per-player cooldown (2 ticks) and global cap (8/tick)

### Revive & Death

- **Player Head Revive** — 30s channel (600 ticks), 30s cooldown, cancel on move >1 block, dimension switch, item loss, or team change
- **Death Tracking** — kill/death stats, kill streaks, multi-kill announcements (Double→Triple→Quadra→Ace), first blood
- **Item Vacuum** — hopper minecart collection on death (queue-bounded at 32 jobs, 3-tick drain interval)
- **Death UI** — title/subtitle screen with killer info, stats, environment cause

### World & Interaction

- **Block Breaking** — unrestricted within ±500 world border; border shrink does not block mining
- **Block Placing** — restricted only by ±500 global limit and end-sequence lock (radius ≤ 16)
- **Interaction Guard** — denylist for cartography table, brewing stand, furnaces, grindstone, smithing table, shulker boxes, hoppers, barrels, composters; ender chest applies knockback
- **Leaderboard NPCs** — 3 NPCs displaying top 10 kills, deaths, and teams (cached, hash-validated)

---

## Pack Layout

```
<world>/
├── behavior_packs/
│   └── uhcrunB26BETA03/        (BP · uuid 2c8816d4-...)
│       ├── scripts/             93 files · ~7,300 lines
│       │   ├── main.js
│       │   ├── customCommand/   command.js + function.js
│       │   ├── system/          17 files · border, match, filler
│       │   ├── Manager/         16 files · teams, stats, revive, GUI
│       │   ├── plugin/          38 files · 12 gameplay components
│       │   └── Router/          21 files · event wiring
│       ├── entities/            player.json (friendly fire filters)
│       ├── loot_tables/
│       ├── structures/          uhc1.mcstructure + uhc.mcstructure
│       ├── features/
│       ├── feature_rules/
│       ├── dimensions/          void nether + end
│       ├── recipes/
│       └── trading/
│
└── resource_packs/
    └── uhcrunR26BETA04/        (RP · uuid 71f61a3d-...)
        ├── ui/                  10 files
        ├── sounds/              kill, UHC notifications, win/start/spawn
        ├── textures/            uhc/, custom_textures/, ui/
        ├── texts/               death messages (en_US, en_GB)
        ├── animations/
        ├── particles/
        └── font/
```

---

## Commands

All commands registered via `customCommandRegistry.registerCommand()`. Admin commands require the `GameDirectors` tag.

| Command          | Permission    | Description                                                           |
| ---------------- | ------------- | --------------------------------------------------------------------- |
| `addon:uhcsetup` | GameDirectors | Load structure, create ticking areas (9+1), set gamerules, spawn NPCs |
| `addon:uhcstart` | GameDirectors | Init match — scatter teleport, game loop, border start                |
| `addon:uhcend`   | GameDirectors | Stop match — cleanup, victory message, restore gamerules              |
| `addon:uhcreset` | GameDirectors | Full reset — clear tags, dynprops, caches, stats, NPCs                |
| `addon:tpa`      | Any           | Teleport menu (admin teleport / spectator to player / player TPA)     |
| `addon:gui`      | GameDirectors | Open main admin GUI (spawn, team, features, credits, ranks, admin)    |
| `!fill`          | Admin chat    | Force final border shrink to radius 2 (one-time use)                  |

### Admin Chat Commands

| Command                    | Description                            |
| -------------------------- | -------------------------------------- |
| `!check` / `!เช็ค`         | Dump cache sizes to console            |
| `!clear` / `!ลบ`           | Clear runtime caches (preserves stats) |
| `!clearall` / `!ลบทั้งหมด` | Clear everything including stats       |

---

## Installation

1. **Deploy packs** — Copy `behavior_packs/uhcrunB26BETA03/` and `resource_packs/uhcrunR26BETA04/` into your BDS `worlds/<world-name>/` directory
2. **Activate** — Ensure `world_behavior_packs.json` and `world_resource_packs.json` reference the correct UUIDs
3. **Start server** — BDS loads and registers all scripts on startup
4. **First run** — Use `addon:uhcsetup` to prepare the world

> **Note:** BDS caches ES modules in memory. `/reload` may not pick up script changes. A **full server restart** is required after editing `.js` files.

---

## Quick Start

```bash
# 1. Admin sets up the world
addon:uhcsetup
# → structure loaded, ticking areas active, gamerules set, NPCs spawned

# 2. Players join teams
addon:tpa  →  Team Manager GUI  →  select team
# UI shows live count: "ผู้เล่นทั้งหมด: 12/54"

# 3. Admin starts the game
addon:uhcstart
# → 2-phase scatter teleport (leader at Y=200 → members at safe Y)
# → Border shrink timer begins (500 → 450 at tick 300)
# → PvP enables at tick 720 (36 seconds)

# 4. Game plays out
# → Border shrinks through 16 checkpoints
# → Deaths tracked, player heads dropped for revive
# → Victory triggers when 1 team remains

# 5. Admin ends or resets
addon:uhcend    # Stop match, show results
addon:uhcreset  # Full wipe for next game
```

---

## Architecture

### Layer Overview

```
main.js (30 lines)
├── plugin/axe/Routes.js                    self-registering
│
├── system/border.js                        block guards + !fill
│   └── BorderManager.js (barrel, 280 ln)   border state machine
│       ├── BorderManager_Particle.js (156) particle rendering
│       ├── BorderManager_Shrink.js (89)    shrink timer
│       ├── BorderManager_WarningDamage.js (138)
│       └── BorderManager_Scoreboard.js (111)
│   └── UhcMatchManager.js (barrel, 311)    match lifecycle
│       ├── UhcMatchManager_Teleport.js (288)  2-phase scatter
│       └── UhcMatchManager_Victory.js (83)    victory check
│   └── BlockFiller.js (barrel, 109)        async block filler
│       ├── BlockFiller_Util.js (140)
│       ├── BlockFiller_FillQueue.js (176)
│       ├── BlockFiller_PatternEnqueue.js (89)
│       ├── BlockFiller_TaskBuilder.js (125)
│       └── BlockFiller_EndSequence.js (129)
│   ├── BlockFillerUtil.js (41)             MODE constants
│   └── UtilUhcMatchManager.js (90)         player setup
│
├── Manager/TeamManager.js (334)            hub module
│   ├── State.js (202)                      global reactive state
│   ├── TeamActions.js (291)                team CRUD (cap 54)
│   ├── CacheManager.js (213)               cache lifecycle
│   ├── MenuManager.js (679)               all GUI forms
│   ├── ReviveManager.js (356)              player head revive
│   ├── StatsManager.js (306)               kill/death tracking
│   ├── DeathManager.js (181)               death processing
│   ├── ScoreboardManager.js (56)           sidebar
│   ├── TeleportManager.js (43)             TPA system
│   ├── ItemVacuum.js (33)                  item cleanup (max 32)
│   └── UtilTeamManager.js (22)             config (maxTotalPlayers: 54)
│   └── Leaderboard/ (5 files, 339 ln)     NPC + data + format
│       ├── LeaderboardConfig.js (41)
│       ├── LeaderboardData.js (128)
│       ├── LeaderboardFormat.js (78)
│       └── LeaderboardNPC.js (92)
│
└── Router/ (21 files)                     event → handler wiring
    ├── startup (1)                        custom commands
    ├── world events (20)                  chat, die, hurt, use, spawn,
    │                                      leave, break block, place block,
    │                                      interact, hit, pickup, projectile,
    │                                      consume, hotbar, pressure plate
    └── each imports Controllers from      plugins + system + Manager
        plugin/*/Controller.js
```

### Event Wiring (Router Layer)

Each `Router/*.js` file subscribes to one Minecraft event and delegates to an ordered list of handlers:

```js
// Example: Router/world-playerBreakBlockAfter.js
import autoSmelt from '../plugin/auto-smelt/Controller.js';
import axe from '../plugin/axe/Controller.js';

world.afterEvents.playerBreakBlock.subscribe((event) => {
    for (const handler of [autoSmelt.onPlayerBreakBlock, axe.onPlayerBreakBlock]) {
        handler(event);
    }
});
```

12 plugin components are wired through 21 Router files:

| Router                                    | Subscribes to  | Delegates to                                                    |
| ----------------------------------------- | -------------- | --------------------------------------------------------------- |
| `world-playerBreakBlock.js`               | `beforeEvents` | border guard                                                    |
| `world-playerBreakBlockAfter.js`          | `afterEvents`  | auto-smelt, axe                                                 |
| `world-playerPlaceBlock.js`               | `beforeEvents` | border guard                                                    |
| `world-playerPlaceBlockAfter.js`          | `afterEvents`  | tnt-instant                                                     |
| `world-entityHurt.js`                     | `afterEvents`  | knockback                                                       |
| `world-entityHitEntity.js`                | `afterEvents`  | anticheat-cps                                                   |
| `world-entityItemPickup.js`               | `afterEvents`  | item-pickup                                                     |
| `world-entitySpawn.js`                    | `afterEvents`  | block-interact-guard                                            |
| `world-itemCompleteUse.js`                | `afterEvents`  | item-consume-effects                                            |
| `world-projectileHitEntity.js`            | `afterEvents`  | fishing-hod, projectile-hit-sounds                              |
| `world-playerHotbarSelectedSlotChange.js` | `afterEvents`  | enchant                                                         |
| `world-playerInteractWithBlock.js`        | `beforeEvents` | border guard, block-interact-guard                              |
| `world-playerLeave.js`                    | `afterEvents`  | anticheat-cps, auto-smelt, axe, enchant, knockback, tnt-instant |

### Plugin Architecture (MVC)

All plugins follow a consistent MVC pattern similar to `@minecraft/server-ui` examples:

```
plugin/<name>/
├── Controller.js    event handlers, orchestrates Model + Service
├── Model.js         config constants, state maps, cooldowns
├── Service.js       business logic, side effects
└── Routes.js*       optional self-registration (axe only)
```

### Match Lifecycle

```
addon:uhcsetup
  ├─ Load uhc1.mcstructure
  ├─ Create ticking areas (9 zone + far north)
  ├─ Set gamerules (peaceful, no PVP, no naturalRegen)
  ├─ Batch player pipeline: compass, spawn, effects
  └─ Spawn 3 leaderboard NPCs

addon:uhcstart
  └─ startGameUhc()
      ├─ borderManagerInit: shrink timer + scoreboard
      ├─ scatter: Phase 1 (leaders to Y=200) → Phase 2 (members to safe Y)
      ├─ PVP timer: warning at 700, enable at 720
      └─ game loop start (20-tick interval)

[Game Loop]
  ├─ tick++ → border tick → shrink → checkpoint
  ├─ particle rendering (every 4 ticks)
  ├─ victory check (every 60 ticks)
  └─ player effects + sounds (first 26 ticks)

[Player Death]
  ├─ cancel revive session
  ├─ remove from alive tracking
  ├─ particles → spectator + drop head + vacuum items
  ├─ update stats → killer rewards → streak/multi-kill/first blood
  └─ queue death UI (batched 5-10/tick)

addon:uhcend
  ├─ stop game loop
  ├─ victory message + particles
  ├─ clear player states
  └─ restore gamerules

addon:uhcreset
  ├─ clearAllTaguhcAndDynamicProperty
  ├─ clearAllCachesIncludingStats
  ├─ reset border state
  └─ respawn NPCs
```

---

## Configuration

| Constant                  | File                              | Default           | Description                         |
| ------------------------- | --------------------------------- | ----------------- | ----------------------------------- |
| `CONFIG.maxTotalPlayers`  | `UtilTeamManager.js:9`            | `54`              | Hard total player cap               |
| `TEAMS`                   | `UtilTeamManager.js:12-22`        | 9 teams           | Team pool (id, name, color, icon)   |
| `CHECKPOINTS`             | `BorderManager.js:52`             | `[500,450,...,2]` | 16 border shrink stages             |
| `MAX_SPAWN_RADIUS`        | `UhcMatchManager_Teleport.js:14`  | `490`             | Max scatter radius                  |
| `GROUPS_RENDER_CAP`       | `BorderManager_Particle.js:14`    | `36`              | Particle groups rendered per tick   |
| `GROUPS_POOL_CAP`         | `BorderManager_Particle.js:13`    | `54`              | Max particle group pool             |
| `ITEM_VACUUM_MAX_QUEUE`   | `ItemVacuum.js:28`                | `32`              | Item vacuum queue limit             |
| `MAX_PLAYERS`             | `LeaderboardConfig.js:1`          | `10`              | Leaderboard top kills               |
| `MAX_TEAMS`               | `LeaderboardConfig.js:2`          | `10`              | Leaderboard top teams               |
| `PLACE_BLOCK_LOCK_RADIUS` | `border.js:12`                    | `16`              | Placing disabled when border ≤ this |
| `PVP_TICK`                | `UhcMatchManager.js`              | `720`             | PVP enable tick (36s)               |
| `BATCH_SIZE_NORMAL`       | `BlockFiller_Util.js:9`           | `120`             | Blocks/tick (normal fill)           |
| `BATCH_SIZE_ENDGAME`      | `BlockFiller_Util.js:10`          | `400`             | Blocks/tick (end sequence)          |
| `TASK_QUEUE_HARD_CAP`     | `BlockFiller_Util.js:13`          | `8000`            | Max fill queue slots                |
| `MAX_PENDING_BLOCKS`      | `BlockFiller_Util.js:14`          | `80000`           | Max pending blocks                  |
| `MAX_BLOCKS_PER_TASK`     | `BlockFiller_Util.js:15`          | `250000`          | Blocks per sub-task                 |
| `RETRY_QUEUE_LIMIT`       | `BlockFiller_Util.js:19`          | `4000`            | Max retry queue                     |
| `TELEPORT_MAX_RETRIES`    | `UhcMatchManager_Teleport.js:10`  | `3`               | Teleport retry attempts             |
| `MAX_CONCURRENT_JOBS`     | `plugin/axe/Model.js:14`          | `4`               | Tree capitator jobs                 |
| `MAX_QUEUE_SIZE`          | `plugin/axe/Model.js:15`          | `50`              | Tree capitator queue                |
| `MAX_LOGS`                | `plugin/axe/Model.js:5`           | `16`              | Logs per tree scan                  |
| `MAX_LEAVES`              | `plugin/axe/Model.js:6`           | `64`              | Leaves per tree scan                |
| `SCAN_BLOCK_CAP`          | `plugin/axe/Model.js:11`          | `400`             | BFS leaf scan cap                   |
| `HARD_LIMIT`              | `plugin/anticheat-cps/Model.js:3` | `24`              | CPS kick threshold                  |
| `MAX_CPS`                 | `plugin/anticheat-cps/Model.js:2` | `20`              | Legitimate CPS limit                |
| `PENDING_MAX`             | `plugin/item-pickup/Model.js:9`   | `32`              | Auto-smelt pending queue            |
| `GLOBAL_BORDER_LIMIT`     | `border.js:11`                    | `500`             | Absolute world boundary             |

---

## Player Capacity

| Players | Configuration     | Rating                      |
| ------- | ----------------- | --------------------------- |
| 9       | Solo (1 per team) | ✅ Optimal                  |
| 18      | To2 (2 per team)  | ✅ Optimal                  |
| 27      | To3 (3 per team)  | ✅ Optimal                  |
| 36      | To4 (4 per team)  | ⚠️ Manageable               |
| 45      | To5 (5 per team)  | ⚠️ Manageable               |
| 54      | To6 (6 per team)  | 🔷 Hard cap (code-enforced) |

**Typical usage:** 12–20 players (4–5 teams × 3–4 players) — all systems run at full efficiency.  
**Scatter:** 9 spread points at radius 490 (≈342 blocks apart). Team members share XZ position.

---

## API Dependencies

| Package                      | Version    |
| ---------------------------- | ---------- |
| `@minecraft/server`          | 2.8.0-beta |
| `@minecraft/server-ui`       | 2.1.0-beta |
| `@minecraft/server-gametest` | 1.0.0-beta |
| `@minecraft/server-admin`    | 1.0.0-beta |

---

## UUID Reference

| Pack          | UUID                                   | Type           |
| ------------- | -------------------------------------- | -------------- |
| Behavior Pack | `2c8816d4-a3b5-4df8-a682-cf7332249c9a` | data + scripts |
| Resource Pack | `71f61a3d-dcb1-4220-8d43-8ecbc2f83d57` | resources      |

---

## Development

- **Edit → test** — No build step. Edit `.js`/`.json` directly, restart BDS.
- **No CI/CD** — No linter, formatter, typechecker, or test framework.
- **Version control** — `.gitignore` skips `level.dat`, `level.dat_old`, `db/`, `levelname.txt`.

---

_UHCRun BETA04 — Minecraft Bedrock UHC addon for Bedrock Dedicated Server._  
_93 scripts · ~7,300 lines · 12 plugins · 21 routers · 9 teams · 54 player cap_

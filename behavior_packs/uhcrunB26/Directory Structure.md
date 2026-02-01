# 🎮 UHC RUN - Project Architecture (Redesigned)

## 📋 **ภาพรวมโครงสร้าง**

### **หลักการออกแบบ:**

- **1 World = 1 Game Instance**
- **Matchmaking Algorithm** สำหรับจัดคิวผู้เล่น
- **Spectator Mode** สำหรับผู้ที่เข้ามาตอนเกมเริ่มแล้ว
- **Scalable Multi-Instance Support**

---

## 🏗️ **โครงสร้างไดเรกทอรี**

```
Project_UHC_RUN/
├── behavior_pack/
│   ├── manifest.json
│   ├── pack_icon.png
│   │
│   ├── scripts/
│   │   ├── main.js                    # Entry point
│   │   │
│   │   ├── config/
│   │   │   ├── gameConfig.js          # Game settings
│   │   │   ├── teamConfig.js          # Team configurations
│   │   │   └── worldConfig.js         # World settings
│   │   │
│   │   ├── core/
│   │   │   ├── GameInstance.js        # Single game instance manager
│   │   │   ├── WorldManager.js        # World creation/deletion
│   │   │   └── StateManager.js        # Game state machine
│   │   │
│   │   ├── matchmaking/
│   │   │   ├── MatchmakingQueue.js    # Queue system
│   │   │   ├── MatchmakingAlgo.js     # Matching algorithm
│   │   │   ├── LobbyManager.js        # Lobby handling
│   │   │   └── PlayerPool.js          # Player pool management
│   │   │
│   │   ├── gameplay/
│   │   │   ├── TeamSystem.js          # Team management
│   │   │   ├── CombatSystem.js        # Combat/knockback
│   │   │   ├── WorldBorder.js         # Border system
│   │   │   ├── AutoSmelt.js           # Auto-smelting
│   │   │   ├── RedstoneHeart.js       # Golden hearts
│   │   │   └── CPSDetector.js         # Anti-cheat
│   │   │
│   │   ├── spectator/
│   │   │   ├── SpectatorMode.js       # Spectator management
│   │   │   └── SpectatorUI.js         # Spectator interface
│   │   │
│   │   ├── ui/
│   │   │   ├── HUDManager.js          # In-game HUD
│   │   │   ├── ScoreboardManager.js   # Scoreboard
│   │   │   ├── LobbyUI.js             # Lobby interface
│   │   │   └── TeamSelectionUI.js     # Team picker
│   │   │
│   │   ├── database/
│   │   │   ├── PlayerStats.js         # Player statistics
│   │   │   ├── GameHistory.js         # Match history
│   │   │   └── Leaderboard.js         # Rankings
│   │   │
│   │   └── utils/
│   │       ├── Logger.js              # Logging system
│   │       ├── EventBus.js            # Event handling
│   │       ├── Timer.js               # Timer utilities
│   │       └── Helpers.js             # Helper functions
│   │
│   ├── functions/
│   │   ├── setup/
│   │   │   └── initialize.mcfunction
│   │   ├── game/
│   │   │   ├── start.mcfunction
│   │   │   ├── end.mcfunction
│   │   │   └── reset.mcfunction
│   │   └── admin/
│   │       ├── force_start.mcfunction
│   │       └── emergency_stop.mcfunction
│   │
│   └── loot_tables/
│       └── custom/
│           └── uhc_loot.json
│
└── resource_pack/
    ├── manifest.json
    ├── pack_icon.png
    ├── textures/
    ├── sounds/
    └── ui/
        ├── lobby_screen.json
        ├── team_selection.json
        └── spectator_hud.json
```

---

## 🎯 **Matchmaking Algorithm Flow**

```
┌─────────────────────────────────────────────────────────────┐
│                     MATCHMAKING SYSTEM                      │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐
│ Player Joins │
│   Server     │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│  Check Active Games  │
│  (1 World = 1 Game)  │
└──────┬───────────────┘
       │
       ├─── Game Running? ────► Spectator Mode
       │
       └─── No Active Game
              │
              ▼
       ┌────────────────┐
       │  Join Queue    │
       │  (Lobby)       │
       └────┬───────────┘
              │
              ▼
       ┌────────────────────────┐
       │  Wait for Players      │
       │  Min: 4 | Max: 16      │
       └────┬───────────────────┘
              │
              ├─── Timeout (60s) ────► Start with current players
              │
              └─── Max Reached (16)
                     │
                     ▼
              ┌─────────────────┐
              │  Team Balancing │
              │  Algorithm      │
              └────┬────────────┘
                     │
                     ▼
              ┌─────────────────┐
              │  Create World   │
              │  Instance       │
              └────┬────────────┘
                     │
                     ▼
              ┌─────────────────┐
              │  Start Game     │
              └─────────────────┘
```

---

## 💾 **Database Schema (Using Dynamic Properties)**

### **Game Instance State**

```javascript
{
  gameId: "uhc_game_1",
  status: "WAITING | STARTING | RUNNING | ENDING",
  worldId: "uhc_world_1",
  players: ["player1", "player2", ...],
  spectators: ["spec1", "spec2", ...],
  teams: {
    "red": ["player1", "player2"],
    "blue": ["player3", "player4"]
  },
  startTime: 1234567890,
  borderSize: 1000,
  maxPlayers: 16
}
```

### **Player Data**

```javascript
{
  playerId: "player_uuid",
  username: "Steve",
  stats: {
    kills: 10,
    deaths: 5,
    wins: 3,
    gamesPlayed: 20
  },
  currentGame: "uhc_game_1" | null,
  isSpectator: false,
  team: "red" | null,
  cpsData: {
    clicks: [],
    violations: 0
  }
}
```

---

## 🔧 **Core Systems**

### **1. Matchmaking Queue System**

```javascript
// matchmaking/MatchmakingQueue.js
import { world, system } from "@minecraft/server";

export class MatchmakingQueue {
  constructor() {
    this.queue = [];
    this.minPlayers = 4;
    this.maxPlayers = 16;
    this.queueTimeout = 60 * 20; // 60 seconds in ticks
    this.queueStartTime = null;
  }

  addPlayer(player) {
    if (!this.isInQueue(player)) {
      this.queue.push({
        player: player,
        joinTime: Date.now(),
        elo: this.getPlayerElo(player),
      });

      player.sendMessage("§a[Matchmaking] คุณเข้าคิวแล้ว!");
      this.checkQueueStatus();
    }
  }

  removePlayer(player) {
    this.queue = this.queue.filter((p) => p.player.id !== player.id);
    player.sendMessage("§c[Matchmaking] คุณออกจากคิว");
  }

  isInQueue(player) {
    return this.queue.some((p) => p.player.id === player.id);
  }

  getQueueSize() {
    return this.queue.length;
  }

  checkQueueStatus() {
    const size = this.getQueueSize();

    // Start countdown when min players reached
    if (size >= this.minPlayers && !this.queueStartTime) {
      this.queueStartTime = system.currentTick;
      this.broadcastToQueue(`§e[Matchmaking] เริ่มนับถอยหลัง 60 วินาที...`);
    }

    // Auto-start when max players reached
    if (size >= this.maxPlayers) {
      this.startMatch();
    }

    // Check timeout
    if (this.queueStartTime) {
      const elapsed = system.currentTick - this.queueStartTime;
      if (elapsed >= this.queueTimeout) {
        this.startMatch();
      }
    }
  }

  startMatch() {
    if (this.queue.length < this.minPlayers) {
      this.broadcastToQueue("§c[Matchmaking] ผู้เล่นไม่เพียงพอ รอต่อ...");
      this.queueStartTime = null;
      return;
    }

    const players = this.queue.map((p) => p.player);
    this.queue = [];
    this.queueStartTime = null;

    // Create game instance
    const gameInstance = this.createGameInstance(players);
    gameInstance.start();
  }

  createGameInstance(players) {
    // Implementation in GameInstance.js
  }

  broadcastToQueue(message) {
    this.queue.forEach((p) => p.player.sendMessage(message));
  }

  getPlayerElo(player) {
    // Get from database
    return player.getDynamicProperty("uhc:elo") || 1000;
  }
}
```

---

### **2. Game Instance Manager**

```javascript
// core/GameInstance.js
import { world, system } from "@minecraft/server";

export class GameInstance {
  constructor(gameId, players) {
    this.gameId = gameId;
    this.players = players;
    this.spectators = [];
    this.state = "WAITING"; // WAITING, STARTING, RUNNING, ENDING
    this.worldId = null;
    this.teams = {};
    this.startTime = null;
  }

  async start() {
    this.state = "STARTING";

    // 1. Create world instance
    await this.createWorld();

    // 2. Assign teams
    this.assignTeams();

    // 3. Teleport players
    this.teleportPlayers();

    // 4. Start countdown
    await this.startCountdown();

    // 5. Begin game
    this.state = "RUNNING";
    this.startTime = Date.now();
    this.startGameLogic();
  }

  async createWorld() {
    // Note: Bedrock doesn't support dynamic world creation via API
    // Use pre-generated worlds or template system
    this.worldId = `uhc_world_${this.gameId}`;

    // Set gamerules
    world.getDimension("overworld").runCommand("gamerule naturalRegeneration false");
    world.getDimension("overworld").runCommand("gamerule keepInventory false");
  }

  assignTeams() {
    const teamColors = ["red", "blue", "green", "yellow", "aqua", "pink"];
    const playersPerTeam = Math.ceil(this.players.length / 2); // Adjust as needed

    let teamIndex = 0;
    this.players.forEach((player, i) => {
      const team = teamColors[teamIndex];
      if (!this.teams[team]) this.teams[team] = [];

      this.teams[team].push(player);
      player.setDynamicProperty("uhc:team", team);

      if ((i + 1) % playersPerTeam === 0) teamIndex++;
    });
  }

  teleportPlayers() {
    const spawnRadius = 500;

    Object.keys(this.teams).forEach((teamColor, index) => {
      const angle = (index / Object.keys(this.teams).length) * Math.PI * 2;
      const x = Math.cos(angle) * spawnRadius;
      const z = Math.sin(angle) * spawnRadius;

      this.teams[teamColor].forEach((player) => {
        player.teleport({ x, y: 100, z });
        player.sendMessage(`§${this.getTeamColorCode(teamColor)}คุณอยู่ทีม ${teamColor.toUpperCase()}!`);
      });
    });
  }

  async startCountdown() {
    for (let i = 10; i > 0; i--) {
      this.broadcast(`§e[UHC] เริ่มเกมใน ${i} วินาที...`);
      await this.wait(20); // 1 second
    }
    this.broadcast("§a[UHC] เกมเริ่มแล้ว! Good luck!");
  }

  startGameLogic() {
    // Initialize game systems
    this.initWorldBorder();
    this.initAutoSmelt();
    this.initCPSDetector();
    this.initSpectatorCheck();
  }

  addSpectator(player) {
    this.spectators.push(player);
    player.setDynamicProperty("uhc:spectator", true);
    player.setGameMode("spectator");
    player.sendMessage("§7[UHC] คุณกำลังดูเกมในโหมดผู้ชม");
  }

  initSpectatorCheck() {
    // Check for new players joining during game
    system.runInterval(() => {
      if (this.state !== "RUNNING") return;

      world.getAllPlayers().forEach((player) => {
        const inGame = this.players.some((p) => p.id === player.id);
        const isSpectator = this.spectators.some((p) => p.id === player.id);

        if (!inGame && !isSpectator) {
          this.addSpectator(player);
        }
      });
    }, 20); // Check every second
  }

  broadcast(message) {
    [...this.players, ...this.spectators].forEach((p) => {
      p.sendMessage(message);
    });
  }

  end(winningTeam) {
    this.state = "ENDING";
    this.broadcast(`§6§l[UHC] ทีม ${winningTeam.toUpperCase()} ชนะ!`);

    // Save stats
    this.saveGameStats(winningTeam);

    // Cleanup after 10 seconds
    system.runTimeout(() => {
      this.cleanup();
    }, 200);
  }

  cleanup() {
    // Reset world or teleport players to lobby
    [...this.players, ...this.spectators].forEach((player) => {
      player.setDynamicProperty("uhc:team", null);
      player.setDynamicProperty("uhc:spectator", null);
      // Teleport to main hub
    });
  }

  wait(ticks) {
    return new Promise((resolve) => {
      system.runTimeout(resolve, ticks);
    });
  }
}
```

---

### **3. Spectator System**

```javascript
// spectator/SpectatorMode.js
import { world, system } from "@minecraft/server";

export class SpectatorMode {
  constructor(player, gameInstance) {
    this.player = player;
    this.gameInstance = gameInstance;
    this.following = null;
  }

  enable() {
    this.player.setGameMode("spectator");
    this.player.runCommand("effect @s invisibility 999999 255 true");
    this.showSpectatorUI();
  }

  disable() {
    this.player.setGameMode("survival");
    this.player.runCommand("effect @s clear");
  }

  followPlayer(targetPlayer) {
    this.following = targetPlayer;

    system.runInterval(() => {
      if (!this.following || !this.isSpectating()) return;

      const loc = this.following.location;
      this.player.teleport({
        x: loc.x,
        y: loc.y + 2,
        z: loc.z,
      });
    }, 5);
  }

  showSpectatorUI() {
    // Display list of alive players to follow
    const alivePlayers = this.gameInstance.getAlivePlayers();

    this.player.sendMessage("§7━━━━━ SPECTATOR MODE ━━━━━");
    this.player.sendMessage("§eใช้คำสั่ง /follow <player> เพื่อติดตาม");
    this.player.sendMessage("§7Players alive:");

    alivePlayers.forEach((p) => {
      const team = p.getDynamicProperty("uhc:team");
      this.player.sendMessage(`§${this.getTeamColor(team)}• ${p.name}`);
    });
  }

  isSpectating() {
    return this.player.getGameMode() === "spectator";
  }
}
```

---

## 🎨 **UI System**

### **Lobby UI**

```javascript
// ui/LobbyUI.js
import { ActionFormData } from "@minecraft/server-ui";

export class LobbyUI {
  static async show(player) {
    const form = new ActionFormData()
      .title("§6§lUHC RUN - LOBBY")
      .body("§7เลือกโหมดเกม")
      .button("§a§lเข้าคิว Matchmaking\n§7รอคนเล่นเพิ่ม", "textures/ui/icon_play")
      .button("§e§lสถิติของฉัน\n§7ดูสถิติส่วนตัว", "textures/ui/icon_stats")
      .button("§c§lออกจากคิว\n§7ยกเลิกการรอ", "textures/ui/icon_cancel");

    const response = await form.show(player);

    if (response.selection === 0) {
      // Join matchmaking
      matchmakingQueue.addPlayer(player);
    } else if (response.selection === 1) {
      // Show stats
      this.showStats(player);
    } else if (response.selection === 2) {
      // Leave queue
      matchmakingQueue.removePlayer(player);
    }
  }

  static async showStats(player) {
    const kills = player.getDynamicProperty("uhc:kills") || 0;
    const deaths = player.getDynamicProperty("uhc:deaths") || 0;
    const wins = player.getDynamicProperty("uhc:wins") || 0;
    const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills;

    const form = new ActionFormData()
      .title("§6§lสถิติของคุณ")
      .body(`§eKills: §f${kills}\n` + `§cDeaths: §f${deaths}\n` + `§aWins: §f${wins}\n` + `§6K/D Ratio: §f${kd}`)
      .button("§7กลับ");

    await form.show(player);
  }
}
```

---

## 📊 **Configuration Files**

### **Game Config**

```javascript
// config/gameConfig.js
export const GameConfig = {
  QUEUE: {
    MIN_PLAYERS: 4,
    MAX_PLAYERS: 16,
    QUEUE_TIMEOUT: 60 * 20, // 60 seconds
  },

  WORLD: {
    BORDER_START_SIZE: 2000,
    BORDER_END_SIZE: 100,
    BORDER_SHRINK_TIME: 20 * 60 * 20, // 20 minutes
  },

  GAMEPLAY: {
    MAX_CPS: 18,
    REDSTONE_HEART_LIMIT: 4,
    RESPAWN_ENABLED: false,
    NATURAL_REGEN: false,
  },

  TEAMS: {
    ENABLED: true,
    TEAM_COLORS: ["red", "blue", "green", "yellow", "aqua", "pink"],
    MAX_TEAM_SIZE: 4,
  },
};
```

---

## 🚀 **Main Entry Point**

```javascript
// main.js
import { world, system } from "@minecraft/server";
import { MatchmakingQueue } from "./matchmaking/MatchmakingQueue.js";
import { GameInstance } from "./core/GameInstance.js";
import { LobbyUI } from "./ui/LobbyUI.js";

// Global instances
const matchmakingQueue = new MatchmakingQueue();
const activeGames = new Map();

// Initialize
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "uhc:init") {
    setupGame();
  }
});

function setupGame() {
  world.sendMessage("§a[UHC] System initialized!");

  // Setup lobby spawn
  world.getDimension("overworld").runCommand("setworldspawn 0 100 0");

  // Register events
  registerEvents();
}

function registerEvents() {
  // Player join
  world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;

    if (event.initialSpawn) {
      // Check if any active game
      const activeGame = Array.from(activeGames.values()).find((g) => g.state === "RUNNING");

      if (activeGame) {
        activeGame.addSpectator(player);
      } else {
        // Show lobby UI
        system.runTimeout(() => {
          LobbyUI.show(player);
        }, 20);
      }
    }
  });

  // Custom commands via chat
  world.beforeEvents.chatSend.subscribe((event) => {
    const { sender, message } = event;

    if (message === "!join") {
      event.cancel = true;
      matchmakingQueue.addPlayer(sender);
    } else if (message === "!leave") {
      event.cancel = true;
      matchmakingQueue.removePlayer(sender);
    } else if (message === "!stats") {
      event.cancel = true;
      LobbyUI.showStats(sender);
    }
  });
}

// Queue check loop
system.runInterval(() => {
  matchmakingQueue.checkQueueStatus();
}, 20);

// Export for use in other modules
export { matchmakingQueue, activeGames };
```

---

## 📝 **Function Files**

### **functions/setup/initialize.mcfunction**

```mcfunction
# UHC RUN - Setup
say §a[UHC] Initializing game...

# Set gamerules
gamerule naturalRegeneration false
gamerule doImmediateRespawn false
gamerule keepInventory false
gamerule showDeathMessages true
gamerule pvp true

# Clear world
kill @e[type=!player]
weather clear
time set day

# Set worldspawn
setworldspawn 0 100 0

# Initialize script
scriptevent uhc:init

say §a[UHC] Setup complete!
```

---

## 🔐 **Security & Anti-Cheat**

```javascript
// gameplay/CPSDetector.js
export class CPSDetector {
  constructor() {
    this.playerClicks = new Map();
    this.maxCPS = 18;
    this.violationThreshold = 3;
  }

  recordClick(player) {
    const now = Date.now();

    if (!this.playerClicks.has(player.id)) {
      this.playerClicks.set(player.id, {
        clicks: [],
        violations: 0,
      });
    }

    const data = this.playerClicks.get(player.id);
    data.clicks.push(now);

    // Keep only last 1 second of clicks
    data.clicks = data.clicks.filter((time) => now - time < 1000);

    // Check CPS
    if (data.clicks.length > this.maxCPS) {
      this.handleViolation(player, data);
    }
  }

  handleViolation(player, data) {
    data.violations++;

    if (data.violations >= this.violationThreshold) {
      player.runCommand(`kick "${player.name}" §cExceeded CPS limit (${this.maxCPS})`);
    } else {
      player.sendMessage(`§c[Anti-Cheat] Warning: High CPS detected (${data.violations}/${this.violationThreshold})`);
    }
  }
}
```

---

## 📈 **Scalability Considerations**

### **Multi-Instance Support**

- ใช้ **Map** เก็บ active games
- แต่ละ game มี `gameId` unique
- Support หลายเกมพร้อมกัน (ถ้า server รองรับ)

### **Performance Optimization**

- ใช้ `system.runInterval` แทน `while` loops
- Batch operations เมื่อเป็นไปได้
- Cleanup resources เมื่อเกมจบ

---

## 🎯 **Next Steps**

1. **Implement Core Systems** ตามโครงสร้างที่วางไว้
2. **Test Matchmaking** กับผู้เล่นจริง
3. **Add Analytics** ติดตาม game metrics
4. **Optimize Performance** ปรับ code ให้เร็วขึ้น
5. **Add Admin Commands** สำหรับจัดการเกม

---

มีส่วนไหนอยากให้ผมอธิบายเพิ่มเติมหรือสร้างโค้ดตัวอย่างเพิ่มไหมครับ? 😊

### Folder Structure
```
uhc-run/
└── scripts/
    ├── main.js                         # Bootstrap / Entry point

    ├── core/                           # Game Engine Kernel
    │   ├── context.js                  # world/system/dimension references
    │   ├── scheduler.js                # tick / interval system
    │   ├── eventBus.js                 # internal event hub
    │   └── gameState.js                # FSM: lobby/matching/running/end

    ├── config/                         # Data-driven Configuration
    │   ├── numbers.js
    │   ├── texts.js
    │   ├── teams.js
    │   ├── modes.js
    │   ├── items.js
    │   └── permissions.js

    ├── state/                          # In-memory Runtime State
    │   ├── players.js
    │   ├── teams.js
    │   ├── match.js
    │   ├── zones.js
    │   └── cache.js

    ├── events/                         # World / Player / Block Events
    │   ├── worldEvents.js
    │   ├── playerEvents.js
    │   ├── blockEvents.js
    │   ├── combatEvents.js
    │   └── inputEvents.js

    ├── systems/                        # Core Game Systems
    │   ├── lobby/
    │   ├── team/
    │   ├── matchmaking/
    │   ├── game/
    │   ├── combat/
    │   ├── world/
    │   ├── progression/
    │   ├── economy/
    │   └── admin/

    ├── storage/                        # Persistence Layer
    │   ├── db.js
    │   ├── playerDB.js
    │   ├── teamDB.js
    │   ├── matchDB.js
    │   └── leaderboardDB.js

    ├── ui/                             # Presentation Layer
    │   ├── lobbyUI.js
    │   ├── teamUI.js
    │   ├── gameUI.js
    │   ├── resultUI.js
    │   ├── statsUI.js
    │   └── adminUI.js

    ├── api/                            # Internal API / Hooks
    │   ├── commands.js
    │   └── hooks.js

    ├── commands/                       # Custom Command Engine
    │   ├── commandRegistry.js
    │   ├── argumentParser.js
    │   ├── validators.js
    │   └── commandRouter.js

    ├── permissions/                    # Permission Engine
    │   ├── permissionManager.js
    │   ├── roleRegistry.js
    │   ├── commandGuards.js
    │   └── tagSync.js

    ├── hud/                            # HUD Systems
    │   ├── actionBar.js
    │   ├── bossBar.js
    │   ├── sidebar.js
    │   └── notifications.js

    ├── cameras/                        # Camera Systems
    │   ├── cutscene.js
    │   ├── killcam.js
    │   ├── spectatorCam.js
    │   └── transitions.js

    ├── controls/                       # Player Control Systems
    │   ├── freeze.js
    │   ├── spectator.js
    │   ├── hotkeys.js
    │   └── controlSchemes.js

    ├── effects/                        # Visual / Audio Effects
    │   ├── particles.js
    │   ├── sounds.js
    │   ├── music.js
    │   └── animations.js

    ├── anti/                           # Anti-cheat Engine
    │   ├── movement.js
    │   ├── cps.js
    │   ├── reach.js
    │   ├── packet.js
    │   └── behavior.js

    ├── profiles/                       # Player Profiles
    │   ├── profileManager.js
    │   ├── ranks.js
    │   ├── cosmetics.js
    │   └── statistics.js

    ├── achievements/                   # Achievement System
    │   ├── achievementRegistry.js
    │   ├── triggers.js
    │   ├── rewardHandler.js
    │   └── ui.js

    ├── social/                         # Social Systems
    │   ├── friends.js
    │   ├── party.js
    │   ├── invites.js
    │   └── chatChannels.js

    ├── moderation/                     # Moderation Systems
    │   ├── banSystem.js
    │   ├── muteSystem.js
    │   ├── reportSystem.js
    │   └── auditLog.js

    ├── marketplace/                    # In-game Shop
    │   ├── shopUI.js
    │   ├── productRegistry.js
    │   ├── purchaseHandler.js
    │   └── transactions.js

    ├── telemetry/                      # Analytics / Metrics
    │   ├── sessionTracker.js
    │   ├── heatmap.js
    │   ├── eventMetrics.js
    │   └── exporter.js

    ├── diagnostics/                    # Debug / Performance
    │   ├── tickProfiler.js
    │   ├── memory.js
    │   ├── eventLogger.js
    │   └── inspector.js

    ├── replay/                         # Replay System
    │   ├── recorder.js
    │   ├── playerPath.js
    │   ├── exporter.js
    │   └── playback.js

    ├── bots/                           # AI / Bots
    │   ├── botSpawner.js
    │   ├── botBrain.js
    │   ├── botCombat.js
    │   └── botMovement.js

    ├── failover/                       # Crash Recovery
    │   ├── watchdog.js
    │   ├── autoRestart.js
    │   ├── snapshot.js
    │   └── restore.js

    ├── sandbox/                        # Testing Environment
    │   ├── scriptTester.js
    │   ├── dryRun.js
    │   └── mockWorld.js

    ├── utils/                          # Generic Utilities
    │   ├── random.js
    │   ├── math.js
    │   ├── array.js
    │   ├── logger.js
    │   ├── tags.js
    │   └── time.js

    ───────────────── UHC DOMAIN ─────────────────

    ├── uhc/                            # UHC Core Rules
    │   ├── uhcRules.js
    │   ├── regenControl.js
    │   ├── goldenHead.js
    │   ├── finalHeal.js
    │   └── gracePeriod.js

    ├── border/                         # Border System
    │   ├── borderManager.js
    │   ├── shrinkScheduler.js
    │   ├── damageOutside.js
    │   └── visualizer.js

    ├── scenarios/                      # UHC Scenarios
    │   ├── scenarioRegistry.js
    │   ├── cutclean.js
    │   ├── hasteyBoys.js
    │   ├── timber.js
    │   ├── tripleOres.js
    │   ├── bloodDiamonds.js
    │   └── noFall.js

    ├── spectators/                     # Spectator System
    │   ├── spectatorManager.js
    │   ├── teleportToPlayer.js
    │   ├── followCam.js
    │   └── hideFromAlive.js

    ├── scoreboard/                     # UHC Sidebar
    │   ├── sidebarManager.js
    │   ├── playerLines.js
    │   ├── teamLines.js
    │   └── updateLoop.js

    ├── kits/                           # UHC Kits
    │   ├── kitRegistry.js
    │   ├── defaultKit.js
    │   ├── archerKit.js
    │   └── healerKit.js

    ├── drops/                          # Custom Drops
    │   ├── oreDrops.js
    │   ├── mobDrops.js
    │   ├── appleRate.js
    │   └── flintRate.js

    ├── worldgen/                       # UHC World Generation
    │   ├── scatterPlayers.js
    │   ├── generateCaves.js
    │   ├── clearSpawn.js
    │   └── resetChunks.js

    ├── voice/                          # Proximity Voice
    │   ├── proximity.js
    │   ├── distanceCalc.js
    │   ├── muteOnDeath.js
    │   └── spectatorVoice.js

    └── lifecycle/                      # Match Lifecycle
        ├── onWorldLoad.js
        ├── onMatchStart.js
        ├── onMatchEnd.js
        └── onServerShutdown.js


```

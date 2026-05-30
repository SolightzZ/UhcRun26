import { EntityDamageCause } from '@minecraft/server';
import { center, ctx } from './BorderManager.js';

const BORDER_WARNING = Object.freeze({
    DANGER_DISTANCE: 25,
    CRITICAL_DISTANCE: 15,
    OUTSIDE_DISTANCE: 5,
    SOUND_COOLDOWN: 80,
    CHECK_INTERVAL: 10,
});

const WARNING_SOUNDS = Object.freeze({
    warning: { sound: 'note.pling', volume: 0.4, pitch: 0.9 },
    critical: { sound: 'note.pling', volume: 0.7, pitch: 1.3 },
    outside: { sound: 'random.break', volume: 0.6, pitch: 1.8 },
    danger: { sound: 'mob.enderdragon.growl', volume: 0.3, pitch: 2.0 },
});

const configDamage = { cause: EntityDamageCause.void };
const MAX_DAMAGE = 5;
const DAMAGE_SCALE = 0.2;

class BorderManagerWarningDamage {
    playerWarningData = new Map();

    clearCache() {
        this.playerWarningData.clear();
    }

    borderManagerGetPlayerWarningLevel(player) {
        if (!player?.isValid) return null;

        const loc = player.location;
        if (!loc) return null;

        const r = ctx.borderRadius;
        const cx = center.x;
        const cz = center.z;

        const dx = Math.abs(loc.x - cx);
        const dz = Math.abs(loc.z - cz);
        const maxDistance = Math.max(dx, dz);

        if (maxDistance > r) {
            const outsideDistance = maxDistance - r;
            if (outsideDistance <= BORDER_WARNING.OUTSIDE_DISTANCE) {
                return { level: 'outside', distance: outsideDistance, isOutside: true };
            }
            return null;
        }

        const distanceToEdge = r - maxDistance;

        if (distanceToEdge <= BORDER_WARNING.CRITICAL_DISTANCE) {
            return { level: 'critical', distance: distanceToEdge, isOutside: false };
        } else if (distanceToEdge <= BORDER_WARNING.DANGER_DISTANCE) {
            return { level: 'warning', distance: distanceToEdge, isOutside: false };
        }

        return null;
    }

    borderManagerUpdatePlayerWarningData(playerId, warningInfo) {
        const currentTick = ctx.uhcTick;

        if (!warningInfo) {
            this.playerWarningData.delete(playerId);
            return false;
        }

        let playerData = this.playerWarningData.get(playerId);
        if (!playerData) {
            playerData = {
                lastSoundTick: 0,
                lastLevel: null,
                consecutiveWarnings: 0,
            };
            this.playerWarningData.set(playerId, playerData);
        }

        const { level } = warningInfo;
        const timeSinceLastSound = currentTick - playerData.lastSoundTick;

        let shouldPlaySound = false;

        if (timeSinceLastSound >= BORDER_WARNING.SOUND_COOLDOWN) {
            shouldPlaySound = true;
        } else if (playerData.lastLevel !== level) {
            shouldPlaySound = true;
        }

        if (shouldPlaySound) {
            playerData.lastSoundTick = currentTick;
            playerData.lastLevel = level;
            playerData.consecutiveWarnings++;
            return true;
        }

        return false;
    }

    borderManagerPlayWarningSound(player, level) {
        if (!player?.isValid || !level) return;

        const soundConfig = WARNING_SOUNDS[level];
        if (!soundConfig) return;

        try {
            player.playSound(soundConfig.sound, {
                volume: soundConfig.volume,
                pitch: soundConfig.pitch,
            });
        } catch (error) {}
    }

    borderManagerProcessWarningSounds(players) {
        if (!players?.length || ctx.uhcTick % BORDER_WARNING.CHECK_INTERVAL !== 0) return;

        const playersToWarn = [];

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            if (!player?.isValid) continue;

            const warningInfo = this.borderManagerGetPlayerWarningLevel(player);
            const shouldPlaySound = this.borderManagerUpdatePlayerWarningData(player.id, warningInfo);

            if (shouldPlaySound && warningInfo) {
                playersToWarn.push({ player, level: warningInfo.level });
            }
        }

        for (let i = 0; i < playersToWarn.length; i++) {
            const { player, level } = playersToWarn[i];
            this.borderManagerPlayWarningSound(player, level);
        }

        this.borderManagerCleanupWarningData(players);
    }

    borderManagerCleanupWarningData(activePlayers) {
        if (ctx.uhcTick % 200 !== 0) return;

        const activePlayerIds = new Set();
        for (let i = 0; i < activePlayers.length; i++) {
            const player = activePlayers[i];
            if (player?.isValid) {
                activePlayerIds.add(player.id);
            }
        }

        for (const [playerId] of this.playerWarningData) {
            if (!activePlayerIds.has(playerId)) {
                this.playerWarningData.delete(playerId);
            }
        }
    }

    borderManagerApplyDamage(player) {
        if (!player?.isValid) return;
        const loc = player.location;
        if (!loc) return;
        const { x, z } = loc;
        const r = ctx.borderRadius;
        const dx = Math.max(0, Math.abs(x - center.x) - r);
        const dz = Math.max(0, Math.abs(z - center.z) - r);
        const outside = Math.max(dx, dz);
        if (outside <= 0) return;
        const damage = Math.min(MAX_DAMAGE, outside * DAMAGE_SCALE);
        player.applyDamage(damage, configDamage);
    }
}

export default new BorderManagerWarningDamage();

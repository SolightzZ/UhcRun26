// Knockback
export const KB = Object.freeze({
    horizontal: 0.18,
    vertical: 0.32,
    maxHorizontal: 1.2,
});

export function clamp(v, max) {
    return v > max ? max : v < -max ? -max : v;
}

/** Unit direction on XZ from a delta (e.g. attacker → victim). */
export function normalizeXZ(x, z) {
    const len = Math.hypot(x, z) || 1;
    return { nx: x / len, nz: z / len, len };
}

export function applyKnockbackXZ(entity, nx, nz, horizontal, vertical, maxHorizontal = KB.maxHorizontal) {
    if (!entity?.isValid) return;
    try {
        entity.applyKnockback({ x: clamp(nx * horizontal, maxHorizontal), z: clamp(nz * horizontal, maxHorizontal) }, vertical);
    } catch (e) {
        console.warn('[Util] Failed to apply knockback:', e);
    }
}

export function applyKnockbackFromDelta(entity, fromX, fromZ, toX, toZ, horizontal, vertical, maxHorizontal = KB.maxHorizontal) {
    const { nx, nz } = normalizeXZ(toX - fromX, toZ - fromZ);
    applyKnockbackXZ(entity, nx, nz, horizontal, vertical, maxHorizontal);
}

export function randomInt(min, max) {
    return (Math.random() * (max - min + 1) + min) | 0;
}

export function isValidEntity(entity) {
    try {
        return !!entity && entity.isValid;
    } catch (e) {
        console.warn('[Util] isValidEntity check failed:', e);
        return false;
    }
}

/** Run plugin/manager handlers in isolation so one failure does not skip the rest. */
export function runEventHandlers(tag, handlers, event) {
    for (let i = 0; i < handlers.length; i++) {
        try {
            handlers[i](event);
        } catch (error) {
            console.error(`[${tag}] handler ${i} error:`, error?.message ?? error);
        }
    }
}

// Dynamic Toast
function padTo(text, total = 100) {
    const safe = text.length > total ? text.slice(0, total) : text;
    return safe + '\t'.repeat(total - safe.length);
}

export function dynamicToast(msg = '', icon = '', bg = 'textures/ui/greyBorder') {
    return '§N§O§T§I§F§I§C§A§T§I§O§N' + padTo(msg, 500) + padTo(icon, 100) + padTo(bg, 100);
}

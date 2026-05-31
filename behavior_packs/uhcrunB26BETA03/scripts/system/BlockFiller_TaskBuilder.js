import { MODE } from './BlockFillerUtil.js';
import util from './BlockFiller_Util.js';

let sharedChunkCache = Object.create(null);

class BlockFillerTaskBuilder {
    resetChunkCache() {
        sharedChunkCache = Object.create(null);
    }

    createBoundsTask(dim, bounds, mode, yDirection = util.UPWARD_Y, fillOptions = {}) {
        let x = bounds.minX;
        let y = yDirection === util.DOWNWARD_Y ? bounds.maxY : bounds.minY;
        let z = bounds.minZ;

        const totalBlockCount = util.calculateBlockCount(bounds);

        let remaining = totalBlockCount;

        const resolvePermutation = util.createBlockResolver(mode, fillOptions);
        const isStatic = !fillOptions.randomize && !fillOptions.blockId && mode !== MODE.NETHER;
        const staticPerm = isStatic ? resolvePermutation() : null;
        const staticPermTypeId = staticPerm ? (staticPerm.typeId ?? staticPerm?.type?.id ?? '') : null;

        const minX = bounds.minX,
            maxX = bounds.maxX;

        const minY = bounds.minY,
            maxY = bounds.maxY;

        const minZ = bounds.minZ,
            maxZ = bounds.maxZ;

        return (limit) => {
            let consumed = 0;
            if ((yDirection === util.DOWNWARD_Y && y < minY) || (yDirection !== util.DOWNWARD_Y && y > maxY)) {
                return { consumed: 0, done: true };
            }

            while (consumed < limit) {
                if (y >= util.WORLD_MIN_Y && y <= util.WORLD_MAX_Y) {
                    const chunkKey = ((x >> 4) << 16) | ((z >> 4) & 0xffff);
                    let chunkOk = sharedChunkCache[chunkKey];
                    if (chunkOk === undefined) {
                        try {
                            const testBlock = dim.getBlock({ x, y: 0, z });
                            chunkOk = !!testBlock;
                        } catch {
                            chunkOk = false;
                        }
                        sharedChunkCache[chunkKey] = chunkOk;
                    }

                    if (!chunkOk) {
                        return { consumed, done: false, blocked: true, remaining };
                    }

                    const block = dim.getBlock({ x, y, z });
                    if (!block) {
                        return { consumed, done: false, blocked: true, remaining };
                    }

                    const perm = staticPerm ?? resolvePermutation();
                    const permTypeId = staticPermTypeId ?? perm.typeId ?? perm?.type?.id ?? '';

                    if (block.typeId !== permTypeId) {
                        try {
                            block.setPermutation(perm);
                        } catch {
                            return { consumed, done: false, blocked: true, remaining };
                        }
                    }
                    consumed++;
                    remaining--;
                }

                x++;
                if (x <= maxX) continue;
                x = minX;
                z++;
                if (z <= maxZ) continue;
                z = minZ;
                y += yDirection;
                if ((yDirection === util.DOWNWARD_Y && y < minY) || (yDirection !== util.DOWNWARD_Y && y > maxY)) {
                    return { consumed, done: true };
                }
            }
            return { consumed, done: false, remaining };
        };
    }

    createFillTask(dim, x1, y1, z1, x2, y2, z2, mode, yDirection = util.UPWARD_Y, fillOptions = {}) {
        util.initPermutations();
        const initialBounds = util.calculateBounds(x1, y1, z1, x2, y2, z2);
        if (!initialBounds) return [];
        const pendingBounds = [initialBounds];
        const segments = [];
        while (pendingBounds.length) {
            const bounds = pendingBounds.pop();
            const blockCount = util.calculateBlockCount(bounds);
            if (blockCount > util.MAX_BLOCKS_PER_TASK) {
                util.splitBounds(bounds, pendingBounds, yDirection);
                continue;
            }
            segments.push({
                task: this.createBoundsTask(dim, bounds, mode, yDirection, fillOptions),
                blockCount,
            });
        }
        return segments;
    }

    createPatternSegment(name, x1, z1, x2, z2) {
        return Object.freeze({ name, x1, z1, x2, z2 });
    }

    rotatePatternSegment(segment) {
        const x1 = segment.z1;
        const z1 = -segment.x1;
        const x2 = segment.z2;
        const z2 = -segment.x2;
        return this.createPatternSegment(segment.name, Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2));
    }

    buildPatternRotationCache(segments) {
        const rotation1 = segments.map((s) => this.rotatePatternSegment(s));
        const rotation2 = rotation1.map((s) => this.rotatePatternSegment(s));
        const rotation3 = rotation2.map((s) => this.rotatePatternSegment(s));
        return [segments, rotation1, rotation2, rotation3];
    }

    createPatternTask(name, mode, segments, options = {}) {
        return Object.freeze({
            name,
            mode,
            segments,
            yDirection: options.yDirection ?? util.UPWARD_Y,
            delay: options.delay ?? 20,
            fillBottomY: options.fillBottomY ?? null,
            startTopY: options.startTopY ?? null,
            fillOptions: Object.freeze({ ...(options.fillOptions ?? {}) }),
            rotationCache: options.useRotation ? this.buildPatternRotationCache(segments) : null,
        });
    }
}

export default new BlockFillerTaskBuilder();

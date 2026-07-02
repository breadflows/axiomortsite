/**
 * AXIOMORT Engine Core
 * Shared runtime systems for the Vault / Island / dimension pages:
 *   PoolManager        — pre-allocated object pools (no instantiation lag)
 *   ECSManager         — interleaved Float32Array entity store (stride 16 / 64B per entity)
 *   PhysicsSystem      — gravity + per-axis AABB resolution over the ECS buffer
 *   SwarmSystem        — boids-style separation/seek for type-2 (drone) entities
 *   PlayerControllerSystem — Source-style ground/air acceleration over the ECS buffer
 *   TransformSyncSystem — writes ECS positions back to Three.js objects
 *   StateBus           — key/value store with change subscriptions
 *   ProceduralFactory  — material shader hooks (currently no-op, see note below)
 *
 * ECS buffer layout per entity (base = id * 16):
 *   +0..2  position xyz     +3..5  velocity xyz     +6..8  target xyz
 *   +9     state            +10    speed limit      +11    hp
 *   +12    radius           +13    height           +14    type (2 = swarm drone)
 *   +15    flags (bit 0 = onGround)
 */

window.AXEngine = window.AXEngine || {};

class PoolManager {
    constructor(scene) {
        this.scene = scene;
        this.pools = new Map();
    }

    /**
     * Pre-allocates an array of objects.
     * @param {string} type - Identifier for the pool (e.g., 'player', 'projectile').
     * @param {number} size - Number of objects to pre-allocate.
     * @param {Function} factory - Async Function returning a newly instantiated Three.js Object3D/wrapper.
     */
    async registerPool(type, size, factory) {
        if (this.pools.has(type)) {
            console.warn(`[AXEngine] Pool '${type}' is already registered.`);
            return;
        }

        const pool = {
            active: [],
            inactive: []
        };

        const promises = [];
        for (let i = 0; i < size; i++) {
            promises.push(factory());
        }

        const objects = await Promise.all(promises);

        for (const obj of objects) {
            const mesh = obj.group || obj; // Support wrapper objects like robot
            mesh.visible = false;
            // Hide object far away
            if (mesh.position) mesh.position.set(0, -9999, 0);

            this.scene.add(mesh);
            pool.inactive.push(obj);
        }

        this.pools.set(type, pool);
        console.log(`[AXEngine] Registered pool '${type}' with ${size} entities.`);
    }

    /**
     * Retrieves an inactive object from the pool.
     * @param {string} type - Identifier for the pool.
     * @returns {Object3D|null} - The activated object, or null if the pool is empty.
     */
    get(type) {
        const pool = this.pools.get(type);
        if (!pool) {
            console.error(`[AXEngine] Pool '${type}' does not exist.`);
            return null;
        }

        if (pool.inactive.length === 0) {
            console.warn(`[AXEngine] Pool '${type}' is exhausted! Cannot allocate more without instantiation lag.`);
            // Fail gracefully rather than dynamically allocating,
            // to preserve predictable memory limits.
            return null;
        }

        const obj = pool.inactive.pop();
        obj.visible = true;
        pool.active.push(obj);
        return obj;
    }

    /**
     * Deactivates an object and returns it to the pool.
     * @param {string} type - Identifier for the pool.
     * @param {Object} obj - The object to release.
     */
    release(type, obj) {
        const pool = this.pools.get(type);
        if (!pool) return;

        const idx = pool.active.indexOf(obj);
        if (idx !== -1) {
            pool.active.splice(idx, 1);

            const mesh = obj.group || obj;
            mesh.visible = false;
            if (mesh.position) mesh.position.set(0, -9999, 0);

            // Custom reset hook if the object needs to clear trails, animations, etc.
            if (typeof obj.onRelease === 'function') obj.onRelease();

            pool.inactive.push(obj);
        }
    }
}

class ECSManager {
    constructor(maxEntities) {
        this.maxEntities = maxEntities;
        this.activeCount = 0;
        this.stride = 16;

        // Single contiguous memory block. 16 floats * 4 bytes = 64 bytes per entity (1 cache line)
        this.buffer = new Float32Array(maxEntities * this.stride);
        this.entities = new Array(maxEntities); // Reverse lookup for abstract logic
    }

    addEntity(abstractEntity, x = 0, y = 0, z = 0, radius = 0.6, height = 1.75, type = 0) {
        if (this.activeCount >= this.maxEntities) return -1;

        const id = this.activeCount;
        const idx = id * this.stride;

        this.buffer[idx + 0] = x;
        this.buffer[idx + 1] = y;
        this.buffer[idx + 2] = z;
        this.buffer[idx + 3] = 0; // velX
        this.buffer[idx + 4] = 0; // velY
        this.buffer[idx + 5] = 0; // velZ
        this.buffer[idx + 6] = 0; // tgtX
        this.buffer[idx + 7] = 0; // tgtY
        this.buffer[idx + 8] = 0; // tgtZ
        this.buffer[idx + 9] = 0; // state (0=Idle, 1=Wander, 2=Swarm)
        this.buffer[idx + 10] = 10.0; // speed limit
        this.buffer[idx + 11] = 100.0; // hp
        this.buffer[idx + 12] = radius;
        this.buffer[idx + 13] = height;
        this.buffer[idx + 14] = type;
        this.buffer[idx + 15] = 0; // flags (bit 0 = onGround)

        this.entities[id] = abstractEntity;
        if (abstractEntity && typeof abstractEntity.setEcsId === 'function') {
            abstractEntity.setEcsId(id);
        }

        this.activeCount++;
        return id;
    }

    removeEntity(id) {
        if (id < 0 || id >= this.activeCount) return;

        const lastId = this.activeCount - 1;
        const idx = id * this.stride;
        const lastIdx = lastId * this.stride;

        // Swap 64 bytes
        for (let i = 0; i < this.stride; i++) {
            this.buffer[idx + i] = this.buffer[lastIdx + i];
        }

        this.entities[id] = this.entities[lastId];
        this.entities[lastId] = null;
        this.activeCount--;

        if (this.entities[id] && typeof this.entities[id].setEcsId === 'function') {
            this.entities[id].setEcsId(id);
        }
    }
}

class PhysicsSystem {
    update(dt, ecs) {
        const count = ecs.activeCount;
        const buf = ecs.buffer;
        const stride = ecs.stride;
        const g = (ecs.gravity || 24) * dt;

        for (let i = 0; i < count; i++) {
            const idx = i * stride;

            // Gravity + vertical integration
            buf[idx + 4] -= g;
            buf[idx + 1] += buf[idx + 4] * dt;

            // Floor collision
            if (ecs.collisionFloorCallback) {
                const floorY = ecs.collisionFloorCallback(buf[idx + 0], buf[idx + 2], buf[idx + 1]);
                if (buf[idx + 1] <= floorY) {
                    buf[idx + 1] = floorY;
                    buf[idx + 4] = 0;
                    buf[idx + 15] = 1; // set onGround flag
                    if (ecs.entities[i]) ecs.entities[i].onGround = true;
                } else {
                    buf[idx + 15] = 0;
                    if (ecs.entities[i]) ecs.entities[i].onGround = false;
                }
            } else {
                if (buf[idx + 1] < 0) {
                    buf[idx + 1] = 0;
                    buf[idx + 4] = 0;
                    buf[idx + 15] = 1;
                    if (ecs.entities[i]) ecs.entities[i].onGround = true;
                }
            }

            // Horizontal integration, one axis at a time so AABB resolution
            // pushes out along the axis that actually penetrated
            buf[idx + 0] += buf[idx + 3] * dt;
            if (ecs.collisionBoxes) this.resolveBox(ecs.collisionBoxes, buf, idx, 'x', buf[idx + 12], buf[idx + 13]);

            buf[idx + 2] += buf[idx + 5] * dt;
            if (ecs.collisionBoxes) this.resolveBox(ecs.collisionBoxes, buf, idx, 'z', buf[idx + 12], buf[idx + 13]);
        }
    }

    resolveBox(boxes, buf, idx, axis, hw, ph) {
        const px = buf[idx + 0], py = buf[idx + 1], pz = buf[idx + 2];
        const pMinX = px - hw, pMaxX = px + hw;
        const pMinZ = pz - hw, pMaxZ = pz + hw;
        const pMinY = py - ph, pMaxY = py;

        for (let i = 0; i < boxes.length; i++) {
            const b = boxes[i];
            if (pMaxY <= b.min.y || pMinY >= b.max.y) continue;
            if (pMaxX > b.min.x && pMinX < b.max.x && pMaxZ > b.min.z && pMinZ < b.max.z) {
                if (axis === 'x') {
                    const bcx = (b.min.x + b.max.x) / 2;
                    if (px > bcx) buf[idx + 0] = b.max.x + hw + 0.001;
                    else buf[idx + 0] = b.min.x - hw - 0.001;
                    buf[idx + 3] = 0; // velX = 0
                } else if (axis === 'z') {
                    const bcz = (b.min.z + b.max.z) / 2;
                    if (pz > bcz) buf[idx + 2] = b.max.z + hw + 0.001;
                    else buf[idx + 2] = b.min.z - hw - 0.001;
                    buf[idx + 5] = 0; // velZ = 0
                }
            }
        }
    }
}

class SwarmSystem {
    update(dt, ecs) {
        const count = ecs.activeCount;
        const buf = ecs.buffer;
        const stride = ecs.stride;

        for (let i = 0; i < count; i++) {
            const idx = i * stride;
            const type = buf[idx + 14];

            // Only process type 2 (Swarm Drones)
            if (type !== 2) continue;

            const px = buf[idx + 0], py = buf[idx + 1], pz = buf[idx + 2];
            let vx = buf[idx + 3], vy = buf[idx + 4], vz = buf[idx + 5];
            const tx = buf[idx + 6], ty = buf[idx + 7], tz = buf[idx + 8];
            const speed = buf[idx + 10];

            // Pull towards target
            let dx = tx - px, dy = ty - py, dz = tz - pz;
            let distSq = dx * dx + dy * dy + dz * dz;
            if (distSq > 0.1) {
                const invD = 1.0 / Math.sqrt(distSq);
                vx += dx * invD * 5.0 * dt;
                vy += dy * invD * 5.0 * dt;
                vz += dz * invD * 5.0 * dt;
            }

            // Swarm avoidance (check neighbors)
            let sepX = 0, sepY = 0, sepZ = 0;
            let neighbors = 0;

            for (let j = 0; j < count; j++) {
                if (i === j) continue;
                const jidx = j * stride;
                if (buf[jidx + 14] !== 2) continue; // Only avoid other drones

                const sx = px - buf[jidx + 0];
                const sy = py - buf[jidx + 1];
                const sz = pz - buf[jidx + 2];
                const sdistSq = sx * sx + sy * sy + sz * sz;

                if (sdistSq > 0 && sdistSq < 16.0) { // 4 meter avoidance radius
                    const sDist = Math.sqrt(sdistSq);
                    sepX += (sx / sDist) / sDist;
                    sepY += (sy / sDist) / sDist;
                    sepZ += (sz / sDist) / sDist;
                    neighbors++;
                }
            }

            if (neighbors > 0) {
                vx += sepX * 10.0 * dt;
                vy += sepY * 10.0 * dt;
                vz += sepZ * 10.0 * dt;
            }

            // Limit speed
            const vSq = vx * vx + vy * vy + vz * vz;
            if (vSq > speed * speed) {
                const invV = speed / Math.sqrt(vSq);
                vx *= invV; vy *= invV; vz *= invV;
            }

            buf[idx + 3] = vx;
            buf[idx + 4] = vy;
            buf[idx + 5] = vz;
        }
    }

    /**
     * Integrates drone (type 2) positions directly — swarm drones fly, so they
     * skip PhysicsSystem gravity/collision entirely.
     */
    integrate(dt, ecs) {
        const count = ecs.activeCount;
        const buf = ecs.buffer;
        const stride = ecs.stride;
        for (let i = 0; i < count; i++) {
            const idx = i * stride;
            if (buf[idx + 14] !== 2) continue;
            buf[idx + 0] += buf[idx + 3] * dt;
            buf[idx + 1] += buf[idx + 4] * dt;
            buf[idx + 2] += buf[idx + 5] * dt;
        }
    }
}

/**
 * GMod/Quake-style movement (ground friction + accel, capped air-strafe)
 * operating directly on the interleaved ECS buffer.
 */
class PlayerControllerSystem {
    update(dt, ecs, playerId, wish, wantJump, sprinting, cfg) {
        if (playerId < 0 || playerId >= ecs.activeCount) return;

        cfg = cfg || {
            walkSpeed: 7.5,
            sprintSpeed: 12,
            jumpVel: 8.4,
            airStrafeCap: 1.4,
            groundAccelMultiplier: 12,
            airAccelMultiplier: 90,
            frictionMultiplier: 7
        };

        const buf = ecs.buffer;
        const idx = playerId * ecs.stride;

        const moving = wish.lengthSq() > 0;
        const wishSpeed = sprinting ? cfg.sprintSpeed : cfg.walkSpeed;
        const onGround = buf[idx + 15] !== 0;

        if (onGround) {
            // Ground friction (skipped on the jump frame so bhop keeps speed)
            if (!wantJump) {
                const sp = Math.hypot(buf[idx + 3], buf[idx + 5]);
                if (sp > 0.1) {
                    const drop = sp * cfg.frictionMultiplier * dt;
                    const k = Math.max(0, sp - drop) / sp;
                    buf[idx + 3] *= k;
                    buf[idx + 5] *= k;
                } else {
                    buf[idx + 3] = 0;
                    buf[idx + 5] = 0;
                }
            }

            // Ground acceleration
            if (moving) {
                const cur = buf[idx + 3] * wish.x + buf[idx + 5] * wish.z;
                const add = wishSpeed - cur;
                if (add > 0) {
                    let acc = cfg.groundAccelMultiplier * wishSpeed * dt;
                    if (acc > add) acc = add;
                    buf[idx + 3] += acc * wish.x;
                    buf[idx + 5] += acc * wish.z;
                }
            }

            // Jump
            if (wantJump) {
                buf[idx + 4] = cfg.jumpVel;
                buf[idx + 15] = 0;
                if (ecs.entities[playerId]) ecs.entities[playerId].onGround = false;
            }
        } else if (moving) {
            // Air-strafe acceleration (the bunnyhop mechanic)
            const cur = buf[idx + 3] * wish.x + buf[idx + 5] * wish.z;
            const add = cfg.airStrafeCap - cur;
            if (add > 0) {
                let acc = cfg.airAccelMultiplier * dt;
                if (acc > add) acc = add;
                buf[idx + 3] += acc * wish.x;
                buf[idx + 5] += acc * wish.z;
            }
        }
    }
}

class TransformSyncSystem {
    /**
     * Writes ECS positions back to the visual Three.js layer at the end of the frame.
     */
    update(ecs) {
        const count = ecs.activeCount;
        const buf = ecs.buffer;
        const stride = ecs.stride;
        const ents = ecs.entities;

        for (let i = 0; i < count; i++) {
            const obj = ents[i];
            if (!obj) continue;

            const idx = i * stride;
            const mesh = obj.group || obj;

            if (mesh && mesh.position && typeof mesh.position.set === 'function') {
                mesh.position.set(buf[idx], buf[idx + 1], buf[idx + 2]);
            }
        }
    }
}

/**
 * Global event bus to decouple logic from hardcoded update ticks.
 */
class StateBus {
    constructor() {
        this.state = new Map();
        this.listeners = new Map();
    }

    /** Set a state value and notify listeners if it changed. */
    set(key, value) {
        const prev = this.state.get(key);
        if (prev !== value) {
            this.state.set(key, value);
            this.notify(key, value, prev);
        }
    }

    /** Get a state value. */
    get(key, defaultValue = null) {
        return this.state.has(key) ? this.state.get(key) : defaultValue;
    }

    /**
     * Subscribe to changes for a specific key.
     * Returns a function to unsubscribe.
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);

        return () => this.listeners.get(key).delete(callback);
    }

    notify(key, newValue, oldValue) {
        if (this.listeners.has(key)) {
            for (const cb of this.listeners.get(key)) {
                try {
                    cb(newValue, oldValue, key);
                } catch (e) {
                    console.error(`[AXEngine StateBus] Error in listener for ${key}:`, e);
                }
            }
        }
    }
}

/**
 * Material shader hooks.
 *
 * The original injectors painted an emissive neon-circuit grid / heavy edge-wear
 * over every surface, which wrecked AXIOMORT's clean authored look, so they are
 * intentional no-ops. The intended "smart material" (subtle dirt + edge wear)
 * needs a different, non-emissive approach — kept as named hooks so call sites
 * stay stable if that gets built.
 */
class ProceduralFactory {
    static injectNoise(material) { return material; }
    static injectPremiumMaterial(material) { return material; }
    static updateTime() {}
}

/**
 * Procedural structural geometry helpers.
 */
class ArchitecturalGenerator {
    static createPlatform(w, h, d) {
        // Main floor slab
        const main = new THREE.BoxGeometry(w, h, d);
        // Macroscopic support beams
        const beamD = 0.5;
        const beamH = 1.0;
        const b1 = new THREE.BoxGeometry(w, beamH, beamD).translate(0, -h / 2 - beamH / 2, d / 2 - beamD / 2);
        const b2 = new THREE.BoxGeometry(w, beamH, beamD).translate(0, -h / 2 - beamH / 2, -d / 2 + beamD / 2);

        if (window.BufferGeometryUtils) {
            return window.BufferGeometryUtils.mergeGeometries([main, b1, b2]);
        }
        return main;
    }
}

AXEngine.PoolManager = PoolManager;
AXEngine.ECSManager = ECSManager;
AXEngine.Systems = { PhysicsSystem, TransformSyncSystem, PlayerControllerSystem, SwarmSystem };
AXEngine.StateBus = StateBus;
AXEngine.ProceduralFactory = ProceduralFactory;
AXEngine.ArchitecturalGenerator = ArchitecturalGenerator;

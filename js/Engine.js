/**
 * AXIOMORT Engine Core
 * Phase 1: Object Pooling & Memory Reuse
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
            // In a strict data-oriented system, we fail gracefully rather than dynamically allocating
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

/**
 * /**
 * Phase 2: Global Shared Systems (Data-Oriented ECS)
 * Interleaved Float32Array (STRIDE = 16) for perfect CPU cache coherency (64 bytes per entity).
 */
class ECSManager {
    constructor(maxEntities) {
        this.maxEntities = maxEntities;
        this.activeCount = 0;
        this.stride = 16;
        
        // Single contiguous memory block. 16 floats * 4 bytes = 64 bytes per entity (1 Cache Line)
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
        this.buffer[idx + 15] = 0; // flags (bitpacked)
        
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
    
    // Abstract backward-compatibility getters for tower.html legacy sync
    get positions() { return { 
        [Symbol.iterator]: function* () {}, // disabled to force using buffer
        get: (i) => this.buffer[i] // Used temporarily by tower.html 
    }; }
}

class PhysicsSystem {
    update(dt, ecs) {
        const count = ecs.activeCount;
        const buf = ecs.buffer;
        const stride = ecs.stride;
        const g = (ecs.gravity || 24) * dt;
        
        for (let i = 0; i < count; i++) {
            const idx = i * stride;
            
            // Gravity
            buf[idx + 4] -= g;
            
            // Apply Velocity
            buf[idx + 0] += buf[idx + 3] * dt; // X
            buf[idx + 1] += buf[idx + 4] * dt; // Y
            buf[idx + 2] += buf[idx + 5] * dt; // Z
            
            // Simple Floor Collision
            if (ecs.collisionFloorCallback) {
                const floorY = ecs.collisionFloorCallback(buf[idx + 0], buf[idx + 2], buf[idx + 1]);
                if (buf[idx + 1] <= floorY) {
                    buf[idx + 1] = floorY;
                    buf[idx + 4] = 0;
                    buf[idx + 15] = 1; // set onGround flag
                    if(ecs.entities[i]) ecs.entities[i].onGround = true;
                } else {
                    buf[idx + 15] = 0;
                    if(ecs.entities[i]) ecs.entities[i].onGround = false;
                }
            } else {
                if (buf[idx + 1] < 0) {
                    buf[idx + 1] = 0;
                    buf[idx + 4] = 0;
                    buf[idx + 15] = 1;
                    if(ecs.entities[i]) ecs.entities[i].onGround = true;
                }
            }
            
            // X Movement
            buf[idx + 0] += buf[idx + 3] * dt;
            if (ecs.collisionBoxes) this.resolveBox(ecs.collisionBoxes, buf, idx, 'x', buf[idx + 12], buf[idx + 13]);
            
            // Z Movement
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
            
            // Boids logic (Cohesion, Alignment, Separation) - simplified for performance
            // Pull towards target
            let dx = tx - px, dy = ty - py, dz = tz - pz;
            let distSq = dx*dx + dy*dy + dz*dz;
            if (distSq > 0.1) {
                const invD = 1.0 / Math.sqrt(distSq);
                vx += dx * invD * 5.0 * dt;
                vy += dy * invD * 5.0 * dt;
                vz += dz * invD * 5.0 * dt;
            }
            
            // Swarm avoidance (check neighbors)
            let sepX = 0, sepY = 0, sepZ = 0;
            let neighbors = 0;
            
            // Inner loop over ECS memory block (cache perfectly hits)
            for (let j = 0; j < count; j++) {
                if (i === j) continue;
                const jidx = j * stride;
                if (buf[jidx + 14] !== 2) continue; // Only avoid other drones
                
                const sx = px - buf[jidx + 0];
                const sy = py - buf[jidx + 1];
                const sz = pz - buf[jidx + 2];
                const sdistSq = sx*sx + sy*sy + sz*sz;
                
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
            const vSq = vx*vx + vy*vy + vz*vz;
            if (vSq > speed * speed) {
                const invV = speed / Math.sqrt(vSq);
                vx *= invV; vy *= invV; vz *= invV;
            }
            
            buf[idx + 3] = vx;
            buf[idx + 4] = vy;
            buf[idx + 5] = vz;
        }
    }
}

/**
 * Phase 5: GMod/Quake Bunnyhop Math inside ECS
 */
class PlayerControllerSystem {
    update(dt, ecs, playerId, wish, wantJump, sprinting, cfg) {
        if (playerId < 0 || playerId >= ecs.activeCount) return;
        
        // Setup defaults (from tower.html specs) if no cfg is provided
        cfg = cfg || {
            walkSpeed: 7.5,
            sprintSpeed: 12,
            jumpVel: 8.4,
            airStrafeCap: 1.4,
            groundAccelMultiplier: 12,
            airAccelMultiplier: 90,
            frictionMultiplier: 7
        };
        
        const idx = playerId * 3;
        const vel = ecs.velocities;
        
        const moving = wish.lengthSq() > 0;
        const wishSpeed = sprinting ? cfg.sprintSpeed : cfg.walkSpeed;
        const entity = ecs.entities[playerId];
        const onGround = entity ? entity.onGround : false;

        if (onGround) {
            // Ground Friction
            if (!wantJump) {
                const sp = Math.hypot(vel[idx], vel[idx+2]);
                if (sp > 0.1) {
                    const drop = sp * cfg.frictionMultiplier * dt;
                    const k = Math.max(0, sp - drop) / sp;
                    vel[idx] *= k;
                    vel[idx+2] *= k;
                } else {
                    vel[idx] = 0;
                    vel[idx+2] = 0;
                }
            }
            
            // Ground Acceleration
            if (moving) {
                const cur = vel[idx]*wish.x + vel[idx+2]*wish.z;
                const add = wishSpeed - cur;
                if (add > 0) {
                    let acc = cfg.groundAccelMultiplier * wishSpeed * dt;
                    if (acc > add) acc = add;
                    vel[idx] += acc*wish.x;
                    vel[idx+2] += acc*wish.z;
                }
            }
            
            // Jump
            if (wantJump) {
                vel[idx+1] = cfg.jumpVel;
                if(entity) entity.onGround = false;
            }
        } else if (moving) {
            // Air Strafe Acceleration (Bunnyhop mechanic)
            const cur = vel[idx]*wish.x + vel[idx+2]*wish.z;
            const add = cfg.airStrafeCap - cur;
            if (add > 0) {
                let acc = cfg.airAccelMultiplier * dt;
                if (acc > add) acc = add;
                vel[idx] += acc*wish.x;
                vel[idx+2] += acc*wish.z;
            }
        }
    }
}

class TransformSyncSystem {
    /**
     * Re-inflates the raw array data back to the visual Three.js layer at the end of the frame.
     */
    update(ecs) {
        const count = ecs.activeCount;
        const pos = ecs.positions;
        const ents = ecs.entities;
        
        for (let i = 0; i < count; i++) {
            const obj = ents[i];
            if (!obj) continue;
            
            const idx = i * 3;
            const mesh = obj.group || obj;
            
            // Only sync visual transform if the entity actually has a Three.js position property
            if (mesh && mesh.position && typeof mesh.position.set === 'function') {
                mesh.position.set(pos[idx], pos[idx + 1], pos[idx + 2]);
            }
        }
    }
}

/**
 * Phase 3: Data-Driven Environment & State Loop
 * Global event bus to decouple logic from hardcoded update ticks.
 */
class StateBus {
    constructor() {
        this.state = new Map();
        this.listeners = new Map();
    }
    
    /**
     * Set a state value and notify listeners if it changed.
     */
    set(key, value) {
        const prev = this.state.get(key);
        if (prev !== value) {
            this.state.set(key, value);
            this.notify(key, value, prev);
        }
    }
    
    /**
     * Get a state value.
     */
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
        
        // Return unsubscribe lambda
        return () => this.listeners.get(key).delete(callback);
    }
    
    notify(key, newValue, oldValue) {
        if (this.listeners.has(key)) {
            for (const cb of this.listeners.get(key)) {
                try {
                    cb(newValue, oldValue, key);
                } catch(e) {
                    console.error(`[AXEngine StateBus] Error in listener for ${key}:`, e);
                }
            }
        }
    }
}

/**
 * Phase 4: Procedural Asset Generation
 * Lightweight hooks to inject noise and mathematical rules directly into WebGL materials.
 */
class ProceduralFactory {
    /**
     * Injects a procedural noise grid / sci-fi overlay into a standard material's shader.
     */
    static injectNoise(material, config = {}) {
        // DISABLED: this painted an emissive neon-circuit grid over every surface, which
        // wrecked AXIOMORT's clean look. The intended "smart material" (subtle dirt + edge
        // wear) needs a different, non-emissive approach — left as a focused follow-up.
        return material;
        // eslint-disable-next-line no-unreachable
        const seed = config.seed || Math.random();
        const scale = config.scale || 10.0;
        const color = new THREE.Color(config.color || 0x00ffcc);
        
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uSeed = { value: seed };
            shader.uniforms.uScale = { value: scale };
            shader.uniforms.uTime = { value: 0 };
            shader.uniforms.uNeonColor = { value: color };

            // Store reference to update uTime globally later
            material.userData.shader = shader;

            // Inject Custom Varyings
            shader.vertexShader = `
                varying vec3 vWorldPos;
            ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `
                #include <worldpos_vertex>
                vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                `
            );

            // Inject Simplex Noise
            shader.fragmentShader = `
                uniform float uSeed;
                uniform float uScale;
                uniform float uTime;
                uniform vec3 uNeonColor;
                varying vec3 vWorldPos;

                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + .1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }
                float noise(vec3 x) {
                    vec3 i = floor(x);
                    vec3 f = fract(x);
                    f = f*f*(3.0-2.0*f);
                    return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)),f.x),
                               mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)),f.x),f.y),
                           mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)),f.x),
                               mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)),f.x),f.y),f.z);
                }
            ` + shader.fragmentShader;

            // Inject Emissive Overrides
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #include <emissivemap_fragment>
                float n = noise(vWorldPos * uScale + uSeed + uTime * 0.5);
                
                // Sci-fi Grid Lines
                float gridX = sin(vWorldPos.x * uScale * 2.0);
                float gridY = sin(vWorldPos.y * uScale * 2.0);
                float grid = smoothstep(0.95, 1.0, gridX) + smoothstep(0.95, 1.0, gridY);
                
                float glow = smoothstep(0.6, 1.0, n) * grid;
                totalEmissiveRadiance += uNeonColor * glow * 4.0;
                `
            );
        };
    }
    
    static _registeredMaterials = [];

    /**
     * Injects a premium Cyberpunk/Brutalist AAA architectural shader into a material.
     * Uses world-space UVs so the grid seamlessly spans across differently sized blocks.
     */
    static injectPremiumMaterial(material, config = {}) {
        // DISABLED — see injectNoise note. Keep AXIOMORT's clean authored surfaces.
        return material;
        // eslint-disable-next-line no-unreachable
        const seed = config.seed || Math.random();
        const scale = config.scale || 1.0;
        const color = new THREE.Color(config.color || 0x00ffcc);

        // Base Pristine White Concrete (Mirror's Edge style)
        material.color.setHex(0xfafafa);
        material.roughness = 0.9;
        material.metalness = 0.1;
        material.emissive.setHex(0x000000);
        
        // CRITICAL: Force derivatives extension so dFdx/dFdy work even without textures
        material.extensions = material.extensions || {};
        material.extensions.derivatives = true;
        
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uSeed = { value: seed };
            shader.uniforms.uScale = { value: scale };
            shader.uniforms.uTime = { value: 0 };
            shader.uniforms.uAccentColor = { value: color };

            material.userData.shader = shader;
            ProceduralFactory._registeredMaterials.push(material);

            shader.vertexShader = `
                varying vec3 vWorldPos;
                varying vec3 vWorldNormal;
            ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `
                #include <worldpos_vertex>
                vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                // Compute world normal for triplanar mapping
                vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                `
            );

            shader.fragmentShader = `
                uniform float uSeed;
                uniform float uScale;
                uniform float uTime;
                uniform vec3 uAccentColor;
                varying vec3 vWorldPos;
                varying vec3 vWorldNormal;

                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + .1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }
                float noise(vec3 x) {
                    vec3 i = floor(x);
                    vec3 f = fract(x);
                    f = f*f*(3.0-2.0*f);
                    return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)),f.x),
                               mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)),f.x),f.y),
                           mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)),f.x),
                               mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)),f.x),f.y),f.z);
                }
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <normal_fragment_begin>',
                `
                #include <normal_fragment_begin>
                
                // --- MICROSCOPIC DETAILS (Procedural Normal Maps) ---
                
                // 1. Recessed Grating (tight geometric pattern)
                vec3 gv = fract(vWorldPos * uScale * 8.0);
                float gratingX = smoothstep(0.0, 0.1, gv.x) * smoothstep(1.0, 0.9, gv.x);
                float gratingY = smoothstep(0.0, 0.1, gv.y) * smoothstep(1.0, 0.9, gv.y);
                float gratingZ = smoothstep(0.0, 0.1, gv.z) * smoothstep(1.0, 0.9, gv.z);
                float grating = gratingX * gratingY * gratingZ;
                
                // 2. Large Panel Gaps
                vec3 pv = fract(vWorldPos * uScale * 0.5);
                float panels = smoothstep(0.0, 0.02, pv.x) * smoothstep(1.0, 0.98, pv.x) *
                               smoothstep(0.0, 0.02, pv.y) * smoothstep(1.0, 0.98, pv.y) *
                               smoothstep(0.0, 0.02, pv.z) * smoothstep(1.0, 0.98, pv.z);
                               
                // 3. Rivets (small dots near the panel gaps)
                vec3 rPos = fract(vWorldPos * uScale * 2.0) - 0.5;
                float rivets = (length(rPos.xy) < 0.05 || length(rPos.xz) < 0.05 || length(rPos.yz) < 0.05) ? 1.0 : 0.0;
                
                // Combine height maps
                float bumpHeight = (grating * 0.1) + (panels * 0.5) + (rivets * 0.2);
                
                // Screen-space derivatives for bump mapping (faking high-poly geometry)
                vec3 dPdx = dFdx(vWorldPos);
                vec3 dPdy = dFdy(vWorldPos);
                float dhdx = dFdx(bumpHeight);
                float dhdy = dFdy(bumpHeight);
                
                vec3 rx = cross(dPdy, normal);
                vec3 ry = cross(normal, dPdx);
                float det = dot(dPdx, rx);
                
                // Prevent division by zero / NaN
                if (abs(det) > 0.00001) {
                    vec3 grad = sign(det) * (dhdx * rx + dhdy * ry);
                    normal = normalize(normal - grad * 2.0);
                }
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                
                // Recalculate panel grooves for Edge Wear
                vec3 _bp = fract(vWorldPos * uScale * 1.5);
                float _grooves = smoothstep(0.0, 0.03, _bp.x) * smoothstep(1.0, 0.97, _bp.x) *
                                 smoothstep(0.0, 0.03, _bp.y) * smoothstep(1.0, 0.97, _bp.y) *
                                 smoothstep(0.0, 0.03, _bp.z) * smoothstep(1.0, 0.97, _bp.z);
                                 
                float edgeWear = 1.0 - _grooves; // 1.0 at the edges
                float wearNoise = noise(vWorldPos * uScale * 25.0 + uSeed);
                
                // Procedural Ambient Occlusion / Smudge Noise
                float n = noise(vWorldPos * uScale * 1.5 + uSeed);
                float fineNoise = noise(vWorldPos * uScale * 8.0 + uSeed);
                
                // Base white plaster with subtle dirt/smudges in the corners + Edge Wear
                float ao = mix(0.75, 1.0, n * 0.7 + fineNoise * 0.3);
                // Darken edges significantly where wear noise is high (chipped concrete/exposed metal)
                float edgeDarkening = mix(1.0, 0.3, edgeWear * wearNoise);
                
                diffuseColor.rgb *= ao * edgeDarkening;
                
                // Triplanar mapping for the accent band
                vec3 blend = abs(vWorldNormal);
                blend = normalize(max(blend, 0.00001));
                blend /= dot(blend, vec3(1.0));
                
                // Create a sharp, non-emissive glossy band running across the geometry
                vec2 uvZ = vWorldPos.xy * uScale * 0.15;
                float band = smoothstep(0.49, 0.5, fract(uvZ.y)) * smoothstep(0.51, 0.5, fract(uvZ.y));
                
                // Apply the highly saturated accent color
                diffuseColor.rgb = mix(diffuseColor.rgb, uAccentColor, band * blend.z);
                `
            );
            
            // To make the stripe glossy, and edges rougher
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <roughnessmap_fragment>',
                `
                #include <roughnessmap_fragment>
                vec2 _uvZ = vWorldPos.xy * uScale * 0.15;
                float _band = smoothstep(0.49, 0.5, fract(_uvZ.y)) * smoothstep(0.51, 0.5, fract(_uvZ.y));
                float _blendZ = abs(vWorldNormal).z;
                
                vec3 __bp = fract(vWorldPos * uScale * 1.5);
                float __grooves = smoothstep(0.0, 0.03, __bp.x) * smoothstep(1.0, 0.97, __bp.x) *
                                  smoothstep(0.0, 0.03, __bp.y) * smoothstep(1.0, 0.97, __bp.y) *
                                  smoothstep(0.0, 0.03, __bp.z) * smoothstep(1.0, 0.97, __bp.z);
                float _edgeWear = 1.0 - __grooves;
                float _wearNoise = noise(vWorldPos * uScale * 25.0 + uSeed);
                
                // Increase roughness at edges (chipped matte wear), decrease roughness on accent band
                roughnessFactor = mix(roughnessFactor, 1.0, _edgeWear * _wearNoise);
                roughnessFactor = mix(roughnessFactor, 0.1, _band * _blendZ);
                `
            );
        };
    }
    
    /**
     * Ticks the uTime uniform for all registered procedural materials.
     */
    static updateTime(dt) {
        for (const mat of ProceduralFactory._registeredMaterials) {
            if (mat && mat.userData && mat.userData.shader) {
                mat.userData.shader.uniforms.uTime.value += dt;
            }
        }
    }
}

/**
 * Generates procedural high-fidelity structural geometry for the Mirror's Edge aesthetic.
 * Uses a hybrid approach: Macro geometry (silhouettes/arcologies) is merged, Micro detail is handled by shaders.
 */
class ArchitecturalGenerator {
    static createPlatform(w, h, d) {
        // Main floor slab
        const main = new THREE.BoxGeometry(w, h, d);
        // Macroscopic support beams
        const beamW = 0.5;
        const beamD = 0.5;
        const beamH = 1.0;
        const b1 = new THREE.BoxGeometry(w, beamH, beamD).translate(0, -h/2 - beamH/2, d/2 - beamD/2);
        const b2 = new THREE.BoxGeometry(w, beamH, beamD).translate(0, -h/2 - beamH/2, -d/2 + beamD/2);
        
        if (window.BufferGeometryUtils) {
            return window.BufferGeometryUtils.mergeGeometries([main, b1, b2]);
        }
        return main;
    }
    
    static createCityBuildingArchetypes() {
        if (!window.BufferGeometryUtils) {
            return [new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)];
        }
        
        const archetypes = [];
        
        // Procedurally generate 4 distinct Arcology silos by scattering smaller geometric blocks
        for (let i = 0; i < 4; i++) {
            const geos = [];
            // Core pillar
            const core = new THREE.BoxGeometry(0.5, 1, 0.5);
            core.translate(0, 0.5, 0);
            geos.push(core);
            
            // Scatter macroscopic structural blocks (balconies, vents, support rings)
            const numBlocks = 15 + Math.floor(Math.random() * 20);
            for (let b = 0; b < numBlocks; b++) {
                const bw = 0.1 + Math.random() * 0.5;
                const bh = 0.05 + Math.random() * 0.2;
                const bd = 0.1 + Math.random() * 0.5;
                
                const block = new THREE.BoxGeometry(bw, bh, bd);
                // Position randomly along the surface of the core
                const y = Math.random();
                const x = (Math.random() - 0.5) * 0.8;
                const z = (Math.random() - 0.5) * 0.8;
                block.translate(x, y, z);
                geos.push(block);
            }
            
            // Bake into a single draw-call geometry
            const merged = window.BufferGeometryUtils.mergeGeometries(geos);
            archetypes.push(merged);
        }
        return archetypes;
    }
}

AXEngine.PoolManager = PoolManager;
AXEngine.ECSManager = ECSManager;
AXEngine.Systems = { PhysicsSystem, TransformSyncSystem, PlayerControllerSystem, SwarmSystem };
AXEngine.StateBus = StateBus;
AXEngine.ProceduralFactory = ProceduralFactory;
AXEngine.ArchitecturalGenerator = ArchitecturalGenerator;

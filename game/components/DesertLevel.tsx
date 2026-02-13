import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getQualitySettings } from '../world/quality';

// ============================================================
// Desert boundaries and collision
// ============================================================
export const DESERT_RADIUS = 45;

// Collision radius for each entity type
const CACTUS_COLLISION_RADIUS = 1.2;
const SCORPION_COLLISION_RADIUS = 1.5;
const TARANTULA_COLLISION_RADIUS = 1.3;

// Module-level collision registries – populated by DesertLevel at runtime
// so the exported checkDesertCollision can reference them without prop drilling.
let _aliveCactuses: { id: string; pos: [number, number, number] }[] = [];
let _aliveCactusIds: Set<string> = new Set();
let _scorpions: { x: number; z: number; alive: boolean }[] = [];
let _tarantulas: { x: number; z: number; alive: boolean }[] = [];
let _perimeterRocks: { x: number; z: number; collisionRadius: number }[] = [];

/** Called by DesertLevel to keep the collision data in sync. */
export function _updateDesertCollisionData(
    cactuses: { id: string; pos: [number, number, number] }[],
    aliveIds: Set<string>,
    scorpions: { x: number; z: number; alive: boolean }[],
    tarantulas: { x: number; z: number; alive: boolean }[],
) {
    _aliveCactuses = cactuses;
    _aliveCactusIds = aliveIds;
    _scorpions = scorpions;
    _tarantulas = tarantulas;
}

export const checkDesertCollision = (x: number, z: number): boolean => {
    // Boundary
    if (Math.sqrt(x * x + z * z) > DESERT_RADIUS - 2) return true;

    // Perimeter rocks (large boulders at the edge)
    for (const rock of _perimeterRocks) {
        const dx = x - rock.x;
        const dz = z - rock.z;
        if (dx * dx + dz * dz < rock.collisionRadius * rock.collisionRadius) return true;
    }

    // Alive cactuses
    for (const c of _aliveCactuses) {
        if (!_aliveCactusIds.has(c.id)) continue;
        const dx = x - c.pos[0];
        const dz = z - c.pos[2];
        if (dx * dx + dz * dz < CACTUS_COLLISION_RADIUS * CACTUS_COLLISION_RADIUS) return true;
    }

    // Scorpion NPCs (skip collision if dead)
    for (const sc of _scorpions) {
        if (!sc.alive) continue;
        const dx = x - sc.x;
        const dz = z - sc.z;
        if (dx * dx + dz * dz < SCORPION_COLLISION_RADIUS * SCORPION_COLLISION_RADIUS) return true;
    }

    // Tarantula NPCs (skip collision if dead)
    for (const ta of _tarantulas) {
        if (!ta.alive) continue;
        const dx = x - ta.x;
        const dz = z - ta.z;
        if (dx * dx + dz * dz < TARANTULA_COLLISION_RADIUS * TARANTULA_COLLISION_RADIUS) return true;
    }

    return false;
};

// ============================================================
// Asset configuration map – swap paths/geometry here when
// final model files become available.
// ============================================================
export const DESERT_ASSET_CONFIG = {
    cactus:        { type: 'procedural' as const, color: '#2d6b30', spineColor: '#d4c89a', scale: 1.0 },
    succulent:     { type: 'procedural' as const, color: '#5a8a5c', accentColor: '#8cb88e', scale: 1.0 },
    rock:          { type: 'procedural' as const, color: '#8b7d6b', darkColor: '#6b5d4b', scale: 1.0 },
};

// ============================================================
// Seeded random helper (deterministic placement)
// ============================================================
function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// ============================================================
// CACTUS – Saguaro-style procedural placeholder
// ============================================================
const Cactus: React.FC<{ position: [number, number, number]; seed: number }> = ({ position, seed }) => {
    const rand = seededRandom(seed);
    const height = 3 + rand() * 4;
    const hasLeftArm = rand() > 0.35;
    const hasRightArm = rand() > 0.35;
    const armHeightL = 1.5 + rand() * (height * 0.4);
    const armHeightR = 1.5 + rand() * (height * 0.4);
    const cfg = DESERT_ASSET_CONFIG.cactus;
    const sc = cfg.scale * (0.8 + rand() * 0.4);

    return (
        <group position={position} scale={[sc, sc, sc]}>
            {/* Main trunk */}
            <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.45, 0.55, height, 8]} />
                <meshStandardMaterial color={cfg.color} roughness={0.85} />
            </mesh>
            {/* Trunk cap */}
            <mesh position={[0, height, 0]} castShadow>
                <sphereGeometry args={[0.45, 8, 6]} />
                <meshStandardMaterial color={cfg.color} roughness={0.85} />
            </mesh>
            {/* Left arm */}
            {hasLeftArm && (
                <group position={[-0.45, armHeightL, 0]}>
                    {/* Horizontal segment: height 1.4 rotated 90° → extends ±0.7 along X */}
                    <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                        <cylinderGeometry args={[0.3, 0.35, 1.4, 7]} />
                        <meshStandardMaterial color={cfg.color} roughness={0.85} />
                    </mesh>
                    {/* Vertical segment: placed at x=-0.7 (left tip of horizontal) */}
                    <mesh position={[-0.7, 0.8, 0]} castShadow>
                        <cylinderGeometry args={[0.28, 0.3, 1.6, 7]} />
                        <meshStandardMaterial color={cfg.color} roughness={0.85} />
                    </mesh>
                    {/* Cap sphere at top of vertical segment */}
                    <mesh position={[-0.7, 1.6, 0]} castShadow>
                        <sphereGeometry args={[0.28, 7, 5]} />
                        <meshStandardMaterial color={cfg.color} roughness={0.85} />
                    </mesh>
                </group>
            )}
            {/* Right arm */}
            {hasRightArm && (
                <group position={[0.45, armHeightR, 0]}>
                    {/* Horizontal segment: height 1.2 rotated -90° → extends ±0.6 along X */}
                    <mesh rotation={[0, 0, -Math.PI / 2]} castShadow>
                        <cylinderGeometry args={[0.3, 0.35, 1.2, 7]} />
                        <meshStandardMaterial color={cfg.color} roughness={0.85} />
                    </mesh>
                    {/* Vertical segment: placed at x=+0.6 (right tip of horizontal) */}
                    <mesh position={[0.6, 0.6, 0]} castShadow>
                        <cylinderGeometry args={[0.28, 0.3, 1.2, 7]} />
                        <meshStandardMaterial color={cfg.color} roughness={0.85} />
                    </mesh>
                    {/* Cap sphere at top of vertical segment */}
                    <mesh position={[0.6, 1.2, 0]} castShadow>
                        <sphereGeometry args={[0.28, 7, 5]} />
                        <meshStandardMaterial color={cfg.color} roughness={0.85} />
                    </mesh>
                </group>
            )}
        </group>
    );
};

// ============================================================
// SUCCULENT – low rosette cluster placeholder
// ============================================================
const Succulent: React.FC<{ position: [number, number, number]; seed: number }> = ({ position, seed }) => {
    const rand = seededRandom(seed);
    const cfg = DESERT_ASSET_CONFIG.succulent;
    const sc = cfg.scale * (0.6 + rand() * 0.5);
    const leafCount = 6 + Math.floor(rand() * 4);

    const leaves = useMemo(() => {
        const r = seededRandom(seed + 100);
        return Array.from({ length: leafCount }, (_, i) => {
            const angle = (i / leafCount) * Math.PI * 2 + r() * 0.3;
            const dist = 0.25 + r() * 0.15;
            return { angle, dist, tilt: 0.3 + r() * 0.4 };
        });
    }, [seed, leafCount]);

    return (
        <group position={position} scale={[sc, sc, sc]}>
            {/* Center rosette */}
            <mesh position={[0, 0.15, 0]} castShadow>
                <sphereGeometry args={[0.3, 8, 6]} />
                <meshStandardMaterial color={cfg.accentColor} roughness={0.8} />
            </mesh>
            {/* Leaves radiating outward */}
            {leaves.map((l, i) => (
                <mesh
                    key={i}
                    position={[Math.cos(l.angle) * l.dist, 0.1, Math.sin(l.angle) * l.dist]}
                    rotation={[l.tilt, l.angle, 0]}
                    castShadow
                >
                    <capsuleGeometry args={[0.08, 0.3, 4, 6]} />
                    <meshStandardMaterial color={cfg.color} roughness={0.75} />
                </mesh>
            ))}
        </group>
    );
};

// ============================================================
// ROCK – dodecahedron boulder placeholder
// ============================================================
const Rock: React.FC<{ position: [number, number, number]; seed: number }> = ({ position, seed }) => {
    const rand = seededRandom(seed);
    const cfg = DESERT_ASSET_CONFIG.rock;
    const sc = cfg.scale * (0.6 + rand() * 1.4);
    const color = rand() > 0.5 ? cfg.color : cfg.darkColor;

    return (
        <group position={position}>
            <mesh position={[0, sc * 0.35, 0]} rotation={[rand() * 0.4, rand() * Math.PI, rand() * 0.3]} castShadow receiveShadow scale={[sc, sc * (0.6 + rand() * 0.4), sc]}>
                <dodecahedronGeometry args={[0.7, 0]} />
                <meshStandardMaterial color={color} roughness={0.95} metalness={0.05} />
            </mesh>
        </group>
    );
};


// ============================================================
// PERIMETER ROCK – large displaced boulders forming outer wall
// ============================================================
const PERIMETER_ROCK_COLORS = ['#a0896e', '#8b7355', '#967859', '#b5956c', '#7a6548', '#92805e'];

const PerimeterRock: React.FC<{
    position: [number, number, number];
    seed: number;
    rockScale: number;
}> = ({ position, seed, rockScale }) => {
    const rand = seededRandom(seed);

    // Create a displaced dodecahedron for a craggy natural look
    const geometry = useMemo(() => {
        const geo = new THREE.DodecahedronGeometry(1, 1);
        const posAttr = geo.attributes.position;
        const r = seededRandom(seed + 500);
        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const z = posAttr.getZ(i);
            const len = Math.sqrt(x * x + y * y + z * z);
            const displacement = 0.7 + r() * 0.6;
            posAttr.setXYZ(
                i,
                (x / len) * displacement,
                (y / len) * displacement,
                (z / len) * displacement,
            );
        }
        geo.computeVertexNormals();
        return geo;
    }, [seed]);

    // Secondary rock cluster geometry (slightly different shape)
    const secondaryGeometry = useMemo(() => {
        const geo = new THREE.IcosahedronGeometry(1, 1);
        const posAttr = geo.attributes.position;
        const r = seededRandom(seed + 900);
        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const z = posAttr.getZ(i);
            const len = Math.sqrt(x * x + y * y + z * z);
            const displacement = 0.75 + r() * 0.5;
            posAttr.setXYZ(
                i,
                (x / len) * displacement,
                (y / len) * displacement,
                (z / len) * displacement,
            );
        }
        geo.computeVertexNormals();
        return geo;
    }, [seed]);

    const color1 = PERIMETER_ROCK_COLORS[Math.floor(rand() * PERIMETER_ROCK_COLORS.length)];
    const color2 = PERIMETER_ROCK_COLORS[Math.floor(rand() * PERIMETER_ROCK_COLORS.length)];
    const yScale = 0.5 + rand() * 0.6;
    const rotY = rand() * Math.PI * 2;
    const tiltX = (rand() - 0.5) * 0.3;
    const tiltZ = (rand() - 0.5) * 0.3;
    const hasSecondary = rand() > 0.3;
    const secondaryScale = 0.45 + rand() * 0.35;
    const secOffsetX = (rand() - 0.5) * rockScale * 0.9;
    const secOffsetZ = (rand() - 0.5) * rockScale * 0.9;

    return (
        <group position={position}>
            {/* Primary boulder */}
            <mesh
                geometry={geometry}
                position={[0, rockScale * yScale * 0.45, 0]}
                rotation={[tiltX, rotY, tiltZ]}
                scale={[rockScale, rockScale * yScale, rockScale]}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial
                    color={color1}
                    roughness={0.95}
                    metalness={0.02}
                />
            </mesh>
            {/* Secondary cluster rock for visual richness */}
            {hasSecondary && (
                <mesh
                    geometry={secondaryGeometry}
                    position={[
                        secOffsetX,
                        rockScale * secondaryScale * yScale * 0.35,
                        secOffsetZ,
                    ]}
                    rotation={[rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4]}
                    scale={[
                        rockScale * secondaryScale,
                        rockScale * secondaryScale * (0.5 + rand() * 0.5),
                        rockScale * secondaryScale,
                    ]}
                    castShadow
                    receiveShadow
                >
                    <meshStandardMaterial
                        color={color2}
                        roughness={0.95}
                        metalness={0.02}
                    />
                </mesh>
            )}
        </group>
    );
};

// ============================================================
// PERIMETER BAND – textured rocky ring around the desert edge
// ============================================================
const PerimeterBand: React.FC = () => {
    const geometry = useMemo(() => {
        const innerRadius = DESERT_RADIUS - 6;
        const outerRadius = DESERT_RADIUS + 4;
        const geo = new THREE.RingGeometry(innerRadius, outerRadius, 64, 6);

        // Add vertex colors for rocky texture variation
        const posAttr = geo.attributes.position;
        const colors = new Float32Array(posAttr.count * 3);
        const r = seededRandom(999);

        for (let i = 0; i < posAttr.count; i++) {
            const px = posAttr.getX(i);
            const py = posAttr.getY(i);
            const dist = Math.sqrt(px * px + py * py);
            // Blend from sandy at inner edge to dark rock at outer edge
            const t = (dist - (DESERT_RADIUS - 6)) / 10;
            // Sandy base: rgb(0.78, 0.66, 0.42) -> Rocky: rgb(0.50, 0.42, 0.32)
            const variation = (r() - 0.5) * 0.12;
            colors[i * 3] = 0.78 - t * 0.28 + variation;
            colors[i * 3 + 1] = 0.66 - t * 0.24 + variation * 0.8;
            colors[i * 3 + 2] = 0.42 - t * 0.10 + variation * 0.5;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Displace vertices slightly upward near the outer edge for a raised lip
        for (let i = 0; i < posAttr.count; i++) {
            const px = posAttr.getX(i);
            const py = posAttr.getY(i);
            const dist = Math.sqrt(px * px + py * py);
            const t = Math.max(0, (dist - (DESERT_RADIUS - 3)) / 7);
            const z = posAttr.getZ(i);
            posAttr.setZ(i, z + t * 0.6 + r() * 0.15 * t);
        }
        geo.computeVertexNormals();

        return geo;
    }, []);

    return (
        <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
            <meshStandardMaterial
                vertexColors
                roughness={0.98}
                metalness={0.0}
            />
        </mesh>
    );
};

// ============================================================
// POP SOUND – lightweight WebAudio pop for cactus destruction
// ============================================================
let _desertAudioCtx: AudioContext | null = null;
const getDesertAudioCtx = (): AudioContext => {
    if (!_desertAudioCtx) {
        _desertAudioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    }
    return _desertAudioCtx;
};

const playCactusPopSound = () => {
    try {
        const ctx = getDesertAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (_e) { /* ignore audio errors */ }
};

// ============================================================
// GREEN CONFETTI – burst effect when a cactus is popped
// ============================================================
const CactusPopEffect: React.FC<{ position: THREE.Vector3 }> = ({ position }) => {
    const pointsRef = useRef<THREE.Points>(null);
    const scaleRef = useRef(1);

    const { positions, velocities } = useMemo(() => {
        const count = 18;
        const posArr = new Float32Array(count * 3);
        const velArr: { x: number; y: number; z: number }[] = [];
        for (let i = 0; i < count; i++) {
            posArr[i * 3] = 0;
            posArr[i * 3 + 1] = 0;
            posArr[i * 3 + 2] = 0;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI - Math.PI / 2;
            const speed = 1.5 + Math.random() * 3;
            velArr.push({
                x: Math.cos(theta) * Math.cos(phi) * speed,
                y: Math.sin(phi) * speed + 2,
                z: Math.sin(theta) * Math.cos(phi) * speed,
            });
        }
        return { positions: posArr, velocities: velArr };
    }, []);

    const velocitiesRef = useRef(velocities);
    useEffect(() => { velocitiesRef.current = velocities; scaleRef.current = 1; }, [velocities]);

    useFrame((_state, delta) => {
        if (!pointsRef.current) return;
        const geo = pointsRef.current.geometry;
        const posAttr = geo.attributes.position as THREE.BufferAttribute;
        const vels = velocitiesRef.current;
        for (let i = 0; i < vels.length; i++) {
            posAttr.array[i * 3] += vels[i].x * delta * 5;
            posAttr.array[i * 3 + 1] += vels[i].y * delta * 5;
            posAttr.array[i * 3 + 2] += vels[i].z * delta * 5;
            vels[i].y -= delta * 6; // gravity
        }
        posAttr.needsUpdate = true;
        scaleRef.current *= 0.94;
        const mat = pointsRef.current.material as THREE.PointsMaterial;
        mat.size = 0.35 * scaleRef.current;
        mat.opacity = Math.max(scaleRef.current, 0);
    });

    return (
        <points ref={pointsRef} position={position}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={positions.length / 3}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                color="#22cc22"
                size={0.35}
                sizeAttenuation
                transparent
                opacity={0.9}
            />
        </points>
    );
};

// ============================================================
// SCORPION NPC – GLB model with chase AI and attack animation
// ============================================================
const SCORPION_MODEL_PATH = '/models/scorpion.glb';
const SCORPION_CHASE_SPEED = 5;
const SCORPION_ATTACK_RANGE = 3;
const SCORPION_START_X = 20;
const SCORPION_START_Z = 20;

const SCORPION_NPC_BODY_RADIUS = 1.2; // Minimum half-distance between two scorpion centers

const ScorpionNPC: React.FC<{
    id: string;
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
    startX: number;
    startZ: number;
    isAlive: boolean;
    onPositionUpdate: (x: number, z: number) => void;
    /** Live positions of ALL NPC scorpions (keyed by id) for inter-scorpion collision. */
    allScorpionPositionsRef: React.MutableRefObject<Map<string, { x: number; z: number }>>;
}> = ({ id, playerPosRef, startX, startZ, isAlive, onPositionUpdate, allScorpionPositionsRef }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(SCORPION_MODEL_PATH);

    // Clone with SkeletonUtils to preserve skin/bone bindings
    const clonedScene = useMemo(() => {
        const clone = skeletonClone(scene) as THREE.Group;
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        return clone;
    }, [scene]);

    // Compute vertical offset so the model's animated bottom sits on y=0.
    // The scorpion's Idle/Walk animation lifts the mesh above its rest-pose
    // bounding box. At game scale (7.5/maxDim) the lift is ~3.0 world units;
    // scale proportionally for the NPC render scale (2).
    const yOffset = useMemo(() => {
        const box = new THREE.Box3().setFromObject(clonedScene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const NPC_SCALE = 2;
        const restGrounding = -box.min.y * NPC_SCALE;
        const localLift = 3.0 / (7.5 / maxDim);
        const animCorrection = localLift * NPC_SCALE;
        return restGrounding - animCorrection;
    }, [clonedScene]);

    const { actions, names } = useAnimations(animations, clonedScene);

    // Log available animation names on mount for debugging / tuning
    useEffect(() => {
        if (names.length > 0) {
            console.log('[ScorpionNPC] Available animations:', names);
        }
    }, [names]);

    // Resolve walk and attack clips from whatever is available in the GLB.
    const resolveClip = useCallback(
        (keywords: string[]): THREE.AnimationAction | null => {
            for (const kw of keywords) {
                const match = names.find((n) => n.toLowerCase().includes(kw.toLowerCase()));
                if (match && actions[match]) return actions[match]!;
            }
            return null;
        },
        [actions, names],
    );

    const walkAction = useMemo(() => resolveClip(['walk', 'run', 'move', 'locomotion']), [resolveClip]);
    const attackAction = useMemo(() => resolveClip(['attack', 'bite', 'sting', 'hit', 'strike']), [resolveClip]);
    const deathAction = useMemo(() => resolveClip(['death', 'die', 'dead', 'defeat', 'collapse']), [resolveClip]);
    // Fallback: if neither found, just grab the first available clip
    const fallbackAction = useMemo(() => {
        if (walkAction || attackAction) return null;
        const first = names[0];
        return first ? actions[first] ?? null : null;
    }, [walkAction, attackAction, actions, names]);

    // AI state – initialised from props
    const stateRef = useRef({
        x: startX,
        z: startZ,
        rotation: 0,
        isAttacking: false,
    });

    // Track whether the death animation has been triggered
    const deathTriggeredRef = useRef(false);
    // Track the ongoing death tilt for procedural fallover
    const deathTiltRef = useRef(0);

    // Start the walk (or fallback) animation on mount
    useEffect(() => {
        const action = walkAction ?? fallbackAction;
        if (action) {
            action.reset();
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
            action.timeScale = 1;
            action.play();
        }
    }, [walkAction, fallbackAction]);

    // Handle death transition: when isAlive becomes false, play death animation
    useEffect(() => {
        if (!isAlive && !deathTriggeredRef.current) {
            deathTriggeredRef.current = true;

            // Fade out all currently playing animations
            const walk = walkAction ?? fallbackAction;
            if (walk) walk.fadeOut(0.3);
            if (attackAction) attackAction.fadeOut(0.3);

            if (deathAction) {
                // Play the death animation once
                deathAction.reset();
                deathAction.setLoop(THREE.LoopOnce, 1);
                deathAction.clampWhenFinished = true;
                deathAction.timeScale = 1;
                deathAction.fadeIn(0.3).play();
            }
            // If no death clip exists, the useFrame below handles a procedural fall-over
        }
    }, [isAlive, walkAction, attackAction, deathAction, fallbackAction]);

    // Animation mixer update + chase / attack logic
    useFrame((_state, delta) => {
        if (!groupRef.current) return;

        // --- Dead: stop AI, apply procedural fall-over if no death clip ---
        if (!isAlive) {
            if (!deathAction && groupRef.current) {
                // Procedural tilt: slowly fall to the side
                deathTiltRef.current = Math.min(deathTiltRef.current + delta * 2, Math.PI / 2);
                groupRef.current.rotation.z = deathTiltRef.current;
            }
            // Keep position static – already set
            return;
        }

        const s = stateRef.current;
        const pp = playerPosRef.current;

        // Direction toward the player
        const dx = pp.x - s.x;
        const dz = pp.z - s.z;
        const distToPlayer = Math.sqrt(dx * dx + dz * dz);

        // ---- Animation state transitions ----
        const shouldAttack = distToPlayer < SCORPION_ATTACK_RANGE;

        if (shouldAttack && !s.isAttacking) {
            // Switch to attack
            s.isAttacking = true;
            const walk = walkAction ?? fallbackAction;
            if (walk) walk.fadeOut(0.3);
            if (attackAction) {
                attackAction.reset();
                attackAction.setLoop(THREE.LoopRepeat, Infinity);
                attackAction.clampWhenFinished = false;
                attackAction.timeScale = 1;
                attackAction.fadeIn(0.3).play();
            }
        } else if (!shouldAttack && s.isAttacking) {
            // Switch back to walk
            s.isAttacking = false;
            if (attackAction) attackAction.fadeOut(0.3);
            const walk = walkAction ?? fallbackAction;
            if (walk) {
                walk.reset();
                walk.setLoop(THREE.LoopRepeat, Infinity);
                walk.clampWhenFinished = false;
                walk.timeScale = 1;
                walk.fadeIn(0.3).play();
            }
        }

        // ---- Movement: chase the player, but stop at attack range or on collision ----
        const PLAYER_BODY_RADIUS = 1.0;
        if (distToPlayer > SCORPION_ATTACK_RANGE * 0.6) {
            const speed = SCORPION_CHASE_SPEED * delta;
            const nx = s.x + (dx / distToPlayer) * speed;
            const nz = s.z + (dz / distToPlayer) * speed;

            // Check boundary
            const boundaryOk = Math.sqrt(nx * nx + nz * nz) <= DESERT_RADIUS - 2;
            // Don't walk into the player body
            const dxNew = pp.x - nx;
            const dzNew = pp.z - nz;
            const distNewToPlayer = Math.sqrt(dxNew * dxNew + dzNew * dzNew);
            const playerOk = distNewToPlayer > PLAYER_BODY_RADIUS;

            // Don't walk into other scorpion NPCs
            let otherScorpionOk = true;
            const minDist = SCORPION_NPC_BODY_RADIUS * 2;
            allScorpionPositionsRef.current.forEach((pos, otherId) => {
                if (otherId === id) return; // skip self
                const odx = nx - pos.x;
                const odz = nz - pos.z;
                if (odx * odx + odz * odz < minDist * minDist) {
                    otherScorpionOk = false;
                }
            });

            if (boundaryOk && playerOk && otherScorpionOk) {
                s.x = nx;
                s.z = nz;
            }
        }

        // Face the player (smooth rotation)
        const targetRotation = Math.atan2(dx, dz);
        s.rotation = THREE.MathUtils.lerp(s.rotation, targetRotation, delta * 6);

        groupRef.current.position.set(s.x, 0, s.z);
        groupRef.current.rotation.y = s.rotation;

        // Report position to parent for collision registry
        onPositionUpdate(s.x, s.z);
    });

    return (
        <group ref={groupRef}>
            <primitive object={clonedScene} scale={[2, 2, 2]} position={[0, yOffset, 0]} />
        </group>
    );
};

// Preload the scorpion GLB so it's ready when the level mounts
useGLTF.preload(SCORPION_MODEL_PATH);

// ============================================================
// TARANTULA NPC – GLB model with chase AI and attack animation
// ============================================================
const TARANTULA_MODEL_PATH = '/models/theraphosa-blondi/source/hi-fi-spider.glb';
const TARANTULA_CHASE_SPEED = 4;
const TARANTULA_ATTACK_RANGE = 2.8;
const TARANTULA_START_X = -18;
const TARANTULA_START_Z = -18;

const TarantulaNPC: React.FC<{
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
    startX: number;
    startZ: number;
    isAlive: boolean;
    onPositionUpdate: (x: number, z: number) => void;
}> = ({ playerPosRef, startX, startZ, isAlive, onPositionUpdate }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(TARANTULA_MODEL_PATH);

    // Clone with SkeletonUtils to preserve skin/bone bindings
    const clonedScene = useMemo(() => {
        const clone = skeletonClone(scene) as THREE.Group;
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        return clone;
    }, [scene]);

    // Compute transform to match the player tarantula's sizing and grounding.
    // The player uses scale = 7.5 / maxDimension with centering and y-grounding.
    const transform = useMemo(() => {
        const box = new THREE.Box3().setFromObject(clonedScene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 7.5 / maxDim;
        return {
            scale,
            x: -center.x * scale,
            y: -box.min.y * scale,
            z: -center.z * scale,
        };
    }, [clonedScene]);

    const { actions, names } = useAnimations(animations, clonedScene);

    // Log available animation names on mount for debugging / tuning
    useEffect(() => {
        if (names.length > 0) {
            console.log('[TarantulaNPC] Available animations:', names);
        }
    }, [names]);

    // Resolve walk and attack clips from whatever is available in the GLB.
    const resolveClip = useCallback(
        (keywords: string[]): THREE.AnimationAction | null => {
            for (const kw of keywords) {
                const match = names.find((n) => n.toLowerCase().includes(kw.toLowerCase()));
                if (match && actions[match]) return actions[match]!;
            }
            return null;
        },
        [actions, names],
    );

    const walkAction = useMemo(() => resolveClip(['walk', 'run', 'move', 'locomotion']), [resolveClip]);
    const attackAction = useMemo(() => resolveClip(['attack', 'bite', 'sting', 'hit', 'strike']), [resolveClip]);
    const deathAction = useMemo(() => resolveClip(['death', 'die', 'dead', 'defeat', 'collapse']), [resolveClip]);
    // Fallback: if neither found, just grab the first available clip
    const fallbackAction = useMemo(() => {
        if (walkAction || attackAction) return null;
        const first = names[0];
        return first ? actions[first] ?? null : null;
    }, [walkAction, attackAction, actions, names]);

    // AI state – initialised from props
    const stateRef = useRef({
        x: startX,
        z: startZ,
        rotation: 0,
        isAttacking: false,
    });

    // Track whether the death animation has been triggered
    const deathTriggeredRef = useRef(false);
    // Track the ongoing death tilt for procedural fallover
    const deathTiltRef = useRef(0);

    // Start the walk (or fallback) animation on mount
    useEffect(() => {
        const action = walkAction ?? fallbackAction;
        if (action) {
            action.reset();
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
            action.timeScale = 1;
            action.play();
        }
    }, [walkAction, fallbackAction]);

    // Handle death transition: when isAlive becomes false, play death animation
    useEffect(() => {
        if (!isAlive && !deathTriggeredRef.current) {
            deathTriggeredRef.current = true;

            // Fade out all currently playing animations
            const walk = walkAction ?? fallbackAction;
            if (walk) walk.fadeOut(0.3);
            if (attackAction) attackAction.fadeOut(0.3);

            if (deathAction) {
                // Play the death animation once
                deathAction.reset();
                deathAction.setLoop(THREE.LoopOnce, 1);
                deathAction.clampWhenFinished = true;
                deathAction.timeScale = 1;
                deathAction.fadeIn(0.3).play();
            }
            // If no death clip exists, the useFrame below handles a procedural fall-over
        }
    }, [isAlive, walkAction, attackAction, deathAction, fallbackAction]);

    // Animation mixer update + chase / attack logic
    useFrame((_state, delta) => {
        if (!groupRef.current) return;

        // --- Dead: stop AI, apply procedural fall-over if no death clip ---
        if (!isAlive) {
            if (!deathAction && groupRef.current) {
                // Procedural tilt: slowly fall to the side
                deathTiltRef.current = Math.min(deathTiltRef.current + delta * 2, Math.PI / 2);
                groupRef.current.rotation.z = deathTiltRef.current;
            }
            // Keep position static – already set
            return;
        }

        const s = stateRef.current;
        const pp = playerPosRef.current;

        // Direction toward the player
        const dx = pp.x - s.x;
        const dz = pp.z - s.z;
        const distToPlayer = Math.sqrt(dx * dx + dz * dz);

        // ---- Animation state transitions ----
        const shouldAttack = distToPlayer < TARANTULA_ATTACK_RANGE;

        if (shouldAttack && !s.isAttacking) {
            // Switch to attack
            s.isAttacking = true;
            const walk = walkAction ?? fallbackAction;
            if (walk) walk.fadeOut(0.3);
            if (attackAction) {
                attackAction.reset();
                attackAction.setLoop(THREE.LoopRepeat, Infinity);
                attackAction.clampWhenFinished = false;
                attackAction.timeScale = 1;
                attackAction.fadeIn(0.3).play();
            }
        } else if (!shouldAttack && s.isAttacking) {
            // Switch back to walk
            s.isAttacking = false;
            if (attackAction) attackAction.fadeOut(0.3);
            const walk = walkAction ?? fallbackAction;
            if (walk) {
                walk.reset();
                walk.setLoop(THREE.LoopRepeat, Infinity);
                walk.clampWhenFinished = false;
                walk.timeScale = 1;
                walk.fadeIn(0.3).play();
            }
        }

        // ---- Movement: chase the player, but stop at attack range or on collision ----
        const PLAYER_BODY_RADIUS = 1.0;
        if (distToPlayer > TARANTULA_ATTACK_RANGE * 0.6) {
            const speed = TARANTULA_CHASE_SPEED * delta;
            const nx = s.x + (dx / distToPlayer) * speed;
            const nz = s.z + (dz / distToPlayer) * speed;

            // Check boundary + collision
            const boundaryOk = Math.sqrt(nx * nx + nz * nz) <= DESERT_RADIUS - 2;
            // Don't walk into the player body
            const dxNew = pp.x - nx;
            const dzNew = pp.z - nz;
            const distNewToPlayer = Math.sqrt(dxNew * dxNew + dzNew * dzNew);
            const playerOk = distNewToPlayer > PLAYER_BODY_RADIUS;

            if (boundaryOk && playerOk) {
                s.x = nx;
                s.z = nz;
            }
        }

        // Face the player (smooth rotation)
        const targetRotation = Math.atan2(dx, dz);
        s.rotation = THREE.MathUtils.lerp(s.rotation, targetRotation, delta * 6);

        groupRef.current.position.set(s.x, 0, s.z);
        groupRef.current.rotation.y = s.rotation;

        // Report position to parent for collision registry
        onPositionUpdate(s.x, s.z);
    });

    return (
        <group ref={groupRef}>
            <primitive
                object={clonedScene}
                scale={transform.scale}
                position={[transform.x, transform.y, transform.z]}
            />
        </group>
    );
};

// Preload the tarantula GLB so it's ready when the level mounts
useGLTF.preload(TARANTULA_MODEL_PATH);

// ============================================================
// DESERT DUNE – procedural sand dune for terrain variation
// ============================================================
const SandDune: React.FC<{ position: [number, number, number]; scale: [number, number, number] }> = ({ position, scale }) => (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow scale={scale}>
        <circleGeometry args={[1, 12]} />
        <meshStandardMaterial color="#d4a55a" roughness={0.95} />
    </mesh>
);

// ============================================================
// MAIN DESERT LEVEL COMPONENT
// ============================================================
interface DesertLevelProps {
    children: React.ReactNode;
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
    onScoreUpdate: (cb: (prev: number) => number) => void;
    attackTriggerRef: React.MutableRefObject<number>;
}

export const DesertLevel: React.FC<DesertLevelProps> = ({
    children,
    playerPosRef,
    onScoreUpdate,
    attackTriggerRef,
}) => {
    const quality = getQualitySettings();
    const shadowSize = quality.shadowMapSize;

    // ----------------------------------------------------------
    // Generate deterministic placement for all desert props
    // ----------------------------------------------------------
    const cactusPositions = useMemo(() => {
        const rand = seededRandom(42);
        const positions: { id: string; pos: [number, number, number]; seed: number }[] = [];
        const count = Math.floor(18 * quality.densityMultiplier);
        for (let i = 0; i < count; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = 8 + rand() * (DESERT_RADIUS - 14);
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            if (Math.abs(x) < 5 && Math.abs(z) < 5) continue; // keep center clear
            positions.push({ id: `cactus-${i}`, pos: [x, 0, z], seed: i * 7 + 100 });
        }
        return positions;
    }, [quality.densityMultiplier]);

    const succulentPositions = useMemo(() => {
        const rand = seededRandom(137);
        const positions: { pos: [number, number, number]; seed: number }[] = [];
        const count = Math.floor(24 * quality.densityMultiplier);
        for (let i = 0; i < count; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = 4 + rand() * (DESERT_RADIUS - 10);
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            positions.push({ pos: [x, 0, z], seed: i * 11 + 200 });
        }
        return positions;
    }, [quality.densityMultiplier]);

    const rockPositions = useMemo(() => {
        const rand = seededRandom(256);
        const positions: { pos: [number, number, number]; seed: number }[] = [];
        const count = Math.floor(30 * quality.densityMultiplier);
        for (let i = 0; i < count; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = 3 + rand() * (DESERT_RADIUS - 8);
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            positions.push({ pos: [x, 0, z], seed: i * 13 + 300 });
        }
        return positions;
    }, [quality.densityMultiplier]);

    const dunePositions = useMemo(() => {
        const rand = seededRandom(512);
        const dunes: { pos: [number, number, number]; scale: [number, number, number] }[] = [];
        for (let i = 0; i < 12; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = 10 + rand() * (DESERT_RADIUS - 15);
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            const sx = 3 + rand() * 6;
            const sz = 3 + rand() * 6;
            dunes.push({ pos: [x, 0.05, z], scale: [sx, 1, sz] });
        }
        return dunes;
    }, []);

    // ----------------------------------------------------------
    // Perimeter rocks – large boulders forming the outer wall
    // ----------------------------------------------------------
    const perimeterRockPositions = useMemo(() => {
        const rand = seededRandom(777);
        const rocks: { pos: [number, number, number]; seed: number; rockScale: number; collisionRadius: number }[] = [];
        const count = 32;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.25;
            // Place rocks between radius 39-44 so some are reachable for collision
            const dist = DESERT_RADIUS - 5 + rand() * 4;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            const sc = 2.5 + rand() * 2.5; // large boulders
            rocks.push({
                pos: [x, 0, z],
                seed: i * 17 + 777,
                rockScale: sc,
                collisionRadius: sc * 0.7,
            });
        }
        return rocks;
    }, []);

    // Set perimeter rock collision data (static, only needs to run once)
    useEffect(() => {
        _perimeterRocks = perimeterRockPositions.map(r => ({
            x: r.pos[0],
            z: r.pos[2],
            collisionRadius: r.collisionRadius,
        }));
        return () => { _perimeterRocks = []; };
    }, [perimeterRockPositions]);

    // ----------------------------------------------------------
    // Multi-scorpion system (max 2 alive at a time)
    // ----------------------------------------------------------
    const MAX_SCORPIONS = 4;
    const SCORPION_RESPAWN_DELAY = 3000; // ms before a replacement spawns

    interface ScorpionInstance {
        id: string;
        startX: number;
        startZ: number;
        alive: boolean;
    }

    // Generate a random spawn position away from the player and within the desert
    const randomScorpionSpawn = useCallback((): { x: number; z: number } => {
        const px = playerPosRef.current.x;
        const pz = playerPosRef.current.z;
        let x: number, z: number, dist: number;
        // Keep trying until we find a position far enough from the player
        do {
            const angle = Math.random() * Math.PI * 2;
            const r = 15 + Math.random() * (DESERT_RADIUS - 20);
            x = Math.cos(angle) * r;
            z = Math.sin(angle) * r;
            const dx = x - px;
            const dz = z - pz;
            dist = Math.sqrt(dx * dx + dz * dz);
        } while (dist < 20);
        return { x, z };
    }, [playerPosRef]);

    const [scorpions, setScorpions] = useState<ScorpionInstance[]>(() => {
        // Start with one scorpion at the default position
        return [{ id: 'scorpion-0', startX: SCORPION_START_X, startZ: SCORPION_START_Z, alive: true }];
    });

    // Position map for collision & hit-detection (updated every frame by each ScorpionNPC)
    const scorpionPositionsRef = useRef<Map<string, { x: number; z: number }>>(new Map());
    const nextScorpionIdRef = useRef(1); // monotonic id counter

    // ----------------------------------------------------------
    // Multi-tarantula system (max 2 alive at a time)
    // ----------------------------------------------------------
    const MAX_TARANTULAS = 2;
    const TARANTULA_RESPAWN_DELAY = 4000; // ms before a replacement spawns

    interface TarantulaInstance {
        id: string;
        startX: number;
        startZ: number;
        alive: boolean;
    }

    // Generate a random spawn position away from the player and within the desert
    const randomTarantulaSpawn = useCallback((): { x: number; z: number } => {
        const px = playerPosRef.current.x;
        const pz = playerPosRef.current.z;
        let x: number, z: number, dist: number;
        // Keep trying until we find a position far enough from the player
        do {
            const angle = Math.random() * Math.PI * 2;
            const r = 15 + Math.random() * (DESERT_RADIUS - 20);
            x = Math.cos(angle) * r;
            z = Math.sin(angle) * r;
            const dx = x - px;
            const dz = z - pz;
            dist = Math.sqrt(dx * dx + dz * dz);
        } while (dist < 20);
        return { x, z };
    }, [playerPosRef]);

    const [tarantulas, setTarantulas] = useState<TarantulaInstance[]>(() => {
        // Start with one tarantula at the default position
        return [{ id: 'tarantula-0', startX: TARANTULA_START_X, startZ: TARANTULA_START_Z, alive: true }];
    });

    // Position map for collision & hit-detection (updated every frame by each TarantulaNPC)
    const tarantulaPositionsRef = useRef<Map<string, { x: number; z: number }>>(new Map());
    const nextTarantulaIdRef = useRef(1); // monotonic id counter

    // ----------------------------------------------------------
    // Cactus alive tracking & confetti effects
    // ----------------------------------------------------------
    const aliveCactusesRef = useRef<Set<string>>(new Set(cactusPositions.map(c => c.id)));
    const [entityVersion, setEntityVersion] = useState(0);
    const [popEffects, setPopEffects] = useState<{ id: string; position: THREE.Vector3 }[]>([]);
    const lastAttackRef = useRef(0);

    // Keep alive set in sync when positions re-generate (quality change)
    useEffect(() => {
        aliveCactusesRef.current = new Set(cactusPositions.map(c => c.id));
        setEntityVersion(v => v + 1);
    }, [cactusPositions]);

    // Attack detection – runs every frame, checks when attackTriggerRef changes
    useFrame(() => {
        const currentAttack = attackTriggerRef.current;
        if (currentAttack === lastAttackRef.current) return;
        lastAttackRef.current = currentAttack;

        const px = playerPosRef.current.x;
        const pz = playerPosRef.current.z;
        const RANGE = 4.5;
        let poppedAny = false;

        for (const c of cactusPositions) {
            if (!aliveCactusesRef.current.has(c.id)) continue;
            const dx = px - c.pos[0];
            const dz = pz - c.pos[2];
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < RANGE) {
                aliveCactusesRef.current.delete(c.id);
                poppedAny = true;

                // Green confetti burst
                const effectPos = new THREE.Vector3(c.pos[0], 1.5, c.pos[2]);
                const effectId = `pop-${c.id}-${Date.now()}`;
                setPopEffects(prev => [...prev, { id: effectId, position: effectPos }]);
                setTimeout(() => {
                    setPopEffects(prev => prev.filter(e => e.id !== effectId));
                }, 1200);

                playCactusPopSound();
                onScoreUpdate(prev => prev + 1);
            }
        }

        // Check if player attack hits any alive scorpion NPC
        for (const sc of scorpions) {
            if (!sc.alive) continue;
            const pos = scorpionPositionsRef.current.get(sc.id);
            if (!pos) continue;
            const sdx = px - pos.x;
            const sdz = pz - pos.z;
            const scorpionDist = Math.sqrt(sdx * sdx + sdz * sdz);
            if (scorpionDist < RANGE) {
                // Mark this scorpion dead
                setScorpions(prev => prev.map(s => s.id === sc.id ? { ...s, alive: false } : s));
                onScoreUpdate(prev => prev + 10);

                // Confetti burst at scorpion position
                const effectPos = new THREE.Vector3(pos.x, 1.5, pos.z);
                const effectId = `pop-${sc.id}-${Date.now()}`;
                setPopEffects(prev => [...prev, { id: effectId, position: effectPos }]);
                setTimeout(() => {
                    setPopEffects(prev => prev.filter(e => e.id !== effectId));
                }, 1200);

                playCactusPopSound();

                // Schedule respawn: fill up to MAX_SCORPIONS alive after a delay
                setTimeout(() => {
                    setScorpions(prev => {
                        // Remove any dead corpses first
                        const alive = prev.filter(s => s.alive);
                        const toSpawn = MAX_SCORPIONS - alive.length;
                        if (toSpawn <= 0) return alive;
                        const newScorpions = [...alive];
                        for (let i = 0; i < toSpawn; i++) {
                            const spawn = randomScorpionSpawn();
                            const newId = `scorpion-${nextScorpionIdRef.current++}`;
                            newScorpions.push({ id: newId, startX: spawn.x, startZ: spawn.z, alive: true });
                        }
                        return newScorpions;
                    });
                }, SCORPION_RESPAWN_DELAY);

                break; // only kill one per attack
            }
        }

        // Check if player attack hits any alive tarantula NPC
        for (const ta of tarantulas) {
            if (!ta.alive) continue;
            const pos = tarantulaPositionsRef.current.get(ta.id);
            if (!pos) continue;
            const tdx = px - pos.x;
            const tdz = pz - pos.z;
            const tarantulaDist = Math.sqrt(tdx * tdx + tdz * tdz);
            if (tarantulaDist < RANGE) {
                // Mark this tarantula dead
                setTarantulas(prev => prev.map(t => t.id === ta.id ? { ...t, alive: false } : t));
                onScoreUpdate(prev => prev + 15);

                // Confetti burst at tarantula position
                const effectPos = new THREE.Vector3(pos.x, 1.5, pos.z);
                const effectId = `pop-${ta.id}-${Date.now()}`;
                setPopEffects(prev => [...prev, { id: effectId, position: effectPos }]);
                setTimeout(() => {
                    setPopEffects(prev => prev.filter(e => e.id !== effectId));
                }, 1200);

                playCactusPopSound();

                // Schedule respawn: fill up to MAX_TARANTULAS alive after a delay
                setTimeout(() => {
                    setTarantulas(prev => {
                        // Remove any dead corpses first
                        const alive = prev.filter(t => t.alive);
                        const toSpawn = MAX_TARANTULAS - alive.length;
                        if (toSpawn <= 0) return alive;
                        const newTarantulas = [...alive];
                        for (let i = 0; i < toSpawn; i++) {
                            const spawn = randomTarantulaSpawn();
                            const newId = `tarantula-${nextTarantulaIdRef.current++}`;
                            newTarantulas.push({ id: newId, startX: spawn.x, startZ: spawn.z, alive: true });
                        }
                        return newTarantulas;
                    });
                }, TARANTULA_RESPAWN_DELAY);

                break; // only kill one per attack
            }
        }

        if (poppedAny) {
            setEntityVersion(v => v + 1);
        }
    });

    // ----------------------------------------------------------
    // Keep module-level collision registry in sync every frame
    // ----------------------------------------------------------
    useFrame(() => {
        const scorpionCollisionData = scorpions.map(sc => {
            const pos = scorpionPositionsRef.current.get(sc.id);
            return {
                x: pos?.x ?? sc.startX,
                z: pos?.z ?? sc.startZ,
                alive: sc.alive,
            };
        });
        const tarantulaCollisionData = tarantulas.map(ta => {
            const pos = tarantulaPositionsRef.current.get(ta.id);
            return {
                x: pos?.x ?? ta.startX,
                z: pos?.z ?? ta.startZ,
                alive: ta.alive,
            };
        });
        _updateDesertCollisionData(
            cactusPositions,
            aliveCactusesRef.current,
            scorpionCollisionData,
            tarantulaCollisionData,
        );
    });

    return (
        <group>
            {/* ==================== LIGHTING ==================== */}
            <ambientLight intensity={0.6} color="#fff5e0" />
            <directionalLight
                position={[15, 30, 10]}
                intensity={1.8}
                color="#fff0d0"
                castShadow={quality.shadowsEnabled}
                shadow-mapSize={[shadowSize, shadowSize]}
            >
                <orthographicCamera attach="shadow-camera" args={[-35, 35, 35, -35, 0.1, 100]} />
            </directionalLight>
            {/* Hot secondary sun glow */}
            <directionalLight position={[-10, 20, -15]} intensity={0.4} color="#ffcc80" />
            <fog attach="fog" args={['#e8c98a', 30, 70]} />

            {/* ==================== SKY DOME ==================== */}
            <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[55, 24, 16]} />
                <meshBasicMaterial color="#d4a55a" side={THREE.BackSide} />
            </mesh>
            {/* Upper sky gradient */}
            <mesh position={[0, 20, 0]}>
                <sphereGeometry args={[54, 24, 16]} />
                <meshBasicMaterial color="#87CEEB" side={THREE.BackSide} transparent opacity={0.5} />
            </mesh>

            {/* ==================== GROUND ==================== */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[55, Math.max(64, quality.floorSegments * 4)]} />
                <meshStandardMaterial color="#d4a55a" roughness={0.95} />
            </mesh>
            {/* Darker packed sand at center / paths */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
                <circleGeometry args={[12, 32]} />
                <meshStandardMaterial color="#c9985a" roughness={0.9} />
            </mesh>

            {/* ==================== PERIMETER BAND (textured ground ring) ==================== */}
            <PerimeterBand />

            {/* ==================== PERIMETER ROCKS (outer wall boulders) ==================== */}
            {perimeterRockPositions.map((r, i) => (
                <PerimeterRock
                    key={`perimeter-rock-${i}`}
                    position={r.pos}
                    seed={r.seed}
                    rockScale={r.rockScale}
                />
            ))}

            {/* ==================== DUNES ==================== */}
            {dunePositions.map((d, i) => (
                <SandDune key={`dune-${i}`} position={d.pos} scale={d.scale} />
            ))}

            {/* ==================== CACTUSES (poppable) ==================== */}
            {cactusPositions.map((c) => (
                aliveCactusesRef.current.has(c.id) && (
                    <Cactus key={c.id} position={c.pos} seed={c.seed} />
                )
            ))}

            {/* ==================== CACTUS POP EFFECTS ==================== */}
            {popEffects.map((e) => (
                <CactusPopEffect key={e.id} position={e.position} />
            ))}

            {/* ==================== SUCCULENTS ==================== */}
            {succulentPositions.map((s, i) => (
                <Succulent key={`succ-${i}`} position={s.pos} seed={s.seed} />
            ))}

            {/* ==================== ROCKS ==================== */}
            {rockPositions.map((r, i) => (
                <Rock key={`rock-${i}`} position={r.pos} seed={r.seed} />
            ))}

            {/* ==================== SCORPION NPCs (max 2) ==================== */}
            {scorpions.map(sc => (
                <ScorpionNPC
                    key={sc.id}
                    id={sc.id}
                    playerPosRef={playerPosRef}
                    startX={sc.startX}
                    startZ={sc.startZ}
                    isAlive={sc.alive}
                    allScorpionPositionsRef={scorpionPositionsRef}
                    onPositionUpdate={(x, z) => {
                        scorpionPositionsRef.current.set(sc.id, { x, z });
                    }}
                />
            ))}

            {/* ==================== TARANTULA NPCs (max 2) ==================== */}
            {tarantulas.map(ta => (
                <TarantulaNPC
                    key={ta.id}
                    playerPosRef={playerPosRef}
                    startX={ta.startX}
                    startZ={ta.startZ}
                    isAlive={ta.alive}
                    onPositionUpdate={(x, z) => {
                        tarantulaPositionsRef.current.set(ta.id, { x, z });
                    }}
                />
            ))}

            {children}
        </group>
    );
};

export default DesertLevel;

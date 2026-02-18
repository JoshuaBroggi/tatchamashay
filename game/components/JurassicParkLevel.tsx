import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getQualitySettings } from '../world/quality';

// ============================================================
// Arena boundaries and collision
// ============================================================
export const JUNGLE_RADIUS = 50;

const TREE_COLLISION_RADIUS = 2.0;
const TREX_COLLISION_RADIUS = 3.0;

// Module-level collision registries
let _treePositions: [number, number, number][] = [];
let _trexPositions: { x: number; z: number; alive: boolean }[] = [];

export function _updateJurassicCollisionData(
    trees: [number, number, number][],
    trex: { x: number; z: number; alive: boolean }[],
) {
    _treePositions = trees;
    _trexPositions = trex;
}

export const checkJurassicCollision = (x: number, z: number): boolean => {
    if (Math.sqrt(x * x + z * z) > JUNGLE_RADIUS - 2) return true;

    for (const t of _treePositions) {
        const dx = x - t[0];
        const dz = z - t[2];
        if (dx * dx + dz * dz < TREE_COLLISION_RADIUS * TREE_COLLISION_RADIUS) return true;
    }

    for (const tr of _trexPositions) {
        if (!tr.alive) continue;
        const dx = x - tr.x;
        const dz = z - tr.z;
        if (dx * dx + dz * dz < TREX_COLLISION_RADIUS * TREX_COLLISION_RADIUS) return true;
    }

    return false;
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
// JUNGLE TREE – GLB model instance
// ============================================================
const JUNGLE_TREE_MODEL_PATH = '/models/jungle_tree.glb';

const JungleTree: React.FC<{ position: [number, number, number]; scale: number; rotationY: number }> = ({ position, scale, rotationY }) => {
    const { scene } = useGLTF(JUNGLE_TREE_MODEL_PATH);

    const clonedScene = useMemo(() => {
        const clone = scene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        return clone;
    }, [scene]);

    return (
        <group position={position} rotation={[0, rotationY, 0]}>
            <primitive object={clonedScene} scale={scale} />
        </group>
    );
};

useGLTF.preload(JUNGLE_TREE_MODEL_PATH);

// ============================================================
// BANANA TREE – GLB model instance
// ============================================================
const BANANA_TREE_MODEL_PATH = '/models/banana_tree.glb';

const BananaTree: React.FC<{ position: [number, number, number]; scale: number; rotationY: number }> = ({ position, scale, rotationY }) => {
    const { scene } = useGLTF(BANANA_TREE_MODEL_PATH);

    const clonedScene = useMemo(() => {
        const clone = scene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        return clone;
    }, [scene]);

    return (
        <group position={position} rotation={[0, rotationY, 0]}>
            <primitive object={clonedScene} scale={scale} />
        </group>
    );
};

useGLTF.preload(BANANA_TREE_MODEL_PATH);

// ============================================================
// FLESH-EATING PLANT – animated GLB model
// ============================================================
const PLANT_MODEL_PATH = '/models/cartoon_flesh-eating_plant_with_animations.glb';
const PLANT_ATTACK_RANGE = 6.0;
const PLANT_COLLISION_RADIUS = 1.5;

const FleshEatingPlant: React.FC<{
    position: [number, number, number];
    scale: number;
    rotationY: number;
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
}> = ({ position, scale, rotationY, playerPosRef }) => {
    const { scene, animations } = useGLTF(PLANT_MODEL_PATH);

    const clonedScene = useMemo(() => {
        const c = skeletonClone(scene);
        c.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        return c;
    }, [scene]);

    const groupRef = useRef<THREE.Group>(null);
    const { actions } = useAnimations(animations, groupRef);
    const currentAction = useRef<string>('');

    useEffect(() => {
        const roar = actions['Armature|Roar'];
        if (roar) {
            roar.reset().fadeIn(0.3).play();
            roar.setLoop(THREE.LoopRepeat, Infinity);
            currentAction.current = 'Armature|Roar';
        }
    }, [actions]);

    useFrame(() => {
        const dx = playerPosRef.current.x - position[0];
        const dz = playerPosRef.current.z - position[2];
        const dist = Math.sqrt(dx * dx + dz * dz);

        const shouldAttack = dist < PLANT_ATTACK_RANGE;
        const desiredAction = shouldAttack ? 'Armature|Attack1' : 'Armature|Roar';

        if (desiredAction !== currentAction.current) {
            const prev = actions[currentAction.current];
            const next = actions[desiredAction];
            if (prev) prev.fadeOut(0.3);
            if (next) {
                next.reset().fadeIn(0.3).play();
                next.setLoop(THREE.LoopRepeat, Infinity);
            }
            currentAction.current = desiredAction;
        }

        if (groupRef.current) {
            const angle = Math.atan2(dx, dz);
            groupRef.current.rotation.y = angle;
        }
    });

    return (
        <group ref={groupRef} position={position}>
            <primitive object={clonedScene} scale={scale} rotation={[0, rotationY, 0]} />
        </group>
    );
};

useGLTF.preload(PLANT_MODEL_PATH);

// ============================================================
// DINOSAUR EGG – collectible
// ============================================================
const EGG_COLORS = ['#f5e6c8', '#e8d4a0', '#fff3d4', '#d4c8a0', '#f0deb8'];

const DinoEgg: React.FC<{
    position: [number, number, number];
    color: string;
    collected: boolean;
}> = ({ position, color, collected }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.PointLight>(null);

    useFrame((state) => {
        if (collected || !meshRef.current) return;
        meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.1;
        meshRef.current.rotation.y += 0.01;
    });

    if (collected) return null;

    return (
        <group>
            <mesh ref={meshRef} position={position} castShadow>
                <sphereGeometry args={[0.35, 12, 10]} />
                <meshStandardMaterial
                    color={color}
                    roughness={0.3}
                    metalness={0.1}
                    emissive={color}
                    emissiveIntensity={0.15}
                />
            </mesh>
            <pointLight
                ref={glowRef}
                position={[position[0], position[1] + 0.5, position[2]]}
                color={color}
                intensity={0.4}
                distance={3}
                decay={2}
            />
        </group>
    );
};

// ============================================================
// AUDIO
// ============================================================
let _jurassicAudioCtx: AudioContext | null = null;
const getJurassicAudioCtx = (): AudioContext => {
    if (!_jurassicAudioCtx) {
        _jurassicAudioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    }
    return _jurassicAudioCtx;
};

const playEggCollectSound = () => {
    try {
        const ctx = getJurassicAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch (_e) { /* ignore */ }
};

const playTrexDeathSound = () => {
    try {
        const ctx = getJurassicAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (_e) { /* ignore */ }
};

// ============================================================
// CONFETTI – burst effect when T-Rex is killed
// ============================================================
const TrexPopEffect: React.FC<{ position: THREE.Vector3 }> = ({ position }) => {
    const pointsRef = useRef<THREE.Points>(null);
    const scaleRef = useRef(1);

    const { positions, velocities } = useMemo(() => {
        const count = 30;
        const posArr = new Float32Array(count * 3);
        const velArr: { x: number; y: number; z: number }[] = [];
        for (let i = 0; i < count; i++) {
            posArr[i * 3] = 0;
            posArr[i * 3 + 1] = 0;
            posArr[i * 3 + 2] = 0;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI - Math.PI / 2;
            const speed = 2 + Math.random() * 4;
            velArr.push({
                x: Math.cos(theta) * Math.cos(phi) * speed,
                y: Math.sin(phi) * speed + 3,
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
            vels[i].y -= delta * 6;
        }
        posAttr.needsUpdate = true;
        scaleRef.current *= 0.93;
        const mat = pointsRef.current.material as THREE.PointsMaterial;
        mat.size = 0.4 * scaleRef.current;
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
                color="#ff4422"
                size={0.4}
                sizeAttenuation
                transparent
                opacity={0.9}
            />
        </points>
    );
};

// ============================================================
// T-REX NPC – GLB model with roam/chase/attack AI
// ============================================================
const TREX_MODEL_PATH = '/models/rigged-t-rex-fabulous/source/rigged_t-rex_fabulous.glb';
const TREX_CHASE_SPEED = 6;
const TREX_ROAM_SPEED = 2.5;
const TREX_ATTACK_RANGE = 5;
const TREX_DETECTION_RANGE = 25;

const TrexNPC: React.FC<{
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
    startX: number;
    startZ: number;
    isAlive: boolean;
    onPositionUpdate: (x: number, z: number) => void;
}> = ({ playerPosRef, startX, startZ, isAlive, onPositionUpdate }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(TREX_MODEL_PATH);

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

    // Match the playable T-Rex sizing: normalise Y-height to Fluffy's rendered height
    const transform = useMemo(() => {
        clonedScene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(clonedScene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const fluffyGameHeight = 0.774 * 7.5;
        const scale = fluffyGameHeight / size.y;
        return {
            scale,
            x: -center.x * scale,
            y: -box.min.y * scale,
            z: -center.z * scale,
        };
    }, [clonedScene]);

    const { actions, names } = useAnimations(animations, clonedScene);

    const mainAction = useMemo(() => {
        const clip = names.find(n => n === 'CINEMA_4D_Main') ?? names[0];
        return clip ? actions[clip] ?? null : null;
    }, [actions, names]);

    const stateRef = useRef({
        x: startX,
        z: startZ,
        rotation: 0,
        mode: 'roam' as 'roam' | 'chase' | 'attack',
        roamTargetX: startX + 10,
        roamTargetZ: startZ + 10,
        roamTimer: 0,
        attackTimer: 0,
    });

    const deathTriggeredRef = useRef(false);
    const deathTiltRef = useRef(0);

    useEffect(() => {
        if (mainAction) {
            mainAction.reset();
            mainAction.setLoop(THREE.LoopRepeat, Infinity);
            mainAction.clampWhenFinished = false;
            mainAction.timeScale = 1;
            mainAction.play();
            mainAction.paused = true;
        }
    }, [mainAction]);

    useEffect(() => {
        if (!isAlive && !deathTriggeredRef.current) {
            deathTriggeredRef.current = true;
            if (mainAction) mainAction.fadeOut(0.3);
        }
    }, [isAlive, mainAction]);

    useFrame((_state, delta) => {
        if (!groupRef.current) return;

        if (!isAlive) {
            deathTiltRef.current = Math.min(deathTiltRef.current + delta * 1.5, Math.PI / 2);
            groupRef.current.rotation.z = deathTiltRef.current;
            return;
        }

        const s = stateRef.current;
        const pp = playerPosRef.current;

        const dx = pp.x - s.x;
        const dz = pp.z - s.z;
        const distToPlayer = Math.sqrt(dx * dx + dz * dz);

        if (distToPlayer < TREX_ATTACK_RANGE) {
            if (s.mode !== 'attack') {
                s.mode = 'attack';
                s.attackTimer = 0;
                if (mainAction) {
                    mainAction.paused = false;
                    mainAction.timeScale = 2.5;
                }
            }
        } else if (distToPlayer < TREX_DETECTION_RANGE) {
            if (s.mode !== 'chase') {
                s.mode = 'chase';
                if (mainAction) {
                    mainAction.paused = false;
                    mainAction.timeScale = 1.2;
                }
            }
        } else {
            if (s.mode !== 'roam') {
                s.mode = 'roam';
                if (mainAction) {
                    mainAction.paused = false;
                    mainAction.timeScale = 0.6;
                }
            }
        }

        const PLAYER_BODY_RADIUS = 1.5;

        if (s.mode === 'chase') {
            if (distToPlayer > TREX_ATTACK_RANGE * 0.6) {
                const speed = TREX_CHASE_SPEED * delta;
                const nx = s.x + (dx / distToPlayer) * speed;
                const nz = s.z + (dz / distToPlayer) * speed;
                const boundaryOk = Math.sqrt(nx * nx + nz * nz) <= JUNGLE_RADIUS - 4;
                const dxNew = pp.x - nx;
                const dzNew = pp.z - nz;
                const playerOk = Math.sqrt(dxNew * dxNew + dzNew * dzNew) > PLAYER_BODY_RADIUS;
                if (boundaryOk && playerOk) {
                    s.x = nx;
                    s.z = nz;
                }
            }
            const targetRotation = Math.atan2(dx, dz);
            s.rotation = THREE.MathUtils.lerp(s.rotation, targetRotation, delta * 4);
        } else if (s.mode === 'attack') {
            s.attackTimer += delta;
            const targetRotation = Math.atan2(dx, dz);
            s.rotation = THREE.MathUtils.lerp(s.rotation, targetRotation, delta * 6);
        } else {
            s.roamTimer += delta;
            if (s.roamTimer > 4) {
                s.roamTimer = 0;
                const angle = Math.random() * Math.PI * 2;
                const dist = 10 + Math.random() * 20;
                s.roamTargetX = Math.cos(angle) * dist;
                s.roamTargetZ = Math.sin(angle) * dist;
            }
            const rdx = s.roamTargetX - s.x;
            const rdz = s.roamTargetZ - s.z;
            const roamDist = Math.sqrt(rdx * rdx + rdz * rdz);
            if (roamDist > 2) {
                const speed = TREX_ROAM_SPEED * delta;
                const nx = s.x + (rdx / roamDist) * speed;
                const nz = s.z + (rdz / roamDist) * speed;
                const boundaryOk = Math.sqrt(nx * nx + nz * nz) <= JUNGLE_RADIUS - 4;
                if (boundaryOk) {
                    s.x = nx;
                    s.z = nz;
                }
                const targetRotation = Math.atan2(rdx, rdz);
                s.rotation = THREE.MathUtils.lerp(s.rotation, targetRotation, delta * 3);
            }
        }

        groupRef.current.position.set(s.x, 0, s.z);
        groupRef.current.rotation.y = s.rotation;
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

useGLTF.preload(TREX_MODEL_PATH);

// ============================================================
// DYNAMIC SPOTLIGHTS – follow player and T-Rex NPC
// ============================================================
const PlayerSpotlight: React.FC<{
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
}> = ({ playerPosRef }) => {
    const lightRef = useRef<THREE.PointLight>(null);

    useFrame(() => {
        if (!lightRef.current) return;
        const pp = playerPosRef.current;
        lightRef.current.position.set(pp.x, 8, pp.z);
    });

    return (
        <pointLight
            ref={lightRef}
            color="#fffae0"
            intensity={2.0}
            distance={20}
            decay={1.5}
        />
    );
};

const TrexSpotlight: React.FC<{
    trexId: string;
    trexPositionsRef: React.MutableRefObject<Map<string, { x: number; z: number }>>;
}> = ({ trexId, trexPositionsRef }) => {
    const lightRef = useRef<THREE.PointLight>(null);

    useFrame(() => {
        if (!lightRef.current) return;
        const pos = trexPositionsRef.current.get(trexId);
        if (pos) {
            lightRef.current.position.set(pos.x, 8, pos.z);
        }
    });

    return (
        <pointLight
            ref={lightRef}
            color="#ffd8b0"
            intensity={1.8}
            distance={18}
            decay={1.5}
        />
    );
};

// ============================================================
// MAIN JURASSIC PARK LEVEL COMPONENT
// ============================================================
interface JurassicParkLevelProps {
    children: React.ReactNode;
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
    onScoreUpdate: (cb: (prev: number) => number) => void;
    attackTriggerRef: React.MutableRefObject<number>;
}

export const JurassicParkLevel: React.FC<JurassicParkLevelProps> = ({
    children,
    playerPosRef,
    onScoreUpdate,
    attackTriggerRef,
}) => {
    const quality = getQualitySettings();
    const shadowSize = quality.shadowMapSize;

    // ----------------------------------------------------------
    // Jungle trees (GLB model instances)
    // ----------------------------------------------------------
    const treePositions = useMemo(() => {
        const rand = seededRandom(1001);
        const trees: { pos: [number, number, number]; scale: number; rotationY: number }[] = [];
        const count = 8;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.4;
            const dist = JUNGLE_RADIUS - 6 + rand() * 4;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            trees.push({
                pos: [x, 0, z],
                scale: 1.5 + rand() * 1.5,
                rotationY: rand() * Math.PI * 2,
            });
        }
        return trees;
    }, []);

    // ----------------------------------------------------------
    // Banana trees (GLB model instances)
    // ----------------------------------------------------------
    const bananaTreePositions = useMemo(() => {
        const rand = seededRandom(2002);
        const trees: { pos: [number, number, number]; scale: number; rotationY: number }[] = [];
        const count = 8;
        const offset = Math.PI / count;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + offset + (rand() - 0.5) * 0.4;
            const dist = JUNGLE_RADIUS - 8 + rand() * 4;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            trees.push({
                pos: [x, 0, z],
                scale: 1.2 + rand() * 1.0,
                rotationY: rand() * Math.PI * 2,
            });
        }
        return trees;
    }, []);

    // ----------------------------------------------------------
    // Flesh-eating plants
    // ----------------------------------------------------------
    const plantPositions = useMemo(() => {
        const rand = seededRandom(3003);
        const plants: { pos: [number, number, number]; scale: number; rotationY: number }[] = [];
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + rand() * 0.5;
            const dist = 18 + rand() * 10;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            plants.push({
                pos: [x, 0, z],
                scale: 1.0 + rand() * 0.8,
                rotationY: rand() * Math.PI * 2,
            });
        }
        return plants;
    }, []);

    // ----------------------------------------------------------
    // Dinosaur eggs
    // ----------------------------------------------------------
    const eggPositions = useMemo(() => {
        const rand = seededRandom(5001);
        const eggs: { id: string; pos: [number, number, number]; color: string }[] = [];
        const count = 30;
        for (let i = 0; i < count; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = 8 + rand() * (JUNGLE_RADIUS - 16);
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
            const color = EGG_COLORS[Math.floor(rand() * EGG_COLORS.length)];
            eggs.push({ id: `egg-${i}`, pos: [x, 0.4, z], color });
        }
        return eggs;
    }, []);

    const collectedEggsRef = useRef<Set<string>>(new Set());
    const [, setEggVersion] = useState(0);

    useFrame(() => {
        const px = playerPosRef.current.x;
        const pz = playerPosRef.current.z;
        const COLLECT_RANGE = 2.0;
        let collected = false;

        for (const egg of eggPositions) {
            if (collectedEggsRef.current.has(egg.id)) continue;
            const dx = px - egg.pos[0];
            const dz = pz - egg.pos[2];
            if (Math.sqrt(dx * dx + dz * dz) < COLLECT_RANGE) {
                collectedEggsRef.current.add(egg.id);
                collected = true;
                playEggCollectSound();
                onScoreUpdate(prev => prev + 1);
            }
        }
        if (collected) setEggVersion(v => v + 1);
    });

    // ----------------------------------------------------------
    // T-Rex NPC system
    // ----------------------------------------------------------
    const TREX_RESPAWN_DELAY = 8000;

    interface TrexInstance {
        id: string;
        startX: number;
        startZ: number;
        alive: boolean;
    }

    const randomTrexSpawn = useCallback((): { x: number; z: number } => {
        const px = playerPosRef.current.x;
        const pz = playerPosRef.current.z;
        let x: number, z: number, dist: number;
        do {
            const angle = Math.random() * Math.PI * 2;
            const r = 20 + Math.random() * (JUNGLE_RADIUS - 28);
            x = Math.cos(angle) * r;
            z = Math.sin(angle) * r;
            const ddx = x - px;
            const ddz = z - pz;
            dist = Math.sqrt(ddx * ddx + ddz * ddz);
        } while (dist < 25);
        return { x, z };
    }, [playerPosRef]);

    const [trexInstances, setTrexInstances] = useState<TrexInstance[]>(() => {
        return [{ id: 'trex-0', startX: 25, startZ: 25, alive: true }];
    });

    const trexPositionsRef = useRef<Map<string, { x: number; z: number }>>(new Map());
    const nextTrexIdRef = useRef(1);

    const [popEffects, setPopEffects] = useState<{ id: string; position: THREE.Vector3 }[]>([]);
    const lastAttackRef = useRef(0);

    // Attack detection
    useFrame(() => {
        const currentAttack = attackTriggerRef.current;
        if (currentAttack === lastAttackRef.current) return;
        lastAttackRef.current = currentAttack;

        const px = playerPosRef.current.x;
        const pz = playerPosRef.current.z;
        const RANGE = 4.5;

        for (const tr of trexInstances) {
            if (!tr.alive) continue;
            const pos = trexPositionsRef.current.get(tr.id);
            if (!pos) continue;
            const tdx = px - pos.x;
            const tdz = pz - pos.z;
            if (Math.sqrt(tdx * tdx + tdz * tdz) < RANGE) {
                setTrexInstances(prev => prev.map(t => t.id === tr.id ? { ...t, alive: false } : t));
                onScoreUpdate(prev => prev + 25);

                const effectPos = new THREE.Vector3(pos.x, 3, pos.z);
                const effectId = `pop-${tr.id}-${Date.now()}`;
                setPopEffects(prev => [...prev, { id: effectId, position: effectPos }]);
                setTimeout(() => {
                    setPopEffects(prev => prev.filter(e => e.id !== effectId));
                }, 1500);

                playTrexDeathSound();

                setTimeout(() => {
                    setTrexInstances(prev => {
                        const alive = prev.filter(t => t.alive);
                        if (alive.length >= 1) return alive;
                        const spawn = randomTrexSpawn();
                        const newId = `trex-${nextTrexIdRef.current++}`;
                        return [...alive, { id: newId, startX: spawn.x, startZ: spawn.z, alive: true }];
                    });
                }, TREX_RESPAWN_DELAY);

                break;
            }
        }
    });

    // Keep collision registry in sync
    useFrame(() => {
        const trexCollisionData = trexInstances.map(tr => {
            const pos = trexPositionsRef.current.get(tr.id);
            return {
                x: pos?.x ?? tr.startX,
                z: pos?.z ?? tr.startZ,
                alive: tr.alive,
            };
        });
        _updateJurassicCollisionData(
            [...treePositions.map(t => t.pos), ...bananaTreePositions.map(t => t.pos), ...plantPositions.map(p => p.pos)],
            trexCollisionData,
        );
    });

    return (
        <group>
            {/* ==================== LIGHTING ==================== */}
            <ambientLight intensity={0.7} color="#d0e8d0" />
            <directionalLight
                position={[10, 30, 10]}
                intensity={2.0}
                color="#fff8e0"
                castShadow={quality.shadowsEnabled}
                shadow-mapSize={[shadowSize, shadowSize]}
            >
                <orthographicCamera attach="shadow-camera" args={[-40, 40, 40, -40, 0.1, 100]} />
            </directionalLight>
            <directionalLight position={[-10, 20, -15]} intensity={0.5} color="#c8e8c8" />
            <fog attach="fog" args={['#2a4a2a', 30, 70]} />

            {/* Spotlight that follows the player */}
            <PlayerSpotlight playerPosRef={playerPosRef} />

            {/* Spotlight that follows the T-Rex NPC */}
            {trexInstances.filter(tr => tr.alive).map(tr => (
                <TrexSpotlight key={`light-${tr.id}`} trexId={tr.id} trexPositionsRef={trexPositionsRef} />
            ))}

            {/* ==================== SKY DOME ==================== */}
            <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[60, 24, 16]} />
                <meshBasicMaterial color="#3a5a3a" side={THREE.BackSide} />
            </mesh>
            <mesh position={[0, 25, 0]}>
                <sphereGeometry args={[59, 24, 16]} />
                <meshBasicMaterial color="#6b9ebb" side={THREE.BackSide} transparent opacity={0.5} />
            </mesh>

            {/* ==================== GROUND ==================== */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[60, Math.max(64, quality.floorSegments * 4)]} />
                <meshStandardMaterial color="#3a6b2a" roughness={0.9} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
                <circleGeometry args={[15, 32]} />
                <meshStandardMaterial color="#2d5a1e" roughness={0.85} />
            </mesh>

            {/* ==================== JUNGLE TREES ==================== */}
            {treePositions.map((t, i) => (
                <JungleTree key={`tree-${i}`} position={t.pos} scale={t.scale} rotationY={t.rotationY} />
            ))}

            {/* ==================== BANANA TREES ==================== */}
            {bananaTreePositions.map((t, i) => (
                <BananaTree key={`banana-${i}`} position={t.pos} scale={t.scale} rotationY={t.rotationY} />
            ))}

            {/* ==================== FLESH-EATING PLANTS ==================== */}
            {plantPositions.map((p, i) => (
                <FleshEatingPlant
                    key={`plant-${i}`}
                    position={p.pos}
                    scale={p.scale}
                    rotationY={p.rotationY}
                    playerPosRef={playerPosRef}
                />
            ))}

            {/* ==================== DINOSAUR EGGS ==================== */}
            {eggPositions.map((egg) => (
                <DinoEgg
                    key={egg.id}
                    position={egg.pos}
                    color={egg.color}
                    collected={collectedEggsRef.current.has(egg.id)}
                />
            ))}

            {/* ==================== POP EFFECTS ==================== */}
            {popEffects.map((e) => (
                <TrexPopEffect key={e.id} position={e.position} />
            ))}

            {/* ==================== T-REX NPC ==================== */}
            {trexInstances.map(tr => (
                <TrexNPC
                    key={tr.id}
                    playerPosRef={playerPosRef}
                    startX={tr.startX}
                    startZ={tr.startZ}
                    isAlive={tr.alive}
                    onPositionUpdate={(x, z) => {
                        trexPositionsRef.current.set(tr.id, { x, z });
                    }}
                />
            ))}

            {children}
        </group>
    );
};

export default JurassicParkLevel;

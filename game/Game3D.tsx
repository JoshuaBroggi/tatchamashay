import React, { useRef, useState, useMemo, useEffect, useCallback, Suspense, lazy } from 'react';
import { useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Controls, GameProps, Level, CharacterVariant, CHARACTER_CONFIGS } from './types';
import { LoadingScreen } from './components/LoadingScreen';
import { useMultiplayer, useMultiplayerEvents } from './multiplayer';
import { RemotePlayer } from './components/RemotePlayer';
import { PerfMonitor } from './world/PerfMonitor';
import { getQualitySettings } from './world/quality';

// Lazy load the world components
const OverWorld = lazy(() => import('./components/OverWorld'));
const CaveLevel = lazy(() => import('./components/CaveLevel'));
const DesertLevel = lazy(() => import('./components/DesertLevel'));

// Import types from OverWorld for balloon and footprint systems
import type { BalloonPhysics, Footprint } from './components/OverWorld';
import { checkOverworldCollision, getPoopPileHeight, PLAYER_RADIUS } from './components/OverWorld';
import { checkCaveCollision, MAIN_CAVERN_RADIUS } from './components/CaveLevel';
import { checkDesertCollision } from './components/DesertLevel';

// Augment React's JSX namespace to include Three.js elements
declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

// --- DESATURATION HELPER ---

/** Apply a grayscale desaturation shader to a mesh's materials (preserves texture & PBR lighting). */
function desaturateMesh(mesh: THREE.Mesh) {
    const desat = (mat: THREE.Material): THREE.Material => {
        const m = mat.clone();
        if (m instanceof THREE.MeshStandardMaterial) {
            m.onBeforeCompile = (shader) => {
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <map_fragment>',
                    `#include <map_fragment>
                    float _dGray = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
                    diffuseColor.rgb = vec3(_dGray);`
                );
            };
            m.customProgramCacheKey = () => 'blackScorpion_desaturated';
        }
        return m;
    };
    if (mesh.material) {
        if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map(desat);
        } else {
            mesh.material = desat(mesh.material);
        }
    }
}

// --- TARANTULA ANIMATION HELPERS ---

/**
 * Custom hook that manages tarantula locomotion animation.
 * Call inside a component that has access to `controlsRef` and the cloned scene.
 */
function useTarantulaAnimation(
    isTarantula: boolean,
    animations: THREE.AnimationClip[],
    clonedScene: THREE.Group | null,
    controlsRef: React.MutableRefObject<Controls>
) {
    const actionsRef = useRef<Record<string, THREE.AnimationAction | null>>({});
    const currentClipRef = useRef<THREE.AnimationAction | null>(null);
    const prevMovingRef = useRef(false);

    // Setup useAnimations – drei's hook needs a ref-like object; pass the cloned scene directly.
    const mixer = useMemo(() => {
        if (!isTarantula || !clonedScene || animations.length === 0) return null;
        return new THREE.AnimationMixer(clonedScene);
    }, [isTarantula, clonedScene, animations]);

    // Build actions map
    useEffect(() => {
        if (!mixer || animations.length === 0) return;
        const map: Record<string, THREE.AnimationAction> = {};
        for (const clip of animations) {
            map[clip.name] = mixer.clipAction(clip);
        }
        actionsRef.current = map;

        // Start playing immediately in a paused-ready state
        const action = Object.values(map).find(Boolean);
        if (action) {
            action.reset();
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
            action.timeScale = 1;
            action.play();
            action.paused = true; // paused until movement
            currentClipRef.current = action;
        }

        return () => {
            mixer.stopAllAction();
            actionsRef.current = {};
            currentClipRef.current = null;
        };
    }, [mixer, animations]);

    // Per-frame update: drive mixer and toggle play/pause based on movement
    const updateAnimation = useCallback((delta: number) => {
        if (!mixer) return;
        const { up, down, left, right } = controlsRef.current;
        const isMoving = up || down || left || right;

        if (isMoving && !prevMovingRef.current) {
            // Resume animation
            if (currentClipRef.current) {
                currentClipRef.current.paused = false;
            }
        } else if (!isMoving && prevMovingRef.current) {
            // Pause animation
            if (currentClipRef.current) {
                currentClipRef.current.paused = true;
            }
        }
        prevMovingRef.current = isMoving;

        mixer.update(delta);
    }, [mixer, controlsRef]);

    return updateAnimation;
}

// --- SCORPION ANIMATION HELPERS ---

/**
 * Custom hook that manages scorpion animation with proper Idle / Walk / Area Attack
 * state transitions and crossfading.
 */
function useScorpionAnimation(
    isScorpion: boolean,
    animations: THREE.AnimationClip[],
    clonedScene: THREE.Group | null,
    controlsRef: React.MutableRefObject<Controls>
) {
    const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
    const currentStateRef = useRef<'idle' | 'walk' | 'attack'>('idle');
    const prevAttackRef = useRef(false);
    const attackingRef = useRef(false);

    const mixer = useMemo(() => {
        if (!isScorpion || !clonedScene || animations.length === 0) return null;
        return new THREE.AnimationMixer(clonedScene);
    }, [isScorpion, clonedScene, animations]);

    // Build actions map and start with Idle
    useEffect(() => {
        if (!mixer || animations.length === 0) return;
        const map: Record<string, THREE.AnimationAction> = {};
        for (const clip of animations) {
            map[clip.name] = mixer.clipAction(clip);
        }
        actionsRef.current = map;

        // Configure looping clips
        for (const name of ['Idle', 'Walk']) {
            const action = map[name];
            if (action) {
                action.setLoop(THREE.LoopRepeat, Infinity);
                action.clampWhenFinished = false;
            }
        }

        // Configure one-shot attack clip
        const attackAction = map['Area Attack'];
        if (attackAction) {
            attackAction.setLoop(THREE.LoopOnce, 1);
            attackAction.clampWhenFinished = true;
        }

        // Start with Idle playing
        const idleAction = map['Idle'];
        if (idleAction) {
            idleAction.reset().play();
            currentStateRef.current = 'idle';
        }

        // When the attack animation finishes, crossfade back to Idle or Walk
        const onFinished = (e: { action: THREE.AnimationAction }) => {
            if (e.action === map['Area Attack']) {
                attackingRef.current = false;
                const { up, down } = controlsRef.current;
                const isMoving = up || down;
                const targetName = isMoving ? 'Walk' : 'Idle';
                const targetAction = map[targetName];
                if (targetAction) {
                    e.action.fadeOut(0.2);
                    targetAction.reset().fadeIn(0.2).play();
                    currentStateRef.current = isMoving ? 'walk' : 'idle';
                }
            }
        };
        mixer.addEventListener('finished', onFinished);

        return () => {
            mixer.removeEventListener('finished', onFinished);
            mixer.stopAllAction();
            actionsRef.current = {};
            currentStateRef.current = 'idle';
            attackingRef.current = false;
        };
    }, [mixer, animations, controlsRef]);

    // Per-frame update: drive state transitions and mixer.
    // Uses state-mismatch detection instead of edge-detection so the Walk
    // transition is never missed even if useFrame fires before the useEffect
    // that populates the actions map.
    const updateAnimation = useCallback((delta: number) => {
        if (!mixer) return;
        const actions = actionsRef.current;
        const { up, down, attack } = controlsRef.current;
        const isMoving = up || down;

        // Detect attack rising edge (key just pressed)
        const attackJustPressed = attack && !prevAttackRef.current;
        prevAttackRef.current = attack;

        // Handle attack trigger
        if (attackJustPressed) {
            attackingRef.current = true;
            const attackAction = actions['Area Attack'];
            if (attackAction) {
                // Fade out whatever is currently playing
                const currentName = currentStateRef.current === 'walk' ? 'Walk' : 'Idle';
                const currentAction = actions[currentName];
                if (currentAction) currentAction.fadeOut(0.15);
                attackAction.stop().reset().fadeIn(0.15).play();
                currentStateRef.current = 'attack';
            }
        }

        // Handle Walk / Idle transitions (only when not in the middle of an attack).
        // Compare desired state against current state so we never miss a transition.
        if (!attackingRef.current) {
            const desiredState = isMoving ? 'walk' : 'idle';
            if (desiredState !== currentStateRef.current) {
                if (desiredState === 'walk') {
                    const idleAction = actions['Idle'];
                    const walkAction = actions['Walk'];
                    if (idleAction && walkAction) {
                        idleAction.fadeOut(0.2);
                        walkAction.reset().fadeIn(0.2).play();
                        currentStateRef.current = 'walk';
                    }
                } else {
                    const walkAction = actions['Walk'];
                    const idleAction = actions['Idle'];
                    if (walkAction && idleAction) {
                        walkAction.fadeOut(0.2);
                        idleAction.reset().fadeIn(0.2).play();
                        currentStateRef.current = 'idle';
                    }
                }
            }
        }

        mixer.update(delta);
    }, [mixer, controlsRef]);

    return updateAnimation;
}

// --- AUDIO SYSTEM (Singleton AudioContext for performance) ---
let audioCtx: AudioContext | null = null;
const getAudioContext = (): AudioContext => {
    if (!audioCtx) {
        audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

const playSound = (type: 'pop' | 'swing') => {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'pop') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } else {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        }
    } catch (e) {
        // Ignore audio errors
    }
};


// --- PLAYER COMPONENT ---
const Player = ({ controlsRef, onAttack, positionRef, onFootprint, hasClimbedPoopRef, characterVariant = 'black', onPositionUpdate }: {
    controlsRef: React.MutableRefObject<Controls>,
    onAttack: () => void,
    positionRef: React.MutableRefObject<THREE.Vector3>,
    onFootprint: (x: number, z: number, rotation: number) => void,
    hasClimbedPoopRef: React.MutableRefObject<boolean>,
    characterVariant?: CharacterVariant,
    onPositionUpdate?: (x: number, y: number, z: number, rotation: number) => void
}) => {
    const group = useRef<THREE.Group>(null);
    const swordRef = useRef<THREE.Group>(null);
    const fluffyHeadRef = useRef<THREE.Group>(null);
    const isAttacking = useRef(false);
    const attackTime = useRef(0);
    const lastFootprintTime = useRef(0);
    const footprintSide = useRef(0);
    const { camera, gl } = useThree();
    
    // Camera orbit controls (mouse drag to rotate view)
    const cameraOrbitRef = useRef(0); // Horizontal orbit angle offset
    const cameraVerticalRef = useRef(0); // Vertical orbit angle offset
    const isDraggingRef = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    
    // Mouse event handlers for camera orbit
    useEffect(() => {
        const canvas = gl.domElement;
        
        const handleMouseDown = (e: MouseEvent) => {
            isDraggingRef.current = true;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        };
        
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            
            const deltaX = e.clientX - lastMousePos.current.x;
            const deltaY = e.clientY - lastMousePos.current.y;
            
            // Adjust orbit based on mouse movement (sensitivity factor)
            const sensitivity = 0.005;
            cameraOrbitRef.current -= deltaX * sensitivity;
            cameraVerticalRef.current += deltaY * sensitivity;
            
            // Clamp vertical angle to prevent flipping
            cameraVerticalRef.current = Math.max(-0.5, Math.min(0.8, cameraVerticalRef.current));
            
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        };
        
        const handleMouseUp = () => {
            isDraggingRef.current = false;
            canvas.style.cursor = 'grab';
        };
        
        const handleMouseLeave = () => {
            isDraggingRef.current = false;
            canvas.style.cursor = 'grab';
        };
        
        // Set initial cursor style
        canvas.style.cursor = 'grab';
        
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        
        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
            canvas.style.cursor = 'default';
        };
    }, [gl]);
    
    const isFluffy = characterVariant === 'fluffy';
    const isLobster = characterVariant === 'lobster';
    const isTarantula = characterVariant === 'tarantula';
    const isScorpion = characterVariant === 'scorpion' || characterVariant === 'blackScorpion';
    const specialModelPath = useMemo(() => {
        if (characterVariant === 'trex') return '/models/rigged-t-rex-fabulous/source/rigged_t-rex_fabulous.glb';
        if (characterVariant === 'warDino') return '/models/war_dinosaur_-_rigged.glb';
        if (characterVariant === 'mosasaurus') return '/models/jurassic_world_mosasaurus.glb';
        if (characterVariant === 'legoMosasaurus') return '/models/rigged_mosasaurus_lego.glb';
        if (characterVariant === 'tarantula') return '/models/theraphosa-blondi/source/hi-fi-spider.glb';
        if (characterVariant === 'scorpion' || characterVariant === 'blackScorpion') return '/models/scorpion.glb';
        return null;
    }, [characterVariant]);

    // Load all character models
    const { scene: deathvaderScene } = useGLTF('/models/deathvader-optimized.glb');
    const { scene: fluffyScene } = useGLTF('/models/fluffy unicorn.glb');
    const { scene: lobsterScene } = useGLTF('/models/super lobster.glb');
    const { scene: specialScene, animations: specialAnimations } = useGLTF(specialModelPath ?? '/models/deathvader-optimized.glb');
    
    // Get cloak color from character config
    const cloakColor = useMemo(() => {
        const config = CHARACTER_CONFIGS.find(c => c.id === characterVariant);
        return config?.cloakColor || '#1a1a1a';
    }, [characterVariant]);

    // Clone DeathVader scene with cloak color
    const clonedDeathvaderScene = useMemo(() => {
        if (isFluffy || isLobster || specialModelPath) return null;
        
        const clone = deathvaderScene.clone();
        const cloakColorObj = new THREE.Color(cloakColor);
        
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                const applyColorToMaterial = (mat: THREE.Material): THREE.Material => {
                    const clonedMat = mat.clone();
                    
                    if (clonedMat instanceof THREE.MeshStandardMaterial || 
                        clonedMat instanceof THREE.MeshBasicMaterial ||
                        clonedMat instanceof THREE.MeshPhongMaterial ||
                        clonedMat instanceof THREE.MeshLambertMaterial) {
                        
                        const originalColor = clonedMat.color;
                        const luminance = 0.299 * originalColor.r + 0.587 * originalColor.g + 0.114 * originalColor.b;
                        
                        // Apply to dark materials (cloak)
                        if (luminance < 0.5) {
                            clonedMat.color = cloakColorObj.clone();
                        }
                    }
                    return clonedMat;
                };
                
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material = mesh.material.map(applyColorToMaterial);
                    } else {
                        mesh.material = applyColorToMaterial(mesh.material);
                    }
                }
            }
        });
        return clone;
    }, [deathvaderScene, cloakColor, isFluffy, isLobster, specialModelPath]);

    // Clone Fluffy unicorn scene
    const clonedFluffyScene = useMemo(() => {
        if (!isFluffy) return null;
        
        const clone = fluffyScene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        return clone;
    }, [fluffyScene, isFluffy]);

    // Clone Super Lobster scene with glowing effect
    const clonedLobsterScene = useMemo(() => {
        if (!isLobster) return null;
        
        const clone = lobsterScene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                // Apply subtle glowing emissive material to the lobster
                const applyGlowToMaterial = (mat: THREE.Material): THREE.Material => {
                    const clonedMat = mat.clone();
                    
                    if (clonedMat instanceof THREE.MeshStandardMaterial) {
                        // Make the lobster glow with a subtle warm orange-red emanation
                        clonedMat.emissive = new THREE.Color('#ff4500');
                        clonedMat.emissiveIntensity = 0.04;
                    } else if (clonedMat instanceof THREE.MeshBasicMaterial ||
                               clonedMat instanceof THREE.MeshPhongMaterial ||
                               clonedMat instanceof THREE.MeshLambertMaterial) {
                        // Convert to MeshStandardMaterial for emissive support
                        const stdMat = new THREE.MeshStandardMaterial({
                            color: clonedMat.color,
                            emissive: new THREE.Color('#ff4500'),
                            emissiveIntensity: 0.04,
                        });
                        return stdMat;
                    }
                    return clonedMat;
                };
                
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material = mesh.material.map(applyGlowToMaterial);
                    } else {
                        mesh.material = applyGlowToMaterial(mesh.material);
                    }
                }
            }
        });
        return clone;
    }, [lobsterScene, isLobster]);

    // Use SkeletonUtils.clone to preserve skin/bone bindings for rigged models
    const clonedSpecialScene = useMemo(() => {
        if (!specialModelPath) return null;
        const clone = skeletonClone(specialScene) as THREE.Group;
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                if (characterVariant === 'blackScorpion') desaturateMesh(mesh);
            }
        });
        return clone;
    }, [specialScene, specialModelPath, characterVariant]);

    const specialTransform = useMemo(() => {
        if (!clonedSpecialScene) return null;
        // Force-update world matrices so SkinnedMesh bone transforms are correct
        // before computing bounding box (stale after skeletonClone).
        clonedSpecialScene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(clonedSpecialScene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const maxDimension = Math.max(size.x, size.y, size.z) || 1;
        let scale: number;
        if (characterVariant === 'trex') {
            // Normalize T-Rex Y-height to match Fluffy's rendered height (0.774 * 7.5)
            const fluffyGameHeight = 0.774 * 7.5;
            scale = fluffyGameHeight / size.y;
        } else {
            scale = 7.5 / maxDimension;
        }
        const x = -center.x * scale;
        const z = -center.z * scale;
        // Per-character facing correction
        let rotationY = -Math.PI / 2;
        if (characterVariant === 'legoMosasaurus') rotationY = 0;
        if (characterVariant === 'tarantula') rotationY = 0;
        if (isScorpion) rotationY = 0;
        // Vertical offset: scorpion's Idle animation lifts the mesh above
        // the rest-pose bounding box. Empirically tuned so feet touch ground.
        let yOffset = -box.min.y * scale;
        if (isScorpion) yOffset -= 3.0;
        return {
            scale,
            x,
            y: yOffset,
            z,
            rotationY
        };
    }, [clonedSpecialScene, characterVariant]);

    // Ref for procedural swim animation on Lego Mosasaurus
    const swimRef = useRef<THREE.Group>(null);

    // Tarantula locomotion animation
    const updateTarantulaAnim = useTarantulaAnimation(
        isTarantula, specialAnimations, clonedSpecialScene, controlsRef
    );

    // Scorpion multi-state animation (Idle / Walk / Area Attack)
    const updateScorpionAnim = useScorpionAnimation(
        isScorpion, specialAnimations, clonedSpecialScene, controlsRef
    );

    const SPEED = 10;
    const ROTATION_SPEED = 2.5;
    const ATTACK_DURATION = 0.25;
    const FOOTPRINT_INTERVAL = 0.25;
    const POOP_TOP_THRESHOLD = 6.0;

    // Reusable vectors to avoid per-frame allocations
    const _forward = useRef(new THREE.Vector3());
    const _camOffset = useRef(new THREE.Vector3());
    const _targetCamPos = useRef(new THREE.Vector3());
    const _lookTarget = useRef(new THREE.Vector3());

    useFrame((state, delta) => {
        if (!group.current) return;

        // Drive creature animation mixers each frame
        updateTarantulaAnim(delta);
        updateScorpionAnim(delta);

        const { up, down, left, right, attack } = controlsRef.current;
        
        if (left) group.current.rotation.y += ROTATION_SPEED * delta;
        if (right) group.current.rotation.y -= ROTATION_SPEED * delta;

        const forward = _forward.current.set(0, 0, 1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, group.current.rotation.y);

        const speed = SPEED * delta;
        const curX = group.current.position.x;
        const curZ = group.current.position.z;
        const isMoving = up || down;
        
        if (up) {
            const newX = curX + forward.x * speed;
            const newZ = curZ + forward.z * speed;

            if (!checkOverworldCollision(newX, newZ)) {
                group.current.position.x = newX;
                group.current.position.z = newZ;
            } else {
                if (!checkOverworldCollision(newX, curZ)) {
                    group.current.position.x = newX;
                } else if (!checkOverworldCollision(curX, newZ)) {
                    group.current.position.z = newZ;
                }
            }
        }
        
        if (down) {
            const backSpeed = -speed * 0.6;
            const newX = curX + forward.x * backSpeed;
            const newZ = curZ + forward.z * backSpeed;

            if (!checkOverworldCollision(newX, newZ)) {
                group.current.position.x = newX;
                group.current.position.z = newZ;
            } else {
                if (!checkOverworldCollision(newX, curZ)) {
                    group.current.position.x = newX;
                } else if (!checkOverworldCollision(curX, newZ)) {
                    group.current.position.z = newZ;
                }
            }
        }

        let groundHeight = getPoopPileHeight(group.current.position.x, group.current.position.z);
        group.current.position.y = groundHeight;

        if (groundHeight >= POOP_TOP_THRESHOLD) {
            hasClimbedPoopRef.current = true;
        }
        
        const isOnGround = groundHeight < 0.5;
        if (hasClimbedPoopRef.current && isOnGround && isMoving) {
            const currentTime = state.clock.elapsedTime;
            if (currentTime - lastFootprintTime.current > FOOTPRINT_INTERVAL) {
                lastFootprintTime.current = currentTime;
                
                const sideOffset = (footprintSide.current === 0 ? -0.3 : 0.3);
                const footX = group.current.position.x + (-forward.z) * sideOffset;
                const footZ = group.current.position.z + forward.x * sideOffset;
                
                onFootprint(footX, footZ, group.current.rotation.y);
                footprintSide.current = 1 - footprintSide.current;
            }
        }

        positionRef.current.copy(group.current.position);

        onPositionUpdate?.(
            group.current.position.x,
            group.current.position.y,
            group.current.position.z,
            group.current.rotation.y
        );

        // Procedural swim sway for Lego Mosasaurus
        if (characterVariant === 'legoMosasaurus' && swimRef.current) {
            if (isMoving) {
                const t = state.clock.elapsedTime;
                swimRef.current.rotation.z = Math.sin(t * 4) * 0.15;
                swimRef.current.rotation.x = Math.sin(t * 3) * 0.08;
            } else {
                swimRef.current.rotation.z *= 0.9;
                swimRef.current.rotation.x *= 0.9;
            }
        }

        const dist = 12;
        const baseHeight = 5.5;
        
        const orbitAngle = group.current.rotation.y + cameraOrbitRef.current;
        const verticalAngle = cameraVerticalRef.current;
        
        const height = baseHeight + Math.sin(verticalAngle) * 8;
        const horizontalDist = dist * Math.cos(verticalAngle * 0.5);
        
        _camOffset.current.set(
            -Math.sin(orbitAngle) * horizontalDist,
            height,
            -Math.cos(orbitAngle) * horizontalDist
        );
        _targetCamPos.current.copy(group.current.position).add(_camOffset.current);
        
        camera.position.lerp(_targetCamPos.current, 0.1);
        
        _lookTarget.current.set(group.current.position.x, group.current.position.y + 2, group.current.position.z);
        camera.lookAt(_lookTarget.current);

        if (attack && !isAttacking.current) {
            isAttacking.current = true;
            attackTime.current = 0;
            playSound('swing');
            onAttack();
        }

        // Attack animation - different for each character
        if (isAttacking.current) {
            attackTime.current += delta;
            const progress = Math.min(attackTime.current / ATTACK_DURATION, 1);
            
            if (isFluffy && fluffyHeadRef.current) {
                // Fluffy: Head swing with horn thrust
                // Forward tilt + side swing for dramatic horn attack
                const thrustAngle = Math.sin(progress * Math.PI) * 0.8; // Forward thrust
                const swingAngle = Math.sin(progress * Math.PI * 2) * 0.4; // Side to side
                fluffyHeadRef.current.rotation.x = -thrustAngle;
                fluffyHeadRef.current.rotation.z = swingAngle;
                
                if (progress >= 1) {
                    isAttacking.current = false;
                    fluffyHeadRef.current.rotation.x = 0;
                    fluffyHeadRef.current.rotation.z = 0;
                }
            } else if (!isFluffy && !specialModelPath && swordRef.current) {
                // DeathVader: Sword swing
                const swingAngle = Math.sin(progress * Math.PI) * 2;
                swordRef.current.rotation.x = swingAngle;

                if (progress >= 1) {
                    isAttacking.current = false;
                    swordRef.current.rotation.x = 0;
                }
            } else if (progress >= 1) {
                isAttacking.current = false;
            }
        }
    });

    useEffect(() => {
        if (group.current) {
            group.current.position.copy(positionRef.current);
        }
    }, [positionRef]);

    // Render Fluffy the Unicorn (GLB model)
    if (isFluffy) {
        return (
            <group ref={group} position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]} rotation={[0, Math.PI, 0]}>
                {clonedFluffyScene && <primitive object={clonedFluffyScene} scale={7.5} rotation={[0, -Math.PI / 2, 0]} />}
            </group>
        );
    }

    // Render Super Lobster (GLB model) with glowing emanation
    if (isLobster) {
        return (
            <group ref={group} position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]} rotation={[0, Math.PI, 0]}>
                {clonedLobsterScene && <primitive object={clonedLobsterScene} scale={7.5} rotation={[0, -Math.PI / 2, 0]} />}
                
                {/* Subtle glowing light emanating from the lobster */}
                <pointLight
                    position={[0, 1.5, 0]}
                    color="#ff6b35"
                    intensity={0.3}
                    distance={15}
                    decay={2}
                />
                {/* Secondary subtle glow for ambient effect */}
                <pointLight
                    position={[0, 0.5, 0]}
                    color="#ff4500"
                    intensity={0.15}
                    distance={8}
                    decay={2}
                />
            </group>
        );
    }

    if (specialModelPath && clonedSpecialScene && specialTransform) {
        return (
            <group ref={group} position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]} rotation={[0, Math.PI, 0]}>
                <group ref={swimRef}>
                    <primitive
                        object={clonedSpecialScene}
                        scale={specialTransform.scale}
                        rotation={[0, specialTransform.rotationY, 0]}
                        position={[specialTransform.x, specialTransform.y, specialTransform.z]}
                    />
                </group>
            </group>
        );
    }

    // Render DeathVader
    return (
        <group ref={group} position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]} rotation={[0, Math.PI, 0]}>
            {clonedDeathvaderScene && <primitive object={clonedDeathvaderScene} scale={2.5} rotation={[0, -Math.PI / 2, 0]} />}
            
            <group position={[0.6, 1.2, 0]} ref={swordRef}>
                <pointLight 
                    position={[0, 0.7, 0.3]}
                    color="#60A5FA" 
                    intensity={1.5} 
                    distance={6}
                    decay={2}
                />
                
                <mesh position={[0, 0.7, 0.3]} rotation={[0, Math.PI/4, 0]} castShadow>
                    <coneGeometry args={[0.12, 1.6, 4]} />
                    <meshStandardMaterial 
                        color="#a5d8ff"
                        emissive="#60A5FA"
                        emissiveIntensity={0.6}
                        metalness={0.9} 
                        roughness={0.1} 
                    />
                </mesh>
                
                <mesh position={[0, 0.7, 0.3]} rotation={[0, Math.PI/4, 0]} scale={[0.6, 0.9, 0.6]}>
                    <coneGeometry args={[0.12, 1.6, 4]} />
                    <meshBasicMaterial 
                        color="#93C5FD"
                        transparent
                        opacity={0.4}
                    />
                </mesh>
                
                <mesh position={[0, -0.3, 0.3]}>
                    <cylinderGeometry args={[0.08, 0.08, 0.4]} />
                    <meshStandardMaterial color="#78350f" />
                </mesh>
                <mesh position={[0, -0.1, 0.3]} rotation={[Math.PI/2, 0, 0]}>
                    <boxGeometry args={[0.4, 0.1, 0.1]} />
                    <meshStandardMaterial 
                        color="#fcd34d" 
                        emissive="#fcd34d"
                        emissiveIntensity={0.3}
                    />
                </mesh>
            </group>
        </group>
    );
};

useGLTF.preload('/models/deathvader-optimized.glb');
useGLTF.preload('/models/fluffy unicorn.glb');
useGLTF.preload('/models/super lobster.glb');
useGLTF.preload('/models/rigged-t-rex-fabulous/source/rigged_t-rex_fabulous.glb');
useGLTF.preload('/models/war_dinosaur_-_rigged.glb');
useGLTF.preload('/models/jurassic_world_mosasaurus.glb');
useGLTF.preload('/models/rigged_mosasaurus_lego.glb');
useGLTF.preload('/models/theraphosa-blondi/source/hi-fi-spider.glb');
useGLTF.preload('/models/scorpion.glb');

// --- DESERT PLAYER COMPONENT (uses desert collision) ---
const DesertPlayer = ({ controlsRef, onAttack, positionRef, characterVariant = 'black', onPositionUpdate }: {
    controlsRef: React.MutableRefObject<Controls>,
    onAttack: () => void,
    positionRef: React.MutableRefObject<THREE.Vector3>,
    characterVariant?: CharacterVariant,
    onPositionUpdate?: (x: number, y: number, z: number, rotation: number) => void
}) => {
    const group = useRef<THREE.Group>(null);
    const swordRef = useRef<THREE.Group>(null);
    const fluffyHeadRef = useRef<THREE.Group>(null);
    const isAttacking = useRef(false);
    const attackTime = useRef(0);
    const { camera, gl } = useThree();

    const cameraOrbitRef = useRef(0);
    const cameraVerticalRef = useRef(0);
    const isDraggingRef = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = gl.domElement;
        const handleMouseDown = (e: MouseEvent) => {
            isDraggingRef.current = true;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        };
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const deltaX = e.clientX - lastMousePos.current.x;
            const deltaY = e.clientY - lastMousePos.current.y;
            const sensitivity = 0.005;
            cameraOrbitRef.current -= deltaX * sensitivity;
            cameraVerticalRef.current += deltaY * sensitivity;
            cameraVerticalRef.current = Math.max(-0.5, Math.min(0.8, cameraVerticalRef.current));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        };
        const handleMouseUp = () => { isDraggingRef.current = false; canvas.style.cursor = 'grab'; };
        const handleMouseLeave = () => { isDraggingRef.current = false; canvas.style.cursor = 'grab'; };

        canvas.style.cursor = 'grab';
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
            canvas.style.cursor = 'default';
        };
    }, [gl]);

    const isFluffy = characterVariant === 'fluffy';
    const isLobster = characterVariant === 'lobster';
    const dIsTarantula = characterVariant === 'tarantula';
    const dIsScorpion = characterVariant === 'scorpion' || characterVariant === 'blackScorpion';
    const dSpecialModelPath = useMemo(() => {
        if (characterVariant === 'tarantula') return '/models/theraphosa-blondi/source/hi-fi-spider.glb';
        if (characterVariant === 'scorpion' || characterVariant === 'blackScorpion') return '/models/scorpion.glb';
        return null;
    }, [characterVariant]);

    const { scene: deathvaderScene } = useGLTF('/models/deathvader-optimized.glb');
    const { scene: fluffyScene } = useGLTF('/models/fluffy unicorn.glb');
    const { scene: lobsterScene } = useGLTF('/models/super lobster.glb');
    const { scene: dSpecialScene, animations: dSpecialAnimations } = useGLTF(dSpecialModelPath ?? '/models/deathvader-optimized.glb');

    const cloakColor = useMemo(() => {
        const config = CHARACTER_CONFIGS.find(c => c.id === characterVariant);
        return config?.cloakColor || '#1a1a1a';
    }, [characterVariant]);

    const clonedDeathvaderScene = useMemo(() => {
        if (isFluffy || isLobster || dSpecialModelPath) return null;
        const clone = deathvaderScene.clone();
        const cloakColorObj = new THREE.Color(cloakColor);
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                const applyColorToMaterial = (mat: THREE.Material): THREE.Material => {
                    const clonedMat = mat.clone();
                    if (clonedMat instanceof THREE.MeshStandardMaterial ||
                        clonedMat instanceof THREE.MeshBasicMaterial ||
                        clonedMat instanceof THREE.MeshPhongMaterial ||
                        clonedMat instanceof THREE.MeshLambertMaterial) {
                        const originalColor = clonedMat.color;
                        const luminance = 0.299 * originalColor.r + 0.587 * originalColor.g + 0.114 * originalColor.b;
                        if (luminance < 0.5) clonedMat.color = cloakColorObj.clone();
                    }
                    return clonedMat;
                };
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(applyColorToMaterial);
                    else mesh.material = applyColorToMaterial(mesh.material);
                }
            }
        });
        return clone;
    }, [deathvaderScene, cloakColor, isFluffy, isLobster, dSpecialModelPath]);

    const clonedFluffyScene = useMemo(() => {
        if (!isFluffy) return null;
        const clone = fluffyScene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        return clone;
    }, [fluffyScene, isFluffy]);

    const clonedLobsterScene = useMemo(() => {
        if (!isLobster) return null;
        const clone = lobsterScene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                const applyGlowToMaterial = (mat: THREE.Material): THREE.Material => {
                    const clonedMat = mat.clone();
                    if (clonedMat instanceof THREE.MeshStandardMaterial) {
                        clonedMat.emissive = new THREE.Color('#ff4500');
                        clonedMat.emissiveIntensity = 0.04;
                    }
                    return clonedMat;
                };
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(applyGlowToMaterial);
                    else mesh.material = applyGlowToMaterial(mesh.material);
                }
            }
        });
        return clone;
    }, [lobsterScene, isLobster]);

    const dClonedSpecialScene = useMemo(() => {
        if (!dSpecialModelPath) return null;
        const clone = skeletonClone(dSpecialScene) as THREE.Group;
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                if (characterVariant === 'blackScorpion') desaturateMesh(mesh);
            }
        });
        return clone;
    }, [dSpecialScene, dSpecialModelPath, characterVariant]);

    const dSpecialTransform = useMemo(() => {
        if (!dClonedSpecialScene) return null;
        const box = new THREE.Box3().setFromObject(dClonedSpecialScene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const maxDimension = Math.max(size.x, size.y, size.z) || 1;
        const scale = 7.5 / maxDimension;
        let yOffset = -box.min.y * scale;
        if (dIsScorpion) yOffset -= 3.0;
        return {
            scale,
            x: -center.x * scale,
            y: yOffset,
            z: -center.z * scale,
            rotationY: (dIsTarantula || dIsScorpion) ? 0 : -Math.PI / 2
        };
    }, [dClonedSpecialScene, dIsTarantula, dIsScorpion]);

    // Tarantula locomotion animation for desert
    const updateDesertTarantulaAnim = useTarantulaAnimation(
        dIsTarantula, dSpecialAnimations, dClonedSpecialScene, controlsRef
    );

    // Scorpion multi-state animation for desert
    const updateDesertScorpionAnim = useScorpionAnimation(
        dIsScorpion, dSpecialAnimations, dClonedSpecialScene, controlsRef
    );

    const SPEED = 10;
    const ROTATION_SPEED = 2.5;
    const ATTACK_DURATION = 0.25;

    const _dForward = useRef(new THREE.Vector3());
    const _dCamOffset = useRef(new THREE.Vector3());
    const _dTargetCam = useRef(new THREE.Vector3());
    const _dLookTarget = useRef(new THREE.Vector3());

    useFrame((state, delta) => {
        if (!group.current) return;
        updateDesertTarantulaAnim(delta);
        updateDesertScorpionAnim(delta);
        const { up, down, left, right, attack } = controlsRef.current;

        if (left) group.current.rotation.y += ROTATION_SPEED * delta;
        if (right) group.current.rotation.y -= ROTATION_SPEED * delta;

        const forward = _dForward.current.set(0, 0, 1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, group.current.rotation.y);
        const speed = SPEED * delta;
        const curX = group.current.position.x;
        const curZ = group.current.position.z;

        if (up) {
            const newX = curX + forward.x * speed;
            const newZ = curZ + forward.z * speed;
            if (!checkDesertCollision(newX, newZ)) {
                group.current.position.x = newX;
                group.current.position.z = newZ;
            } else {
                if (!checkDesertCollision(newX, curZ)) group.current.position.x = newX;
                else if (!checkDesertCollision(curX, newZ)) group.current.position.z = newZ;
            }
        }

        if (down) {
            const backSpeed = -speed * 0.6;
            const newX = curX + forward.x * backSpeed;
            const newZ = curZ + forward.z * backSpeed;
            if (!checkDesertCollision(newX, newZ)) {
                group.current.position.x = newX;
                group.current.position.z = newZ;
            } else {
                if (!checkDesertCollision(newX, curZ)) group.current.position.x = newX;
                else if (!checkDesertCollision(curX, newZ)) group.current.position.z = newZ;
            }
        }

        group.current.position.y = 0;
        positionRef.current.copy(group.current.position);
        onPositionUpdate?.(group.current.position.x, group.current.position.y, group.current.position.z, group.current.rotation.y);

        const dist = 12;
        const baseHeight = 5.5;
        const orbitAngle = group.current.rotation.y + cameraOrbitRef.current;
        const verticalAngle = cameraVerticalRef.current;
        const height = baseHeight + Math.sin(verticalAngle) * 8;
        const horizontalDist = dist * Math.cos(verticalAngle * 0.5);
        _dCamOffset.current.set(-Math.sin(orbitAngle) * horizontalDist, height, -Math.cos(orbitAngle) * horizontalDist);
        _dTargetCam.current.copy(group.current.position).add(_dCamOffset.current);
        camera.position.lerp(_dTargetCam.current, 0.1);
        _dLookTarget.current.set(group.current.position.x, group.current.position.y + 2, group.current.position.z);
        camera.lookAt(_dLookTarget.current);

        if (attack && !isAttacking.current) {
            isAttacking.current = true;
            attackTime.current = 0;
            playSound('swing');
            onAttack();
        }

        if (isAttacking.current) {
            attackTime.current += delta;
            const progress = Math.min(attackTime.current / ATTACK_DURATION, 1);
            if (isFluffy && fluffyHeadRef.current) {
                const thrustAngle = Math.sin(progress * Math.PI) * 0.8;
                const swingAngle = Math.sin(progress * Math.PI * 2) * 0.4;
                fluffyHeadRef.current.rotation.x = -thrustAngle;
                fluffyHeadRef.current.rotation.z = swingAngle;
                if (progress >= 1) { isAttacking.current = false; fluffyHeadRef.current.rotation.x = 0; fluffyHeadRef.current.rotation.z = 0; }
            } else if (!isFluffy && swordRef.current) {
                const swingAngle = Math.sin(progress * Math.PI) * 2;
                swordRef.current.rotation.x = swingAngle;
                if (progress >= 1) { isAttacking.current = false; swordRef.current.rotation.x = 0; }
            } else if (progress >= 1) { isAttacking.current = false; }
        }
    });

    useEffect(() => { if (group.current) group.current.position.copy(positionRef.current); }, [positionRef]);

    if (isFluffy) return <group ref={group} position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]} rotation={[0, Math.PI, 0]}>{clonedFluffyScene && <primitive object={clonedFluffyScene} scale={7.5} rotation={[0, -Math.PI / 2, 0]} />}</group>;
    if (isLobster) return <group ref={group} position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]} rotation={[0, Math.PI, 0]}>{clonedLobsterScene && <primitive object={clonedLobsterScene} scale={7.5} rotation={[0, -Math.PI / 2, 0]} />}<pointLight position={[0, 1.5, 0]} color="#ff6b35" intensity={3} distance={15} decay={2} /></group>;
    if (dSpecialModelPath && dClonedSpecialScene && dSpecialTransform) {
        return (
            <group ref={group} position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]} rotation={[0, Math.PI, 0]}>
                <primitive
                    object={dClonedSpecialScene}
                    scale={dSpecialTransform.scale}
                    rotation={[0, dSpecialTransform.rotationY, 0]}
                    position={[dSpecialTransform.x, dSpecialTransform.y, dSpecialTransform.z]}
                />
            </group>
        );
    }
    return (
        <group ref={group} position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]} rotation={[0, Math.PI, 0]}>
            {clonedDeathvaderScene && <primitive object={clonedDeathvaderScene} scale={2.5} rotation={[0, -Math.PI / 2, 0]} />}
            <group position={[0.6, 1.2, 0]} ref={swordRef}>
                <pointLight position={[0, 0.7, 0.3]} color="#60A5FA" intensity={1.5} distance={6} decay={2} />
                <mesh position={[0, 0.7, 0.3]} rotation={[0, Math.PI/4, 0]} castShadow><coneGeometry args={[0.12, 1.6, 4]} /><meshStandardMaterial color="#a5d8ff" emissive="#60A5FA" emissiveIntensity={0.6} metalness={0.9} roughness={0.1} /></mesh>
            </group>
        </group>
    );
};

// --- CAVE PLAYER COMPONENT (uses cave collision) ---
const CavePlayer = ({ controlsRef, onAttack, positionRef, characterVariant = 'black', onPositionUpdate }: {
    controlsRef: React.MutableRefObject<Controls>,
    onAttack: () => void,
    positionRef: React.MutableRefObject<THREE.Vector3>,
    characterVariant?: CharacterVariant,
    onPositionUpdate?: (x: number, y: number, z: number, rotation: number) => void
}) => {
    const group = useRef<THREE.Group>(null);
    const swordRef = useRef<THREE.Group>(null);
    const fluffyHeadRef = useRef<THREE.Group>(null);
    const isAttacking = useRef(false);
    const attackTime = useRef(0);
    const { camera, gl } = useThree();
    
    // Camera orbit controls (mouse drag to rotate view)
    const cameraOrbitRef = useRef(0); // Horizontal orbit angle offset
    const cameraVerticalRef = useRef(0); // Vertical orbit angle offset
    const isDraggingRef = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    
    // Mouse event handlers for camera orbit
    useEffect(() => {
        const canvas = gl.domElement;
        
        const handleMouseDown = (e: MouseEvent) => {
            isDraggingRef.current = true;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        };
        
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            
            const deltaX = e.clientX - lastMousePos.current.x;
            const deltaY = e.clientY - lastMousePos.current.y;
            
            // Adjust orbit based on mouse movement (sensitivity factor)
            const sensitivity = 0.005;
            cameraOrbitRef.current -= deltaX * sensitivity;
            cameraVerticalRef.current += deltaY * sensitivity;
            
            // Clamp vertical angle to prevent flipping
            cameraVerticalRef.current = Math.max(-0.5, Math.min(0.8, cameraVerticalRef.current));
            
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        };
        
        const handleMouseUp = () => {
            isDraggingRef.current = false;
            canvas.style.cursor = 'grab';
        };
        
        const handleMouseLeave = () => {
            isDraggingRef.current = false;
            canvas.style.cursor = 'grab';
        };
        
        // Set initial cursor style
        canvas.style.cursor = 'grab';
        
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        
        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
            canvas.style.cursor = 'default';
        };
    }, [gl]);
    
    const isFluffy = characterVariant === 'fluffy';
    const isLobster = characterVariant === 'lobster';
    const cIsTarantula = characterVariant === 'tarantula';
    const cIsScorpion = characterVariant === 'scorpion' || characterVariant === 'blackScorpion';
    const cSpecialModelPath = useMemo(() => {
        if (characterVariant === 'tarantula') return '/models/theraphosa-blondi/source/hi-fi-spider.glb';
        if (characterVariant === 'scorpion' || characterVariant === 'blackScorpion') return '/models/scorpion.glb';
        return null;
    }, [characterVariant]);

    const { scene: deathvaderScene } = useGLTF('/models/deathvader-optimized.glb');
    const { scene: fluffyScene } = useGLTF('/models/fluffy unicorn.glb');
    const { scene: lobsterScene } = useGLTF('/models/super lobster.glb');
    const { scene: cSpecialScene, animations: cSpecialAnimations } = useGLTF(cSpecialModelPath ?? '/models/deathvader-optimized.glb');
    
    const cloakColor = useMemo(() => {
        const config = CHARACTER_CONFIGS.find(c => c.id === characterVariant);
        return config?.cloakColor || '#1a1a1a';
    }, [characterVariant]);

    const clonedDeathvaderScene = useMemo(() => {
        if (isFluffy || isLobster || cSpecialModelPath) return null;
        
        const clone = deathvaderScene.clone();
        const cloakColorObj = new THREE.Color(cloakColor);
        
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                const applyColorToMaterial = (mat: THREE.Material): THREE.Material => {
                    const clonedMat = mat.clone();
                    
                    if (clonedMat instanceof THREE.MeshStandardMaterial || 
                        clonedMat instanceof THREE.MeshBasicMaterial ||
                        clonedMat instanceof THREE.MeshPhongMaterial ||
                        clonedMat instanceof THREE.MeshLambertMaterial) {
                        
                        const originalColor = clonedMat.color;
                        const luminance = 0.299 * originalColor.r + 0.587 * originalColor.g + 0.114 * originalColor.b;
                        
                        if (luminance < 0.5) {
                            clonedMat.color = cloakColorObj.clone();
                        }
                    }
                    return clonedMat;
                };
                
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material = mesh.material.map(applyColorToMaterial);
                    } else {
                        mesh.material = applyColorToMaterial(mesh.material);
                    }
                }
            }
        });
        return clone;
    }, [deathvaderScene, cloakColor, isFluffy, isLobster, cSpecialModelPath]);

    const clonedFluffyScene = useMemo(() => {
        if (!isFluffy) return null;
        
        const clone = fluffyScene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        return clone;
    }, [fluffyScene, isFluffy]);

    // Clone Super Lobster scene with glowing effect for cave
    const clonedLobsterScene = useMemo(() => {
        if (!isLobster) return null;
        
        const clone = lobsterScene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                // Apply subtle glowing emissive material to the lobster
                const applyGlowToMaterial = (mat: THREE.Material): THREE.Material => {
                    const clonedMat = mat.clone();
                    
                    if (clonedMat instanceof THREE.MeshStandardMaterial) {
                        // Make the lobster glow with a subtle warm orange-red emanation
                        clonedMat.emissive = new THREE.Color('#ff4500');
                        clonedMat.emissiveIntensity = 0.04;
                    } else if (clonedMat instanceof THREE.MeshBasicMaterial ||
                               clonedMat instanceof THREE.MeshPhongMaterial ||
                               clonedMat instanceof THREE.MeshLambertMaterial) {
                        // Convert to MeshStandardMaterial for emissive support
                        const stdMat = new THREE.MeshStandardMaterial({
                            color: clonedMat.color,
                            emissive: new THREE.Color('#ff4500'),
                            emissiveIntensity: 0.04,
                        });
                        return stdMat;
                    }
                    return clonedMat;
                };
                
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material = mesh.material.map(applyGlowToMaterial);
                    } else {
                        mesh.material = applyGlowToMaterial(mesh.material);
                    }
                }
            }
        });
        return clone;
    }, [lobsterScene, isLobster]);

    const cClonedSpecialScene = useMemo(() => {
        if (!cSpecialModelPath) return null;
        const clone = skeletonClone(cSpecialScene) as THREE.Group;
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                if (characterVariant === 'blackScorpion') desaturateMesh(mesh);
            }
        });
        return clone;
    }, [cSpecialScene, cSpecialModelPath, characterVariant]);

    const cSpecialTransform = useMemo(() => {
        if (!cClonedSpecialScene) return null;
        const box = new THREE.Box3().setFromObject(cClonedSpecialScene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const maxDimension = Math.max(size.x, size.y, size.z) || 1;
        const scale = 7.5 / maxDimension;
        let yOffset = -box.min.y * scale;
        if (cIsScorpion) yOffset -= 3.0;
        return {
            scale,
            x: -center.x * scale,
            y: yOffset,
            z: -center.z * scale,
            rotationY: (cIsTarantula || cIsScorpion) ? 0 : -Math.PI / 2
        };
    }, [cClonedSpecialScene, cIsTarantula, cIsScorpion]);

    // Tarantula locomotion animation for cave
    const updateCaveTarantulaAnim = useTarantulaAnimation(
        cIsTarantula, cSpecialAnimations, cClonedSpecialScene, controlsRef
    );

    // Scorpion multi-state animation for cave
    const updateCaveScorpionAnim = useScorpionAnimation(
        cIsScorpion, cSpecialAnimations, cClonedSpecialScene, controlsRef
    );

    const SPEED = 10;
    const ROTATION_SPEED = 2.5;
    const ATTACK_DURATION = 0.25;

    // Reusable vectors for CavePlayer
    const _cForward = useRef(new THREE.Vector3());
    const _cCamOffset = useRef(new THREE.Vector3());
    const _cTargetCam = useRef(new THREE.Vector3());
    const _cLookTarget = useRef(new THREE.Vector3());

    useFrame((state, delta) => {
        if (!group.current) return;
        updateCaveTarantulaAnim(delta);
        updateCaveScorpionAnim(delta);

        const { up, down, left, right, attack } = controlsRef.current;
        
        if (left) group.current.rotation.y += ROTATION_SPEED * delta;
        if (right) group.current.rotation.y -= ROTATION_SPEED * delta;

        const forward = _cForward.current.set(0, 0, 1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, group.current.rotation.y);

        const speed = SPEED * delta;
        const curX = group.current.position.x;
        const curZ = group.current.position.z;
        
        if (up) {
            const newX = curX + forward.x * speed;
            const newZ = curZ + forward.z * speed;

            if (!checkCaveCollision(newX, newZ)) {
                group.current.position.x = newX;
                group.current.position.z = newZ;
            } else {
                if (!checkCaveCollision(newX, curZ)) {
                    group.current.position.x = newX;
                } else if (!checkCaveCollision(curX, newZ)) {
                    group.current.position.z = newZ;
                }
            }
        }
        
        if (down) {
            const backSpeed = -speed * 0.6;
            const newX = curX + forward.x * backSpeed;
            const newZ = curZ + forward.z * backSpeed;

            if (!checkCaveCollision(newX, newZ)) {
                group.current.position.x = newX;
                group.current.position.z = newZ;
            } else {
                if (!checkCaveCollision(newX, curZ)) {
                    group.current.position.x = newX;
                } else if (!checkCaveCollision(curX, newZ)) {
                    group.current.position.z = newZ;
                }
            }
        }

        group.current.position.y = 0;

        positionRef.current.copy(group.current.position);

        onPositionUpdate?.(
            group.current.position.x,
            group.current.position.y,
            group.current.position.z,
            group.current.rotation.y
        );

        const dist = 12;
        const baseHeight = 5.5;
        
        const orbitAngle = group.current.rotation.y + cameraOrbitRef.current;
        const verticalAngle = cameraVerticalRef.current;
        
        const height = baseHeight + Math.sin(verticalAngle) * 8;
        const horizontalDist = dist * Math.cos(verticalAngle * 0.5);
        
        _cCamOffset.current.set(
            -Math.sin(orbitAngle) * horizontalDist,
            height,
            -Math.cos(orbitAngle) * horizontalDist
        );
        _cTargetCam.current.copy(group.current.position).add(_cCamOffset.current);
        
        camera.position.lerp(_cTargetCam.current, 0.1);
        
        _cLookTarget.current.set(group.current.position.x, group.current.position.y + 2, group.current.position.z);
        camera.lookAt(_cLookTarget.current);

        if (attack && !isAttacking.current) {
            isAttacking.current = true;
            attackTime.current = 0;
            playSound('swing');
            onAttack();
        }

        if (isAttacking.current) {
            attackTime.current += delta;
            const progress = Math.min(attackTime.current / ATTACK_DURATION, 1);
            
            if (isFluffy && fluffyHeadRef.current) {
                const thrustAngle = Math.sin(progress * Math.PI) * 0.8;
                const swingAngle = Math.sin(progress * Math.PI * 2) * 0.4;
                fluffyHeadRef.current.rotation.x = -thrustAngle;
                fluffyHeadRef.current.rotation.z = swingAngle;
                
                if (progress >= 1) {
                    isAttacking.current = false;
                    fluffyHeadRef.current.rotation.x = 0;
                    fluffyHeadRef.current.rotation.z = 0;
                }
            } else if (!isFluffy && swordRef.current) {
                const swingAngle = Math.sin(progress * Math.PI) * 2;
                swordRef.current.rotation.x = swingAngle;

                if (progress >= 1) {
                    isAttacking.current = false;
                    swordRef.current.rotation.x = 0;
                }
            } else if (progress >= 1) {
                isAttacking.current = false;
            }
        }
    });

    useEffect(() => {
        if (group.current) {
            group.current.position.copy(positionRef.current);
        }
    }, [positionRef]);

    if (isFluffy) {
        return (
            <group ref={group} position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]} rotation={[0, Math.PI, 0]}>
                {clonedFluffyScene && <primitive object={clonedFluffyScene} scale={7.5} rotation={[0, -Math.PI / 2, 0]} />}
            </group>
        );
    }

    if (isLobster) {
        return (
            <group ref={group} position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]} rotation={[0, Math.PI, 0]}>
                {clonedLobsterScene && <primitive object={clonedLobsterScene} scale={7.5} rotation={[0, -Math.PI / 2, 0]} />}
                
                {/* Glowing light emanating from the lobster body */}
                <pointLight
                    position={[0, 1.5, 0]}
                    color="#ff6b35"
                    intensity={3}
                    distance={15}
                    decay={2}
                />
                {/* Secondary subtle glow for ambient effect */}
                <pointLight
                    position={[0, 0.5, 0]}
                    color="#ff4500"
                    intensity={1.5}
                    distance={8}
                    decay={2}
                />
                
                {/* Big Flashlight for the Lobster in the Cave - positioned in claw gap, pointing forward */}
                <group position={[-1.2, 0.8, 1.0]} rotation={[Math.PI / 2, 0, 0]}>
                    {/* Flashlight body - large industrial style (now horizontal, pointing forward) */}
                    <mesh castShadow>
                        <cylinderGeometry args={[0.25, 0.35, 1.2, 12]} />
                        <meshStandardMaterial 
                            color="#2a2a2a" 
                            metalness={0.8} 
                            roughness={0.3} 
                        />
                    </mesh>
                    
                    {/* Flashlight head (lens housing) - at front end */}
                    <mesh position={[0, 0.7, 0]} castShadow>
                        <cylinderGeometry args={[0.45, 0.25, 0.4, 16]} />
                        <meshStandardMaterial 
                            color="#1a1a1a" 
                            metalness={0.9} 
                            roughness={0.2} 
                        />
                    </mesh>
                    
                    {/* Flashlight lens (glowing) - facing forward */}
                    <mesh position={[0, 0.92, 0]} rotation={[0, 0, 0]}>
                        <circleGeometry args={[0.42, 16]} />
                        <meshStandardMaterial 
                            color="#ffffee"
                            emissive="#ffff99"
                            emissiveIntensity={2}
                            transparent
                            opacity={0.9}
                        />
                    </mesh>
                    
                    {/* Grip rings on flashlight body */}
                    {[-0.3, -0.1, 0.1].map((y, i) => (
                        <mesh key={i} position={[0, y, 0]}>
                            <torusGeometry args={[0.32, 0.03, 8, 16]} />
                            <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.4} />
                        </mesh>
                    ))}
                    
                    {/* Back cap of flashlight */}
                    <mesh position={[0, -0.6, 0]} rotation={[Math.PI, 0, 0]}>
                        <sphereGeometry args={[0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                        <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
                    </mesh>
                    
                    {/* Main flashlight beam - powerful spotlight pointing forward (no shadow for perf) */}
                    <spotLight
                        position={[0, 1.0, 0]}
                        target-position={[0, 80, 0]}
                        color="#fffde0"
                        intensity={100}
                        angle={0.4}
                        penumbra={0.2}
                        distance={80}
                        decay={1.2}
                        castShadow={false}
                    />
                    
                    {/* Secondary fill light for immediate area */}
                    <pointLight
                        position={[0, 1.2, 0]}
                        color="#ffffcc"
                        intensity={4}
                        distance={12}
                        decay={2}
                    />
                </group>
            </group>
        );
    }

    if (cSpecialModelPath && cClonedSpecialScene && cSpecialTransform) {
        return (
            <group ref={group} position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]} rotation={[0, Math.PI, 0]}>
                <primitive
                    object={cClonedSpecialScene}
                    scale={cSpecialTransform.scale}
                    rotation={[0, cSpecialTransform.rotationY, 0]}
                    position={[cSpecialTransform.x, cSpecialTransform.y, cSpecialTransform.z]}
                />
            </group>
        );
    }

    return (
        <group ref={group} position={[positionRef.current.x, positionRef.current.y, positionRef.current.z]} rotation={[0, Math.PI, 0]}>
            {clonedDeathvaderScene && <primitive object={clonedDeathvaderScene} scale={2.5} rotation={[0, -Math.PI / 2, 0]} />}
            
            <group position={[0.6, 1.2, 0]} ref={swordRef}>
                <pointLight 
                    position={[0, 0.7, 0.3]}
                    color="#60A5FA" 
                    intensity={1.5} 
                    distance={6}
                    decay={2}
                />
                
                <mesh position={[0, 0.7, 0.3]} rotation={[0, Math.PI/4, 0]} castShadow>
                    <coneGeometry args={[0.12, 1.6, 4]} />
                    <meshStandardMaterial 
                        color="#a5d8ff"
                        emissive="#60A5FA"
                        emissiveIntensity={0.6}
                        metalness={0.9} 
                        roughness={0.1} 
                    />
                </mesh>
                
                <mesh position={[0, 0.7, 0.3]} rotation={[0, Math.PI/4, 0]} scale={[0.6, 0.9, 0.6]}>
                    <coneGeometry args={[0.12, 1.6, 4]} />
                    <meshBasicMaterial 
                        color="#93C5FD"
                        transparent
                        opacity={0.4}
                    />
                </mesh>
                
                <mesh position={[0, -0.3, 0.3]}>
                    <cylinderGeometry args={[0.08, 0.08, 0.4]} />
                    <meshStandardMaterial color="#78350f" />
                </mesh>
                <mesh position={[0, -0.1, 0.3]} rotation={[Math.PI/2, 0, 0]}>
                    <boxGeometry args={[0.4, 0.1, 0.1]} />
                    <meshStandardMaterial 
                        color="#fcd34d" 
                        emissive="#fcd34d"
                        emissiveIntensity={0.3}
                    />
                </mesh>
            </group>
        </group>
    );
};

// --- PARTICLES SYSTEM ---
const Particles = ({ particles }: { particles: { pos: THREE.Vector3, color: string, id: string }[] }) => {
    return (
        <group>
            {particles.map(p => (
                <ParticleBurst key={p.id} position={p.pos} color={p.color} />
            ))}
        </group>
    );
};

const ParticleBurst = ({ position, color }: { position: THREE.Vector3, color: string }) => {
    const pointsRef = useRef<THREE.Points>(null);
    const velocitiesRef = useRef<THREE.Vector3[]>([]);
    const scaleRef = useRef(1);

    const { positions, velocities } = useMemo(() => {
        const count = 40;
        const positions = new Float32Array(count * 3);
        const velocities: THREE.Vector3[] = [];
        
        for (let i = 0; i < count; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            
            const vel = new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).normalize().multiplyScalar(Math.random() * 2 + 1);
            velocities.push(vel);
        }
        
        return { positions, velocities };
    }, []);

    useEffect(() => {
        velocitiesRef.current = velocities;
        scaleRef.current = 1;
    }, [velocities]);

    useFrame((state, delta) => {
        if (!pointsRef.current) return;
        
        const geometry = pointsRef.current.geometry;
        const posAttr = geometry.attributes.position as THREE.BufferAttribute;
        const vels = velocitiesRef.current;
        
        for (let i = 0; i < vels.length; i++) {
            posAttr.array[i * 3] += vels[i].x * delta * 5;
            posAttr.array[i * 3 + 1] += vels[i].y * delta * 5;
            posAttr.array[i * 3 + 2] += vels[i].z * delta * 5;
        }
        posAttr.needsUpdate = true;
        
        scaleRef.current *= 0.92;
        const material = pointsRef.current.material as THREE.PointsMaterial;
        material.size = 0.3 * scaleRef.current;
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
                color={color} 
                size={0.3} 
                sizeAttenuation={true}
                transparent
                opacity={0.9}
            />
        </points>
    );
};

// --- LOADING STATE ---
type LoadingState = 'ready' | 'loading';

// --- MAIN GAME COMPONENT ---
const Game3D: React.FC<GameProps> = ({ isPlaying, controlsRef, onScoreUpdate, onLoadingChange, selectedCharacter = 'black', selectedLevel = 'overworld' }) => {
    // Loading state management
    const [loadingState, setLoadingState] = useState<LoadingState>('ready');
    
    // Multiplayer context
    const {
        isConnected,
        isHost,
        remotePlayers,
        broadcastPosition,
        broadcastAttack,
        broadcastBalloonPop,
    } = useMultiplayer();
    
    // Handle multiplayer events
    useMultiplayerEvents({
        onBalloonPop: useCallback((event) => {
            // Remote player popped balloons - remove them locally
            const poppedIds = new Set(event.balloonIds);
            balloonsRef.current = balloonsRef.current.filter(b => !poppedIds.has(b.id));
        }, []),
    });

    // Notify parent of loading state changes
    useEffect(() => {
        onLoadingChange?.(loadingState === 'loading');
    }, [loadingState, onLoadingChange]);
    
    // Balloon physics data for overworld
    const balloonsRef = useRef<BalloonPhysics[]>([]);
    const [particles, setParticles] = useState<{ id: string, pos: THREE.Vector3, color: string }[]>([]);
    const [footprints, setFootprints] = useState<Footprint[]>([]);
    const hasClimbedPoopRef = useRef(false);
    const attackTriggerRef = useRef(0);

    // Set initial player position based on level
    const playerPos = useRef(new THREE.Vector3(
        selectedLevel === 'cave' ? 0 : 0,
        0,
        selectedLevel === 'cave' ? 0 : 8
    ));

    // Initialize balloons and reset game state
    useEffect(() => {
        if (isPlaying) {
            setFootprints([]);
            hasClimbedPoopRef.current = false;
            setLoadingState('ready');
            
            // Set initial player position based on level
            if (selectedLevel === 'cave') {
                playerPos.current.set(0, 0, 0);
            } else {
                playerPos.current.set(0, 0, 8);
            }

            // Initialize balloons for overworld only (quality-driven count)
            if (selectedLevel === 'overworld') {
                const quality = getQualitySettings();
                const newBalloons: BalloonPhysics[] = [];
                const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];
                const balloonCount = Math.min(750, Math.floor(750 * quality.densityMultiplier));
                for(let i=0; i<balloonCount; i++) {
                    let x = (Math.random()-0.5)*120;
                    let z = (Math.random()-0.5)*120;
                    if (Math.abs(x) < 12 && Math.abs(z) < 12) x += 20;

                    const baseY = 1.5 + Math.random() * 2;
                    newBalloons.push({
                        id: Math.random().toString(),
                        x,
                        y: baseY,
                        z,
                        vx: 0,
                        vy: 0,
                        vz: 0,
                        baseY,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        offset: Math.random() * 100
                    });
                }
                balloonsRef.current = newBalloons;
            } else {
                balloonsRef.current = [];
            }
        }
    }, [isPlaying, selectedLevel]);

    const handlePopEffect = (pos: THREE.Vector3, color: string) => {
        const id = Math.random().toString();
        setParticles(prev => [...prev, { id, pos, color }]);
        setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), 1000);
    };

    const handleFootprint = (x: number, z: number, rotation: number) => {
        const id = Math.random().toString();
        const newFootprint: Footprint = {
            id,
            x,
            z,
            rotation,
            opacity: 0.8,
            createdAt: Date.now()
        };
        
        setFootprints(prev => {
            const updated = [...prev, newFootprint];
            if (updated.length > 200) {
                return updated.slice(-200);
            }
            return updated;
        });
    };

    const handleAttack = useCallback(() => {
        // Increment attack trigger for level-specific hit detection
        attackTriggerRef.current++;

        // Broadcast attack to other players
        if (isConnected) {
            broadcastAttack(true);
            // Reset attack state after animation
            setTimeout(() => broadcastAttack(false), 250);
        }
        
        // Balloon popping only applies to overworld
        if (selectedLevel === 'overworld') {
            const swordPos = playerPos.current.clone();
            swordPos.y += 1;
            
            const RANGE = 4.0;
            let hits = 0;
            const poppedIds: string[] = [];

            const surviving: BalloonPhysics[] = [];
            for (const b of balloonsRef.current) {
                const bPos = new THREE.Vector3(b.x, b.y, b.z);
                if (bPos.distanceTo(swordPos) < RANGE) {
                    playSound('pop');
                    handlePopEffect(bPos, b.color);
                    hits++;
                    poppedIds.push(b.id);
                } else {
                    surviving.push(b);
                }
            }

            // Broadcast balloon pops to other players
            if (isConnected && poppedIds.length > 0) {
                broadcastBalloonPop(poppedIds);
            }

            if (surviving.length < 700) {
                const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];
                for(let k=0; k<3; k++) {
                    let x = (Math.random()-0.5)*120;
                    let z = (Math.random()-0.5)*120;
                    if (Math.abs(x) < 15 && Math.abs(z) < 15) x += 20;
                    
                    const baseY = 1.5 + Math.random() * 2;
                    surviving.push({
                        id: Math.random().toString(),
                        x,
                        y: baseY,
                        z,
                        vx: 0,
                        vy: 0,
                        vz: 0,
                        baseY,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        offset: Math.random() * 100
                    });
                }
            }

            balloonsRef.current = surviving;

            if (hits > 0) {
                onScoreUpdate(prev => prev + hits);
            }
        }
    }, [isConnected, broadcastAttack, broadcastBalloonPop, onScoreUpdate, selectedLevel]);

    // Show loading screen during transitions
    if (loadingState === 'loading') {
        return <LoadingScreen />;
    }

    // Convert remote players map to array for rendering
    const remotePlayerArray = useMemo(() => Array.from(remotePlayers.values()), [remotePlayers]);
    
    // Extract remote player positions for balloon collision
    const remotePlayerPositions = useMemo(() => 
        remotePlayerArray.map(p => p.currentPosition), 
        [remotePlayerArray]
    );

    // Dev perf monitor (set to true for debugging, false for production)
    const showPerfMonitor = false;

    // Render level based on selectedLevel prop
    if (selectedLevel === 'desert') {
        return (
            <Suspense fallback={<LoadingScreen />}>
                <DesertLevel
                    playerPosRef={playerPos}
                    onScoreUpdate={onScoreUpdate}
                    attackTriggerRef={attackTriggerRef}
                >
                    <DesertPlayer
                        controlsRef={controlsRef}
                        onAttack={handleAttack}
                        positionRef={playerPos}
                        characterVariant={selectedCharacter}
                        onPositionUpdate={isConnected ? broadcastPosition : undefined}
                    />

                    {/* Render remote players */}
                    {remotePlayerArray.map(player => (
                        <RemotePlayer key={player.id} player={player} />
                    ))}

                    <Particles particles={particles} />
                </DesertLevel>
            </Suspense>
        );
    }

    if (selectedLevel === 'cave') {
        return (
            <Suspense fallback={<LoadingScreen />}>
                <CaveLevel
                    playerPosRef={playerPos}
                    onExitCave={() => {}}
                    onScoreUpdate={onScoreUpdate}
                >
                    <CavePlayer
                        controlsRef={controlsRef}
                        onAttack={handleAttack}
                        positionRef={playerPos}
                        characterVariant={selectedCharacter}
                        onPositionUpdate={isConnected ? broadcastPosition : undefined}
                    />

                    {remotePlayerArray.map(player => (
                        <RemotePlayer key={player.id} player={player} />
                    ))}

                    <Particles particles={particles} />
                    <PerfMonitor show={showPerfMonitor} />
                </CaveLevel>
            </Suspense>
        );
    }

    // Render overworld with lazy loading
    return (
        <Suspense fallback={<LoadingScreen />}>
            <OverWorld
                playerPosRef={playerPos}
                balloonsRef={balloonsRef}
                footprints={footprints}
                remotePlayerPositions={remotePlayerPositions}
                onEnterCave={() => {}}
            >
                <Player
                    controlsRef={controlsRef}
                    onAttack={handleAttack}
                    positionRef={playerPos}
                    onFootprint={handleFootprint}
                    hasClimbedPoopRef={hasClimbedPoopRef}
                    characterVariant={selectedCharacter}
                    onPositionUpdate={isConnected ? broadcastPosition : undefined}
                />

                {remotePlayerArray.map(player => (
                    <RemotePlayer key={player.id} player={player} />
                ))}

                <Particles particles={particles} />
                <PerfMonitor show={showPerfMonitor} />
            </OverWorld>
        </Suspense>
    );
};

export default Game3D;

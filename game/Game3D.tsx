import React, { useRef, useState, useMemo, useEffect, useCallback, Suspense, lazy } from 'react';
import { useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Controls, GameProps, Level, CharacterVariant, CHARACTER_CONFIGS } from './types';
import { LoadingScreen } from './components/LoadingScreen';
import { useMultiplayer, useMultiplayerEvents } from './multiplayer';
import { RemotePlayer } from './components/RemotePlayer';

// Lazy load the world components
const OverWorld = lazy(() => import('./components/OverWorld'));
const CaveLevel = lazy(() => import('./components/CaveLevel'));

// Import types from OverWorld for balloon and footprint systems
import type { BalloonPhysics, Footprint } from './components/OverWorld';
import { checkOverworldCollision, getPoopPileHeight, PLAYER_RADIUS } from './components/OverWorld';
import { checkCaveCollision, MAIN_CAVERN_RADIUS } from './components/CaveLevel';

// Augment React's JSX namespace to include Three.js elements
declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
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

    // Load all character models
    const { scene: deathvaderScene } = useGLTF('/models/deathvader-optimized.glb');
    const { scene: fluffyScene } = useGLTF('/models/fluffy unicorn.glb');
    const { scene: lobsterScene } = useGLTF('/models/super lobster.glb');
    
    // Get cloak color from character config
    const cloakColor = useMemo(() => {
        const config = CHARACTER_CONFIGS.find(c => c.id === characterVariant);
        return config?.cloakColor || '#1a1a1a';
    }, [characterVariant]);

    // Clone DeathVader scene with cloak color
    const clonedDeathvaderScene = useMemo(() => {
        if (isFluffy || isLobster) return null;
        
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
    }, [deathvaderScene, cloakColor, isFluffy, isLobster]);

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
                
                // Apply glowing emissive material to the lobster
                const applyGlowToMaterial = (mat: THREE.Material): THREE.Material => {
                    const clonedMat = mat.clone();
                    
                    if (clonedMat instanceof THREE.MeshStandardMaterial) {
                        // Make the lobster glow with a warm orange-red emanation
                        clonedMat.emissive = new THREE.Color('#ff4500');
                        clonedMat.emissiveIntensity = 0.4;
                    } else if (clonedMat instanceof THREE.MeshBasicMaterial ||
                               clonedMat instanceof THREE.MeshPhongMaterial ||
                               clonedMat instanceof THREE.MeshLambertMaterial) {
                        // Convert to MeshStandardMaterial for emissive support
                        const stdMat = new THREE.MeshStandardMaterial({
                            color: clonedMat.color,
                            emissive: new THREE.Color('#ff4500'),
                            emissiveIntensity: 0.4,
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

    const SPEED = 10;
    const ROTATION_SPEED = 2.5;
    const ATTACK_DURATION = 0.25;
    const FOOTPRINT_INTERVAL = 0.25;
    const POOP_TOP_THRESHOLD = 6.0;

    useFrame((state, delta) => {
        if (!group.current) return;

        const { up, down, left, right, attack } = controlsRef.current;
        
        if (left) group.current.rotation.y += ROTATION_SPEED * delta;
        if (right) group.current.rotation.y -= ROTATION_SPEED * delta;

        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), group.current.rotation.y);

        const speed = SPEED * delta;
        const currentPos = group.current.position.clone();
        const isMoving = up || down;
        
        if (up) {
            const movement = forward.clone().multiplyScalar(speed);
            const newX = currentPos.x + movement.x;
            const newZ = currentPos.z + movement.z;

            if (!checkOverworldCollision(newX, newZ)) {
                group.current.position.x = newX;
                group.current.position.z = newZ;
            } else {
                if (!checkOverworldCollision(newX, currentPos.z)) {
                    group.current.position.x = newX;
                } else if (!checkOverworldCollision(currentPos.x, newZ)) {
                    group.current.position.z = newZ;
                }
            }
        }
        
        if (down) {
            const movement = forward.clone().multiplyScalar(-speed * 0.6);
            const newX = currentPos.x + movement.x;
            const newZ = currentPos.z + movement.z;

            if (!checkOverworldCollision(newX, newZ)) {
                group.current.position.x = newX;
                group.current.position.z = newZ;
            } else {
                if (!checkOverworldCollision(newX, currentPos.z)) {
                    group.current.position.x = newX;
                } else if (!checkOverworldCollision(currentPos.x, newZ)) {
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
                const perpendicular = new THREE.Vector3(-forward.z, 0, forward.x);
                const footX = group.current.position.x + perpendicular.x * sideOffset;
                const footZ = group.current.position.z + perpendicular.z * sideOffset;
                
                onFootprint(footX, footZ, group.current.rotation.y);
                footprintSide.current = 1 - footprintSide.current;
            }
        }

        positionRef.current.copy(group.current.position);

        // Broadcast position to multiplayer (throttled in the context)
        onPositionUpdate?.(
            group.current.position.x,
            group.current.position.y,
            group.current.position.z,
            group.current.rotation.y
        );

        const dist = 12;
        const baseHeight = 5.5;
        
        // Apply camera orbit offset to the camera position
        // Rotate the camera offset around the player based on mouse drag
        const orbitAngle = group.current.rotation.y + cameraOrbitRef.current;
        const verticalAngle = cameraVerticalRef.current;
        
        // Calculate camera position with orbit
        const height = baseHeight + Math.sin(verticalAngle) * 8;
        const horizontalDist = dist * Math.cos(verticalAngle * 0.5);
        
        const camOffset = new THREE.Vector3(
            -Math.sin(orbitAngle) * horizontalDist,
            height,
            -Math.cos(orbitAngle) * horizontalDist
        );
        const targetCamPos = group.current.position.clone().add(camOffset);
        
        camera.position.lerp(targetCamPos, 0.1);
        
        const lookTarget = group.current.position.clone().add(new THREE.Vector3(0, 2, 0));
        camera.lookAt(lookTarget);

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
            } else if (!isFluffy && swordRef.current) {
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
                
                {/* Glowing light emanating from the lobster */}
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

    const { scene: deathvaderScene } = useGLTF('/models/deathvader-optimized.glb');
    const { scene: fluffyScene } = useGLTF('/models/fluffy unicorn.glb');
    const { scene: lobsterScene } = useGLTF('/models/super lobster.glb');
    
    const cloakColor = useMemo(() => {
        const config = CHARACTER_CONFIGS.find(c => c.id === characterVariant);
        return config?.cloakColor || '#1a1a1a';
    }, [characterVariant]);

    const clonedDeathvaderScene = useMemo(() => {
        if (isFluffy || isLobster) return null;
        
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
    }, [deathvaderScene, cloakColor, isFluffy, isLobster]);

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
                
                // Apply glowing emissive material to the lobster
                const applyGlowToMaterial = (mat: THREE.Material): THREE.Material => {
                    const clonedMat = mat.clone();
                    
                    if (clonedMat instanceof THREE.MeshStandardMaterial) {
                        // Make the lobster glow with a warm orange-red emanation
                        clonedMat.emissive = new THREE.Color('#ff4500');
                        clonedMat.emissiveIntensity = 0.4;
                    } else if (clonedMat instanceof THREE.MeshBasicMaterial ||
                               clonedMat instanceof THREE.MeshPhongMaterial ||
                               clonedMat instanceof THREE.MeshLambertMaterial) {
                        // Convert to MeshStandardMaterial for emissive support
                        const stdMat = new THREE.MeshStandardMaterial({
                            color: clonedMat.color,
                            emissive: new THREE.Color('#ff4500'),
                            emissiveIntensity: 0.4,
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

    const SPEED = 10;
    const ROTATION_SPEED = 2.5;
    const ATTACK_DURATION = 0.25;

    useFrame((state, delta) => {
        if (!group.current) return;

        const { up, down, left, right, attack } = controlsRef.current;
        
        if (left) group.current.rotation.y += ROTATION_SPEED * delta;
        if (right) group.current.rotation.y -= ROTATION_SPEED * delta;

        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), group.current.rotation.y);

        const speed = SPEED * delta;
        const currentPos = group.current.position.clone();
        
        if (up) {
            const movement = forward.clone().multiplyScalar(speed);
            const newX = currentPos.x + movement.x;
            const newZ = currentPos.z + movement.z;

            // Use cave collision instead of overworld
            if (!checkCaveCollision(newX, newZ)) {
                group.current.position.x = newX;
                group.current.position.z = newZ;
            } else {
                if (!checkCaveCollision(newX, currentPos.z)) {
                    group.current.position.x = newX;
                } else if (!checkCaveCollision(currentPos.x, newZ)) {
                    group.current.position.z = newZ;
                }
            }
        }
        
        if (down) {
            const movement = forward.clone().multiplyScalar(-speed * 0.6);
            const newX = currentPos.x + movement.x;
            const newZ = currentPos.z + movement.z;

            if (!checkCaveCollision(newX, newZ)) {
                group.current.position.x = newX;
                group.current.position.z = newZ;
            } else {
                if (!checkCaveCollision(newX, currentPos.z)) {
                    group.current.position.x = newX;
                } else if (!checkCaveCollision(currentPos.x, newZ)) {
                    group.current.position.z = newZ;
                }
            }
        }

        // Cave has flat floor
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
        
        // Apply camera orbit offset to the camera position
        // Rotate the camera offset around the player based on mouse drag
        const orbitAngle = group.current.rotation.y + cameraOrbitRef.current;
        const verticalAngle = cameraVerticalRef.current;
        
        // Calculate camera position with orbit
        const height = baseHeight + Math.sin(verticalAngle) * 8;
        const horizontalDist = dist * Math.cos(verticalAngle * 0.5);
        
        const camOffset = new THREE.Vector3(
            -Math.sin(orbitAngle) * horizontalDist,
            height,
            -Math.cos(orbitAngle) * horizontalDist
        );
        const targetCamPos = group.current.position.clone().add(camOffset);
        
        camera.position.lerp(targetCamPos, 0.1);
        
        const lookTarget = group.current.position.clone().add(new THREE.Vector3(0, 2, 0));
        camera.lookAt(lookTarget);

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
                    
                    {/* Main flashlight beam - powerful spotlight pointing forward (10+ body lengths ahead) */}
                    <spotLight
                        position={[0, 1.0, 0]}
                        target-position={[0, 80, 0]}
                        color="#fffde0"
                        intensity={100}
                        angle={0.4}
                        penumbra={0.2}
                        distance={80}
                        decay={1.2}
                        castShadow
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

            // Initialize balloons for overworld
            const newBalloons: BalloonPhysics[] = [];
            const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];
            for(let i=0; i<750; i++) {
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
        // Broadcast attack to other players
        if (isConnected) {
            broadcastAttack(true);
            // Reset attack state after animation
            setTimeout(() => broadcastAttack(false), 250);
        }
        
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
    }, [isConnected, broadcastAttack, broadcastBalloonPop, onScoreUpdate]);

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

    // Render level based on selectedLevel prop
    if (selectedLevel === 'cave') {
        return (
            <Suspense fallback={<LoadingScreen />}>
                <CaveLevel
                    playerPosRef={playerPos}
                    onExitCave={() => {}} // No-op - cave is a standalone level
                    onScoreUpdate={onScoreUpdate}
                >
                    <CavePlayer
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
                onEnterCave={() => {}} // No-op - door is decorative in overworld
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

                {/* Render remote players */}
                {remotePlayerArray.map(player => (
                    <RemotePlayer key={player.id} player={player} />
                ))}

                <Particles particles={particles} />
            </OverWorld>
        </Suspense>
    );
};

export default Game3D;

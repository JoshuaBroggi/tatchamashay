import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CharacterVariant, CHARACTER_CONFIGS } from '../types';

interface CharacterPreviewProps {
    variant: CharacterVariant;
    isSelected: boolean;
}

// --- FLUFFY UNICORN PREVIEW MODEL (GLB) ---
const FluffyPreviewModel: React.FC<{ scale: number; isSelected: boolean }> = ({ scale, isSelected }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { scene } = useGLTF('/models/fluffy unicorn.glb');
    
    // Clone the scene and set up shadows
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
    
    // Rotate the character 360 degrees continuously
    useFrame((state, delta) => {
        if (groupRef.current) {
            // Full rotation every 8 seconds
            groupRef.current.rotation.y += delta * (Math.PI / 4);
        }
    });
    
    return (
        <group ref={groupRef}>
            <primitive 
                object={clonedScene} 
                scale={isSelected ? 2.8 : 2.2} 
                rotation={[0, -Math.PI / 2, 0]}
                position={[0, -1.5, 0]}
            />
        </group>
    );
};

// --- SUPER LOBSTER PREVIEW MODEL (GLB) with glowing effect ---
const LobsterPreviewModel: React.FC<{ scale: number; isSelected: boolean }> = ({ scale, isSelected }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { scene } = useGLTF('/models/super lobster.glb');
    
    // Clone the scene and set up shadows with glowing emissive materials
    const clonedScene = useMemo(() => {
        const clone = scene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                // Apply glowing emissive material to the lobster
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
    }, [scene]);
    
    // Rotate the character 360 degrees continuously
    useFrame((state, delta) => {
        if (groupRef.current) {
            // Full rotation every 8 seconds
            groupRef.current.rotation.y += delta * (Math.PI / 4);
        }
    });
    
    return (
        <group ref={groupRef}>
            <primitive 
                object={clonedScene} 
                scale={isSelected ? 2.8 : 2.2} 
                rotation={[0, -Math.PI / 2, 0]}
                position={[0, -1.5, 0]}
            />
            {/* Subtle glowing light emanating from the lobster */}
            <pointLight
                position={[0, 0, 0]}
                color="#ff6b35"
                intensity={0.2}
                distance={10}
                decay={2}
            />
        </group>
    );
};

// --- RIGGED T-REX PREVIEW MODEL (GLB) ---
const TrexPreviewModel: React.FC<{ isSelected: boolean }> = ({ isSelected }) => {
    const { scene, animations } = useGLTF('/models/rigged-t-rex-fabulous/source/rigged_t-rex_fabulous.glb');

    // Use SkeletonUtils clone so skinned meshes/rig animations behave correctly.
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
    const { actions } = useAnimations(animations, clonedScene);

    // Normalize the T-Rex height to match Fluffy's preview height.
    // Force-update world matrices first: after skeletonClone the bone world
    // matrices are stale (identity), which causes SkinnedMesh.computeBoundingBox
    // to produce incorrect bounds. Updating fixes the bone chain so Box3 is accurate.
    const { previewScale, xOffset, yOffset, zOffset } = useMemo(() => {
        clonedScene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(clonedScene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        // Match Fluffy's preview height: native 0.774 * preview scale
        const fluffyPreviewHeight = 0.774 * (isSelected ? 2.8 : 2.2);
        const previewScale = fluffyPreviewHeight / size.y;
        const xOffset = -center.x * previewScale;
        const yOffset = -box.min.y * previewScale - 1.5;
        const zOffset = -center.z * previewScale - 2.2;
        return { previewScale, xOffset, yOffset, zOffset };
    }, [clonedScene, isSelected]);

    // Play embedded clip from the rigged GLB.
    useEffect(() => {
        const action = actions['CINEMA_4D_Main'] ?? Object.values(actions).find(Boolean);
        if (!action) return;
        action.reset();
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        action.timeScale = 1;
        action.fadeIn(0.2).play();
        return () => {
            action.fadeOut(0.2).stop();
        };
    }, [actions]);

    return (
        <group>
            <primitive
                object={clonedScene}
                scale={previewScale}
                rotation={[0, -Math.PI / 2, 0]}
                position={[xOffset, yOffset, zOffset]}
            />
        </group>
    );
};

const GenericAutoFitPreviewModel: React.FC<{
    modelPath: string;
    isSelected: boolean;
    targetSizeSelected?: number;
    targetSizeUnselected?: number;
    yBase?: number;
    zBase?: number;
    autoRotate?: boolean;
    desaturate?: boolean;
}> = ({
    modelPath,
    isSelected,
    targetSizeSelected = 3.4,
    targetSizeUnselected = 3.0,
    yBase = -1.5,
    zBase = -1.2,
    autoRotate = true,
    desaturate = false
}) => {
    const groupRef = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(modelPath);

    const clonedScene = useMemo(() => {
        // Preserve skeleton bindings for rigged/skinned models.
        const clone = skeletonClone(scene) as THREE.Group;
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                // Desaturate materials: remove colour but keep texture detail & PBR lighting
                if (desaturate) {
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
                            m.customProgramCacheKey = () => 'desaturated';
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
            }
        });
        return clone;
    }, [scene, desaturate]);
    const { actions } = useAnimations(animations, clonedScene);

    useEffect(() => {
        // Prefer the "Idle" clip when available (avoids playing "Area Attack" for scorpion)
        const action = actions['Idle'] ?? Object.values(actions).find(Boolean);
        if (!action) return;
        action.reset();
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        action.timeScale = 1;
        action.fadeIn(0.2).play();
        return () => {
            action.fadeOut(0.2).stop();
        };
    }, [actions]);

    const { previewScale, xOffset, yOffset, zOffset } = useMemo(() => {
        const box = new THREE.Box3().setFromObject(clonedScene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const maxDimension = Math.max(size.x, size.y, size.z) || 1;
        const targetSize = isSelected ? targetSizeSelected : targetSizeUnselected;
        const previewScale = targetSize / maxDimension;
        const xOffset = -center.x * previewScale;
        const yOffset = -box.min.y * previewScale + yBase;
        const zOffset = -center.z * previewScale + zBase;
        return { previewScale, xOffset, yOffset, zOffset };
    }, [clonedScene, isSelected, targetSizeSelected, targetSizeUnselected, yBase, zBase]);

    useFrame((state, delta) => {
        if (groupRef.current && autoRotate) {
            groupRef.current.rotation.y += delta * (Math.PI / 4);
        }
    });

    return (
        <group ref={groupRef}>
            <primitive
                object={clonedScene}
                scale={previewScale}
                rotation={[0, -Math.PI / 2, 0]}
                position={[xOffset, yOffset, zOffset]}
            />
        </group>
    );
};

// DeathVader character preview with rotation animation
const DeathVaderPreview: React.FC<{ isSelected: boolean; cloakColor: string }> = ({ isSelected, cloakColor }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { scene } = useGLTF('/models/deathvader-optimized.glb');
    
    // Clone the scene and apply cloak color to ALL dark/black materials
    const clonedScene = useMemo(() => {
        const clone = scene.clone();
        const cloakColorObj = new THREE.Color(cloakColor);
        
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                const applyColorToMaterial = (mat: THREE.Material): THREE.Material => {
                    const clonedMat = mat.clone();
                    
                    // Handle different material types
                    if (clonedMat instanceof THREE.MeshStandardMaterial || 
                        clonedMat instanceof THREE.MeshBasicMaterial ||
                        clonedMat instanceof THREE.MeshPhongMaterial ||
                        clonedMat instanceof THREE.MeshLambertMaterial) {
                        
                        const originalColor = clonedMat.color;
                        // Check if this is a dark/black material (likely cloak/robe)
                        const luminance = 0.299 * originalColor.r + 0.587 * originalColor.g + 0.114 * originalColor.b;
                        
                        // Apply to dark materials (cloak) - threshold 0.5 to catch more materials
                        if (luminance < 0.5) {
                            clonedMat.color = cloakColorObj.clone();
                        }
                    }
                    return clonedMat;
                };
                
                // Clone and modify materials
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
    }, [scene, cloakColor]);
    
    // Rotate the character 360 degrees continuously
    useFrame((state, delta) => {
        if (groupRef.current) {
            // Full rotation every 8 seconds
            groupRef.current.rotation.y += delta * (Math.PI / 4);
        }
    });
    
    return (
        <group ref={groupRef}>
            {/* Character model */}
            <primitive 
                object={clonedScene} 
                scale={isSelected ? 2.8 : 2.2} 
                rotation={[0, -Math.PI / 2, 0]}
                position={[0, -1.5, 0]}
            />
        </group>
    );
};

// Individual character preview with rotation animation
const CharacterPreview: React.FC<CharacterPreviewProps> = ({ variant, isSelected }) => {
    const groupRef = useRef<THREE.Group>(null);
    const config = CHARACTER_CONFIGS.find(c => c.id === variant)!;
    
    // Rotate the character 360 degrees continuously
    useFrame((state, delta) => {
        if (groupRef.current) {
            // Full rotation every 8 seconds
            groupRef.current.rotation.y += delta * (Math.PI / 4);
        }
    });
    
    // Render Fluffy the Unicorn (GLB model)
    if (variant === 'fluffy') {
        return (
            <Float speed={2} rotationIntensity={0} floatIntensity={0.3}>
                <FluffyPreviewModel scale={3} isSelected={isSelected} />
            </Float>
        );
    }
    
    // Render Super Lobster (GLB model)
    if (variant === 'lobster') {
        return (
            <Float speed={2} rotationIntensity={0} floatIntensity={0.3}>
                <LobsterPreviewModel scale={3} isSelected={isSelected} />
            </Float>
        );
    }

    // Render Rigged T-Rex Fabulous (GLB model + embedded animation clip)
    if (variant === 'trex') {
        return (
            <Float speed={1.6} rotationIntensity={0} floatIntensity={0.2}>
                <TrexPreviewModel isSelected={isSelected} />
            </Float>
        );
    }

    if (variant === 'warDino') {
        return (
            <Float speed={1.4} rotationIntensity={0} floatIntensity={0.18}>
                <GenericAutoFitPreviewModel
                    modelPath="/models/war_dinosaur_-_rigged.glb"
                    isSelected={isSelected}
                    targetSizeSelected={3.5}
                    targetSizeUnselected={3.0}
                    yBase={-1.45}
                    zBase={-1.3}
                />
            </Float>
        );
    }

    if (variant === 'mosasaurus') {
        return (
            <Float speed={1.2} rotationIntensity={0} floatIntensity={0.16}>
                <GenericAutoFitPreviewModel
                    modelPath="/models/jurassic_world_mosasaurus.glb"
                    isSelected={isSelected}
                    targetSizeSelected={3.6}
                    targetSizeUnselected={3.1}
                    yBase={-1.45}
                    zBase={-1.35}
                    autoRotate={false}
                />
            </Float>
        );
    }

    if (variant === 'legoMosasaurus') {
        return (
            <Float speed={1.3} rotationIntensity={0} floatIntensity={0.17}>
                <GenericAutoFitPreviewModel
                    modelPath="/models/rigged_mosasaurus_lego.glb"
                    isSelected={isSelected}
                    targetSizeSelected={3.5}
                    targetSizeUnselected={3.0}
                    yBase={-1.45}
                    zBase={-1.3}
                    autoRotate={false}
                />
            </Float>
        );
    }

    if (variant === 'tarantula') {
        return (
            <Float speed={1.4} rotationIntensity={0} floatIntensity={0.18}>
                <GenericAutoFitPreviewModel
                    modelPath="/models/theraphosa-blondi/source/hi-fi-spider.glb"
                    isSelected={isSelected}
                    targetSizeSelected={3.5}
                    targetSizeUnselected={3.0}
                    yBase={-1.45}
                    zBase={-1.3}
                />
            </Float>
        );
    }

    if (variant === 'scorpion') {
        return (
            <Float speed={1.4} rotationIntensity={0} floatIntensity={0.18}>
                <GenericAutoFitPreviewModel
                    modelPath="/models/scorpion.glb"
                    isSelected={isSelected}
                    targetSizeSelected={3.5}
                    targetSizeUnselected={3.0}
                    yBase={-3.8}
                    zBase={-1.3}
                />
            </Float>
        );
    }

    if (variant === 'blackScorpion') {
        return (
            <Float speed={1.4} rotationIntensity={0} floatIntensity={0.18}>
                <GenericAutoFitPreviewModel
                    modelPath="/models/scorpion.glb"
                    isSelected={isSelected}
                    targetSizeSelected={3.5}
                    targetSizeUnselected={3.0}
                    yBase={-3.8}
                    zBase={-1.3}
                    desaturate
                />
            </Float>
        );
    }
    
    // Render DeathVader variants
    return (
        <group ref={groupRef}>
            <DeathVaderPreview isSelected={isSelected} cloakColor={config.cloakColor} />
        </group>
    );
};

interface CharacterSelectSceneProps {
    selectedCharacter: CharacterVariant;
    onSelectCharacter: (variant: CharacterVariant) => void;
}

// The 3D scene for character selection - renders INSIDE the Canvas
export const CharacterSelectScene: React.FC<CharacterSelectSceneProps> = ({ 
    selectedCharacter 
}) => {
    // Position the camera closer for character selection
    const { camera } = useThree();
    const isFluffy = selectedCharacter === 'fluffy';
    
    useEffect(() => {
        camera.position.set(0, 2, 6);
        camera.lookAt(0, 2.5, 0);
    }, [camera]);
    
    // Background color based on character
    const bgColor = isFluffy ? '#1e3a5f' : '#1a1a2e';
    
    return (
        <>
            {/* Atmospheric background - lighter blue for Fluffy */}
            <color attach="background" args={[bgColor]} />
            <fog attach="fog" args={[bgColor, 15, 30]} />
            
            {/* Strong ambient lighting so character is visible */}
            <ambientLight intensity={isFluffy ? 1.0 : 2.5} />
            <Environment preset={isFluffy ? "sunset" : "sunset"} />

            {/* Main front light - bright spotlight on character */}
            <spotLight
                position={[0, 8, 8]}
                angle={0.5}
                penumbra={0.5}
                intensity={isFluffy ? 3 : 6}
                color="#ffffff"
                castShadow
                target-position={[0, 2.5, 0]}
            />

            {/* Fill light from front */}
            <directionalLight
                position={[0, 5, 5]}
                intensity={isFluffy ? 1.5 : 3.5}
                color="#ffffff"
            />

            {/* Rim lights for dramatic effect - pink/rainbow for Fluffy, purple for others */}
            <pointLight
                position={[-4, 3, -2]}
                color={isFluffy ? "#F472B6" : "#6366f1"}
                intensity={isFluffy ? 2 : 4}
            />
            <pointLight
                position={[4, 3, -2]}
                color={isFluffy ? "#60A5FA" : "#a855f7"}
                intensity={isFluffy ? 2 : 4}
            />

            {/* Top light */}
            <pointLight position={[0, 6, 0]} color="#ffffff" intensity={isFluffy ? 1 : 2.5} />
            
            {/* Floor platform - grassy green for Fluffy */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]} receiveShadow>
                <circleGeometry args={[4, 32]} />
                <meshStandardMaterial 
                    color={isFluffy ? "#4ADE80" : "#2d2d4a"} 
                    roughness={isFluffy ? 0.8 : 0.3} 
                    metalness={isFluffy ? 0.1 : 0.7}
                />
            </mesh>
            
            {/* Character positioned higher up in viewport, feet above name modal */}
            <group position={[0, 2.5, 0]}>
                <CharacterPreview
                    variant={selectedCharacter}
                    isSelected={true}
                />
            </group>
        </>
    );
};

// Preload models
useGLTF.preload('/models/deathvader-optimized.glb');
useGLTF.preload('/models/fluffy unicorn.glb');
useGLTF.preload('/models/super lobster.glb');
useGLTF.preload('/models/rigged-t-rex-fabulous/source/rigged_t-rex_fabulous.glb');
useGLTF.preload('/models/war_dinosaur_-_rigged.glb');
useGLTF.preload('/models/jurassic_world_mosasaurus.glb');
useGLTF.preload('/models/rigged_mosasaurus_lego.glb');
useGLTF.preload('/models/theraphosa-blondi/source/hi-fi-spider.glb');
useGLTF.preload('/models/scorpion.glb');

export default CharacterSelectScene;

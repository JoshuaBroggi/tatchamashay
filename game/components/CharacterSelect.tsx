import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
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
        // Set camera position for a good character view
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

export default CharacterSelectScene;

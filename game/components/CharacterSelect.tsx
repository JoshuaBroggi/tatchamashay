import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
import { CharacterVariant, CharacterConfig, CHARACTER_CONFIGS } from '../types';

interface CharacterPreviewProps {
    variant: CharacterVariant;
    isSelected: boolean;
}

// Individual character preview with rotation animation
const CharacterPreview: React.FC<CharacterPreviewProps> = ({ variant, isSelected }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { scene } = useGLTF('/models/deathvader-optimized.glb');
    
    const config = CHARACTER_CONFIGS.find(c => c.id === variant)!;
    
    // Clone the scene and apply cloak color
    const clonedScene = useMemo(() => {
        const clone = scene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                // Clone the material to avoid modifying the original
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material = mesh.material.map(mat => {
                            const clonedMat = mat.clone();
                            // Apply cloak color to darker materials (likely the cloak/robe)
                            if (clonedMat instanceof THREE.MeshStandardMaterial) {
                                const originalColor = clonedMat.color;
                                const luminance = 0.299 * originalColor.r + 0.587 * originalColor.g + 0.114 * originalColor.b;
                                // Target darker materials for cloak modification
                                if (luminance < 0.3) {
                                    clonedMat.color = new THREE.Color(config.cloakColor);
                                }
                            }
                            return clonedMat;
                        });
                    } else {
                        const clonedMat = mesh.material.clone();
                        if (clonedMat instanceof THREE.MeshStandardMaterial) {
                            const originalColor = clonedMat.color;
                            const luminance = 0.299 * originalColor.r + 0.587 * originalColor.g + 0.114 * originalColor.b;
                            if (luminance < 0.3) {
                                clonedMat.color = new THREE.Color(config.cloakColor);
                            }
                        }
                        mesh.material = clonedMat;
                    }
                }
            }
        });
        return clone;
    }, [scene, config.cloakColor]);
    
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
            
            {/* Glow ring under selected character */}
            {isSelected && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
                    <ringGeometry args={[1.5, 2.2, 32]} />
                    <meshBasicMaterial 
                        color={variant === 'purple' ? '#a855f7' : '#60a5fa'} 
                        transparent 
                        opacity={0.6}
                    />
                </mesh>
            )}
            
            {/* Particle sparkles around selected character */}
            {isSelected && (
                <Float speed={3} rotationIntensity={0.5} floatIntensity={1}>
                    <pointLight 
                        position={[0, 2, 0]} 
                        color={variant === 'purple' ? '#a855f7' : '#60a5fa'} 
                        intensity={2} 
                        distance={8} 
                    />
                </Float>
            )}
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
    
    useEffect(() => {
        // Set camera position for a good character view
        camera.position.set(0, 2, 6);
        camera.lookAt(0, 1, 0);
    }, [camera]);
    
    return (
        <>
            {/* Dark atmospheric background */}
            <color attach="background" args={['#1a1a2e']} />
            <fog attach="fog" args={['#1a1a2e', 15, 30]} />
            
            {/* Strong ambient lighting so character is visible */}
            <ambientLight intensity={0.8} />
            <Environment preset="night" environmentIntensity={0.5} />
            
            {/* Main front light - bright spotlight on character */}
            <spotLight
                position={[0, 8, 8]}
                angle={0.5}
                penumbra={0.5}
                intensity={3}
                color="#ffffff"
                castShadow
                target-position={[0, 0, 0]}
            />
            
            {/* Fill light from front */}
            <directionalLight 
                position={[0, 5, 5]} 
                intensity={1.5} 
                color="#ffffff"
            />
            
            {/* Rim lights for dramatic effect */}
            <pointLight position={[-4, 3, -2]} color="#6366f1" intensity={2} />
            <pointLight position={[4, 3, -2]} color="#a855f7" intensity={2} />
            
            {/* Top light */}
            <pointLight position={[0, 6, 0]} color="#ffffff" intensity={1} />
            
            {/* Floor platform */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
                <circleGeometry args={[4, 32]} />
                <meshStandardMaterial 
                    color="#2d2d4a" 
                    roughness={0.3} 
                    metalness={0.7}
                />
            </mesh>
            
            {/* Character positioned at center, slightly forward */}
            <group position={[0, 0, 0]}>
                <CharacterPreview 
                    variant={selectedCharacter}
                    isSelected={true}
                />
            </group>
        </>
    );
};

// Preload model
useGLTF.preload('/models/deathvader-optimized.glb');

export default CharacterSelectScene;

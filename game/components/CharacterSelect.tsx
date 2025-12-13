import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
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
    
    // Clone the scene and apply cloak color to ALL dark/black materials
    const clonedScene = useMemo(() => {
        const clone = scene.clone();
        const cloakColorObj = new THREE.Color(config.cloakColor);
        
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

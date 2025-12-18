import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { Level } from '../types';

// --- OVERWORLD PREVIEW COMPONENTS ---

// Simple balloon for preview
const PreviewBalloon: React.FC<{ position: [number, number, number], color: string, seed: number }> = ({
    position,
    color,
    seed
}) => {
    const balloonRef = useRef<THREE.Group>(null);
    const stringRef = useRef<THREE.Mesh>(null);

    // Gentle floating animation
    useFrame((state, delta) => {
        if (balloonRef.current) {
            balloonRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + seed) * 0.3;
            balloonRef.current.rotation.y += delta * 0.5;
        }
    });

    return (
        <group ref={balloonRef} position={position}>
            {/* Balloon sphere */}
            <mesh castShadow>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshStandardMaterial color={color} />
            </mesh>

            {/* Balloon string */}
            <mesh ref={stringRef} position={[0, -0.6, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.8]} />
                <meshStandardMaterial color="#666666" />
            </mesh>
        </group>
    );
};

// Overworld preview with balloons and simple terrain
const OverworldPreview: React.FC<{ isSelected: boolean }> = ({ isSelected }) => {
    const balloons = useMemo(() => [
        { position: [-2, 2, -1] as [number, number, number], color: '#ef4444', seed: 1 },
        { position: [1, 3, 0] as [number, number, number], color: '#3b82f6', seed: 2 },
        { position: [2, 2.5, -2] as [number, number, number], color: '#22c55e', seed: 3 },
        { position: [-1, 3.5, 1] as [number, number, number], color: '#eab308', seed: 4 },
        { position: [0, 2.8, -1.5] as [number, number, number], color: '#a855f7', seed: 5 },
    ], []);

    return (
        <group>
            {/* Simple ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <circleGeometry args={[4, 32]} />
                <meshStandardMaterial color="#4ADE80" roughness={0.8} />
            </mesh>

            {/* Balloons */}
            {balloons.map((balloon, i) => (
                <PreviewBalloon key={i} {...balloon} />
            ))}

            {/* Sun */}
            <mesh position={[3, 4, -2]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.3} />
            </mesh>
        </group>
    );
};

// --- CAVE PREVIEW COMPONENTS ---

// Glowing jewel for cave preview
const PreviewJewel: React.FC<{ position: [number, number, number], color: string, seed: number }> = ({
    position,
    color,
    seed
}) => {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y = state.clock.elapsedTime * 0.5 + seed;
            meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + seed) * 0.2;
        }
    });

    return (
        <group position={position}>
            <mesh ref={meshRef} castShadow>
                <octahedronGeometry args={[0.3, 0]} />
                <meshStandardMaterial 
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.8}
                    metalness={0.3}
                    roughness={0.1}
                    transparent
                    opacity={0.9}
                />
            </mesh>
            <pointLight color={color} intensity={0.5} distance={3} decay={2} />
        </group>
    );
};

// Cave preview with stalactites, jewels and dark atmosphere
const CavePreview: React.FC<{ isSelected: boolean }> = ({ isSelected }) => {
    const jewels = useMemo(() => [
        { position: [0, 0.5, 0] as [number, number, number], color: '#50C878', seed: 1 },
        { position: [-1.5, 2, -0.5] as [number, number, number], color: '#E0115F', seed: 2 },
        { position: [1.5, 2.5, 0.5] as [number, number, number], color: '#0F52BA', seed: 3 },
        { position: [-0.5, 3, 1] as [number, number, number], color: '#9966CC', seed: 4 },
        { position: [0.8, 1.8, -1] as [number, number, number], color: '#FFBF00', seed: 5 },
        { position: [0, 2.2, 0.8] as [number, number, number], color: '#50C878', seed: 6 },
    ], []);

    return (
        <group>
            {/* Cave floor - dark stone */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <circleGeometry args={[4, 32]} />
                <meshStandardMaterial color="#1a1815" roughness={0.95} />
            </mesh>

            {/* Cave dome ceiling */}
            <mesh position={[0, 5, 0]} scale={[4, 2, 4]}>
                <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color="#2D2A26" roughness={0.95} side={THREE.BackSide} />
            </mesh>

            {/* Stalactites */}
            <mesh position={[-1.5, 4, -1]} rotation={[0, 0, 0.1]}>
                <coneGeometry args={[0.15, 1.2, 6]} />
                <meshStandardMaterial color="#3D3A36" roughness={0.9} />
            </mesh>
            <mesh position={[1.2, 4.2, 0.8]} rotation={[0, 0, -0.15]}>
                <coneGeometry args={[0.12, 0.9, 6]} />
                <meshStandardMaterial color="#3D3A36" roughness={0.9} />
            </mesh>
            <mesh position={[0.3, 4.5, -0.5]} rotation={[0.05, 0, 0.08]}>
                <coneGeometry args={[0.18, 1.4, 6]} />
                <meshStandardMaterial color="#3D3A36" roughness={0.9} />
            </mesh>
            <mesh position={[-0.8, 4.3, 1]} rotation={[-0.1, 0, 0]}>
                <coneGeometry args={[0.1, 0.7, 6]} />
                <meshStandardMaterial color="#3D3A36" roughness={0.9} />
            </mesh>

            {/* Treasure pile base */}
            <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[1, 1.2, 0.3, 16]} />
                <meshStandardMaterial 
                    color="#B8860B" 
                    emissive="#B8860B"
                    emissiveIntensity={0.2}
                    metalness={0.8}
                    roughness={0.3}
                />
            </mesh>

            {/* Floating jewels */}
            {jewels.map((jewel, i) => (
                <Float key={i} speed={1.5} rotationIntensity={0.3} floatIntensity={0.3}>
                    <PreviewJewel {...jewel} />
                </Float>
            ))}

            {/* Central glow */}
            <pointLight position={[0, 1, 0]} color="#FFBF00" intensity={2} distance={8} decay={2} />
        </group>
    );
};

// Level preview wrapper with rotation
const LevelPreview: React.FC<{ level: Level, isSelected: boolean }> = ({ level, isSelected }) => {
    const groupRef = useRef<THREE.Group>(null);

    // Slow rotation for selected level
    useFrame((state, delta) => {
        if (groupRef.current && isSelected) {
            groupRef.current.rotation.y += delta * 0.3;
        }
    });

    return (
        <group ref={groupRef}>
            {level === 'cave' ? (
                <CavePreview isSelected={isSelected} />
            ) : (
                <OverworldPreview isSelected={isSelected} />
            )}
        </group>
    );
};

interface LevelSelectSceneProps {
    selectedLevel: Level;
    onSelectLevel: (level: Level) => void;
}

// The 3D scene for level selection - renders INSIDE the Canvas
export const LevelSelectScene: React.FC<LevelSelectSceneProps> = ({
    selectedLevel
}) => {
    const { camera } = useThree();

    useEffect(() => {
        // Set camera position for level preview
        camera.position.set(0, 3, 8);
        camera.lookAt(0, 1.5, 0);
    }, [camera]);

    // Background color based on level
    const bgColor = selectedLevel === 'cave' ? '#0a0908' : '#87CEEB';

    return (
        <>
            {/* Atmospheric background */}
            <color attach="background" args={[bgColor]} />
            <fog attach="fog" args={[bgColor, 15, 30]} />

            {/* Lighting based on level */}
            {selectedLevel === 'cave' ? (
                <>
                    <ambientLight intensity={0.3} color="#6b5b4f" />
                    <directionalLight
                        position={[0, 8, 5]}
                        intensity={0.5}
                        color="#8b7355"
                    />
                    <pointLight position={[0, 3, 0]} color="#FFBF00" intensity={1.5} distance={15} />
                </>
            ) : (
                <>
                    <ambientLight intensity={1.0} />
                    <directionalLight
                        position={[5, 8, 5]}
                        intensity={2}
                        color="#ffffff"
                        castShadow
                    />
                    <pointLight position={[-3, 5, -3]} color="#FFE4B5" intensity={1} />
                </>
            )}

            {/* Level preview positioned in center */}
            <group position={[0, 1, 0]}>
                <Float speed={1} rotationIntensity={0.1} floatIntensity={0.2}>
                    <LevelPreview level={selectedLevel} isSelected={true} />
                </Float>
            </group>
        </>
    );
};

export default LevelSelectScene;

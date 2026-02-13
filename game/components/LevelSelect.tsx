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

// --- DESERT PREVIEW COMPONENTS ---

const DesertPreview: React.FC<{ isSelected: boolean }> = ({ isSelected }) => {
    return (
        <group>
            {/* Sandy ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <circleGeometry args={[4, 32]} />
                <meshStandardMaterial color="#d4a55a" roughness={0.9} />
            </mesh>

            {/* Mini Cactus */}
            <group position={[-1.5, 0, 0.5]}>
                <mesh position={[0, 0.6, 0]} castShadow>
                    <cylinderGeometry args={[0.12, 0.15, 1.2, 6]} />
                    <meshStandardMaterial color="#2d6b30" roughness={0.85} />
                </mesh>
                <mesh position={[0, 1.2, 0]} castShadow>
                    <sphereGeometry args={[0.12, 6, 5]} />
                    <meshStandardMaterial color="#2d6b30" roughness={0.85} />
                </mesh>
                {/* Left arm */}
                <mesh position={[-0.15, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                    <cylinderGeometry args={[0.08, 0.1, 0.4, 5]} />
                    <meshStandardMaterial color="#2d6b30" roughness={0.85} />
                </mesh>
                <mesh position={[-0.35, 0.7, 0]} castShadow>
                    <cylinderGeometry args={[0.07, 0.08, 0.4, 5]} />
                    <meshStandardMaterial color="#2d6b30" roughness={0.85} />
                </mesh>
            </group>

            {/* Mini Cobra (reared up) */}
            <group position={[1.2, 0, -0.5]}>
                {/* Body coil */}
                <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.2, 0.06, 6, 12]} />
                    <meshStandardMaterial color="#3d4a1f" roughness={0.75} />
                </mesh>
                {/* Neck */}
                <mesh position={[0, 0.45, 0.05]} castShadow>
                    <capsuleGeometry args={[0.06, 0.5, 4, 6]} />
                    <meshStandardMaterial color="#3d4a1f" roughness={0.75} />
                </mesh>
                {/* Hood */}
                <mesh position={[0, 0.75, 0]} castShadow>
                    <sphereGeometry args={[0.15, 7, 5]} />
                    <meshStandardMaterial color="#6b7a3d" roughness={0.7} />
                </mesh>
                {/* Eyes */}
                <mesh position={[0.04, 0.8, 0.12]}>
                    <sphereGeometry args={[0.02, 4, 4]} />
                    <meshBasicMaterial color="#ffe600" />
                </mesh>
                <mesh position={[-0.04, 0.8, 0.12]}>
                    <sphereGeometry args={[0.02, 4, 4]} />
                    <meshBasicMaterial color="#ffe600" />
                </mesh>
            </group>

            {/* Mini Scorpion */}
            <group position={[0, 0, 1.5]} scale={[0.6, 0.6, 0.6]}>
                <mesh position={[0, 0.06, 0]} castShadow>
                    <capsuleGeometry args={[0.08, 0.2, 4, 6]} />
                    <meshStandardMaterial color="#2a1a0a" roughness={0.8} />
                </mesh>
                <mesh position={[0, 0.15, -0.2]} rotation={[-0.8, 0, 0]} castShadow>
                    <capsuleGeometry args={[0.04, 0.2, 4, 6]} />
                    <meshStandardMaterial color="#2a1a0a" roughness={0.8} />
                </mesh>
                <mesh position={[0, 0.3, -0.3]} rotation={[-0.4, 0, 0]} castShadow>
                    <coneGeometry args={[0.025, 0.1, 4]} />
                    <meshStandardMaterial color="#1a0a00" roughness={0.5} />
                </mesh>
            </group>

            {/* Mini Rocks */}
            <mesh position={[0.3, 0.12, -1.5]} castShadow>
                <dodecahedronGeometry args={[0.2, 0]} />
                <meshStandardMaterial color="#8b7d6b" roughness={0.95} />
            </mesh>
            <mesh position={[-0.5, 0.08, -1.2]} castShadow>
                <dodecahedronGeometry args={[0.15, 0]} />
                <meshStandardMaterial color="#6b5d4b" roughness={0.95} />
            </mesh>

            {/* Sun */}
            <mesh position={[2.5, 3.5, -2]}>
                <sphereGeometry args={[0.4, 12, 12]} />
                <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
            </mesh>
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
            ) : level === 'desert' ? (
                <DesertPreview isSelected={isSelected} />
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
    const bgColor = selectedLevel === 'cave' ? '#0a0908' : selectedLevel === 'desert' ? '#e8c98a' : '#87CEEB';

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
            ) : selectedLevel === 'desert' ? (
                <>
                    <ambientLight intensity={0.7} color="#fff5e0" />
                    <directionalLight
                        position={[8, 10, 5]}
                        intensity={1.8}
                        color="#fff0d0"
                        castShadow
                    />
                    <pointLight position={[0, 3, 0]} color="#FFD700" intensity={0.8} distance={12} />
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

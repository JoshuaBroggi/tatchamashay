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

// --- JURASSIC PARK PREVIEW COMPONENTS ---

const JurassicParkPreview: React.FC<{ isSelected: boolean }> = ({ isSelected }) => {
    const trexRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (trexRef.current) {
            trexRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.3;
        }
    });

    return (
        <group>
            {/* Jungle ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <circleGeometry args={[4, 32]} />
                <meshStandardMaterial color="#2d6b1e" roughness={0.85} />
            </mesh>

            {/* Mini jungle tree */}
            <group position={[-2, 0, -1]}>
                <mesh position={[0, 0.8, 0]} castShadow>
                    <cylinderGeometry args={[0.08, 0.12, 1.6, 6]} />
                    <meshStandardMaterial color="#5c3a1e" roughness={0.9} />
                </mesh>
                <mesh position={[0, 1.8, 0]} castShadow>
                    <sphereGeometry args={[0.5, 8, 6]} />
                    <meshStandardMaterial color="#1a6b1a" roughness={0.85} />
                </mesh>
                <mesh position={[0, 2.2, 0]} castShadow>
                    <sphereGeometry args={[0.35, 8, 6]} />
                    <meshStandardMaterial color="#228b22" roughness={0.85} />
                </mesh>
            </group>

            {/* Second mini tree */}
            <group position={[1.8, 0, -1.5]}>
                <mesh position={[0, 0.6, 0]} castShadow>
                    <cylinderGeometry args={[0.06, 0.1, 1.2, 6]} />
                    <meshStandardMaterial color="#5c3a1e" roughness={0.9} />
                </mesh>
                <mesh position={[0, 1.4, 0]} castShadow>
                    <sphereGeometry args={[0.4, 8, 6]} />
                    <meshStandardMaterial color="#228b22" roughness={0.85} />
                </mesh>
            </group>

            {/* Mini ferns */}
            {[[-1, 0, 1], [0.8, 0, 0.5], [-0.5, 0, -0.8]].map((pos, i) => (
                <group key={`fern-${i}`} position={pos as [number, number, number]}>
                    {[0, 1, 2, 3].map(j => {
                        const angle = (j / 4) * Math.PI * 2;
                        return (
                            <mesh
                                key={j}
                                position={[Math.cos(angle) * 0.1, 0.1, Math.sin(angle) * 0.1]}
                                rotation={[0.5, angle, 0]}
                            >
                                <capsuleGeometry args={[0.03, 0.2, 3, 4]} />
                                <meshStandardMaterial color="#2d8a2d" roughness={0.75} />
                            </mesh>
                        );
                    })}
                </group>
            ))}

            {/* Mini T-Rex silhouette */}
            <group ref={trexRef} position={[0.5, 0, 0.8]} scale={[0.35, 0.35, 0.35]}>
                {/* Body */}
                <mesh position={[0, 0.6, 0]} castShadow>
                    <capsuleGeometry args={[0.25, 0.6, 5, 7]} />
                    <meshStandardMaterial color="#5a4a2a" roughness={0.8} />
                </mesh>
                {/* Head */}
                <mesh position={[0.3, 1.1, 0]} castShadow>
                    <boxGeometry args={[0.5, 0.3, 0.25]} />
                    <meshStandardMaterial color="#5a4a2a" roughness={0.8} />
                </mesh>
                {/* Jaw */}
                <mesh position={[0.45, 0.95, 0]} castShadow>
                    <boxGeometry args={[0.3, 0.1, 0.2]} />
                    <meshStandardMaterial color="#4a3a1a" roughness={0.8} />
                </mesh>
                {/* Eyes */}
                <mesh position={[0.35, 1.2, 0.1]}>
                    <sphereGeometry args={[0.04, 4, 4]} />
                    <meshBasicMaterial color="#ff3300" />
                </mesh>
                <mesh position={[0.35, 1.2, -0.1]}>
                    <sphereGeometry args={[0.04, 4, 4]} />
                    <meshBasicMaterial color="#ff3300" />
                </mesh>
                {/* Tail */}
                <mesh position={[-0.5, 0.5, 0]} rotation={[0, 0, 0.3]} castShadow>
                    <coneGeometry args={[0.15, 0.8, 5]} />
                    <meshStandardMaterial color="#5a4a2a" roughness={0.8} />
                </mesh>
                {/* Legs */}
                <mesh position={[0.1, 0.15, 0.15]} castShadow>
                    <cylinderGeometry args={[0.06, 0.08, 0.4, 5]} />
                    <meshStandardMaterial color="#4a3a1a" roughness={0.8} />
                </mesh>
                <mesh position={[0.1, 0.15, -0.15]} castShadow>
                    <cylinderGeometry args={[0.06, 0.08, 0.4, 5]} />
                    <meshStandardMaterial color="#4a3a1a" roughness={0.8} />
                </mesh>
            </group>

            {/* Electric fence posts */}
            {[[-2.8, 0, 1.5], [2.8, 0, 1.5]].map((pos, i) => (
                <group key={`fence-${i}`} position={pos as [number, number, number]}>
                    <mesh position={[0, 0.6, 0]} castShadow>
                        <cylinderGeometry args={[0.03, 0.04, 1.2, 4]} />
                        <meshStandardMaterial color="#666666" metalness={0.6} roughness={0.4} />
                    </mesh>
                </group>
            ))}
            {/* Fence wire */}
            <mesh position={[0, 0.8, 1.5]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.01, 0.01, 5.6, 3]} />
                <meshStandardMaterial color="#aaaaaa" emissive="#44aaff" emissiveIntensity={0.3} />
            </mesh>

            {/* Dinosaur eggs */}
            {[[1.5, 0.15, 1.2], [-1, 0.15, 0.2]].map((pos, i) => (
                <mesh key={`egg-${i}`} position={pos as [number, number, number]} castShadow>
                    <sphereGeometry args={[0.12, 8, 6]} />
                    <meshStandardMaterial
                        color={i === 0 ? '#f5e6c8' : '#e8d4a0'}
                        emissive={i === 0 ? '#f5e6c8' : '#e8d4a0'}
                        emissiveIntensity={0.2}
                        roughness={0.3}
                    />
                </mesh>
            ))}
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
            {level === 'desert' ? (
                <DesertPreview isSelected={isSelected} />
            ) : level === 'jurassicPark' ? (
                <JurassicParkPreview isSelected={isSelected} />
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
    const bgColor = selectedLevel === 'desert' ? '#e8c98a' : selectedLevel === 'jurassicPark' ? '#2a4a2a' : '#87CEEB';

    return (
        <>
            {/* Atmospheric background */}
            <color attach="background" args={[bgColor]} />
            <fog attach="fog" args={[bgColor, 15, 30]} />

            {/* Lighting based on level */}
            {selectedLevel === 'desert' ? (
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
            ) : selectedLevel === 'jurassicPark' ? (
                <>
                    <ambientLight intensity={0.6} color="#c8e6c8" />
                    <directionalLight
                        position={[5, 10, 5]}
                        intensity={1.5}
                        color="#fff8e0"
                        castShadow
                    />
                    <pointLight position={[0, 3, 0]} color="#88cc88" intensity={0.6} distance={12} />
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

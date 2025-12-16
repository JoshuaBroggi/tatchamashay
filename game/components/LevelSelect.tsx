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
            <OverworldPreview isSelected={isSelected} />
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

    // Background color for overworld
    const bgColor = '#87CEEB';

    return (
        <>
            {/* Atmospheric background */}
            <color attach="background" args={[bgColor]} />
            <fog attach="fog" args={[bgColor, 15, 30]} />

            {/* Lighting for overworld */}
            <ambientLight intensity={1.0} />
            <directionalLight
                position={[5, 8, 5]}
                intensity={2}
                color="#ffffff"
                castShadow
            />
            <pointLight position={[-3, 5, -3]} color="#FFE4B5" intensity={1} />

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
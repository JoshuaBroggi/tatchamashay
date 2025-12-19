import React from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// Forest boundaries and collision
export const FOREST_RADIUS = 40;
const TOWER_RADIUS = 3;

// Simple collision check for the forest
export const checkForestCollision = (x: number, z: number): boolean => {
    // Boundary check
    if (Math.sqrt(x * x + z * z) > FOREST_RADIUS - 2) return true;

    // River check (river flows along Z axis at x = 13, width 6)
    // x range: 10 to 16
    if (x > 10 && x < 16) return true;

    // Tower check (at -15, -15)
    const towerDist = Math.sqrt(Math.pow(x - (-15), 2) + Math.pow(z - (-15), 2));
    if (towerDist < TOWER_RADIUS + 1.0) return true;

    return false;
};

interface ForestLevelProps {
    children: React.ReactNode;
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
    onScoreUpdate: (cb: (prev: number) => number) => void;
}

const Tree: React.FC<{ position: [number, number, number], scale?: number }> = ({ position, scale = 1 }) => {
    return (
        <group position={position} scale={[scale, scale, scale]}>
            {/* Trunk */}
            <mesh position={[0, 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.4, 0.6, 4, 7]} />
                <meshStandardMaterial color="#4a3c31" roughness={1.0} />
            </mesh>
            {/* Foliage - tiered */}
            <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
                <coneGeometry args={[2.2, 3, 7]} />
                <meshStandardMaterial color="#2d5a27" roughness={0.9} />
            </mesh>
            <mesh position={[0, 6.5, 0]} castShadow receiveShadow>
                <coneGeometry args={[1.8, 2.5, 7]} />
                <meshStandardMaterial color="#3a6b32" roughness={0.9} />
            </mesh>
        </group>
    );
};

export const ForestLevel: React.FC<ForestLevelProps> = ({ 
    children, 
    playerPosRef,
    onScoreUpdate 
}) => {
    // Load the background texture provided by user
    const texture = useTexture('/textures/forest_panorama.png');
    
    // Configure texture mapping
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    
    return (
        <group>
            {/* Atmospheric Lighting */}
            <ambientLight intensity={0.5} color="#cce6ff" />
            <directionalLight 
                position={[-10, 25, -10]} 
                intensity={1.0} 
                color="#ffeebb" 
                castShadow 
                shadow-mapSize={[2048, 2048]}
            >
                <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30, 0.1, 100]} />
            </directionalLight>
            <fog attach="fog" args={['#cce6ff', 20, 60]} />

            {/* 360 Background Skybox */}
            <mesh position={[0, 5, 0]}>
                {/* Large cylinder wrapped with the image */}
                <cylinderGeometry args={[48, 48, 30, 32, 1, true]} />
                <meshBasicMaterial 
                    map={texture} 
                    side={THREE.BackSide} 
                />
            </mesh>

            {/* Ground Plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[50, 64]} />
                <meshStandardMaterial color="#3a5f0b" roughness={0.8} />
            </mesh>

            {/* River */}
            <group>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[13, 0.05, 0]} receiveShadow>
                    <planeGeometry args={[6, 100]} />
                    <meshStandardMaterial color="#4fa4b8" roughness={0.2} metalness={0.3} />
                </mesh>
                {/* River banks/details could go here */}
            </group>

            {/* Mysterious Stone Tower */}
            <group position={[-15, 0, -15]}>
                {/* Base */}
                <mesh position={[0, 6, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[3, 4, 12, 8]} />
                    <meshStandardMaterial color="#5c5c5c" roughness={0.7} />
                </mesh>
                {/* Roof */}
                <mesh position={[0, 13, 0]} castShadow receiveShadow>
                     <coneGeometry args={[4.5, 4, 5]} />
                     <meshStandardMaterial color="#2c2c2c" roughness={0.9} />
                </mesh>
                {/* Glowing Runes / Window */}
                <mesh position={[0, 8, 2.8]} rotation={[0, 0, 0]}>
                    <planeGeometry args={[1, 2]} />
                    <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={2} />
                </mesh>
                <pointLight position={[0, 8, 4]} color="#00ffcc" intensity={1} distance={8} decay={2} />
            </group>

            {/* Japanese-style Lantern */}
            <group position={[-5, 0, -5]}>
                 <mesh position={[0, 1.5, 0]} castShadow>
                    <boxGeometry args={[0.5, 3, 0.5]} />
                    <meshStandardMaterial color="#4a4a4a" />
                 </mesh>
                 <mesh position={[0, 3, 0]} castShadow>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={0.5} />
                 </mesh>
                 <pointLight position={[0, 3, 0]} color="#ffaa00" intensity={1} distance={5} />
            </group>

            {/* Scattered Trees */}
            <Tree position={[5, 0, 5]} scale={1.2} />
            <Tree position={[-5, 0, 8]} scale={0.9} />
            <Tree position={[0, 0, -12]} scale={1.1} />
            <Tree position={[-8, 0, 2]} scale={1.3} />
            <Tree position={[20, 0, 10]} scale={1.5} />
            <Tree position={[22, 0, -15]} scale={1.0} />
            <Tree position={[2, 0, 15]} scale={0.8} />
            <Tree position={[-12, 0, 10]} scale={1.2} />
            <Tree position={[-20, 0, 0]} scale={1.4} />

            {children}
        </group>
    );
};

export default ForestLevel;

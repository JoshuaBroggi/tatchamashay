import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

// Gem data interface
export interface GemData {
    id: string;
    x: number;
    y: number;
    z: number;
    color: string;
    collected: boolean;
}

interface GemProps {
    position: [number, number, number];
    color: string;
    onCollect: () => void;
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
    id: string;
}

// Audio for gem collection
let audioCtx: AudioContext | null = null;
const getAudioContext = (): AudioContext => {
    if (!audioCtx) {
        audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

const playGemSound = () => {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // Sparkly gem collection sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
        // Ignore audio errors
    }
};

// Individual gem component
export const Gem: React.FC<GemProps> = ({ position, color, onCollect, playerPosRef, id }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const collected = useRef(false);
    const gemPos = useMemo(() => new THREE.Vector3(...position), [position]);
    
    useFrame((state) => {
        if (!meshRef.current || collected.current) return;
        
        const time = state.clock.elapsedTime;
        
        // Spin the gem
        meshRef.current.rotation.y = time * 2;
        meshRef.current.rotation.x = Math.sin(time) * 0.2;
        
        // Pulse the light
        if (lightRef.current) {
            lightRef.current.intensity = 1 + Math.sin(time * 3) * 0.3;
        }
        
        // Check for player collision
        const dist = gemPos.distanceTo(playerPosRef.current);
        if (dist < 2) {
            collected.current = true;
            playGemSound();
            onCollect();
        }
    });
    
    if (collected.current) return null;
    
    return (
        <Float speed={3} rotationIntensity={0} floatIntensity={0.5}>
            <group position={position}>
                {/* Gem glow light */}
                <pointLight 
                    ref={lightRef}
                    color={color} 
                    intensity={1} 
                    distance={8}
                    decay={2}
                />
                
                {/* Main gem body - octahedron shape */}
                <mesh ref={meshRef} castShadow>
                    <octahedronGeometry args={[0.5, 0]} />
                    <meshStandardMaterial 
                        color={color}
                        emissive={color}
                        emissiveIntensity={0.5}
                        roughness={0.1}
                        metalness={0.8}
                        transparent
                        opacity={0.9}
                    />
                </mesh>
                
                {/* Inner glow core */}
                <mesh scale={[0.3, 0.3, 0.3]}>
                    <sphereGeometry args={[1, 8, 8]} />
                    <meshBasicMaterial 
                        color={color}
                        transparent
                        opacity={0.6}
                    />
                </mesh>
            </group>
        </Float>
    );
};

// Gem colors
const GEM_COLORS = ['#00FFFF', '#FF00FF', '#00FF00', '#FFD700', '#FF6B6B', '#4ECDC4'];

// Generate initial gem data for the cave
export const generateCaveGems = (chamberCenter: THREE.Vector3, count: number = 12): GemData[] => {
    const gems: GemData[] = [];
    
    for (let i = 0; i < count; i++) {
        // Scatter gems around the central chamber
        const angle = (i / count) * Math.PI * 2;
        const radius = 8 + Math.random() * 12;
        const x = chamberCenter.x + Math.cos(angle) * radius;
        const z = chamberCenter.z + Math.sin(angle) * radius;
        const y = 1 + Math.random() * 2; // Float above ground
        
        gems.push({
            id: `gem-${i}`,
            x,
            y,
            z,
            color: GEM_COLORS[i % GEM_COLORS.length],
            collected: false
        });
    }
    
    // Add a few gems in the tunnel
    for (let i = 0; i < 3; i++) {
        gems.push({
            id: `tunnel-gem-${i}`,
            x: (Math.random() - 0.5) * 6,
            y: 1.5,
            z: 20 + i * 15,
            color: GEM_COLORS[(count + i) % GEM_COLORS.length],
            collected: false
        });
    }
    
    return gems;
};

// Gem system component - manages all gems in the cave
interface GemSystemProps {
    gems: GemData[];
    onCollectGem: (id: string) => void;
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

export const GemSystem: React.FC<GemSystemProps> = ({ gems, onCollectGem, playerPosRef }) => {
    return (
        <group>
            {gems.filter(g => !g.collected).map(gem => (
                <Gem
                    key={gem.id}
                    id={gem.id}
                    position={[gem.x, gem.y, gem.z]}
                    color={gem.color}
                    playerPosRef={playerPosRef}
                    onCollect={() => onCollectGem(gem.id)}
                />
            ))}
        </group>
    );
};

export default Gem;


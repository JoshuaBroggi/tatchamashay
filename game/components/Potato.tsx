import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GemData } from './Gem';

// Potato physics data
export interface PotatoPhysics {
    id: string;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    restY: number; // Target floating height
    rotation: number;
    rotationSpeed: number;
}

// Constants
const POTATO_RADIUS = 0.5;
const POTATO_KICK_STRENGTH = 15.0;
const POTATO_FRICTION = 0.92;
const POTATO_MAX_VELOCITY = 12.0;
const POTATO_FLOAT_STRENGTH = 3.0; // How strongly potatoes return to rest height
const KICK_RANGE = 3.0;

// Audio for potato kick
let audioCtx: AudioContext | null = null;
const getAudioContext = (): AudioContext => {
    if (!audioCtx) {
        audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

const playKickSound = () => {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // Thud kick sound
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
        // Ignore audio errors
    }
};

// Generate initial potato data for the cave
export const generateCavePotatoes = (chamberCenter: THREE.Vector3, count: number = 10): PotatoPhysics[] => {
    const potatoes: PotatoPhysics[] = [];
    
    for (let i = 0; i < count; i++) {
        // Scatter potatoes around the central chamber
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const radius = 5 + Math.random() * 15;
        const x = chamberCenter.x + Math.cos(angle) * radius;
        const z = chamberCenter.z + Math.sin(angle) * radius;
        const restY = 0.8 + Math.random() * 0.5; // Float just above ground
        
        potatoes.push({
            id: `potato-${i}`,
            x,
            y: restY,
            z,
            vx: 0,
            vy: 0,
            vz: 0,
            restY,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: 0
        });
    }
    
    // Add a few potatoes in the tunnel
    for (let i = 0; i < 4; i++) {
        const restY = 0.8 + Math.random() * 0.3;
        potatoes.push({
            id: `tunnel-potato-${i}`,
            x: (Math.random() - 0.5) * 5,
            y: restY,
            z: 15 + i * 12,
            vx: 0,
            vy: 0,
            vz: 0,
            restY,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: 0
        });
    }
    
    return potatoes;
};

// Individual potato mesh (visual only, physics handled by system)
const PotatoMesh = ({ potato }: { potato: PotatoPhysics }) => {
    const meshRef = useRef<THREE.Group>(null);
    
    useFrame(() => {
        if (!meshRef.current) return;
        meshRef.current.position.set(potato.x, potato.y, potato.z);
        meshRef.current.rotation.y = potato.rotation;
        meshRef.current.rotation.x = potato.rotation * 0.3;
    });
    
    return (
        <group ref={meshRef}>
            {/* Main potato body - elongated ellipsoid */}
            <mesh castShadow scale={[1.2, 0.8, 0.9]}>
                <sphereGeometry args={[POTATO_RADIUS, 12, 8]} />
                <meshStandardMaterial 
                    color="#C4A574" 
                    roughness={0.9} 
                    metalness={0.0}
                />
            </mesh>
            
            {/* Potato spots/eyes */}
            <mesh position={[0.25, 0.15, 0.35]} scale={[0.8, 0.8, 0.8]}>
                <sphereGeometry args={[0.08, 6, 6]} />
                <meshStandardMaterial color="#8B7355" roughness={1} />
            </mesh>
            <mesh position={[-0.15, -0.1, 0.38]}>
                <sphereGeometry args={[0.06, 6, 6]} />
                <meshStandardMaterial color="#8B7355" roughness={1} />
            </mesh>
            <mesh position={[0.1, 0.25, 0.2]}>
                <sphereGeometry args={[0.05, 6, 6]} />
                <meshStandardMaterial color="#9B8565" roughness={1} />
            </mesh>
            <mesh position={[-0.3, 0.05, 0.25]}>
                <sphereGeometry args={[0.07, 6, 6]} />
                <meshStandardMaterial color="#7B6345" roughness={1} />
            </mesh>
        </group>
    );
};

// Potato system props
interface PotatoSystemProps {
    potatoesRef: React.MutableRefObject<PotatoPhysics[]>;
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
    gemsRef: React.MutableRefObject<GemData[]>;
    onAttack: boolean;
    onGemCollect: (id: string) => void;
    chamberBounds?: { center: THREE.Vector3, radius: number };
}

// Potato system component - handles physics and rendering
export const PotatoSystem: React.FC<PotatoSystemProps> = ({ 
    potatoesRef, 
    playerPosRef, 
    gemsRef,
    onAttack,
    onGemCollect,
    chamberBounds = { center: new THREE.Vector3(0, 0, 75), radius: 25 }
}) => {
    const lastAttack = useRef(false);
    const [, forceUpdate] = React.useState(0);
    
    // Force re-render periodically to update potato visuals
    useEffect(() => {
        const interval = setInterval(() => forceUpdate(n => n + 1), 50);
        return () => clearInterval(interval);
    }, []);
    
    useFrame((state, delta) => {
        const potatoes = potatoesRef.current;
        const playerPos = playerPosRef.current;
        const gems = gemsRef.current;
        
        // Cap delta to prevent physics explosions
        const dt = Math.min(delta, 0.05);
        
        // Check for kick (attack pressed this frame)
        const attackThisFrame = onAttack && !lastAttack.current;
        lastAttack.current = onAttack;
        
        // Update each potato
        for (const potato of potatoes) {
            // Apply kick force if player attacks nearby
            if (attackThisFrame) {
                const dx = potato.x - playerPos.x;
                const dy = potato.y - (playerPos.y + 0.5);
                const dz = potato.z - playerPos.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (dist < KICK_RANGE && dist > 0.1) {
                    playKickSound();
                    const force = POTATO_KICK_STRENGTH * (1 - dist / KICK_RANGE);
                    potato.vx += (dx / dist) * force;
                    potato.vy += (dy / dist) * force * 0.5 + 3; // Add upward boost
                    potato.vz += (dz / dist) * force;
                    potato.rotationSpeed = (Math.random() - 0.5) * 10;
                }
            }
            
            // Apply physics
            potato.x += potato.vx * dt;
            potato.y += potato.vy * dt;
            potato.z += potato.vz * dt;
            potato.rotation += potato.rotationSpeed * dt;
            
            // Apply friction
            potato.vx *= POTATO_FRICTION;
            potato.vy *= POTATO_FRICTION;
            potato.vz *= POTATO_FRICTION;
            potato.rotationSpeed *= 0.95;
            
            // Cap velocity
            const speed = Math.sqrt(potato.vx * potato.vx + potato.vy * potato.vy + potato.vz * potato.vz);
            if (speed > POTATO_MAX_VELOCITY) {
                const scale = POTATO_MAX_VELOCITY / speed;
                potato.vx *= scale;
                potato.vy *= scale;
                potato.vz *= scale;
            }
            
            // Float back to rest height
            const heightDiff = potato.y - potato.restY;
            potato.vy -= heightDiff * POTATO_FLOAT_STRENGTH * dt;
            
            // Ground collision
            if (potato.y < 0.4) {
                potato.y = 0.4;
                potato.vy = Math.abs(potato.vy) * 0.5;
            }
            
            // Ceiling collision
            if (potato.y > 15) {
                potato.y = 15;
                potato.vy = -Math.abs(potato.vy) * 0.5;
            }
            
            // Chamber boundary collision
            const distFromChamber = Math.sqrt(
                Math.pow(potato.x - chamberBounds.center.x, 2) + 
                Math.pow(potato.z - chamberBounds.center.z, 2)
            );
            if (distFromChamber > chamberBounds.radius - 1) {
                const nx = (potato.x - chamberBounds.center.x) / distFromChamber;
                const nz = (potato.z - chamberBounds.center.z) / distFromChamber;
                potato.x = chamberBounds.center.x + nx * (chamberBounds.radius - 1);
                potato.z = chamberBounds.center.z + nz * (chamberBounds.radius - 1);
                potato.vx -= nx * Math.abs(potato.vx) * 1.5;
                potato.vz -= nz * Math.abs(potato.vz) * 1.5;
            }
            
            // Tunnel bounds (z < 60)
            if (potato.z < 60) {
                // Simple tunnel walls at x = +/- 4
                if (Math.abs(potato.x) > 4) {
                    potato.x = Math.sign(potato.x) * 4;
                    potato.vx = -potato.vx * 0.5;
                }
            }
            
            // Check collision with gems
            for (const gem of gems) {
                if (gem.collected) continue;
                
                const dx = potato.x - gem.x;
                const dy = potato.y - gem.y;
                const dz = potato.z - gem.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (dist < POTATO_RADIUS + 0.5) {
                    // Potato hit a gem - collect it!
                    gem.collected = true;
                    onGemCollect(gem.id);
                    
                    // Bounce potato slightly
                    if (dist > 0.1) {
                        potato.vx += (dx / dist) * 2;
                        potato.vz += (dz / dist) * 2;
                    }
                }
            }
        }
    });
    
    return (
        <group>
            {potatoesRef.current.map(potato => (
                <PotatoMesh key={potato.id} potato={potato} />
            ))}
        </group>
    );
};

export default PotatoSystem;


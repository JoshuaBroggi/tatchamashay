import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

interface DoorProps {
    position: [number, number, number];
    rotation?: [number, number, number];
    onPlayerNear?: () => void;
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

// Floating potato decoration component
const FloatingPotato = ({ position, seed }: { position: [number, number, number], seed: number }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    
    useFrame((state) => {
        if (!meshRef.current) return;
        const time = state.clock.elapsedTime;
        // Gentle bobbing and rotation
        meshRef.current.rotation.x = Math.sin(time * 0.5 + seed) * 0.2;
        meshRef.current.rotation.z = Math.cos(time * 0.3 + seed) * 0.15;
    });
    
    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <mesh ref={meshRef} position={position} castShadow>
                {/* Potato shape - elongated ellipsoid */}
                <sphereGeometry args={[0.4, 12, 8]} />
                <meshStandardMaterial 
                    color="#C4A574" 
                    roughness={0.9} 
                    metalness={0.0}
                />
            </mesh>
            {/* Potato eyes/spots */}
            <mesh position={[position[0] + 0.15, position[1] + 0.1, position[2] + 0.3]}>
                <sphereGeometry args={[0.06, 6, 6]} />
                <meshStandardMaterial color="#8B7355" roughness={1} />
            </mesh>
            <mesh position={[position[0] - 0.1, position[1] - 0.05, position[2] + 0.32]}>
                <sphereGeometry args={[0.05, 6, 6]} />
                <meshStandardMaterial color="#8B7355" roughness={1} />
            </mesh>
        </Float>
    );
};

// Portal effect - glowing swirling energy inside the door
const PortalEffect = () => {
    const portalRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.PointLight>(null);
    
    useFrame((state) => {
        if (!portalRef.current) return;
        const time = state.clock.elapsedTime;
        
        // Rotate the portal texture/shader
        portalRef.current.rotation.z = time * 0.5;
        
        // Pulsing glow
        if (glowRef.current) {
            glowRef.current.intensity = 2 + Math.sin(time * 2) * 0.5;
        }
    });
    
    return (
        <group position={[0, 2.5, 0.1]}>
            {/* Portal glow light */}
            <pointLight 
                ref={glowRef}
                color="#8B5CF6" 
                intensity={2} 
                distance={10}
                decay={2}
            />
            
            {/* Main portal disc */}
            <mesh ref={portalRef}>
                <circleGeometry args={[1.5, 32]} />
                <meshBasicMaterial 
                    color="#8B5CF6"
                    transparent
                    opacity={0.8}
                    side={THREE.DoubleSide}
                />
            </mesh>
            
            {/* Inner swirl layer */}
            <mesh position={[0, 0, 0.01]} rotation={[0, 0, Math.PI / 4]}>
                <ringGeometry args={[0.3, 1.2, 32]} />
                <meshBasicMaterial 
                    color="#A78BFA"
                    transparent
                    opacity={0.6}
                    side={THREE.DoubleSide}
                />
            </mesh>
            
            {/* Center glow */}
            <mesh position={[0, 0, 0.02]}>
                <circleGeometry args={[0.5, 16]} />
                <meshBasicMaterial 
                    color="#DDD6FE"
                    transparent
                    opacity={0.9}
                />
            </mesh>
        </group>
    );
};

export const Door: React.FC<DoorProps> = ({ 
    position, 
    rotation = [0, 0, 0],
    onPlayerNear,
    playerPosRef 
}) => {
    const groupRef = useRef<THREE.Group>(null);
    const doorPos = useMemo(() => new THREE.Vector3(...position), [position]);
    const hasTriggered = useRef(false);
    
    // Check for player proximity
    useFrame(() => {
        if (!onPlayerNear || hasTriggered.current) return;
        
        const playerPos = playerPosRef.current;
        const dist = doorPos.distanceTo(playerPos);
        
        if (dist < 2.5) {
            hasTriggered.current = true;
            onPlayerNear();
            // Reset after a short delay to allow re-entry
            setTimeout(() => {
                hasTriggered.current = false;
            }, 1000);
        }
    });
    
    return (
        <group ref={groupRef} position={position} rotation={rotation}>
            {/* Door Frame - Left Pillar */}
            <mesh position={[-1.8, 2.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.5, 5, 0.5]} />
                <meshStandardMaterial color="#5D4E37" roughness={0.9} />
            </mesh>
            
            {/* Door Frame - Right Pillar */}
            <mesh position={[1.8, 2.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.5, 5, 0.5]} />
                <meshStandardMaterial color="#5D4E37" roughness={0.9} />
            </mesh>
            
            {/* Door Frame - Top */}
            <mesh position={[0, 5.25, 0]} castShadow receiveShadow>
                <boxGeometry args={[4.1, 0.5, 0.5]} />
                <meshStandardMaterial color="#5D4E37" roughness={0.9} />
            </mesh>
            
            {/* Decorative arch on top */}
            <mesh position={[0, 5.8, 0]} castShadow>
                <cylinderGeometry args={[0.3, 0.3, 4, 8, 1, false, 0, Math.PI]} />
                <meshStandardMaterial color="#8B7355" roughness={0.8} />
            </mesh>
            
            {/* Stone base */}
            <mesh position={[0, 0.15, 0]} receiveShadow>
                <boxGeometry args={[4.5, 0.3, 1]} />
                <meshStandardMaterial color="#6B6B6B" roughness={0.95} />
            </mesh>
            
            {/* Portal Effect */}
            <PortalEffect />
            
            {/* Floating potatoes around the door */}
            <FloatingPotato position={[-2.5, 3, 1]} seed={0} />
            <FloatingPotato position={[2.5, 2.5, 1]} seed={1} />
            <FloatingPotato position={[0, 5.5, 1.5]} seed={2} />
            <FloatingPotato position={[-1.5, 1, 1.2]} seed={3} />
        </group>
    );
};

export default Door;


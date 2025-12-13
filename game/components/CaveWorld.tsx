import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Door } from './Door';

interface CaveWorldProps {
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
    onReturnToOverworld: () => void;
    children?: React.ReactNode;
    offset?: [number, number, number]; // World offset for cave positioning
}

// Seeded random for deterministic generation
const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

// Helper to dispose material and its textures
const disposeMaterial = (material: THREE.Material) => {
    material.dispose();
    
    // Dispose textures if they exist
    const mat = material as any;
    if (mat.map) mat.map.dispose();
    if (mat.lightMap) mat.lightMap.dispose();
    if (mat.bumpMap) mat.bumpMap.dispose();
    if (mat.normalMap) mat.normalMap.dispose();
    if (mat.specularMap) mat.specularMap.dispose();
    if (mat.envMap) mat.envMap.dispose();
    if (mat.alphaMap) mat.alphaMap.dispose();
    if (mat.aoMap) mat.aoMap.dispose();
    if (mat.displacementMap) mat.displacementMap.dispose();
    if (mat.emissiveMap) mat.emissiveMap.dispose();
    if (mat.gradientMap) mat.gradientMap.dispose();
    if (mat.metalnessMap) mat.metalnessMap.dispose();
    if (mat.roughnessMap) mat.roughnessMap.dispose();
};

// Cave floor component - covers the entire cave area
const CaveFloor = () => (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 50]} receiveShadow>
        <planeGeometry args={[100, 200]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.95} />
    </mesh>
);

// Stalactite component
const Stalactite = ({ position, height, seed }: { 
    position: [number, number, number], 
    height: number,
    seed: number 
}) => {
    const geometry = useMemo(() => {
        const geo = new THREE.ConeGeometry(0.3 + seededRandom(seed) * 0.4, height, 6);
        return geo;
    }, [height, seed]);
    
    return (
        <mesh position={position} rotation={[Math.PI, 0, 0]} geometry={geometry} castShadow>
            <meshStandardMaterial 
                color={`hsl(30, ${10 + seededRandom(seed) * 10}%, ${20 + seededRandom(seed + 1) * 15}%)`}
                roughness={0.9}
            />
        </mesh>
    );
};

// Stalactite cluster on ceiling
const CeilingDecorations = () => {
    const stalactites = useMemo(() => {
        const result: { position: [number, number, number], height: number, seed: number }[] = [];
        
        // Generate stalactites throughout the cave
        for (let i = 0; i < 100; i++) {
            const x = (seededRandom(i * 3) - 0.5) * 60;
            const z = seededRandom(i * 3 + 1) * 100;
            const y = 18 + seededRandom(i * 3 + 2) * 4; // Ceiling at ~20 units
            const height = 1 + seededRandom(i * 3 + 3) * 3;
            
            result.push({
                position: [x, y, z],
                height,
                seed: i * 17
            });
        }
        
        return result;
    }, []);
    
    return (
        <group>
            {stalactites.map((s, i) => (
                <Stalactite key={i} {...s} />
            ))}
        </group>
    );
};

// Cave wall segment with rocky texture
const CaveWallSegment = ({ position, rotation, width, height }: {
    position: [number, number, number],
    rotation: [number, number, number],
    width: number,
    height: number
}) => {
    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(width, height, 8, 8);
        const posAttr = geo.attributes.position;
        const vertex = new THREE.Vector3();
        
        // Add rocky displacement
        for (let i = 0; i < posAttr.count; i++) {
            vertex.fromBufferAttribute(posAttr, i);
            const noise = Math.sin(vertex.x * 0.5) * Math.cos(vertex.y * 0.3) * 0.5;
            vertex.z += noise;
            posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        
        geo.computeVertexNormals();
        return geo;
    }, [width, height]);
    
    return (
        <mesh position={position} rotation={rotation} geometry={geometry} receiveShadow castShadow>
            <meshStandardMaterial color="#5d5550" roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
    );
};

// Tunnel segment - a section of the winding tunnel
const TunnelSection = ({ start, end, width = 8, height = 15 }: {
    start: THREE.Vector3,
    end: THREE.Vector3,
    width?: number,
    height?: number
}) => {
    const { leftWall, rightWall, ceiling } = useMemo(() => {
        const dir = end.clone().sub(start);
        const length = dir.length();
        const midpoint = start.clone().add(dir.multiplyScalar(0.5));
        const angle = Math.atan2(dir.x, dir.z);
        
        // Perpendicular direction for wall placement
        const perpAngle = angle + Math.PI / 2;
        
        return {
            leftWall: {
                position: [
                    midpoint.x + Math.sin(perpAngle) * (width / 2),
                    height / 2,
                    midpoint.z + Math.cos(perpAngle) * (width / 2)
                ] as [number, number, number],
                rotation: [0, angle, 0] as [number, number, number],
                width: length + 2,
                height
            },
            rightWall: {
                position: [
                    midpoint.x - Math.sin(perpAngle) * (width / 2),
                    height / 2,
                    midpoint.z - Math.cos(perpAngle) * (width / 2)
                ] as [number, number, number],
                rotation: [0, angle, 0] as [number, number, number],
                width: length + 2,
                height
            },
            ceiling: {
                position: [midpoint.x, height, midpoint.z] as [number, number, number],
                rotation: [-Math.PI / 2, 0, angle] as [number, number, number],
                width: width,
                height: length + 2
            }
        };
    }, [start, end, width, height]);
    
    return (
        <group>
            <CaveWallSegment {...leftWall} />
            <CaveWallSegment {...rightWall} />
            <CaveWallSegment {...ceiling} />
        </group>
    );
};

// The winding tunnel system
const TunnelSystem = () => {
    // Define tunnel path points
    const tunnelPath = useMemo(() => [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(5, 0, 15),
        new THREE.Vector3(-3, 0, 30),
        new THREE.Vector3(8, 0, 45),
        new THREE.Vector3(0, 0, 60),
    ], []);
    
    return (
        <group>
            {tunnelPath.slice(0, -1).map((point, i) => (
                <TunnelSection 
                    key={i} 
                    start={point} 
                    end={tunnelPath[i + 1]} 
                    width={10}
                    height={20}
                />
            ))}
        </group>
    );
};

// Central chamber - large open area with domed ceiling
const CentralChamber = ({ position }: { position: [number, number, number] }) => {
    const radius = 25;
    const height = 25;
    
    // Create dome geometry for ceiling
    const domeGeometry = useMemo(() => {
        const geo = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        return geo;
    }, [radius]);
    
    // Create cylinder walls
    const wallGeometry = useMemo(() => {
        const geo = new THREE.CylinderGeometry(radius, radius, height, 32, 1, true);
        return geo;
    }, [radius, height]);
    
    return (
        <group position={position}>
            {/* Dome ceiling */}
            <mesh 
                position={[0, height, 0]} 
                rotation={[Math.PI, 0, 0]} 
                geometry={domeGeometry}
                receiveShadow
            >
                <meshStandardMaterial 
                    color="#5d5550" 
                    roughness={0.95} 
                    side={THREE.BackSide}
                />
            </mesh>
            
            {/* Cylindrical walls */}
            <mesh 
                position={[0, height / 2, 0]} 
                geometry={wallGeometry}
                receiveShadow
                castShadow
            >
                <meshStandardMaterial 
                    color="#5d5550" 
                    roughness={0.95} 
                    side={THREE.BackSide}
                />
            </mesh>
            
            {/* Floor of chamber */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[radius, 32]} />
                <meshStandardMaterial color="#4a4a4a" roughness={0.95} />
            </mesh>
            
            {/* Ambient point lights for atmosphere - brighter */}
            <pointLight position={[0, 15, 0]} color="#6a6a9a" intensity={1.2} distance={60} />
            <pointLight position={[-10, 5, 10]} color="#8a6a8a" intensity={0.8} distance={40} />
            <pointLight position={[10, 5, -10]} color="#6a8a8a" intensity={0.8} distance={40} />
            <pointLight position={[0, 8, 0]} color="#ffffff" intensity={0.5} distance={50} />
        </group>
    );
};

// Main CaveWorld component - simplified for reliability
export const CaveWorld: React.FC<CaveWorldProps> = ({ 
    playerPosRef, 
    onReturnToOverworld,
    children,
    offset = [0, 0, 1000] // Default offset to separate from overworld
}) => {
    const { gl, scene } = useThree();
    
    // Cleanup on unmount - dispose of Three.js resources to free memory
    useEffect(() => {
        return () => {
            // Traverse scene and dispose of geometries and materials
            scene.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    // Dispose geometry
                    if (object.geometry) {
                        object.geometry.dispose();
                    }
                    
                    // Dispose material(s)
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach((material) => {
                                disposeMaterial(material);
                            });
                        } else {
                            disposeMaterial(object.material);
                        }
                    }
                }
            });
            
            // Force garbage collection hint
            gl.dispose();
        };
    }, [gl, scene]);
    
    return (
        <>
            {/* Cave atmosphere */}
            <ambientLight intensity={0.6} />
            <hemisphereLight args={['#5a5a7e', '#6d6d8a', 0.6]} />
            <color attach="background" args={['#2a2a3e']} />
            
            {/* Main lights at player spawn area */}
            <pointLight 
                position={[offset[0], 10, offset[2] + 10]} 
                intensity={2} 
                distance={50}
                color="#ffffff"
            />
            <pointLight 
                position={[offset[0], 15, offset[2] + 50]} 
                intensity={2} 
                distance={80}
                color="#8888aa"
            />
            
            {/* Simple cave geometry */}
            <group position={offset}>
                {/* Large floor */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 50]} receiveShadow>
                    <planeGeometry args={[60, 120]} />
                    <meshStandardMaterial color="#4a4a5a" roughness={0.9} />
                </mesh>
                
                {/* Left wall */}
                <mesh position={[-25, 10, 50]} castShadow receiveShadow>
                    <boxGeometry args={[2, 20, 120]} />
                    <meshStandardMaterial color="#5d5d6d" roughness={0.95} />
                </mesh>
                
                {/* Right wall */}
                <mesh position={[25, 10, 50]} castShadow receiveShadow>
                    <boxGeometry args={[2, 20, 120]} />
                    <meshStandardMaterial color="#5d5d6d" roughness={0.95} />
                </mesh>
                
                {/* Back wall (behind spawn) */}
                <mesh position={[0, 10, -5]} castShadow receiveShadow>
                    <boxGeometry args={[52, 20, 2]} />
                    <meshStandardMaterial color="#4d4d5d" roughness={0.95} />
                </mesh>
                
                {/* Ceiling */}
                <mesh position={[0, 20, 50]} receiveShadow>
                    <boxGeometry args={[52, 2, 120]} />
                    <meshStandardMaterial color="#3d3d4d" roughness={0.95} />
                </mesh>
                
                {/* Central chamber - larger room at the end */}
                <group position={[0, 0, 75]}>
                    {/* Chamber floor highlight */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                        <circleGeometry args={[20, 32]} />
                        <meshStandardMaterial color="#5a5a6a" roughness={0.85} />
                    </mesh>
                    
                    {/* Chamber ambient light */}
                    <pointLight position={[0, 12, 0]} intensity={1.5} distance={40} color="#9999bb" />
                </group>
            </group>
            
            {/* Return door in central chamber - uses world coordinates for collision */}
            <Door 
                position={[offset[0], offset[1], offset[2] + 90]}
                rotation={[0, 0, 0]}
                playerPosRef={playerPosRef}
                onPlayerNear={onReturnToOverworld}
            />
            
            {/* Children (gems, potatoes, player, etc.) - use world coordinates */}
            {children}
        </>
    );
};

export default CaveWorld;


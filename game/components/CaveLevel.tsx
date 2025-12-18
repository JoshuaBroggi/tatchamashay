import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// --- CAVE CONSTANTS ---
export const MAIN_CAVERN_RADIUS = 40;
const TUNNEL_WIDTH = 6;
const TUNNEL_LENGTH = 25;
const SIDE_CAVERN_RADIUS = 15;
export const PLAYER_RADIUS = 0.6;

// Tunnel angles in radians (5 tunnels at 72 degree intervals)
const TUNNEL_ANGLES = [0, 72, 144, 216, 288].map(deg => (deg * Math.PI) / 180);

// Calculate tunnel and side cavern positions
const getTunnelData = () => {
    return TUNNEL_ANGLES.map(angle => {
        const startX = Math.cos(angle) * (MAIN_CAVERN_RADIUS - 2);
        const startZ = Math.sin(angle) * (MAIN_CAVERN_RADIUS - 2);
        const endX = Math.cos(angle) * (MAIN_CAVERN_RADIUS + TUNNEL_LENGTH);
        const endZ = Math.sin(angle) * (MAIN_CAVERN_RADIUS + TUNNEL_LENGTH);
        const sideCavernX = Math.cos(angle) * (MAIN_CAVERN_RADIUS + TUNNEL_LENGTH + SIDE_CAVERN_RADIUS - 5);
        const sideCavernZ = Math.sin(angle) * (MAIN_CAVERN_RADIUS + TUNNEL_LENGTH + SIDE_CAVERN_RADIUS - 5);
        
        return {
            angle,
            startX,
            startZ,
            endX,
            endZ,
            sideCavernX,
            sideCavernZ,
            midX: (startX + endX) / 2,
            midZ: (startZ + endZ) / 2
        };
    });
};

const TUNNEL_DATA = getTunnelData();

// --- COLLISION SYSTEM ---
// Wall inner radius is MAIN_CAVERN_RADIUS - 2, so main cavern walkable area must be smaller
const MAIN_CAVERN_WALKABLE_RADIUS = MAIN_CAVERN_RADIUS - 3; // Inside the walls

const inMainCavern = (x: number, z: number): boolean => {
    const dist = Math.sqrt(x * x + z * z);
    return dist < MAIN_CAVERN_WALKABLE_RADIUS - PLAYER_RADIUS;
};

const inTunnel = (x: number, z: number, tunnel: typeof TUNNEL_DATA[0]): boolean => {
    const dx = x;
    const dz = z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    // Tunnel starts at main cavern edge and extends to side cavern
    const tunnelStart = MAIN_CAVERN_WALKABLE_RADIUS - 2; // Overlap with main cavern for smooth transition
    const tunnelEnd = MAIN_CAVERN_RADIUS + TUNNEL_LENGTH + 2;
    
    if (dist < tunnelStart || dist > tunnelEnd) {
        return false;
    }
    
    // Get angle to point
    const pointAngle = Math.atan2(z, x);
    let angleDiff = Math.abs(pointAngle - tunnel.angle);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    
    // Calculate tunnel angular width at this distance (narrower when further from center)
    const halfWidth = (TUNNEL_WIDTH / 2) - PLAYER_RADIUS;
    const tunnelAngularWidth = Math.atan2(halfWidth, dist);
    
    return angleDiff < tunnelAngularWidth;
};

const inSideCavern = (x: number, z: number, tunnel: typeof TUNNEL_DATA[0]): boolean => {
    const dx = x - tunnel.sideCavernX;
    const dz = z - tunnel.sideCavernZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    return dist < SIDE_CAVERN_RADIUS - PLAYER_RADIUS - 1; // Stay away from walls
};

export const checkCaveCollision = (x: number, z: number): boolean => {
    // Check if in main cavern (inside the circular wall boundary)
    if (inMainCavern(x, z)) return false;
    
    // Check if in any tunnel or side cavern
    for (const tunnel of TUNNEL_DATA) {
        if (inTunnel(x, z, tunnel)) return false;
        if (inSideCavern(x, z, tunnel)) return false;
    }
    
    // Not in any valid area = collision
    return true;
};

// --- SEEDED RANDOM ---
const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

// --- CAVE FLOOR ---
const CaveFloor = () => {
    const floorGeometry = useMemo(() => {
        const geo = new THREE.CircleGeometry(MAIN_CAVERN_RADIUS + TUNNEL_LENGTH + SIDE_CAVERN_RADIUS + 20, 48);
        const positionAttribute = geo.attributes.position;
        const vertex = new THREE.Vector3();
        
        for (let i = 0; i < positionAttribute.count; i++) {
            vertex.fromBufferAttribute(positionAttribute, i);
            const noise = Math.sin(vertex.x * 0.3) * Math.cos(vertex.y * 0.3) * 0.3;
            positionAttribute.setZ(i, noise);
        }
        
        geo.computeVertexNormals();
        return geo;
    }, []);

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow geometry={floorGeometry}>
            <meshStandardMaterial color="#1a1815" roughness={0.95} metalness={0.02} />
        </mesh>
    );
};

// --- CAVE CEILING (Main Cavern Dome) ---
const CaveCeiling = () => {
    const geometry = useMemo(() => {
        // Create hemisphere - the bottom half of a sphere viewed from inside
        const geo = new THREE.SphereGeometry(MAIN_CAVERN_RADIUS + 5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        // Scale Y to flatten the dome, keep positive so it arches upward
        geo.scale(1, 0.6, 1);
        
        const positionAttribute = geo.attributes.position;
        const vertex = new THREE.Vector3();
        
        // Add rocky displacement for natural cave look
        for (let i = 0; i < positionAttribute.count; i++) {
            vertex.fromBufferAttribute(positionAttribute, i);
            const noise = Math.sin(vertex.x * 0.5 + vertex.z * 0.3) * 
                         Math.cos(vertex.z * 0.4 + vertex.x * 0.2) * 2;
            const scale = 1 + noise * 0.05;
            positionAttribute.setXYZ(i, vertex.x * scale, vertex.y, vertex.z * scale);
        }
        
        geo.computeVertexNormals();
        return geo;
    }, []);

    return (
        <mesh position={[0, 0, 0]} geometry={geometry} receiveShadow>
            <meshStandardMaterial 
                color="#1a1815" 
                emissive="#000000"
                emissiveIntensity={0}
                roughness={0.95} 
                metalness={0.02}
                side={THREE.BackSide}
            />
        </mesh>
    );
};

// --- INSTANCED STALACTITES (Performance optimized) ---
// Stalactites hang DOWN from the CEILING
const StalactiteSystem = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const COUNT = 40; // Reduced from 80+
    
    const { geometry, positions } = useMemo(() => {
        const geo = new THREE.ConeGeometry(0.5, 2, 6);
        const positions: { x: number, y: number, z: number, scaleY: number, tiltX: number, tiltZ: number }[] = [];
        
        // Main cavern stalactites - hanging from dome ceiling
        for (let i = 0; i < 30; i++) {
            const angle = seededRandom(i * 100) * Math.PI * 2;
            const dist = 5 + seededRandom(i * 100 + 1) * (MAIN_CAVERN_RADIUS - 10);
            // Calculate ceiling height at this distance (dome shape)
            const normalizedDist = dist / (MAIN_CAVERN_RADIUS + 5);
            const ceilingHeight = Math.sqrt(1 - normalizedDist * normalizedDist) * 0.6 * (MAIN_CAVERN_RADIUS + 5);
            const stalactiteLength = 1 + seededRandom(i * 100 + 3) * 3;
            
            positions.push({
                x: Math.cos(angle) * dist,
                y: ceilingHeight - stalactiteLength / 2, // Hang from ceiling
                z: Math.sin(angle) * dist,
                scaleY: stalactiteLength / 2, // Scale based on length
                tiltX: (seededRandom(i * 100 + 4) - 0.5) * 0.3,
                tiltZ: (seededRandom(i * 100 + 5) - 0.5) * 0.3
            });
        }
        
        // Side cavern stalactites (fewer) - hanging from side cavern ceilings
        // Dome is now at y=0 with height of (SIDE_CAVERN_RADIUS + 2) * 0.5 ≈ 8.5 at center
        TUNNEL_DATA.forEach((tunnel, ti) => {
            for (let i = 0; i < 2; i++) {
                const angle = seededRandom(ti * 1000 + i * 50) * Math.PI * 2;
                const dist = seededRandom(ti * 1000 + i * 50 + 1) * (SIDE_CAVERN_RADIUS - 3);
                const stalactiteLength = 0.8 + seededRandom(ti * 1000 + i * 50 + 2) * 2;
                
                // Calculate ceiling height at this distance from center (dome shape)
                const domeRadius = SIDE_CAVERN_RADIUS + 2;
                const normalizedDist = dist / domeRadius;
                const ceilingHeight = Math.sqrt(Math.max(0, 1 - normalizedDist * normalizedDist)) * 0.5 * domeRadius;
                
                positions.push({
                    x: tunnel.sideCavernX + Math.cos(angle) * dist,
                    y: ceilingHeight - stalactiteLength / 2, // Hang from calculated ceiling height
                    z: tunnel.sideCavernZ + Math.sin(angle) * dist,
                    scaleY: stalactiteLength / 2,
                    tiltX: (seededRandom(ti * 1000 + i * 50 + 3) - 0.5) * 0.2,
                    tiltZ: (seededRandom(ti * 1000 + i * 50 + 4) - 0.5) * 0.2
                });
            }
        });
        
        return { geometry: geo, positions };
    }, []);

    useEffect(() => {
        if (!meshRef.current) return;
        
        const dummy = new THREE.Object3D();
        
        for (let i = 0; i < positions.length && i < COUNT; i++) {
            const p = positions[i];
            dummy.position.set(p.x, p.y, p.z);
            // Rotate PI around X to point DOWN (cone tip faces down)
            dummy.rotation.set(Math.PI + p.tiltX, 0, p.tiltZ);
            dummy.scale.set(1, p.scaleY, 1);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [positions]);

    return (
        <instancedMesh ref={meshRef} args={[geometry, undefined, COUNT]} castShadow>
            <meshStandardMaterial color="#2a2520" roughness={0.95} />
        </instancedMesh>
    );
};

// --- INSTANCED STALAGMITES (Performance optimized) ---
// Stalagmites grow UP from the FLOOR
const StalagmiteSystem = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const COUNT = 25; // Reduced from 50+
    
    const { geometry, positions } = useMemo(() => {
        const geo = new THREE.ConeGeometry(0.6, 2, 6);
        const positions: { x: number, z: number, scaleY: number }[] = [];
        
        // Main cavern stalagmites (avoid center treasure pile)
        for (let i = 0; i < 20; i++) {
            const angle = seededRandom(i * 200) * Math.PI * 2;
            const dist = 10 + seededRandom(i * 200 + 1) * (MAIN_CAVERN_RADIUS - 15);
            positions.push({
                x: Math.cos(angle) * dist,
                z: Math.sin(angle) * dist,
                scaleY: 0.5 + seededRandom(i * 200 + 2) * 1.5
            });
        }
        
        // Side cavern stalagmites (fewer)
        TUNNEL_DATA.forEach((tunnel, ti) => {
            const angle = seededRandom(ti * 2000) * Math.PI * 2;
            const dist = 3 + seededRandom(ti * 2000 + 1) * (SIDE_CAVERN_RADIUS - 5);
            positions.push({
                x: tunnel.sideCavernX + Math.cos(angle) * dist,
                z: tunnel.sideCavernZ + Math.sin(angle) * dist,
                scaleY: 0.4 + seededRandom(ti * 2000 + 2) * 1
            });
        });
        
        return { geometry: geo, positions };
    }, []);

    useEffect(() => {
        if (!meshRef.current) return;
        
        const dummy = new THREE.Object3D();
        
        for (let i = 0; i < positions.length && i < COUNT; i++) {
            const p = positions[i];
            const height = p.scaleY * 2;
            // Position base at floor (y=0), cone points UP by default
            dummy.position.set(p.x, height / 2, p.z);
            dummy.rotation.set(0, 0, 0); // No rotation - cone points up naturally
            dummy.scale.set(1, p.scaleY, 1);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [positions]);

    return (
        <instancedMesh ref={meshRef} args={[geometry, undefined, COUNT]} castShadow receiveShadow>
            <meshStandardMaterial color="#2a2520" roughness={0.95} />
        </instancedMesh>
    );
};

// --- CAVE WALLS (simplified) ---
const CaveWall = ({ innerRadius, outerRadius, height, startAngle, endAngle }: {
    innerRadius: number,
    outerRadius: number,
    height: number,
    startAngle: number,
    endAngle: number
}) => {
    const geometry = useMemo(() => {
        const shape = new THREE.Shape();
        const segments = 16; // Reduced from 32
        const angleRange = endAngle - startAngle;
        
        for (let i = 0; i <= segments; i++) {
            const angle = startAngle + (i / segments) * angleRange;
            const x = Math.cos(angle) * outerRadius;
            const y = Math.sin(angle) * outerRadius;
            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        
        for (let i = segments; i >= 0; i--) {
            const angle = startAngle + (i / segments) * angleRange;
            const x = Math.cos(angle) * innerRadius;
            const y = Math.sin(angle) * innerRadius;
            shape.lineTo(x, y);
        }
        
        shape.closePath();
        
        return new THREE.ExtrudeGeometry(shape, { steps: 1, depth: height, bevelEnabled: false });
    }, [innerRadius, outerRadius, startAngle, endAngle, height]);

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial 
                color="#1a1815" 
                emissive="#000000"
                emissiveIntensity={0}
                roughness={0.95} 
            />
        </mesh>
    );
};

const CaveWallSystem = () => {
    const wallSegments = useMemo(() => {
        const segments: { startAngle: number, endAngle: number }[] = [];
        // Increase tunnel opening gap - use wider angle to prevent walls from blocking entrances
        // TUNNEL_WIDTH is 6, at radius 40, that's about 0.15 rad, add 0.15 more for clearance
        const tunnelHalfAngle = Math.atan2((TUNNEL_WIDTH / 2) + 2, MAIN_CAVERN_RADIUS - 2) + 0.05;
        
        for (let i = 0; i < TUNNEL_ANGLES.length; i++) {
            const currentTunnel = TUNNEL_ANGLES[i];
            const nextTunnel = TUNNEL_ANGLES[(i + 1) % TUNNEL_ANGLES.length];
            
            let startAngle = currentTunnel + tunnelHalfAngle;
            let endAngle = nextTunnel - tunnelHalfAngle;
            
            if (endAngle < startAngle) endAngle += Math.PI * 2;
            
            segments.push({ startAngle, endAngle });
        }
        
        return segments;
    }, []);

    return (
        <group>
            {wallSegments.map((seg, i) => (
                <CaveWall
                    key={i}
                    innerRadius={MAIN_CAVERN_RADIUS - 2}
                    outerRadius={MAIN_CAVERN_RADIUS + 3}
                    height={20}
                    startAngle={seg.startAngle}
                    endAngle={seg.endAngle}
                />
            ))}
        </group>
    );
};

// --- TUNNEL SYSTEM ---
const Tunnel = ({ tunnel }: { tunnel: typeof TUNNEL_DATA[0] }) => {
    // Tunnel walls start at outer edge of main cavern wall (MAIN_CAVERN_RADIUS + 3)
    // Floor/ceiling extend through the wall gap for smooth transition
    const wallStart = MAIN_CAVERN_RADIUS + 3; // Walls start after main cavern walls end
    const tunnelEnd = MAIN_CAVERN_RADIUS + TUNNEL_LENGTH + 5; // Extend to connect with side cavern
    const wallLength = tunnelEnd - wallStart;
    const wallMidDistance = (wallStart + tunnelEnd) / 2;
    
    // Floor/ceiling extend further to cover the wall gap area
    const floorStart = MAIN_CAVERN_RADIUS - 3; // Start inside main cavern (through wall gap)
    const floorLength = tunnelEnd - floorStart;
    const floorMidDistance = (floorStart + tunnelEnd) / 2;
    
    const wallMidX = Math.cos(tunnel.angle) * wallMidDistance;
    const wallMidZ = Math.sin(tunnel.angle) * wallMidDistance;
    const floorMidX = Math.cos(tunnel.angle) * floorMidDistance;
    const floorMidZ = Math.sin(tunnel.angle) * floorMidDistance;
    
    return (
        <group>
            {/* Tunnel floor - extends through wall gap into main cavern */}
            <mesh 
                position={[floorMidX, 0.02, floorMidZ]} 
                rotation={[-Math.PI / 2, 0, tunnel.angle + Math.PI / 2]}
                receiveShadow
            >
                <planeGeometry args={[TUNNEL_WIDTH + 2, floorLength]} />
                <meshStandardMaterial color="#1a1815" roughness={0.95} />
            </mesh>
            
            {/* Tunnel ceiling - extends through wall gap */}
            <mesh 
                position={[floorMidX, 8, floorMidZ]} 
                rotation={[Math.PI / 2, 0, tunnel.angle + Math.PI / 2]}
            >
                <planeGeometry args={[TUNNEL_WIDTH + 2, floorLength]} />
                <meshStandardMaterial 
                    color="#1a1815" 
                    roughness={0.95} 
                    side={THREE.BackSide} 
                />
            </mesh>
            
            {/* Left wall - starts after main cavern walls */}
            <mesh 
                position={[
                    wallMidX + Math.cos(tunnel.angle + Math.PI / 2) * (TUNNEL_WIDTH / 2 + 1),
                    4,
                    wallMidZ + Math.sin(tunnel.angle + Math.PI / 2) * (TUNNEL_WIDTH / 2 + 1)
                ]} 
                rotation={[0, tunnel.angle, 0]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[2, 8, wallLength]} />
                <meshStandardMaterial 
                    color="#1a1815" 
                    roughness={0.95} 
                />
            </mesh>
            
            {/* Right wall */}
            <mesh 
                position={[
                    wallMidX + Math.cos(tunnel.angle - Math.PI / 2) * (TUNNEL_WIDTH / 2 + 1),
                    4,
                    wallMidZ + Math.sin(tunnel.angle - Math.PI / 2) * (TUNNEL_WIDTH / 2 + 1)
                ]} 
                rotation={[0, tunnel.angle, 0]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[2, 8, wallLength]} />
                <meshStandardMaterial 
                    color="#1a1815" 
                    roughness={0.95} 
                />
            </mesh>
        </group>
    );
};

// --- SIDE CAVERN ---
const SideCavern = ({ tunnel }: { tunnel: typeof TUNNEL_DATA[0] }) => {
    const geometry = useMemo(() => {
        // Create hemisphere dome that arches UPWARD (positive Y scale)
        const geo = new THREE.SphereGeometry(SIDE_CAVERN_RADIUS + 2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        geo.scale(1, 0.5, 1); // Positive Y so dome curves upward
        return geo;
    }, []);

    return (
        <group position={[tunnel.sideCavernX, 0, tunnel.sideCavernZ]}>
            {/* Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[SIDE_CAVERN_RADIUS, 24]} />
                <meshStandardMaterial color="#1a1815" roughness={0.95} />
            </mesh>
            
            {/* Ceiling dome - positioned at ground level, arches up */}
            <mesh position={[0, 0, 0]} geometry={geometry}>
                <meshStandardMaterial 
                    color="#1a1815" 
                    roughness={0.95} 
                    side={THREE.BackSide}
                />
            </mesh>
        </group>
    );
};

// --- JEWEL COLORS (Rainbow spectrum for multi-color effect) ---
const JEWEL_COLORS = [
    { color: new THREE.Color('#FF0000'), name: 'red' },        // Red
    { color: new THREE.Color('#FF7F00'), name: 'orange' },     // Orange
    { color: new THREE.Color('#FFFF00'), name: 'yellow' },     // Yellow
    { color: new THREE.Color('#00FF00'), name: 'green' },      // Green
    { color: new THREE.Color('#00FFFF'), name: 'cyan' },       // Cyan
    { color: new THREE.Color('#0080FF'), name: 'blue' },       // Blue
    { color: new THREE.Color('#8000FF'), name: 'purple' },     // Purple
    { color: new THREE.Color('#FF00FF'), name: 'magenta' },    // Magenta
    { color: new THREE.Color('#FF1493'), name: 'pink' },       // Pink
    { color: new THREE.Color('#50C878'), name: 'emerald' },    // Emerald
];

// Collection radius for gems
const GEM_COLLECT_RADIUS = 2.5;

// --- INSTANCED JEWEL SYSTEM (Performance optimized with collection) ---
const JewelSystem = ({ 
    playerPosRef, 
    onGemCollect,
    collectedGemsRef 
}: { 
    playerPosRef: React.MutableRefObject<THREE.Vector3>,
    onGemCollect: (points: number) => void,
    collectedGemsRef: React.MutableRefObject<Set<number>>
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const colorAttributeRef = useRef<THREE.InstancedBufferAttribute | null>(null);
    const JEWEL_COUNT = 50;
    
    const { geometry, jewelData } = useMemo(() => {
        const geo = new THREE.OctahedronGeometry(0.4, 0);
        const data: { x: number, y: number, z: number, baseY: number, offset: number, scale: number, colorIndex: number }[] = [];
        
        // Main cavern jewels
        for (let i = 0; i < 25; i++) {
            const angle = seededRandom(i * 300) * Math.PI * 2;
            const dist = 8 + seededRandom(i * 300 + 1) * (MAIN_CAVERN_RADIUS - 15);
            const y = 1.5 + seededRandom(i * 300 + 2) * 2; // Lower height for easier collection
            
            data.push({
                x: Math.cos(angle) * dist,
                y: y,
                z: Math.sin(angle) * dist,
                baseY: y,
                offset: seededRandom(i * 300 + 4) * 100,
                scale: 0.8 + seededRandom(i * 300 + 5) * 0.4,
                colorIndex: i % JEWEL_COLORS.length
            });
        }
        
        // Tunnel jewels
        let idx = 25;
        TUNNEL_DATA.forEach((tunnel, ti) => {
            for (let i = 0; i < 2 && idx < JEWEL_COUNT; i++) {
                const t = (i + 1) / 3;
                const baseX = Math.cos(tunnel.angle) * (MAIN_CAVERN_RADIUS + t * TUNNEL_LENGTH);
                const baseZ = Math.sin(tunnel.angle) * (MAIN_CAVERN_RADIUS + t * TUNNEL_LENGTH);
                const offset = (seededRandom(ti * 400 + i * 40) - 0.5) * (TUNNEL_WIDTH - 2);
                const perpX = Math.cos(tunnel.angle + Math.PI / 2) * offset;
                const perpZ = Math.sin(tunnel.angle + Math.PI / 2) * offset;
                const y = 1.5 + seededRandom(ti * 400 + i * 40 + 1) * 2;
                
                data.push({
                    x: baseX + perpX,
                    y: y,
                    z: baseZ + perpZ,
                    baseY: y,
                    offset: seededRandom(ti * 400 + i * 40 + 3) * 100,
                    scale: 0.7 + seededRandom(ti * 400 + i * 40 + 4) * 0.3,
                    colorIndex: idx % JEWEL_COLORS.length
                });
                idx++;
            }
            
            // Side cavern jewels
            for (let i = 0; i < 3 && idx < JEWEL_COUNT; i++) {
                const angle = seededRandom(ti * 500 + i * 50) * Math.PI * 2;
                const dist = seededRandom(ti * 500 + i * 50 + 1) * (SIDE_CAVERN_RADIUS - 3);
                const y = 1.5 + seededRandom(ti * 500 + i * 50 + 2) * 2;
                
                data.push({
                    x: tunnel.sideCavernX + Math.cos(angle) * dist,
                    y: y,
                    z: tunnel.sideCavernZ + Math.sin(angle) * dist,
                    baseY: y,
                    offset: seededRandom(ti * 500 + i * 50 + 4) * 100,
                    scale: 0.7 + seededRandom(ti * 500 + i * 50 + 5) * 0.4,
                    colorIndex: idx % JEWEL_COLORS.length
                });
                idx++;
            }
        });
        
        return { geometry: geo, jewelData: data };
    }, []);

    // Initialize color attribute
    useEffect(() => {
        if (meshRef.current) {
            const colors = new Float32Array(JEWEL_COUNT * 3);
            // Initialize with first colors
            for (let i = 0; i < jewelData.length; i++) {
                const colorData = JEWEL_COLORS[jewelData[i].colorIndex];
                colors[i * 3] = colorData.color.r;
                colors[i * 3 + 1] = colorData.color.g;
                colors[i * 3 + 2] = colorData.color.b;
            }
            const colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
            meshRef.current.instanceColor = colorAttr;
            colorAttributeRef.current = colorAttr;
        }
    }, [jewelData]);

    // Animation and collection detection
    useFrame((state) => {
        if (!meshRef.current || !colorAttributeRef.current) return;
        
        const time = state.clock.elapsedTime;
        const dummy = new THREE.Object3D();
        const playerPos = playerPosRef.current;
        const colors = colorAttributeRef.current.array as Float32Array;
        let gemsCollectedThisFrame = 0;
        
        for (let i = 0; i < jewelData.length; i++) {
            const j = jewelData[i];
            
            // Check if already collected
            if (collectedGemsRef.current.has(i)) {
                // Hide collected gems by setting scale to 0
                dummy.position.set(j.x, j.baseY, j.z);
                dummy.scale.setScalar(0);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, dummy.matrix);
                continue;
            }
            
            // Check for collection (player proximity)
            const dx = playerPos.x - j.x;
            const dz = playerPos.z - j.z;
            const distSq = dx * dx + dz * dz;
            
            if (distSq < GEM_COLLECT_RADIUS * GEM_COLLECT_RADIUS) {
                // Collect this gem!
                collectedGemsRef.current.add(i);
                gemsCollectedThisFrame++;
                
                // Hide immediately
                dummy.position.set(j.x, j.baseY, j.z);
                dummy.scale.setScalar(0);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, dummy.matrix);
                continue;
            }
            
            // Rainbow color cycling - each gem cycles through colors at different speeds
            const colorCycleSpeed = 0.5 + (j.offset * 0.02);
            const hue = ((time * colorCycleSpeed) + j.offset * 0.1) % 1;
            const color = new THREE.Color().setHSL(hue, 1.0, 0.5);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            
            // Bobbing animation
            const y = j.baseY + Math.sin(time * 2 + j.offset) * 0.3;
            
            // Rotation and pulsing scale
            const pulseScale = j.scale * (1 + Math.sin(time * 3 + j.offset) * 0.1);
            dummy.position.set(j.x, y, j.z);
            dummy.rotation.y = time * 0.5 + j.offset;
            dummy.rotation.x = time * 0.3 + j.offset * 0.5;
            dummy.scale.setScalar(pulseScale);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        
        // Notify about collected gems
        if (gemsCollectedThisFrame > 0) {
            onGemCollect(gemsCollectedThisFrame * 10); // 10 points per gem
        }
        
        meshRef.current.instanceMatrix.needsUpdate = true;
        colorAttributeRef.current.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[geometry, undefined, JEWEL_COUNT]} castShadow>
            <meshStandardMaterial 
                vertexColors
                emissive="#ffffff"
                emissiveIntensity={0.8}
                metalness={0.4}
                roughness={0.1}
                transparent
                opacity={0.95}
            />
        </instancedMesh>
    );
};

// --- TREASURE PILE (with rainbow cycling colors and collection) ---
const TreasurePile = ({ 
    playerPosRef, 
    onGemCollect,
    collectedGemsRef,
    gemIndexOffset 
}: { 
    playerPosRef: React.MutableRefObject<THREE.Vector3>,
    onGemCollect: (points: number) => void,
    collectedGemsRef: React.MutableRefObject<Set<number>>,
    gemIndexOffset: number
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const colorAttributeRef = useRef<THREE.InstancedBufferAttribute | null>(null);
    const PILE_COUNT = 25;
    
    const { geometry, jewelData } = useMemo(() => {
        const geo = new THREE.OctahedronGeometry(0.5, 0);
        const data: { x: number, y: number, z: number, scale: number, rotY: number, offset: number }[] = [];
        
        const layers = 4;
        let idx = 0;
        for (let layer = 0; layer < layers && idx < PILE_COUNT; layer++) {
            const y = layer * 0.7 + 0.6;
            const radius = 3.5 - layer * 0.6;
            const count = Math.floor(8 - layer * 1.5);
            
            for (let i = 0; i < count && idx < PILE_COUNT; i++) {
                const angle = (i / count) * Math.PI * 2 + layer * 0.3;
                const r = radius * (0.5 + seededRandom(layer * 100 + i) * 0.5);
                
                data.push({
                    x: Math.cos(angle) * r,
                    y: y,
                    z: Math.sin(angle) * r,
                    scale: 0.7 + seededRandom(layer * 100 + i + 100) * 0.5,
                    rotY: seededRandom(layer * 100 + i + 150) * Math.PI * 2,
                    offset: seededRandom(layer * 100 + i + 200) * 100
                });
                idx++;
            }
        }
        
        return { geometry: geo, jewelData: data };
    }, []);

    // Initialize color attribute
    useEffect(() => {
        if (meshRef.current) {
            const colors = new Float32Array(PILE_COUNT * 3);
            for (let i = 0; i < jewelData.length; i++) {
                const colorData = JEWEL_COLORS[i % JEWEL_COLORS.length];
                colors[i * 3] = colorData.color.r;
                colors[i * 3 + 1] = colorData.color.g;
                colors[i * 3 + 2] = colorData.color.b;
            }
            const colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
            meshRef.current.instanceColor = colorAttr;
            colorAttributeRef.current = colorAttr;
        }
    }, [jewelData]);

    useFrame((state) => {
        if (!meshRef.current || !colorAttributeRef.current) return;
        
        const time = state.clock.elapsedTime;
        const dummy = new THREE.Object3D();
        const playerPos = playerPosRef.current;
        const colors = colorAttributeRef.current.array as Float32Array;
        let gemsCollectedThisFrame = 0;
        
        for (let i = 0; i < jewelData.length; i++) {
            const j = jewelData[i];
            const globalGemIndex = gemIndexOffset + i;
            
            // Check if already collected
            if (collectedGemsRef.current.has(globalGemIndex)) {
                dummy.position.set(j.x, j.y, j.z);
                dummy.scale.setScalar(0);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, dummy.matrix);
                continue;
            }
            
            // Check for collection (player proximity to center treasure pile)
            const dx = playerPos.x - j.x;
            const dz = playerPos.z - j.z;
            const distSq = dx * dx + dz * dz;
            
            if (distSq < GEM_COLLECT_RADIUS * GEM_COLLECT_RADIUS) {
                collectedGemsRef.current.add(globalGemIndex);
                gemsCollectedThisFrame++;
                
                dummy.position.set(j.x, j.y, j.z);
                dummy.scale.setScalar(0);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, dummy.matrix);
                continue;
            }
            
            // Rainbow color cycling
            const colorCycleSpeed = 0.8 + (j.offset * 0.02);
            const hue = ((time * colorCycleSpeed) + j.offset * 0.1) % 1;
            const color = new THREE.Color().setHSL(hue, 1.0, 0.55);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            
            // Animation
            const pulseScale = j.scale * (1 + Math.sin(time * 4 + j.offset) * 0.15);
            dummy.position.set(j.x, j.y, j.z);
            dummy.rotation.y = j.rotY + time * 0.5;
            dummy.rotation.x = Math.sin(time * 2 + j.offset) * 0.2;
            dummy.scale.setScalar(pulseScale);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        
        if (gemsCollectedThisFrame > 0) {
            onGemCollect(gemsCollectedThisFrame * 15); // 15 points per treasure gem
        }
        
        meshRef.current.instanceMatrix.needsUpdate = true;
        colorAttributeRef.current.needsUpdate = true;
    });

    return (
        <group position={[0, 0, 0]}>
            {/* Base gold pile */}
            <mesh position={[0, 0.25, 0]} receiveShadow>
                <cylinderGeometry args={[4, 5, 0.5, 16]} />
                <meshStandardMaterial 
                    color="#D4A84B" 
                    emissive="#B8860B"
                    emissiveIntensity={0.3}
                    metalness={0.7}
                    roughness={0.3}
                />
            </mesh>
            
            {/* Jewels */}
            <instancedMesh ref={meshRef} args={[geometry, undefined, PILE_COUNT]} castShadow>
                <meshStandardMaterial 
                    vertexColors
                    emissive="#ffffff"
                    emissiveIntensity={0.8}
                    metalness={0.4}
                    roughness={0.1}
                    transparent
                    opacity={0.95}
                />
            </instancedMesh>
        </group>
    );
};

// --- STRATEGIC CAVE LIGHTING (very dim - flashlight is the main light source) ---
const CaveLighting = () => {
    return (
        <group>
            {/* Central treasure has a subtle glow - the jewels emit some light */}
            <pointLight 
                position={[0, 3, 0]} 
                color="#FFD080" 
                intensity={0.8} 
                distance={15}
                decay={2}
            />
            
            {/* Very faint side cavern glows from jewels */}
            {TUNNEL_DATA.map((tunnel, i) => (
                <pointLight 
                    key={`side-${i}`}
                    position={[tunnel.sideCavernX, 2, tunnel.sideCavernZ]} 
                    color="#6080ff" 
                    intensity={0.3} 
                    distance={10}
                    decay={2}
                />
            ))}
        </group>
    );
};

// --- GIANT SPIDER (Roams and flees from player) ---
const GiantSpider = ({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) => {
    const groupRef = useRef<THREE.Group>(null);
    const legsRef = useRef<THREE.Group[]>([]);
    
    // Spider state
    const stateRef = useRef({
        x: 20,
        z: 20,
        rotation: 0,
        targetX: 20,
        targetZ: 20,
        velocity: { x: 0, z: 0 },
        legPhase: 0,
        isFleeing: false,
        nextWanderTime: 0
    });
    
    const SPIDER_SPEED = 8;
    const FLEE_SPEED = 15;
    const DETECTION_RADIUS = 15;
    const FLEE_DISTANCE = 25;
    
    // Generate valid random position within cave
    const getRandomCavePosition = () => {
        // Pick a random area: main cavern or side cavern
        const areaChoice = Math.random();
        
        if (areaChoice < 0.6) {
            // Main cavern - stay well inside the walls
            const angle = Math.random() * Math.PI * 2;
            const maxDist = MAIN_CAVERN_WALKABLE_RADIUS - 5; // Stay away from walls
            const dist = 8 + Math.random() * (maxDist - 8);
            return {
                x: Math.cos(angle) * dist,
                z: Math.sin(angle) * dist
            };
        } else {
            // Random side cavern
            const tunnelIdx = Math.floor(Math.random() * TUNNEL_DATA.length);
            const tunnel = TUNNEL_DATA[tunnelIdx];
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * (SIDE_CAVERN_RADIUS - 6); // Stay away from walls
            return {
                x: tunnel.sideCavernX + Math.cos(angle) * dist,
                z: tunnel.sideCavernZ + Math.sin(angle) * dist
            };
        }
    };
    
    // Check if position is valid (not colliding with walls)
    const isValidPosition = (x: number, z: number) => {
        return !checkCaveCollision(x, z);
    };
    
    // Find a valid flee direction that doesn't go through walls
    const getValidFleeDirection = (fromX: number, fromZ: number, awayFromX: number, awayFromZ: number) => {
        // Try the direct opposite direction first
        const dx = fromX - awayFromX;
        const dz = fromZ - awayFromZ;
        const baseFleAngle = Math.atan2(dz, dx);
        
        // Try several angles, starting with direct opposite
        const anglesToTry = [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, Math.PI];
        
        for (const offset of anglesToTry) {
            const testAngle = baseFleAngle + offset;
            const testX = fromX + Math.cos(testAngle) * 5;
            const testZ = fromZ + Math.sin(testAngle) * 5;
            
            if (isValidPosition(testX, testZ)) {
                return {
                    x: fromX + Math.cos(testAngle) * FLEE_DISTANCE,
                    z: fromZ + Math.sin(testAngle) * FLEE_DISTANCE
                };
            }
        }
        
        // If no valid direction, just stay put
        return { x: fromX, z: fromZ };
    };
    
    useFrame((state, delta) => {
        if (!groupRef.current) return;
        
        const spider = stateRef.current;
        const playerPos = playerPosRef.current;
        const time = state.clock.elapsedTime;
        
        // Calculate distance to player
        const dx = playerPos.x - spider.x;
        const dz = playerPos.z - spider.z;
        const distToPlayer = Math.sqrt(dx * dx + dz * dz);
        
        // Check if player is nearby
        if (distToPlayer < DETECTION_RADIUS) {
            spider.isFleeing = true;
            
            // Find a valid flee direction that doesn't go through walls
            const fleeTarget = getValidFleeDirection(spider.x, spider.z, playerPos.x, playerPos.z);
            spider.targetX = fleeTarget.x;
            spider.targetZ = fleeTarget.z;
        } else if (spider.isFleeing && distToPlayer > FLEE_DISTANCE) {
            spider.isFleeing = false;
        }
        
        // Wandering behavior when not fleeing
        if (!spider.isFleeing && time > spider.nextWanderTime) {
            const newPos = getRandomCavePosition();
            spider.targetX = newPos.x;
            spider.targetZ = newPos.z;
            spider.nextWanderTime = time + 3 + Math.random() * 5;
        }
        
        // Move towards target
        const targetDx = spider.targetX - spider.x;
        const targetDz = spider.targetZ - spider.z;
        const targetDist = Math.sqrt(targetDx * targetDx + targetDz * targetDz);
        
        if (targetDist > 1) {
            const speed = spider.isFleeing ? FLEE_SPEED : SPIDER_SPEED;
            const moveX = (targetDx / targetDist) * speed * delta;
            const moveZ = (targetDz / targetDist) * speed * delta;
            
            const newX = spider.x + moveX;
            const newZ = spider.z + moveZ;
            
            // Check collision before moving
            if (isValidPosition(newX, newZ)) {
                spider.x = newX;
                spider.z = newZ;
                
                // Update rotation to face movement direction
                spider.rotation = Math.atan2(targetDz, targetDx);
                
                // Animate legs when moving
                spider.legPhase += delta * (spider.isFleeing ? 20 : 12);
            } else {
                // Hit wall, pick new target
                const newPos = getRandomCavePosition();
                spider.targetX = newPos.x;
                spider.targetZ = newPos.z;
            }
        }
        
        // Update group position and rotation
        groupRef.current.position.set(spider.x, 0, spider.z);
        groupRef.current.rotation.y = spider.rotation + Math.PI / 2;
        
        // Animate legs
        legsRef.current.forEach((leg, i) => {
            if (leg) {
                const phase = spider.legPhase + (i * Math.PI / 4);
                const swing = Math.sin(phase) * 0.3;
                leg.rotation.z = swing;
            }
        });
    });

    // Spider leg component
    const SpiderLeg = ({ side, index }: { side: 'left' | 'right', index: number }) => {
        const legIndex = side === 'left' ? index : index + 4;
        const xOffset = side === 'left' ? -1.2 : 1.2;
        const zOffset = -1.5 + index * 1;
        
        return (
            <group 
                ref={(el) => { if (el) legsRef.current[legIndex] = el; }}
                position={[xOffset, 0.8, zOffset]}
                rotation={[0, 0, side === 'left' ? -0.5 : 0.5]}
            >
                {/* Upper leg */}
                <mesh position={[side === 'left' ? -1 : 1, 0.3, 0]} rotation={[0, 0, side === 'left' ? -0.8 : 0.8]}>
                    <cylinderGeometry args={[0.15, 0.1, 2, 6]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
                </mesh>
                {/* Lower leg */}
                <mesh position={[side === 'left' ? -2.2 : 2.2, -0.5, 0]} rotation={[0, 0, side === 'left' ? 0.5 : -0.5]}>
                    <cylinderGeometry args={[0.1, 0.05, 2.5, 6]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
                </mesh>
            </group>
        );
    };

    return (
        <group ref={groupRef}>
            {/* Spider body */}
            <group position={[0, 1.5, 0]}>
                {/* Abdomen (back) */}
                <mesh position={[0, 0.3, -1.5]} castShadow>
                    <sphereGeometry args={[1.8, 12, 10]} />
                    <meshStandardMaterial 
                        color="#0a0a0a" 
                        roughness={0.6}
                        metalness={0.1}
                    />
                </mesh>
                
                {/* Abdomen pattern */}
                <mesh position={[0, 0.8, -1.8]} castShadow>
                    <sphereGeometry args={[0.6, 8, 8]} />
                    <meshStandardMaterial color="#8B0000" roughness={0.5} />
                </mesh>
                <mesh position={[0.4, 0.6, -1.2]} castShadow>
                    <sphereGeometry args={[0.3, 8, 8]} />
                    <meshStandardMaterial color="#8B0000" roughness={0.5} />
                </mesh>
                <mesh position={[-0.4, 0.6, -1.2]} castShadow>
                    <sphereGeometry args={[0.3, 8, 8]} />
                    <meshStandardMaterial color="#8B0000" roughness={0.5} />
                </mesh>
                
                {/* Cephalothorax (front body) */}
                <mesh position={[0, 0, 0.8]} castShadow>
                    <sphereGeometry args={[1.2, 10, 8]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
                </mesh>
                
                {/* Eyes (8 of them) - glowing brightly in the dark */}
                {/* Main eyes with point lights */}
                <mesh position={[0.3, 0.4, 1.8]}>
                    <sphereGeometry args={[0.2, 8, 8]} />
                    <meshBasicMaterial color="#ff0000" />
                    <pointLight position={[0, 0, 0.1]} color="#ff0000" intensity={3} distance={8} decay={2} />
                </mesh>
                <mesh position={[-0.3, 0.4, 1.8]}>
                    <sphereGeometry args={[0.2, 8, 8]} />
                    <meshBasicMaterial color="#ff0000" />
                    <pointLight position={[0, 0, 0.1]} color="#ff0000" intensity={3} distance={8} decay={2} />
                </mesh>
                {/* Secondary eyes with lights */}
                <mesh position={[0.5, 0.6, 1.5]}>
                    <sphereGeometry args={[0.12, 6, 6]} />
                    <meshBasicMaterial color="#ff0000" />
                    <pointLight position={[0, 0, 0]} color="#ff0000" intensity={1.5} distance={5} decay={2} />
                </mesh>
                <mesh position={[-0.5, 0.6, 1.5]}>
                    <sphereGeometry args={[0.12, 6, 6]} />
                    <meshBasicMaterial color="#ff0000" />
                    <pointLight position={[0, 0, 0]} color="#ff0000" intensity={1.5} distance={5} decay={2} />
                </mesh>
                <mesh position={[0.6, 0.3, 1.6]}>
                    <sphereGeometry args={[0.1, 6, 6]} />
                    <meshBasicMaterial color="#ff0000" />
                    <pointLight position={[0, 0, 0]} color="#ff0000" intensity={1} distance={4} decay={2} />
                </mesh>
                <mesh position={[-0.6, 0.3, 1.6]}>
                    <sphereGeometry args={[0.1, 6, 6]} />
                    <meshBasicMaterial color="#ff0000" />
                    <pointLight position={[0, 0, 0]} color="#ff0000" intensity={1} distance={4} decay={2} />
                </mesh>
                
                {/* Fangs */}
                <mesh position={[0.2, -0.3, 1.9]} rotation={[0.5, 0.2, 0]}>
                    <coneGeometry args={[0.1, 0.6, 6]} />
                    <meshStandardMaterial color="#2a2a2a" roughness={0.3} metalness={0.4} />
                </mesh>
                <mesh position={[-0.2, -0.3, 1.9]} rotation={[0.5, -0.2, 0]}>
                    <coneGeometry args={[0.1, 0.6, 6]} />
                    <meshStandardMaterial color="#2a2a2a" roughness={0.3} metalness={0.4} />
                </mesh>
                
                {/* Pedipalps (small front appendages) */}
                <mesh position={[0.4, 0, 1.5]} rotation={[0.3, 0.3, 0]}>
                    <cylinderGeometry args={[0.08, 0.05, 0.6, 6]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
                </mesh>
                <mesh position={[-0.4, 0, 1.5]} rotation={[0.3, -0.3, 0]}>
                    <cylinderGeometry args={[0.08, 0.05, 0.6, 6]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
                </mesh>
            </group>
            
            {/* 8 Legs (4 on each side) */}
            {[0, 1, 2, 3].map(i => (
                <SpiderLeg key={`left-${i}`} side="left" index={i} />
            ))}
            {[0, 1, 2, 3].map(i => (
                <SpiderLeg key={`right-${i}`} side="right" index={i} />
            ))}
            
            {/* Spider's eerie eye glow - casts red light in the darkness */}
            <pointLight 
                position={[0, 2, 1.5]} 
                color="#ff0000" 
                intensity={8} 
                distance={25}
                decay={1.5}
            />
        </group>
    );
};

// --- CAVE PROPS ---
export interface CaveLevelProps {
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
    onExitCave?: () => void;
    onScoreUpdate?: (cb: (prev: number) => number) => void;
    children?: React.ReactNode;
}

// --- MAIN CAVE LEVEL COMPONENT ---
export const CaveLevel: React.FC<CaveLevelProps> = ({ 
    playerPosRef,
    onScoreUpdate,
    children 
}) => {
    const { scene } = useThree();
    
    // Track collected gems (persists across frames)
    const collectedGemsRef = useRef<Set<number>>(new Set());
    
    // Handle gem collection - plays sound and updates score
    const handleGemCollect = useCallback((points: number) => {
        // Play collection sound
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            // Sparkle/chime sound for gem collection
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
            osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
        } catch (e) {
            // Ignore audio errors
        }
        
        // Update score
        if (onScoreUpdate) {
            onScoreUpdate(prev => prev + points);
        }
    }, [onScoreUpdate]);
    
    useEffect(() => {
        return () => {
            scene.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(m => m.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                }
            });
        };
    }, [scene]);

    return (
        <>
            {/* Cave atmosphere - very dark for flashlight exploration */}
            <color attach="background" args={['#050404']} />
            <fog attach="fog" args={['#0a0808', 5, 40]} />
            
            {/* Minimal ambient lighting - just enough to see shapes */}
            <ambientLight intensity={0.05} color="#404040" />
            <hemisphereLight args={['#202020', '#0a0a0a', 0.03]} />
            
            {/* Very dim directional light */}
            <directionalLight 
                position={[20, 40, 20]} 
                intensity={0.05} 
                color="#404050"
            />
            
            {/* Strategic point lights */}
            <CaveLighting />
            
            {/* Cave structure */}
            <CaveFloor />
            <CaveCeiling />
            <CaveWallSystem />
            <StalactiteSystem />
            <StalagmiteSystem />
            
            {/* Tunnels and side caverns */}
            {TUNNEL_DATA.map((tunnel, i) => (
                <React.Fragment key={i}>
                    <Tunnel tunnel={tunnel} />
                    <SideCavern tunnel={tunnel} />
                </React.Fragment>
            ))}
            
            {/* Treasure pile in center (collectible gems) */}
            <TreasurePile 
                playerPosRef={playerPosRef}
                onGemCollect={handleGemCollect}
                collectedGemsRef={collectedGemsRef}
                gemIndexOffset={100} // Offset to avoid collision with JewelSystem indices
            />
            
            {/* Floating jewels (instanced, collectible) */}
            <JewelSystem 
                playerPosRef={playerPosRef}
                onGemCollect={handleGemCollect}
                collectedGemsRef={collectedGemsRef}
            />
            
            {/* Giant Spider - roams and flees from player */}
            <GiantSpider playerPosRef={playerPosRef} />
            
            {/* Children (player, particles, etc.) */}
            {children}
        </>
    );
};

export default CaveLevel;

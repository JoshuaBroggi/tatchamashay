import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { Float, useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Controls, GameProps } from './types';

// Augment React's JSX namespace to include Three.js elements
declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

// --- AUDIO SYSTEM (Singleton AudioContext for performance) ---
let audioCtx: AudioContext | null = null;
const getAudioContext = (): AudioContext => {
    if (!audioCtx) {
        audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

const playSound = (type: 'pop' | 'swing') => {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'pop') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } else {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        }
    } catch (e) {
        // Ignore audio errors
    }
};

// --- COLLISION SYSTEM ---
// Seeded random for deterministic pillar positions
const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

// Generate pillar collision data (deterministic)
const generatePillarColliders = (): { x: number, z: number, radius: number }[] => {
    const colliders = [];
    for (let i = 0; i < 20; i++) {
        const x = (seededRandom(i * 3 + 1) - 0.5) * 80;
        const z = (seededRandom(i * 3 + 2) - 0.5) * 80;
        if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
        
        const scaleX = 1 + seededRandom(i * 3 + 4);
        const scaleZ = 1 + seededRandom(i * 3 + 6);
        // Collision radius based on pillar size (use larger dimension)
        const radius = Math.max(scaleX, scaleZ) * 0.7;
        
        colliders.push({ x, z, radius });
    }
    
    // Add archway pillars
    colliders.push({ x: 0, z: -15, radius: 1.5 });
    colliders.push({ x: 6, z: -15, radius: 1.5 });
    
    return colliders;
};

// Static collision data
const PILLAR_COLLIDERS = generatePillarColliders();
const MOUNTAIN_BOUNDARY_RADIUS = 58; // Inner edge of the mountain ring
const PLAYER_RADIUS = 0.6;

// Poop pile dimensions (center of map) - climbable mountain of poop
const POOP_PILE_POSITION = { x: 0, z: 0 };
const POOP_PILE_BASE_RADIUS = 8.0; // 3x wider base
const POOP_PILE_HEIGHT = 8.0; // Height at the peak (tip)

// Calculate poop pile height at a given position (for climbing)
// Creates a pyramid shape matching the stacked flattened coils
const getPoopPileHeight = (x: number, z: number): number => {
    const dx = x - POOP_PILE_POSITION.x;
    const dz = z - POOP_PILE_POSITION.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist >= POOP_PILE_BASE_RADIUS) return 0;
    
    // Simple pyramid/cone shape - linear taper from edge to peak
    // This gives a smooth climb up the poop pile
    const normalizedDist = dist / POOP_PILE_BASE_RADIUS;
    
    // Pyramid formula: height decreases linearly from center to edge
    // Add slight curve for more natural feel
    const linearHeight = POOP_PILE_HEIGHT * (1 - normalizedDist);
    
    // Add subtle bumps to simulate the coil layers
    const layerBump = Math.sin(normalizedDist * Math.PI * 7) * 0.15 * (1 - normalizedDist);
    
    return Math.max(0, linearHeight + layerBump);
};

// Collision check function (poop pile is climbable, not a collision)
const checkCollision = (newX: number, newZ: number): boolean => {
    // Check mountain boundary (circular)
    const distFromCenter = Math.sqrt(newX * newX + newZ * newZ);
    if (distFromCenter > MOUNTAIN_BOUNDARY_RADIUS) {
        return true; // Collision with mountain boundary
    }
    
    // Check pillar collisions
    for (const pillar of PILLAR_COLLIDERS) {
        const dx = newX - pillar.x;
        const dz = newZ - pillar.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < pillar.radius + PLAYER_RADIUS) {
            return true; // Collision with pillar
        }
    }
    
    return false; // No collision
};

const Floor = () => (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#E6C288" />
    </mesh>
);

// --- GRASS SYSTEM ---
// Cartoonish grass blade component using instanced mesh for performance
const GrassBlade = () => {
    // Create a tapered blade shape
    const geometry = useMemo(() => {
        const shape = new THREE.Shape();
        // Blade shape - wider at bottom, pointed at top
        shape.moveTo(-0.03, 0);
        shape.lineTo(0.03, 0);
        shape.lineTo(0.01, 0.4);
        shape.lineTo(0, 0.5);
        shape.lineTo(-0.01, 0.4);
        shape.lineTo(-0.03, 0);
        
        const extrudeSettings = {
            steps: 1,
            depth: 0.01,
            bevelEnabled: false
        };
        
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }, []);

    return geometry;
};

// Individual grass patch with many blades using instancing
const GrassPatch = ({ position, radius, density, seed }: {
    position: [number, number, number],
    radius: number,
    density: number,
    seed: number
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    
    // Generate blade data
    const { matrices, colors } = useMemo(() => {
        const matrices: THREE.Matrix4[] = [];
        const colors: THREE.Color[] = [];
        const numBlades = Math.floor(density * radius * radius * Math.PI);
        
        // Beautiful cartoonish green palette
        const greenPalette = [
            new THREE.Color('#4ade80'), // Bright green
            new THREE.Color('#22c55e'), // Medium green
            new THREE.Color('#16a34a'), // Deep green
            new THREE.Color('#86efac'), // Light mint
            new THREE.Color('#a3e635'), // Lime green
            new THREE.Color('#84cc16'), // Yellow-green
            new THREE.Color('#65a30d'), // Olive green
        ];
        
        for (let i = 0; i < numBlades; i++) {
            const matrix = new THREE.Matrix4();
            
            // Random position within circular patch
            const angle = seededRandom(seed + i * 3) * Math.PI * 2;
            const dist = Math.sqrt(seededRandom(seed + i * 3 + 1)) * radius;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            
            // Random rotation and lean
            const rotY = seededRandom(seed + i * 3 + 2) * Math.PI * 2;
            const lean = (seededRandom(seed + i * 3 + 3) - 0.5) * 0.4;
            const leanDir = seededRandom(seed + i * 3 + 4) * Math.PI * 2;
            
            // Random scale for variety
            const scaleX = 0.8 + seededRandom(seed + i * 3 + 5) * 0.5;
            const scaleY = 0.6 + seededRandom(seed + i * 3 + 6) * 0.8;
            const scaleZ = scaleX;
            
            // Compose transformation matrix
            const pos = new THREE.Vector3(x, 0, z);
            const quat = new THREE.Quaternion();
            quat.setFromEuler(new THREE.Euler(
                lean * Math.cos(leanDir),
                rotY,
                lean * Math.sin(leanDir)
            ));
            const scale = new THREE.Vector3(scaleX, scaleY, scaleZ);
            
            matrix.compose(pos, quat, scale);
            matrices.push(matrix);
            
            // Pick random color from palette
            const colorIndex = Math.floor(seededRandom(seed + i * 3 + 7) * greenPalette.length);
            colors.push(greenPalette[colorIndex].clone());
        }
        
        return { matrices, colors };
    }, [radius, density, seed]);

    // Apply instance matrices and colors
    useEffect(() => {
        if (!meshRef.current) return;
        
        const mesh = meshRef.current;
        const colorArray = new Float32Array(matrices.length * 3);
        
        for (let i = 0; i < matrices.length; i++) {
            mesh.setMatrixAt(i, matrices[i]);
            colorArray[i * 3] = colors[i].r;
            colorArray[i * 3 + 1] = colors[i].g;
            colorArray[i * 3 + 2] = colors[i].b;
        }
        
        mesh.instanceMatrix.needsUpdate = true;
        
        // Set instance colors
        mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    }, [matrices, colors]);

    // Create blade geometry
    const bladeGeometry = useMemo(() => {
        const shape = new THREE.Shape();
        shape.moveTo(-0.04, 0);
        shape.quadraticCurveTo(-0.02, 0.25, 0, 0.5);
        shape.quadraticCurveTo(0.02, 0.25, 0.04, 0);
        shape.lineTo(-0.04, 0);
        
        const extrudeSettings = {
            steps: 1,
            depth: 0.015,
            bevelEnabled: false
        };
        
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }, []);

    // REMOVED: Per-patch useFrame animation for performance
    // Wind effect removed to reduce useFrame callback overhead

    return (
        <group position={position}>
            <instancedMesh 
                ref={meshRef} 
                args={[bladeGeometry, undefined, matrices.length]}
                castShadow
                receiveShadow
                frustumCulled={true}
            >
                <meshStandardMaterial 
                    color="#4ade80"
                    roughness={0.8}
                    metalness={0.0}
                    side={THREE.FrontSide}
                />
            </instancedMesh>
        </group>
    );
};

// Instanced flower system - all flowers rendered with 3 InstancedMesh calls (stems, petals, centers)
const FlowerSystem = ({ flowers }: { 
    flowers: { position: [number, number, number], color: string, seed: number }[] 
}) => {
    const stemMeshRef = useRef<THREE.InstancedMesh>(null);
    const petalMeshRef = useRef<THREE.InstancedMesh>(null);
    const centerMeshRef = useRef<THREE.InstancedMesh>(null);

    // Pre-calculate all flower data
    const { stemMatrices, petalData, centerMatrices, petalColors } = useMemo(() => {
        const stemMatrices: THREE.Matrix4[] = [];
        const centerMatrices: THREE.Matrix4[] = [];
        const petalData: { matrix: THREE.Matrix4, color: THREE.Color }[] = [];
        const petalColors: THREE.Color[] = [];
        
        const dummy = new THREE.Object3D();
        
        flowers.forEach((flower) => {
            const [fx, fy, fz] = flower.position;
            
            // Stem matrix
            dummy.position.set(fx, fy + 0.15, fz);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            stemMatrices.push(dummy.matrix.clone());
            
            // Center matrix
            dummy.position.set(fx, fy + 0.32, fz);
            dummy.updateMatrix();
            centerMatrices.push(dummy.matrix.clone());
            
            // Petals (6 per flower for simplicity)
            const petalCount = 6;
            const petalColor = new THREE.Color(flower.color);
            for (let i = 0; i < petalCount; i++) {
                const angle = (i / petalCount) * Math.PI * 2;
                dummy.position.set(
                    fx + Math.cos(angle) * 0.08,
                    fy + 0.32,
                    fz + Math.sin(angle) * 0.08
                );
                dummy.rotation.set(0.3, angle, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                petalData.push({ matrix: dummy.matrix.clone(), color: petalColor });
                petalColors.push(petalColor.clone());
            }
        });
        
        return { stemMatrices, petalData, centerMatrices, petalColors };
    }, [flowers]);

    // Apply matrices on mount
    useEffect(() => {
        if (stemMeshRef.current) {
            stemMatrices.forEach((m, i) => stemMeshRef.current!.setMatrixAt(i, m));
            stemMeshRef.current.instanceMatrix.needsUpdate = true;
        }
        
        if (centerMeshRef.current) {
            centerMatrices.forEach((m, i) => centerMeshRef.current!.setMatrixAt(i, m));
            centerMeshRef.current.instanceMatrix.needsUpdate = true;
        }
        
        if (petalMeshRef.current) {
            const colorArray = new Float32Array(petalData.length * 3);
            petalData.forEach((p, i) => {
                petalMeshRef.current!.setMatrixAt(i, p.matrix);
                colorArray[i * 3] = p.color.r;
                colorArray[i * 3 + 1] = p.color.g;
                colorArray[i * 3 + 2] = p.color.b;
            });
            petalMeshRef.current.instanceMatrix.needsUpdate = true;
            petalMeshRef.current.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
        }
    }, [stemMatrices, centerMatrices, petalData]);

    if (flowers.length === 0) return null;

    return (
        <group>
            {/* Stems */}
            <instancedMesh 
                ref={stemMeshRef} 
                args={[undefined, undefined, stemMatrices.length]}
                frustumCulled={true}
            >
                <cylinderGeometry args={[0.02, 0.025, 0.3, 6]} />
                <meshStandardMaterial color="#22c55e" roughness={0.7} />
            </instancedMesh>
            
            {/* Petals */}
            <instancedMesh 
                ref={petalMeshRef} 
                args={[undefined, undefined, petalData.length]}
                frustumCulled={true}
            >
                <sphereGeometry args={[0.06, 6, 4]} />
                <meshStandardMaterial roughness={0.4} />
            </instancedMesh>
            
            {/* Centers */}
            <instancedMesh 
                ref={centerMeshRef} 
                args={[undefined, undefined, centerMatrices.length]}
                frustumCulled={true}
            >
                <sphereGeometry args={[0.05, 6, 6]} />
                <meshStandardMaterial color="#fbbf24" roughness={0.5} />
            </instancedMesh>
        </group>
    );
};

// Complete grass coverage system - covers ~30% of the arena
const GrassPatches = () => {
    const patches = useMemo(() => {
        const result: {
            position: [number, number, number],
            radius: number,
            density: number,
            seed: number
        }[] = [];
        
        // Create organic patches scattered across the arena
        // Large patches
        const numLargePatches = 12;
        for (let i = 0; i < numLargePatches; i++) {
            const angle = (i / numLargePatches) * Math.PI * 2 + seededRandom(i * 100) * 0.5;
            const dist = 20 + seededRandom(i * 100 + 1) * 30;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            
            // Skip if too close to center (player spawn)
            if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
            
            result.push({
                position: [x, 0.01, z],
                radius: 6 + seededRandom(i * 100 + 2) * 4,
                density: 40 + seededRandom(i * 100 + 3) * 20,
                seed: i * 1000
            });
        }
        
        // Medium patches
        const numMediumPatches = 25;
        for (let i = 0; i < numMediumPatches; i++) {
            const x = (seededRandom(i * 200 + 1) - 0.5) * 100;
            const z = (seededRandom(i * 200 + 2) - 0.5) * 100;
            
            // Check boundary and center
            const distFromCenter = Math.sqrt(x * x + z * z);
            if (distFromCenter > 55 || (Math.abs(x) < 6 && Math.abs(z) < 6)) continue;
            
            result.push({
                position: [x, 0.01, z],
                radius: 3 + seededRandom(i * 200 + 3) * 3,
                density: 35 + seededRandom(i * 200 + 4) * 15,
                seed: i * 2000 + 500
            });
        }
        
        // Small scattered patches
        const numSmallPatches = 35;
        for (let i = 0; i < numSmallPatches; i++) {
            const x = (seededRandom(i * 300 + 1) - 0.5) * 110;
            const z = (seededRandom(i * 300 + 2) - 0.5) * 110;
            
            const distFromCenter = Math.sqrt(x * x + z * z);
            if (distFromCenter > 55 || (Math.abs(x) < 5 && Math.abs(z) < 5)) continue;
            
            result.push({
                position: [x, 0.01, z],
                radius: 1.5 + seededRandom(i * 300 + 3) * 2,
                density: 50 + seededRandom(i * 300 + 4) * 20,
                seed: i * 3000 + 1000
            });
        }
        
        return result;
    }, []);

    // Generate flowers for some patches
    const flowers = useMemo(() => {
        const result: {
            position: [number, number, number],
            color: string,
            seed: number
        }[] = [];
        
        const flowerColors = ['#f472b6', '#fb7185', '#fbbf24', '#a78bfa', '#60a5fa', '#f87171'];
        
        // Add flowers to some grass patches
        patches.forEach((patch, patchIndex) => {
            if (seededRandom(patchIndex * 500) > 0.6) return; // Only 40% of patches get flowers
            
            const numFlowers = Math.floor(2 + seededRandom(patchIndex * 500 + 1) * 4);
            for (let i = 0; i < numFlowers; i++) {
                const angle = seededRandom(patchIndex * 500 + i * 10 + 2) * Math.PI * 2;
                const dist = seededRandom(patchIndex * 500 + i * 10 + 3) * patch.radius * 0.7;
                
                result.push({
                    position: [
                        patch.position[0] + Math.cos(angle) * dist,
                        0.01,
                        patch.position[2] + Math.sin(angle) * dist
                    ],
                    color: flowerColors[Math.floor(seededRandom(patchIndex * 500 + i * 10 + 4) * flowerColors.length)],
                    seed: patchIndex * 1000 + i * 100
                });
            }
        });
        
        return result;
    }, [patches]);

    return (
        <group>
            {patches.map((patch, i) => (
                <GrassPatch key={`grass-${i}`} {...patch} />
            ))}
            <FlowerSystem flowers={flowers} />
        </group>
    );
};

const Ruins = () => {
    const pillars = useMemo(() => {
        const items = [];
        for (let i = 0; i < 20; i++) {
            const x = (seededRandom(i * 3 + 1) - 0.5) * 80;
            const z = (seededRandom(i * 3 + 2) - 0.5) * 80;
            if (Math.abs(x) < 5 && Math.abs(z) < 5) continue; 
            
            items.push({
                position: [x, 2, z] as [number, number, number],
                scale: [1 + seededRandom(i * 3 + 4), 4 + seededRandom(i * 3 + 5) * 4, 1 + seededRandom(i * 3 + 6)] as [number, number, number],
                rotation: [0, seededRandom(i * 3 + 7) * Math.PI, 0] as [number, number, number]
            });
        }
        return items;
    }, []);

    return (
        <group>
            {pillars.map((p, i) => (
                <mesh key={i} position={p.position} scale={p.scale} rotation={p.rotation} castShadow receiveShadow>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color="#D2B48C" roughness={0.9} />
                </mesh>
            ))}
            {/* Archway */}
            <mesh position={[0, 3, -15]} castShadow receiveShadow>
                <boxGeometry args={[2, 6, 2]} />
                <meshStandardMaterial color="#C19A6B" />
            </mesh>
            <mesh position={[6, 3, -15]} castShadow receiveShadow>
                <boxGeometry args={[2, 6, 2]} />
                <meshStandardMaterial color="#C19A6B" />
            </mesh>
            <mesh position={[3, 7, -15]} castShadow receiveShadow>
                <boxGeometry args={[10, 2, 2]} />
                <meshStandardMaterial color="#C19A6B" />
            </mesh>
        </group>
    );
};

// --- MOUNTAIN SYSTEM ---
// Individual realistic mountain peak with rocky texture and snow cap
const MountainPeak = ({ position, height, baseRadius, rotation, seed }: {
    position: [number, number, number],
    height: number,
    baseRadius: number,
    rotation: number,
    seed: number
}) => {
    const geometry = useMemo(() => {
        // Create cone geometry and displace vertices for rocky appearance
        const geo = new THREE.ConeGeometry(baseRadius, height, 12, 8);
        const positionAttribute = geo.attributes.position;
        const vertex = new THREE.Vector3();
        
        // Displace vertices to create rocky, irregular surface
        for (let i = 0; i < positionAttribute.count; i++) {
            vertex.fromBufferAttribute(positionAttribute, i);
            
            // Don't displace the very bottom vertices much
            const normalizedY = (vertex.y + height / 2) / height;
            
            // Create noise-like displacement based on position
            const noise = Math.sin(vertex.x * 2 + seed) * 
                         Math.cos(vertex.z * 2 + seed * 0.7) * 
                         Math.sin(vertex.y * 0.5 + seed * 1.3);
            
            const displacement = noise * baseRadius * 0.3 * normalizedY;
            
            // Add horizontal displacement for jagged look
            vertex.x += displacement * Math.cos(seed + i);
            vertex.z += displacement * Math.sin(seed + i * 0.7);
            
            // Add vertical ridges
            const ridge = Math.sin(Math.atan2(vertex.z, vertex.x) * 8 + seed) * 
                         baseRadius * 0.15 * normalizedY;
            const dist = Math.sqrt(vertex.x * vertex.x + vertex.z * vertex.z);
            if (dist > 0.1) {
                vertex.x *= 1 + ridge / dist;
                vertex.z *= 1 + ridge / dist;
            }
            
            positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        
        geo.computeVertexNormals();
        return geo;
    }, [height, baseRadius, seed]);

    // Create snow cap geometry - sized to fit the mountain's taper
    // Cone geometry: base at -height/2, tip at +height/2
    // At any local Y, radius = baseRadius * (0.5 - Y/height)
    const snowCapY = height * 0.25; // Position snow cap at 25% above center (75% up the mountain)
    const mountainRadiusAtSnowCap = baseRadius * (0.5 - snowCapY / height);
    const snowCapRadius = mountainRadiusAtSnowCap * 0.95; // Slightly smaller to sit on surface
    const snowCapHeight = height * 0.25; // Height of the snow cap cone

    // Color variation for rock
    const rockColor = useMemo(() => {
        const hue = 25 + (seed % 20) - 10; // Brown-ish hue with variation
        const saturation = 15 + (seed % 10);
        const lightness = 25 + (seed % 15);
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }, [seed]);

    return (
        <group position={position} rotation={[0, rotation, 0]}>
            {/* Main mountain body */}
            <mesh geometry={geometry} castShadow receiveShadow>
                <meshStandardMaterial 
                    color={rockColor}
                    roughness={0.95}
                    metalness={0.05}
                    flatShading
                />
            </mesh>
            
            {/* Snow cap for taller mountains */}
            {height > 30 && (
                <mesh position={[0, snowCapY, 0]} castShadow>
                    <coneGeometry args={[snowCapRadius, snowCapHeight, 10, 4]} />
                    <meshStandardMaterial 
                        color="#F5F5F5"
                        roughness={0.7}
                        metalness={0.1}
                    />
                </mesh>
            )}
            
            {/* Secondary snow patches on very tall peaks */}
            {height > 45 && (
                <>
                    {/* Calculate mountain radius at patch positions */}
                    <mesh position={[mountainRadiusAtSnowCap * 0.4, snowCapY - 2, mountainRadiusAtSnowCap * 0.3]} castShadow>
                        <sphereGeometry args={[snowCapRadius * 0.25, 6, 6]} />
                        <meshStandardMaterial color="#EEEEEE" roughness={0.8} />
                    </mesh>
                    <mesh position={[-mountainRadiusAtSnowCap * 0.5, snowCapY - 4, -mountainRadiusAtSnowCap * 0.4]} castShadow>
                        <sphereGeometry args={[snowCapRadius * 0.2, 6, 6]} />
                        <meshStandardMaterial color="#E8E8E8" roughness={0.8} />
                    </mesh>
                </>
            )}
        </group>
    );
};

// Mountain cluster - group of peaks for more natural look
const MountainCluster = ({ centerX, centerZ, mainHeight, clusterSeed }: {
    centerX: number,
    centerZ: number,
    mainHeight: number,
    clusterSeed: number
}) => {
    const peaks = useMemo(() => {
        const result = [];
        
        // Main peak
        result.push({
            position: [centerX, 0, centerZ] as [number, number, number],
            height: mainHeight,
            baseRadius: mainHeight * 0.5,
            rotation: clusterSeed * 0.5,
            seed: clusterSeed
        });
        
        // Secondary peaks around the main one
        const numSecondary = 2 + Math.floor(clusterSeed % 3);
        for (let i = 0; i < numSecondary; i++) {
            const angle = (i / numSecondary) * Math.PI * 2 + clusterSeed;
            const dist = mainHeight * 0.4 + (clusterSeed * i) % 10;
            const secondaryHeight = mainHeight * (0.5 + (clusterSeed * i * 0.1) % 0.3);
            
            result.push({
                position: [
                    centerX + Math.cos(angle) * dist,
                    0,
                    centerZ + Math.sin(angle) * dist
                ] as [number, number, number],
                height: secondaryHeight,
                baseRadius: secondaryHeight * 0.45,
                rotation: angle + clusterSeed,
                seed: clusterSeed + i * 17
            });
        }
        
        // Smaller foothills
        const numFoothills = 3 + Math.floor(clusterSeed % 4);
        for (let i = 0; i < numFoothills; i++) {
            const angle = (i / numFoothills) * Math.PI * 2 + clusterSeed * 0.3;
            const dist = mainHeight * 0.7 + (clusterSeed * i * 0.5) % 15;
            const footHillHeight = mainHeight * (0.2 + (clusterSeed * i * 0.05) % 0.15);
            
            result.push({
                position: [
                    centerX + Math.cos(angle) * dist,
                    0,
                    centerZ + Math.sin(angle) * dist
                ] as [number, number, number],
                height: footHillHeight,
                baseRadius: footHillHeight * 0.6,
                rotation: angle * 2,
                seed: clusterSeed + i * 31 + 100
            });
        }
        
        return result;
    }, [centerX, centerZ, mainHeight, clusterSeed]);

    return (
        <group>
            {peaks.map((peak, i) => (
                <MountainPeak key={i} {...peak} />
            ))}
        </group>
    );
};

// --- GIANT POOP PILE ---
// Classic 💩 emoji pyramid shape - stacked flattened coils tapering to curled tip
// 3x wider at the base
const PoopPile = () => {
    // Multiple brown shades for that classic poop look
    const poopColor = '#8B4513'; // Saddle brown (main)
    const poopHighlight = '#A0522D'; // Sienna (lighter)
    const poopDark = '#5D3A1A'; // Dark brown
    const poopMid = '#6B4423'; // Medium brown
    
    return (
        <group position={[POOP_PILE_POSITION.x, 0, POOP_PILE_POSITION.z]}>
            {/* === LAYER 1 - MASSIVE BASE (3x wider) === */}
            {/* Flattened ellipsoid coil */}
            <mesh position={[0, 0.8, 0]} scale={[6.5, 1.0, 6.5]} castShadow receiveShadow>
                <sphereGeometry args={[1, 20, 16]} />
                <meshStandardMaterial color={poopDark} roughness={0.7} metalness={0.05} />
            </mesh>
            
            {/* === LAYER 2 - Offset coil === */}
            <mesh position={[0.8, 1.9, 0.5]} scale={[5.0, 1.0, 5.0]} castShadow receiveShadow>
                <sphereGeometry args={[1, 18, 14]} />
                <meshStandardMaterial color={poopHighlight} roughness={0.65} metalness={0.05} />
            </mesh>
            
            {/* === LAYER 3 - Getting smaller === */}
            <mesh position={[-0.5, 3.0, -0.3]} scale={[3.8, 1.0, 3.8]} castShadow receiveShadow>
                <sphereGeometry args={[1, 16, 14]} />
                <meshStandardMaterial color={poopColor} roughness={0.6} metalness={0.05} />
            </mesh>
            
            {/* === LAYER 4 - Smaller still === */}
            <mesh position={[0.4, 4.0, 0.2]} scale={[2.8, 0.9, 2.8]} castShadow receiveShadow>
                <sphereGeometry args={[1, 14, 12]} />
                <meshStandardMaterial color={poopMid} roughness={0.6} metalness={0.05} />
            </mesh>
            
            {/* === LAYER 5 - Small === */}
            <mesh position={[-0.2, 4.9, -0.1]} scale={[2.0, 0.85, 2.0]} castShadow receiveShadow>
                <sphereGeometry args={[1, 14, 12]} />
                <meshStandardMaterial color={poopDark} roughness={0.6} metalness={0.05} />
            </mesh>
            
            {/* === LAYER 6 - Near top === */}
            <mesh position={[0.15, 5.7, 0.1]} scale={[1.3, 0.8, 1.3]} castShadow receiveShadow>
                <sphereGeometry args={[1, 12, 10]} />
                <meshStandardMaterial color={poopHighlight} roughness={0.6} metalness={0.05} />
            </mesh>
            
            {/* === LAYER 7 - Tiny top ball === */}
            <mesh position={[-0.05, 6.4, 0]} scale={[0.7, 0.7, 0.7]} castShadow receiveShadow>
                <sphereGeometry args={[1, 12, 10]} />
                <meshStandardMaterial color={poopColor} roughness={0.6} metalness={0.05} />
            </mesh>
            
            {/* === TOP TIP - The iconic curl === */}
            <group position={[0.1, 7.0, 0.1]} rotation={[0.4, 0.3, 0.3]}>
                {/* Main tip cone */}
                <mesh castShadow receiveShadow>
                    <coneGeometry args={[0.45, 1.3, 10]} />
                    <meshStandardMaterial color={poopDark} roughness={0.6} metalness={0.05} />
                </mesh>
                {/* Curl at very tip */}
                <mesh position={[0.12, 0.55, 0.08]} scale={[0.3, 0.25, 0.3]} castShadow>
                    <sphereGeometry args={[1, 8, 8]} />
                    <meshStandardMaterial color={poopMid} roughness={0.6} metalness={0.05} />
                </mesh>
            </group>
            
            {/* === SMALL POOP LUMPS around base === */}
            <mesh position={[5.8, 0.5, 2.2]} scale={[1.3, 0.8, 1.3]} castShadow receiveShadow>
                <sphereGeometry args={[1, 10, 10]} />
                <meshStandardMaterial color={poopMid} roughness={0.75} metalness={0.02} />
            </mesh>
            <mesh position={[4.2, 0.4, 4.8]} scale={[1.0, 0.7, 1.0]} castShadow receiveShadow>
                <sphereGeometry args={[1, 10, 10]} />
                <meshStandardMaterial color={poopDark} roughness={0.75} metalness={0.02} />
            </mesh>
            <mesh position={[-5.2, 0.5, -2.8]} scale={[1.2, 0.75, 1.2]} castShadow receiveShadow>
                <sphereGeometry args={[1, 10, 10]} />
                <meshStandardMaterial color={poopHighlight} roughness={0.75} metalness={0.02} />
            </mesh>
            <mesh position={[-3.8, 0.4, -5.2]} scale={[0.9, 0.6, 0.9]} castShadow receiveShadow>
                <sphereGeometry args={[1, 10, 10]} />
                <meshStandardMaterial color={poopColor} roughness={0.75} metalness={0.02} />
            </mesh>
            <mesh position={[0.6, 0.45, 6.2]} scale={[1.25, 0.7, 1.25]} castShadow receiveShadow>
                <sphereGeometry args={[1, 10, 10]} />
                <meshStandardMaterial color={poopDark} roughness={0.75} metalness={0.02} />
            </mesh>
            <mesh position={[-0.4, 0.4, -6.0]} scale={[1.1, 0.65, 1.1]} castShadow receiveShadow>
                <sphereGeometry args={[1, 10, 10]} />
                <meshStandardMaterial color={poopMid} roughness={0.75} metalness={0.02} />
            </mesh>
            <mesh position={[-6.3, 0.5, 1.2]} scale={[1.0, 0.7, 1.0]} castShadow receiveShadow>
                <sphereGeometry args={[1, 10, 10]} />
                <meshStandardMaterial color={poopHighlight} roughness={0.75} metalness={0.02} />
            </mesh>
            <mesh position={[6.4, 0.45, -1.8]} scale={[1.15, 0.7, 1.15]} castShadow receiveShadow>
                <sphereGeometry args={[1, 10, 10]} />
                <meshStandardMaterial color={poopColor} roughness={0.75} metalness={0.02} />
            </mesh>
            
            {/* === FLIES === */}
            <Float speed={8} rotationIntensity={0} floatIntensity={2}>
                <mesh position={[3.0, 5.0, 1.5]}>
                    <sphereGeometry args={[0.12, 6, 6]} />
                    <meshBasicMaterial color="#1a1a1a" />
                </mesh>
            </Float>
            <Float speed={6} rotationIntensity={0} floatIntensity={1.5}>
                <mesh position={[-2.0, 6.5, -1.0]}>
                    <sphereGeometry args={[0.1, 6, 6]} />
                    <meshBasicMaterial color="#1a1a1a" />
                </mesh>
            </Float>
            <Float speed={10} rotationIntensity={0} floatIntensity={2.5}>
                <mesh position={[0.5, 8.0, 0.8]}>
                    <sphereGeometry args={[0.11, 6, 6]} />
                    <meshBasicMaterial color="#1a1a1a" />
                </mesh>
            </Float>
            <Float speed={7} rotationIntensity={0} floatIntensity={1.8}>
                <mesh position={[-4.0, 3.0, 3.0]}>
                    <sphereGeometry args={[0.09, 6, 6]} />
                    <meshBasicMaterial color="#1a1a1a" />
                </mesh>
            </Float>
            
            {/* === STINK LINES === */}
            <group position={[0, 8.2, 0]}>
                <mesh position={[-0.4, 0.8, 0]} rotation={[0, 0, 0.12]}>
                    <cylinderGeometry args={[0.05, 0.05, 2.0, 6]} />
                    <meshBasicMaterial color="#90EE90" transparent opacity={0.4} />
                </mesh>
                <mesh position={[0.5, 1.0, 0.25]} rotation={[0, 0, -0.15]}>
                    <cylinderGeometry args={[0.05, 0.05, 2.5, 6]} />
                    <meshBasicMaterial color="#90EE90" transparent opacity={0.35} />
                </mesh>
                <mesh position={[0, 0.7, -0.4]} rotation={[0.1, 0, 0.05]}>
                    <cylinderGeometry args={[0.04, 0.04, 1.8, 6]} />
                    <meshBasicMaterial color="#90EE90" transparent opacity={0.3} />
                </mesh>
            </group>
        </group>
    );
};

// Complete circular mountain boundary
const MountainBoundary = () => {
    const ARENA_RADIUS = 80; // Distance from center to mountain ring
    const NUM_CLUSTERS = 24; // Number of mountain clusters in the ring

    const clusters = useMemo(() => {
        const result = [];
        
        for (let i = 0; i < NUM_CLUSTERS; i++) {
            const angle = (i / NUM_CLUSTERS) * Math.PI * 2;
            
            // Vary the distance slightly for natural look
            const radiusVariation = ARENA_RADIUS + (Math.sin(i * 3.7) * 8);
            
            const x = Math.cos(angle) * radiusVariation;
            const z = Math.sin(angle) * radiusVariation;
            
            // Vary heights - create some dramatic tall peaks and lower sections
            const baseHeight = 35 + Math.sin(i * 1.5) * 15 + Math.cos(i * 2.3) * 10;
            
            result.push({
                centerX: x,
                centerZ: z,
                mainHeight: baseHeight,
                clusterSeed: i * 47 + 123 // Unique seed for each cluster
            });
        }
        
        return result;
    }, []);

    // Add some inner ring smaller mountains for depth
    const innerMountains = useMemo(() => {
        const result = [];
        const INNER_RADIUS = 65;
        const NUM_INNER = 16;
        
        for (let i = 0; i < NUM_INNER; i++) {
            const angle = (i / NUM_INNER) * Math.PI * 2 + 0.15; // Offset from outer ring
            const x = Math.cos(angle) * INNER_RADIUS;
            const z = Math.sin(angle) * INNER_RADIUS;
            
            result.push({
                position: [x, 0, z] as [number, number, number],
                height: 15 + (i % 5) * 3,
                baseRadius: 8 + (i % 3) * 2,
                rotation: i * 0.7,
                seed: i * 89 + 500
            });
        }
        
        return result;
    }, []);

    return (
        <group>
            {/* Main mountain ring */}
            {clusters.map((cluster, i) => (
                <MountainCluster key={`cluster-${i}`} {...cluster} />
            ))}
            
            {/* Inner ring of smaller peaks for depth */}
            {innerMountains.map((peak, i) => (
                <MountainPeak key={`inner-${i}`} {...peak} />
            ))}
        </group>
    );
};

const Player = ({ controlsRef, onAttack, positionRef, onFootprint, hasClimbedPoopRef }: {
    controlsRef: React.MutableRefObject<Controls>,
    onAttack: () => void,
    positionRef: React.MutableRefObject<THREE.Vector3>,
    onFootprint: (x: number, z: number, rotation: number) => void,
    hasClimbedPoopRef: React.MutableRefObject<boolean>
}) => {
    const group = useRef<THREE.Group>(null);
    const swordRef = useRef<THREE.Group>(null);
    const isAttacking = useRef(false);
    const attackTime = useRef(0);
    const lastFootprintTime = useRef(0);
    const footprintSide = useRef(0); // Alternates 0, 1 for left/right foot
    const { camera } = useThree();
    
    // Load the character model
    const { scene } = useGLTF('/models/deathvader.glb');
    
    // Clone the scene so we can modify it without affecting the cached original
    const clonedScene = useMemo(() => {
        const clone = scene.clone();
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        return clone;
    }, [scene]);

    const SPEED = 10;
    const ROTATION_SPEED = 2.5;
    const ATTACK_DURATION = 0.2;
    const FOOTPRINT_INTERVAL = 0.25; // Time between footprints in seconds
    const POOP_TOP_THRESHOLD = 6.0; // Height to count as "on top" of poop (pyramid is 8.0 tall)

    useFrame((state, delta) => {
        if (!group.current) return;

        const { up, down, left, right, attack } = controlsRef.current;
        
        // --- TANK CONTROLS ---
        
        // Rotation
        if (left) group.current.rotation.y += ROTATION_SPEED * delta;
        if (right) group.current.rotation.y -= ROTATION_SPEED * delta;

        // Calculate Forward Vector based on current rotation
        // Assuming 0 rotation = Facing Z+
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), group.current.rotation.y);

        // Movement with collision detection
        const speed = SPEED * delta;
        const currentPos = group.current.position.clone();
        const isMoving = up || down;
        
        if (up) {
            const movement = forward.clone().multiplyScalar(speed);
            const newX = currentPos.x + movement.x;
            const newZ = currentPos.z + movement.z;
            
            // Check collision and apply movement if no collision
            if (!checkCollision(newX, newZ)) {
                group.current.position.x = newX;
                group.current.position.z = newZ;
            } else {
                // Try sliding along obstacles (check X and Z separately)
                if (!checkCollision(newX, currentPos.z)) {
                    group.current.position.x = newX;
                } else if (!checkCollision(currentPos.x, newZ)) {
                    group.current.position.z = newZ;
                }
            }
        }
        
        if (down) {
            const movement = forward.clone().multiplyScalar(-speed * 0.6);
            const newX = currentPos.x + movement.x;
            const newZ = currentPos.z + movement.z;
            
            if (!checkCollision(newX, newZ)) {
                group.current.position.x = newX;
                group.current.position.z = newZ;
            } else {
                // Try sliding along obstacles
                if (!checkCollision(newX, currentPos.z)) {
                    group.current.position.x = newX;
                } else if (!checkCollision(currentPos.x, newZ)) {
                    group.current.position.z = newZ;
                }
            }
        }

        // Calculate height based on poop pile (climbing!)
        const poopHeight = getPoopPileHeight(group.current.position.x, group.current.position.z);
        group.current.position.y = poopHeight;
        
        // Track if player has reached the top of the poop
        if (poopHeight >= POOP_TOP_THRESHOLD) {
            hasClimbedPoopRef.current = true;
        }
        
        // Leave footprints when on ground (or very close to it) after climbing poop
        // Use threshold < 0.5 to account for floating point and slight slopes
        const isOnGround = poopHeight < 0.5;
        if (hasClimbedPoopRef.current && isOnGround && isMoving) {
            const currentTime = state.clock.elapsedTime;
            if (currentTime - lastFootprintTime.current > FOOTPRINT_INTERVAL) {
                lastFootprintTime.current = currentTime;
                
                // Offset footprint slightly to left or right of center based on which foot
                const sideOffset = (footprintSide.current === 0 ? -0.3 : 0.3);
                const perpendicular = new THREE.Vector3(-forward.z, 0, forward.x);
                const footX = group.current.position.x + perpendicular.x * sideOffset;
                const footZ = group.current.position.z + perpendicular.z * sideOffset;
                
                onFootprint(footX, footZ, group.current.rotation.y);
                footprintSide.current = 1 - footprintSide.current; // Alternate feet
            }
        }

        // Sync ref position for game logic
        positionRef.current.copy(group.current.position);

        // --- STICKY CAMERA FOLLOW ---
        // Camera stays locked behind the player
        const dist = 12;
        const height = 5.5;
        
        // Calculate ideal camera position: PlayerPos + (Forward * -dist) + (Up * height)
        const camOffset = forward.clone().multiplyScalar(-dist).add(new THREE.Vector3(0, height, 0));
        const targetCamPos = group.current.position.clone().add(camOffset);
        
        // Smoothly lerp camera to target
        camera.position.lerp(targetCamPos, 0.1);
        
        // Camera always looks at player's head area
        const lookTarget = group.current.position.clone().add(new THREE.Vector3(0, 2, 0));
        camera.lookAt(lookTarget);

        // --- ATTACK LOGIC ---
        if (attack && !isAttacking.current) {
            isAttacking.current = true;
            attackTime.current = 0;
            playSound('swing');
            onAttack();
        }

        if (isAttacking.current && swordRef.current) {
            attackTime.current += delta;
            const progress = Math.min(attackTime.current / ATTACK_DURATION, 1);
            
            // Swing animation
            const swingAngle = Math.sin(progress * Math.PI) * 2;
            swordRef.current.rotation.x = swingAngle;

            if (progress >= 1) {
                isAttacking.current = false;
                swordRef.current.rotation.x = 0;
            }
        }
    });

    return (
        // Initial rotation Math.PI ensures player starts facing away from camera (Z-)
        // Start position offset to avoid spawning inside the poop pile
        <group ref={group} position={[0, 0, 8]} rotation={[0, Math.PI, 0]}>
            {/* Character Model */}
            <primitive object={clonedScene} scale={2.5} rotation={[0, -Math.PI / 2, 0]} />
            
            {/* Sword Arm Pivot (kept for attack animation) */}
            <group position={[0.6, 1.2, 0]} ref={swordRef}>
                {/* Blade - single tapered cone from base to point */}
                <mesh position={[0, 0.7, 0.3]} rotation={[0, Math.PI/4, 0]} castShadow>
                    <coneGeometry args={[0.12, 1.6, 4]} />
                    <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
                </mesh>
                {/* Handle */}
                <mesh position={[0, -0.3, 0.3]}>
                    <cylinderGeometry args={[0.08, 0.08, 0.4]} />
                    <meshStandardMaterial color="#78350f" />
                </mesh>
                {/* Cross guard */}
                <mesh position={[0, -0.1, 0.3]} rotation={[Math.PI/2, 0, 0]}>
                    <boxGeometry args={[0.4, 0.1, 0.1]} />
                    <meshStandardMaterial color="#fcd34d" />
                </mesh>
            </group>
        </group>
    );
};

// Preload the model for better performance
useGLTF.preload('/models/deathvader.glb');

// Balloon physics constants
const BALLOON_RADIUS = 0.8;
const BALLOON_BOUNCE_STRENGTH = 2.0; // How strongly balloons repel each other
const PLAYER_BOUNCE_STRENGTH = 4.0; // How strongly player pushes balloons
const BALLOON_FRICTION = 0.95; // Velocity damping
const BALLOON_MAX_VELOCITY = 3.0; // Cap velocity to prevent crazy speeds

// Balloon data stored in a ref for physics calculations
interface BalloonPhysics {
    id: string;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    baseY: number; // Original Y for bobbing reference
    color: string;
    offset: number; // For bobbing phase offset
}

// Color mapping for balloon colors to indices
const BALLOON_COLORS = [
    new THREE.Color('#ef4444'), // red
    new THREE.Color('#3b82f6'), // blue
    new THREE.Color('#22c55e'), // green
    new THREE.Color('#eab308'), // yellow
    new THREE.Color('#a855f7'), // purple
];

const COLOR_STRING_TO_INDEX: { [key: string]: number } = {
    '#ef4444': 0,
    '#3b82f6': 1,
    '#22c55e': 2,
    '#eab308': 3,
    '#a855f7': 4,
};

// Instanced balloon system - renders all balloons with a single draw call
const BalloonSystem = ({ 
    balloonsRef,
    playerPosRef 
}: { 
    balloonsRef: React.MutableRefObject<BalloonPhysics[]>,
    playerPosRef: React.MutableRefObject<THREE.Vector3>
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const colorArray = useRef<Float32Array | null>(null);
    const MAX_BALLOONS = 3100; // Slightly more than needed for respawns

    // Initialize color array
    useEffect(() => {
        if (meshRef.current && !colorArray.current) {
            colorArray.current = new Float32Array(MAX_BALLOONS * 3);
        }
    }, []);

    useFrame((state, delta) => {
        if (!meshRef.current) return;
        
        const balloons = balloonsRef.current;
        const time = state.clock.elapsedTime;
        
        // Cap delta to prevent physics explosions on lag spikes
        const dt = Math.min(delta, 0.05);

        // --- PHYSICS UPDATE (moved from BalloonPhysicsUpdater) ---
        if (balloons.length > 0) {
            // Build spatial grid for efficient collision detection
            const grid: Map<string, number[]> = new Map();
            for (let i = 0; i < balloons.length; i++) {
                const b = balloons[i];
                const key = getGridKey(b.x, b.z);
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key)!.push(i);
            }

            // Check balloon-balloon collisions using spatial grid
            const collisionDist = BALLOON_RADIUS * 2;
            const collisionDistSq = collisionDist * collisionDist;

            for (let i = 0; i < balloons.length; i++) {
                const b1 = balloons[i];
                const neighborKeys = getNeighborKeys(b1.x, b1.z);

                for (const key of neighborKeys) {
                    const cellIndices = grid.get(key);
                    if (!cellIndices) continue;

                    for (const j of cellIndices) {
                        if (j <= i) continue;

                        const b2 = balloons[j];
                        const dx = b2.x - b1.x;
                        const dy = b2.y - b1.y;
                        const dz = b2.z - b1.z;
                        const distSq = dx * dx + dy * dy + dz * dz;

                        if (distSq < collisionDistSq && distSq > 0.001) {
                            const dist = Math.sqrt(distSq);
                            const overlap = collisionDist - dist;
                            
                            const nx = dx / dist;
                            const ny = dy / dist;
                            const nz = dz / dist;

                            const force = overlap * BALLOON_BOUNCE_STRENGTH * dt;
                            
                            b1.vx -= nx * force;
                            b1.vy -= ny * force * 0.3;
                            b1.vz -= nz * force;
                            
                            b2.vx += nx * force;
                            b2.vy += ny * force * 0.3;
                            b2.vz += nz * force;
                        }
                    }
                }
            }

            // Check balloon-player collisions
            const playerPos = playerPosRef.current;
            const playerBalloonDist = BALLOON_RADIUS + PLAYER_RADIUS;
            const playerBalloonDistSq = playerBalloonDist * playerBalloonDist;

            for (const b of balloons) {
                const dx = b.x - playerPos.x;
                const dy = b.y - (playerPos.y + 1.5);
                const dz = b.z - playerPos.z;
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < playerBalloonDistSq && distSq > 0.001) {
                    const dist = Math.sqrt(distSq);
                    const overlap = playerBalloonDist - dist;
                    
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const nz = dz / dist;

                    const force = overlap * PLAYER_BOUNCE_STRENGTH * dt;
                    
                    b.vx += nx * force;
                    b.vy += ny * force * 0.5;
                    b.vz += nz * force;
                }
            }

            // Update balloon positions and apply friction/constraints
            for (const b of balloons) {
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                b.z += b.vz * dt;

                b.vx *= BALLOON_FRICTION;
                b.vy *= BALLOON_FRICTION;
                b.vz *= BALLOON_FRICTION;

                const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
                if (speed > BALLOON_MAX_VELOCITY) {
                    const scale = BALLOON_MAX_VELOCITY / speed;
                    b.vx *= scale;
                    b.vy *= scale;
                    b.vz *= scale;
                }

                const distFromCenter = Math.sqrt(b.x * b.x + b.z * b.z);
                if (distFromCenter > MOUNTAIN_BOUNDARY_RADIUS - 5) {
                    const pushBack = (distFromCenter - (MOUNTAIN_BOUNDARY_RADIUS - 5)) * 0.1;
                    b.vx -= (b.x / distFromCenter) * pushBack;
                    b.vz -= (b.z / distFromCenter) * pushBack;
                }

                const heightDiff = b.y - b.baseY;
                b.vy -= heightDiff * 0.5 * dt;
                
                b.y = Math.max(1, Math.min(b.y, 6));
            }
        }

        // --- VISUAL UPDATE ---
        const colors = colorArray.current;

        for (let i = 0; i < balloons.length; i++) {
            const b = balloons[i];
            
            // Calculate position with bobbing animation
            const bobbing = Math.sin(time * 2 + b.offset) * 0.3;
            dummy.position.set(b.x, b.y + bobbing, b.z);
            
            // Gentle rotation for delightful animation
            dummy.rotation.y = time * 0.5 + b.offset;
            
            // IMPORTANT: Reset scale to 1 for active balloons
            dummy.scale.set(1, 1, 1);
            
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);

            // Update colors
            if (colors) {
                const colorIndex = COLOR_STRING_TO_INDEX[b.color] ?? 0;
                const color = BALLOON_COLORS[colorIndex];
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            }
        }

        // Hide unused instances by scaling to 0
        for (let i = balloons.length; i < MAX_BALLOONS; i++) {
            dummy.position.set(0, -100, 0); // Move off-screen
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        
        // Update instance colors (only recreate attribute when needed)
        if (colors && meshRef.current.instanceColor) {
            (meshRef.current.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
        } else if (colors) {
            meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
        }
    });

    return (
        <instancedMesh 
            ref={meshRef} 
            args={[undefined, undefined, MAX_BALLOONS]}
            castShadow
            frustumCulled={false} // Disable culling since we manage visibility manually
        >
            <sphereGeometry args={[BALLOON_RADIUS, 12, 12]} />
            <meshStandardMaterial 
                roughness={0.3} 
                metalness={0.1}
            />
        </instancedMesh>
    );
};

// Optimized spatial grid for collision detection
const GRID_CELL_SIZE = 4; // Size of each grid cell

const getGridKey = (x: number, z: number): string => {
    const gx = Math.floor(x / GRID_CELL_SIZE);
    const gz = Math.floor(z / GRID_CELL_SIZE);
    return `${gx},${gz}`;
};

const getNeighborKeys = (x: number, z: number): string[] => {
    const gx = Math.floor(x / GRID_CELL_SIZE);
    const gz = Math.floor(z / GRID_CELL_SIZE);
    const keys: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            keys.push(`${gx + dx},${gz + dz}`);
        }
    }
    return keys;
};

// BalloonPhysicsUpdater removed - physics now handled inside BalloonSystem for efficiency

const Particles = ({ particles }: { particles: { pos: THREE.Vector3, color: string, id: string }[] }) => {
    return (
        <group>
            {particles.map(p => (
                <ParticleBurst key={p.id} position={p.pos} color={p.color} />
            ))}
        </group>
    );
};

// Optimized particle burst using Points geometry instead of individual meshes
const ParticleBurst = ({ position, color }: { position: THREE.Vector3, color: string }) => {
    const pointsRef = useRef<THREE.Points>(null);
    const velocitiesRef = useRef<THREE.Vector3[]>([]);
    const scaleRef = useRef(1);

    // Generate particle data - reduced from 400 to 40 for performance
    const { positions, velocities } = useMemo(() => {
        const count = 40;
        const positions = new Float32Array(count * 3);
        const velocities: THREE.Vector3[] = [];
        
        for (let i = 0; i < count; i++) {
            // Start at origin (relative to group)
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            
            // Random velocity direction
            const vel = new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).normalize().multiplyScalar(Math.random() * 2 + 1);
            velocities.push(vel);
        }
        
        return { positions, velocities };
    }, []);

    // Store velocities in ref for animation
    useEffect(() => {
        velocitiesRef.current = velocities;
        scaleRef.current = 1;
    }, [velocities]);

    useFrame((state, delta) => {
        if (!pointsRef.current) return;
        
        const geometry = pointsRef.current.geometry;
        const posAttr = geometry.attributes.position as THREE.BufferAttribute;
        const vels = velocitiesRef.current;
        
        // Update particle positions
        for (let i = 0; i < vels.length; i++) {
            posAttr.array[i * 3] += vels[i].x * delta * 5;
            posAttr.array[i * 3 + 1] += vels[i].y * delta * 5;
            posAttr.array[i * 3 + 2] += vels[i].z * delta * 5;
        }
        posAttr.needsUpdate = true;
        
        // Shrink particles over time
        scaleRef.current *= 0.92;
        const material = pointsRef.current.material as THREE.PointsMaterial;
        material.size = 0.3 * scaleRef.current;
    });

    return (
        <points ref={pointsRef} position={position}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={positions.length / 3}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial 
                color={color} 
                size={0.3} 
                sizeAttenuation={true}
                transparent
                opacity={0.9}
            />
        </points>
    );
};

// --- FOOTPRINT SYSTEM ---
// Brown footprints left on the ground after climbing the poop pile
interface Footprint {
    id: string;
    x: number;
    z: number;
    rotation: number;
    opacity: number;
    createdAt: number;
}

const FootprintSystem = ({ footprints }: { footprints: Footprint[] }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const MAX_FOOTPRINTS = 200;

    useFrame(() => {
        if (!meshRef.current) return;
        
        for (let i = 0; i < footprints.length && i < MAX_FOOTPRINTS; i++) {
            const fp = footprints[i];
            dummy.position.set(fp.x, 0.02, fp.z); // Slightly above ground
            dummy.rotation.set(-Math.PI / 2, 0, fp.rotation); // Flat on ground, rotated to match direction
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        
        // Hide unused instances
        for (let i = footprints.length; i < MAX_FOOTPRINTS; i++) {
            dummy.position.set(0, -100, 0);
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    // Create footprint shape (oval/shoe shape) - bigger and more visible
    const footprintGeometry = useMemo(() => {
        const shape = new THREE.Shape();
        // Create a larger oval footprint shape
        shape.ellipse(0, 0, 0.3, 0.6, 0, Math.PI * 2, false, 0);
        
        const extrudeSettings = {
            steps: 1,
            depth: 0.03,
            bevelEnabled: false
        };
        
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }, []);

    return (
        <instancedMesh 
            ref={meshRef} 
            args={[footprintGeometry, undefined, MAX_FOOTPRINTS]}
            receiveShadow
        >
            <meshStandardMaterial 
                color="#5D3A1A" // Dark brown (poop color)
                roughness={0.9}
                metalness={0.0}
                transparent
                opacity={0.8}
            />
        </instancedMesh>
    );
};

const Game3D: React.FC<GameProps> = ({ isPlaying, controlsRef, onScoreUpdate }) => {
    // Use a ref to store balloon physics data (mutable, doesn't trigger re-renders)
    const balloonsRef = useRef<BalloonPhysics[]>([]);
    const [particles, setParticles] = useState<{ id: string, pos: THREE.Vector3, color: string }[]>([]);
    const [footprints, setFootprints] = useState<Footprint[]>([]);
    const hasClimbedPoopRef = useRef(false);
    
    const playerPos = useRef(new THREE.Vector3(0, 0, 8));

    useEffect(() => {
        console.log("Game3D Mounted");
    }, []);

    // Initialize Balloons and reset game state
    useEffect(() => {
        if (isPlaying) {
            // Reset footprints and climbing state for new game
            setFootprints([]);
            hasClimbedPoopRef.current = false;
            
            const newBalloons: BalloonPhysics[] = [];
            const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];
            // Create balloons with physics properties
            for(let i=0; i<3000; i++) {
                let x = (Math.random()-0.5)*120;
                let z = (Math.random()-0.5)*120;
                // Keep starting area clear - also avoid the poop pile area
                if (Math.abs(x) < 12 && Math.abs(z) < 12) x += 20;

                const baseY = 1.5 + Math.random() * 2;
                newBalloons.push({
                    id: Math.random().toString(),
                    x,
                    y: baseY,
                    z,
                    vx: 0,
                    vy: 0,
                    vz: 0,
                    baseY,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    offset: Math.random() * 100
                });
            }
            balloonsRef.current = newBalloons;
        }
    }, [isPlaying]);

    const handlePopEffect = (pos: THREE.Vector3, color: string) => {
        const id = Math.random().toString();
        setParticles(prev => [...prev, { id, pos, color }]);
        setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), 1000);
    };

    const handleFootprint = (x: number, z: number, rotation: number) => {
        const id = Math.random().toString();
        const newFootprint: Footprint = {
            id,
            x,
            z,
            rotation,
            opacity: 0.8,
            createdAt: Date.now()
        };
        
        setFootprints(prev => {
            // Keep only the last 200 footprints for performance
            const updated = [...prev, newFootprint];
            if (updated.length > 200) {
                return updated.slice(-200);
            }
            return updated;
        });
    };

    const handleAttack = () => {
        const swordPos = playerPos.current.clone();
        // Shift check position slightly forward and up to match sword location
        swordPos.y += 1;
        
        const RANGE = 4.0;
        let hits = 0;

        // Filter balloons in range
        const surviving: BalloonPhysics[] = [];
        for (const b of balloonsRef.current) {
            const bPos = new THREE.Vector3(b.x, b.y, b.z);
            if (bPos.distanceTo(swordPos) < RANGE) {
                playSound('pop');
                handlePopEffect(bPos, b.color);
                hits++;
            } else {
                surviving.push(b);
            }
        }

        // Respawn mechanic: Keep the world full
        if (surviving.length < 2900) {
            const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];
            // Spawn multiple at once to refill faster
            for(let k=0; k<3; k++) {
                let x = (Math.random()-0.5)*120;
                let z = (Math.random()-0.5)*120;
                if (Math.abs(x) < 15 && Math.abs(z) < 15) x += 20;
                
                const baseY = 1.5 + Math.random() * 2;
                surviving.push({
                    id: Math.random().toString(),
                    x,
                    y: baseY,
                    z,
                    vx: 0,
                    vy: 0,
                    vz: 0,
                    baseY,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    offset: Math.random() * 100
                });
            }
        }

        balloonsRef.current = surviving;

        if (hits > 0) {
            onScoreUpdate(prev => prev + hits);
        }
    };

    return (
        <>
            <ambientLight intensity={0.6} />
            <hemisphereLight args={['#87CEEB', '#5C4033', 0.6]} />
            <Environment preset="sunset" environmentIntensity={0.5} />
            <directionalLight 
                position={[80, 150, 80]} 
                intensity={1.5} 
                castShadow 
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-120}
                shadow-camera-right={120}
                shadow-camera-top={120}
                shadow-camera-bottom={-120}
                shadow-camera-far={400}
            />

            <Floor />
            <GrassPatches />
            <Ruins />
            <MountainBoundary />
            <PoopPile />
            
            <Player 
                controlsRef={controlsRef} 
                onAttack={handleAttack} 
                positionRef={playerPos}
                onFootprint={handleFootprint}
                hasClimbedPoopRef={hasClimbedPoopRef}
            />
            
            {/* Footprints left after climbing poop */}
            <FootprintSystem footprints={footprints} />
            
            {/* Instanced balloon system - single draw call for all balloons */}
            <BalloonSystem balloonsRef={balloonsRef} playerPosRef={playerPos} />

            <Particles particles={particles} />
        </>
    );
};

export default Game3D;
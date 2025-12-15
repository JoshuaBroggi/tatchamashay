import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Float, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Door } from './Door';

// Player radius constant - must be defined before use in generateMountainColliders
export const PLAYER_RADIUS = 0.6;

// Helper to dispose material and its textures
const disposeMaterial = (material: THREE.Material) => {
    material.dispose();
    
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

// --- COLLISION SYSTEM ---
// Seeded random for deterministic pillar positions
const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};


// Generate mountain collision data (deterministic)
const generateMountainColliders = (): { x: number, z: number, radius: number, height: number }[] => {
    const colliders = [];
    const ARENA_RADIUS = 80;
    const NUM_CLUSTERS = 24;

    // Generate collision data for outer mountain clusters
    for (let i = 0; i < NUM_CLUSTERS; i++) {
        const angle = (i / NUM_CLUSTERS) * Math.PI * 2;
        const radiusVariation = ARENA_RADIUS + (Math.sin(i * 3.7) * 8);
        const centerX = Math.cos(angle) * radiusVariation;
        const centerZ = Math.sin(angle) * radiusVariation;
        const mainHeight = 35 + Math.sin(i * 1.5) * 15 + Math.cos(i * 2.3) * 10;
        const clusterSeed = i * 47 + 123;

        // Main peak
        colliders.push({
            x: centerX,
            z: centerZ,
            radius: mainHeight * 0.5 + PLAYER_RADIUS,
            height: mainHeight
        });

        // Secondary peaks
        const numSecondary = 2 + Math.floor(clusterSeed % 3);
        for (let j = 0; j < numSecondary; j++) {
            const secondaryAngle = (j / numSecondary) * Math.PI * 2 + clusterSeed;
            const dist = mainHeight * 0.4 + (clusterSeed * j) % 10;
            const secondaryHeight = mainHeight * (0.5 + (clusterSeed * j * 0.1) % 0.3);

            colliders.push({
                x: centerX + Math.cos(secondaryAngle) * dist,
                z: centerZ + Math.sin(secondaryAngle) * dist,
                radius: secondaryHeight * 0.45 + PLAYER_RADIUS,
                height: secondaryHeight
            });
        }

        // Foothills
        const numFoothills = 3 + Math.floor(clusterSeed % 4);
        for (let j = 0; j < numFoothills; j++) {
            const foothillAngle = (j / numFoothills) * Math.PI * 2 + clusterSeed * 0.3;
            const dist = mainHeight * 0.7 + (clusterSeed * j * 0.5) % 15;
            const footHillHeight = mainHeight * (0.2 + (clusterSeed * j * 0.05) % 0.15);

            colliders.push({
                x: centerX + Math.cos(foothillAngle) * dist,
                z: centerZ + Math.sin(foothillAngle) * dist,
                radius: footHillHeight * 0.6 + PLAYER_RADIUS,
                height: footHillHeight
            });
        }
    }

    // Generate collision data for inner mountains
    const INNER_RADIUS = 65;
    const NUM_INNER = 16;
    for (let i = 0; i < NUM_INNER; i++) {
        const angle = (i / NUM_INNER) * Math.PI * 2 + 0.15;
        const x = Math.cos(angle) * INNER_RADIUS;
        const z = Math.sin(angle) * INNER_RADIUS;
        const height = 15 + (i % 5) * 3;
        const radius = 8 + (i % 3) * 2;

        colliders.push({
            x,
            z,
            radius: radius + PLAYER_RADIUS,
            height
        });
    }

    return colliders;
};

// Static collision data
const MOUNTAIN_COLLIDERS = generateMountainColliders();
export const MOUNTAIN_BOUNDARY_RADIUS = 58;

// Poop pile dimensions
const POOP_PILE_POSITION = { x: 0, z: 0 };
const POOP_PILE_BASE_RADIUS = 8.0;
const POOP_PILE_HEIGHT = 8.0;

// Calculate poop pile height at a given position (for climbing)
export const getPoopPileHeight = (x: number, z: number): number => {
    const dx = x - POOP_PILE_POSITION.x;
    const dz = z - POOP_PILE_POSITION.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist >= POOP_PILE_BASE_RADIUS) return 0;
    
    const normalizedDist = dist / POOP_PILE_BASE_RADIUS;
    const linearHeight = POOP_PILE_HEIGHT * (1 - normalizedDist);
    const layerBump = Math.sin(normalizedDist * Math.PI * 7) * 0.15 * (1 - normalizedDist);
    
    return Math.max(0, linearHeight + layerBump);
};

// Collision check function for OVERWORLD
export const checkOverworldCollision = (newX: number, newZ: number): boolean => {
    const distFromCenter = Math.sqrt(newX * newX + newZ * newZ);
    if (distFromCenter > MOUNTAIN_BOUNDARY_RADIUS) {
        return true;
    }

    for (const mountain of MOUNTAIN_COLLIDERS) {
        const dx = newX - mountain.x;
        const dz = newZ - mountain.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < mountain.radius) {
            return true;
        }
    }

    return false;
};

// --- FLOOR ---
const Floor = () => (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#E6C288" />
    </mesh>
);

// --- GRASS SYSTEM ---
const GrassPatch = ({ position, radius, density, seed }: {
    position: [number, number, number],
    radius: number,
    density: number,
    seed: number
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    
    const { matrices, colors } = useMemo(() => {
        const matrices: THREE.Matrix4[] = [];
        const colors: THREE.Color[] = [];
        const numBlades = Math.floor(density * radius * radius * Math.PI);
        
        const greenPalette = [
            new THREE.Color('#4ade80'),
            new THREE.Color('#22c55e'),
            new THREE.Color('#16a34a'),
            new THREE.Color('#86efac'),
            new THREE.Color('#a3e635'),
            new THREE.Color('#84cc16'),
            new THREE.Color('#65a30d'),
        ];
        
        for (let i = 0; i < numBlades; i++) {
            const matrix = new THREE.Matrix4();
            
            const angle = seededRandom(seed + i * 3) * Math.PI * 2;
            const dist = Math.sqrt(seededRandom(seed + i * 3 + 1)) * radius;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            
            const rotY = seededRandom(seed + i * 3 + 2) * Math.PI * 2;
            const lean = (seededRandom(seed + i * 3 + 3) - 0.5) * 0.4;
            const leanDir = seededRandom(seed + i * 3 + 4) * Math.PI * 2;
            
            const scaleX = 0.8 + seededRandom(seed + i * 3 + 5) * 0.5;
            const scaleY = 0.6 + seededRandom(seed + i * 3 + 6) * 0.8;
            const scaleZ = scaleX;
            
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
            
            const colorIndex = Math.floor(seededRandom(seed + i * 3 + 7) * greenPalette.length);
            colors.push(greenPalette[colorIndex].clone());
        }
        
        return { matrices, colors };
    }, [radius, density, seed]);

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
        mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    }, [matrices, colors]);

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

const FlowerSystem = ({ flowers }: { 
    flowers: { position: [number, number, number], color: string, seed: number }[] 
}) => {
    const stemMeshRef = useRef<THREE.InstancedMesh>(null);
    const petalMeshRef = useRef<THREE.InstancedMesh>(null);
    const centerMeshRef = useRef<THREE.InstancedMesh>(null);

    const { stemMatrices, petalData, centerMatrices } = useMemo(() => {
        const stemMatrices: THREE.Matrix4[] = [];
        const centerMatrices: THREE.Matrix4[] = [];
        const petalData: { matrix: THREE.Matrix4, color: THREE.Color }[] = [];
        
        const dummy = new THREE.Object3D();
        
        flowers.forEach((flower) => {
            const [fx, fy, fz] = flower.position;
            
            dummy.position.set(fx, fy + 0.15, fz);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            stemMatrices.push(dummy.matrix.clone());
            
            dummy.position.set(fx, fy + 0.32, fz);
            dummy.updateMatrix();
            centerMatrices.push(dummy.matrix.clone());
            
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
            }
        });
        
        return { stemMatrices, petalData, centerMatrices };
    }, [flowers]);

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
            <instancedMesh 
                ref={stemMeshRef} 
                args={[undefined, undefined, stemMatrices.length]}
                frustumCulled={true}
            >
                <cylinderGeometry args={[0.02, 0.025, 0.3, 6]} />
                <meshStandardMaterial color="#22c55e" roughness={0.7} />
            </instancedMesh>
            
            <instancedMesh 
                ref={petalMeshRef} 
                args={[undefined, undefined, petalData.length]}
                frustumCulled={true}
            >
                <sphereGeometry args={[0.06, 6, 4]} />
                <meshStandardMaterial roughness={0.4} />
            </instancedMesh>
            
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

const GrassPatches = () => {
    const patches = useMemo(() => {
        const result: {
            position: [number, number, number],
            radius: number,
            density: number,
            seed: number
        }[] = [];
        
        const numLargePatches = 12;
        for (let i = 0; i < numLargePatches; i++) {
            const angle = (i / numLargePatches) * Math.PI * 2 + seededRandom(i * 100) * 0.5;
            const dist = 20 + seededRandom(i * 100 + 1) * 30;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            
            if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
            
            result.push({
                position: [x, 0.01, z],
                radius: 6 + seededRandom(i * 100 + 2) * 4,
                density: 40 + seededRandom(i * 100 + 3) * 20,
                seed: i * 1000
            });
        }
        
        const numMediumPatches = 25;
        for (let i = 0; i < numMediumPatches; i++) {
            const x = (seededRandom(i * 200 + 1) - 0.5) * 100;
            const z = (seededRandom(i * 200 + 2) - 0.5) * 100;
            
            const distFromCenter = Math.sqrt(x * x + z * z);
            if (distFromCenter > 55 || (Math.abs(x) < 6 && Math.abs(z) < 6)) continue;
            
            result.push({
                position: [x, 0.01, z],
                radius: 3 + seededRandom(i * 200 + 3) * 3,
                density: 35 + seededRandom(i * 200 + 4) * 15,
                seed: i * 2000 + 500
            });
        }
        
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

    const flowers = useMemo(() => {
        const result: {
            position: [number, number, number],
            color: string,
            seed: number
        }[] = [];
        
        const flowerColors = ['#f472b6', '#fb7185', '#fbbf24', '#a78bfa', '#60a5fa', '#f87171'];
        
        patches.forEach((patch, patchIndex) => {
            if (seededRandom(patchIndex * 500) > 0.6) return;
            
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


// --- MOUNTAIN SYSTEM ---
const MountainPeak = ({ position, height, baseRadius, rotation, seed }: {
    position: [number, number, number],
    height: number,
    baseRadius: number,
    rotation: number,
    seed: number
}) => {
    const geometry = useMemo(() => {
        const geo = new THREE.ConeGeometry(baseRadius, height, 12, 8);
        const positionAttribute = geo.attributes.position;
        const vertex = new THREE.Vector3();
        
        for (let i = 0; i < positionAttribute.count; i++) {
            vertex.fromBufferAttribute(positionAttribute, i);
            
            const normalizedY = (vertex.y + height / 2) / height;
            
            const noise = Math.sin(vertex.x * 2 + seed) * 
                         Math.cos(vertex.z * 2 + seed * 0.7) * 
                         Math.sin(vertex.y * 0.5 + seed * 1.3);
            
            const displacement = noise * baseRadius * 0.3 * normalizedY;
            
            vertex.x += displacement * Math.cos(seed + i);
            vertex.z += displacement * Math.sin(seed + i * 0.7);
            
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

    const snowCapY = height * 0.25;
    const mountainRadiusAtSnowCap = baseRadius * (0.5 - snowCapY / height);
    const snowCapRadius = mountainRadiusAtSnowCap * 0.95;
    const snowCapHeight = height * 0.25;

    const rockColor = useMemo(() => {
        const hue = 25 + (seed % 20) - 10;
        const saturation = 15 + (seed % 10);
        const lightness = 25 + (seed % 15);
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }, [seed]);

    return (
        <group position={position} rotation={[0, rotation, 0]}>
            <mesh geometry={geometry} castShadow receiveShadow>
                <meshStandardMaterial 
                    color={rockColor}
                    roughness={0.95}
                    metalness={0.05}
                    flatShading
                />
            </mesh>
            
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
            
            {height > 45 && (
                <>
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

const MountainCluster = ({ centerX, centerZ, mainHeight, clusterSeed }: {
    centerX: number,
    centerZ: number,
    mainHeight: number,
    clusterSeed: number
}) => {
    const peaks = useMemo(() => {
        const result = [];
        
        result.push({
            position: [centerX, 0, centerZ] as [number, number, number],
            height: mainHeight,
            baseRadius: mainHeight * 0.5,
            rotation: clusterSeed * 0.5,
            seed: clusterSeed
        });
        
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

const MountainBoundary = () => {
    const ARENA_RADIUS = 80;
    const NUM_CLUSTERS = 24;

    const clusters = useMemo(() => {
        const result = [];
        
        for (let i = 0; i < NUM_CLUSTERS; i++) {
            const angle = (i / NUM_CLUSTERS) * Math.PI * 2;
            const radiusVariation = ARENA_RADIUS + (Math.sin(i * 3.7) * 8);
            
            const x = Math.cos(angle) * radiusVariation;
            const z = Math.sin(angle) * radiusVariation;
            
            const baseHeight = 35 + Math.sin(i * 1.5) * 15 + Math.cos(i * 2.3) * 10;
            
            result.push({
                centerX: x,
                centerZ: z,
                mainHeight: baseHeight,
                clusterSeed: i * 47 + 123
            });
        }
        
        return result;
    }, []);

    const innerMountains = useMemo(() => {
        const result = [];
        const INNER_RADIUS = 65;
        const NUM_INNER = 16;
        
        for (let i = 0; i < NUM_INNER; i++) {
            const angle = (i / NUM_INNER) * Math.PI * 2 + 0.15;
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
            {clusters.map((cluster, i) => (
                <MountainCluster key={`cluster-${i}`} {...cluster} />
            ))}
            {innerMountains.map((peak, i) => (
                <MountainPeak key={`inner-${i}`} {...peak} />
            ))}
        </group>
    );
};

// --- POOP PILE ---
const PoopPile = () => {
    const poopColor = '#8B4513';
    const poopHighlight = '#A0522D';
    const poopDark = '#5D3A1A';
    const poopMid = '#6B4423';
    
    return (
        <group position={[POOP_PILE_POSITION.x, 0, POOP_PILE_POSITION.z]}>
            <mesh position={[0, 0.8, 0]} scale={[6.5, 1.0, 6.5]} castShadow receiveShadow>
                <sphereGeometry args={[1, 20, 16]} />
                <meshStandardMaterial color={poopDark} roughness={0.7} metalness={0.05} />
            </mesh>
            
            <mesh position={[0.8, 1.9, 0.5]} scale={[5.0, 1.0, 5.0]} castShadow receiveShadow>
                <sphereGeometry args={[1, 18, 14]} />
                <meshStandardMaterial color={poopHighlight} roughness={0.65} metalness={0.05} />
            </mesh>
            
            <mesh position={[-0.5, 3.0, -0.3]} scale={[3.8, 1.0, 3.8]} castShadow receiveShadow>
                <sphereGeometry args={[1, 16, 14]} />
                <meshStandardMaterial color={poopColor} roughness={0.6} metalness={0.05} />
            </mesh>
            
            <mesh position={[0.4, 4.0, 0.2]} scale={[2.8, 0.9, 2.8]} castShadow receiveShadow>
                <sphereGeometry args={[1, 14, 12]} />
                <meshStandardMaterial color={poopMid} roughness={0.6} metalness={0.05} />
            </mesh>
            
            <mesh position={[-0.2, 4.9, -0.1]} scale={[2.0, 0.85, 2.0]} castShadow receiveShadow>
                <sphereGeometry args={[1, 14, 12]} />
                <meshStandardMaterial color={poopDark} roughness={0.6} metalness={0.05} />
            </mesh>
            
            <mesh position={[0.15, 5.7, 0.1]} scale={[1.3, 0.8, 1.3]} castShadow receiveShadow>
                <sphereGeometry args={[1, 12, 10]} />
                <meshStandardMaterial color={poopHighlight} roughness={0.6} metalness={0.05} />
            </mesh>
            
            <mesh position={[-0.05, 6.4, 0]} scale={[0.7, 0.7, 0.7]} castShadow receiveShadow>
                <sphereGeometry args={[1, 12, 10]} />
                <meshStandardMaterial color={poopColor} roughness={0.6} metalness={0.05} />
            </mesh>
            
            <group position={[0.1, 7.0, 0.1]} rotation={[0.4, 0.3, 0.3]}>
                <mesh castShadow receiveShadow>
                    <coneGeometry args={[0.45, 1.3, 10]} />
                    <meshStandardMaterial color={poopDark} roughness={0.6} metalness={0.05} />
                </mesh>
                <mesh position={[0.12, 0.55, 0.08]} scale={[0.3, 0.25, 0.3]} castShadow>
                    <sphereGeometry args={[1, 8, 8]} />
                    <meshStandardMaterial color={poopMid} roughness={0.6} metalness={0.05} />
                </mesh>
            </group>
            
            {/* Small poop lumps around base */}
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
            
            {/* Flies */}
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
            
            {/* Stink lines */}
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

// --- CHRISTMAS TREE ---
const ChristmasTree = ({ position }: { position: [number, number, number] }) => {
    const starRef = useRef<THREE.Mesh>(null);
    const lightsRef = useRef<THREE.Group>(null);
    
    useFrame((state) => {
        if (starRef.current) {
            starRef.current.rotation.y = state.clock.elapsedTime * 0.5;
            const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
            starRef.current.scale.set(scale, scale, scale);
        }
    });
    
    const ornaments = useMemo(() => {
        const result: { position: [number, number, number], color: string }[] = [];
        const ornamentColors = ['#ef4444', '#3b82f6', '#fbbf24', '#a855f7', '#ec4899', '#22c55e'];
        
        const tiers = [
            { height: 4, radius: 8, count: 16 },
            { height: 10, radius: 6, count: 12 },
            { height: 16, radius: 4, count: 8 },
            { height: 22, radius: 2.5, count: 5 },
        ];
        
        tiers.forEach((tier, tierIndex) => {
            for (let i = 0; i < tier.count; i++) {
                const angle = (i / tier.count) * Math.PI * 2 + tierIndex * 0.3;
                result.push({
                    position: [
                        Math.cos(angle) * tier.radius * 0.85,
                        tier.height,
                        Math.sin(angle) * tier.radius * 0.85
                    ],
                    color: ornamentColors[(i + tierIndex) % ornamentColors.length]
                });
            }
        });
        
        return result;
    }, []);
    
    const lights = useMemo(() => {
        const result: { position: [number, number, number], color: string, phase: number }[] = [];
        const lightColors = ['#fef08a', '#fde047', '#facc15', '#ffffff', '#fef9c3'];
        
        const numLights = 60;
        for (let i = 0; i < numLights; i++) {
            const t = i / numLights;
            const height = 2 + t * 24;
            const radius = 10 * (1 - t * 0.85);
            const angle = t * Math.PI * 8;
            
            result.push({
                position: [
                    Math.cos(angle) * radius,
                    height,
                    Math.sin(angle) * radius
                ],
                color: lightColors[i % lightColors.length],
                phase: i * 0.5
            });
        }
        
        return result;
    }, []);

    return (
        <group position={position} scale={[0.5, 0.5, 0.5]}>
            <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[1.5, 2, 3, 12]} />
                <meshStandardMaterial color="#5D4037" roughness={0.9} />
            </mesh>
            
            <mesh position={[0, 6, 0]} castShadow receiveShadow>
                <coneGeometry args={[10, 10, 16]} />
                <meshStandardMaterial color="#15803d" roughness={0.8} />
            </mesh>
            
            <mesh position={[0, 12, 0]} castShadow receiveShadow>
                <coneGeometry args={[7.5, 9, 16]} />
                <meshStandardMaterial color="#16a34a" roughness={0.8} />
            </mesh>
            
            <mesh position={[0, 17, 0]} castShadow receiveShadow>
                <coneGeometry args={[5, 7, 16]} />
                <meshStandardMaterial color="#22c55e" roughness={0.8} />
            </mesh>
            
            <mesh position={[0, 22, 0]} castShadow receiveShadow>
                <coneGeometry args={[3, 6, 16]} />
                <meshStandardMaterial color="#4ade80" roughness={0.8} />
            </mesh>
            
            <group position={[0, 26, 0]}>
                <mesh ref={starRef} rotation={[0, 0, 0]}>
                    <octahedronGeometry args={[2, 0]} />
                    <meshStandardMaterial 
                        color="#fcd34d" 
                        emissive="#fcd34d"
                        emissiveIntensity={1}
                        metalness={0.8}
                        roughness={0.2}
                    />
                </mesh>
                <pointLight color="#fcd34d" intensity={5} distance={20} decay={2} />
            </group>
            
            {ornaments.map((orn, i) => (
                <mesh key={`ornament-${i}`} position={orn.position} castShadow>
                    <sphereGeometry args={[0.6, 12, 12]} />
                    <meshStandardMaterial 
                        color={orn.color} 
                        metalness={0.4} 
                        roughness={0.2}
                        emissive={orn.color}
                        emissiveIntensity={0.2}
                    />
                </mesh>
            ))}
            
            <group ref={lightsRef}>
                {lights.map((light, i) => (
                    <mesh key={`light-${i}`} position={light.position}>
                        <sphereGeometry args={[0.25, 6, 6]} />
                        <meshBasicMaterial color={light.color} />
                    </mesh>
                ))}
            </group>
            
            <pointLight position={[0, 12, 0]} color="#fef08a" intensity={2} distance={15} decay={2} />
            
            <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <circleGeometry args={[12, 24]} />
                <meshStandardMaterial color="#f0f9ff" roughness={0.9} />
            </mesh>
            
            {/* Presents */}
            <mesh position={[-4, 1, 3]} rotation={[0, 0.3, 0]} castShadow>
                <boxGeometry args={[2, 2, 2]} />
                <meshStandardMaterial color="#ef4444" roughness={0.6} />
            </mesh>
            <mesh position={[-4, 2.1, 3]} rotation={[0, 0.3, Math.PI / 2]}>
                <boxGeometry args={[0.1, 2.2, 2.2]} />
                <meshStandardMaterial color="#fbbf24" metalness={0.5} />
            </mesh>
            
            <mesh position={[3, 0.75, 4]} rotation={[0, -0.5, 0]} castShadow>
                <boxGeometry args={[1.5, 1.5, 1.5]} />
                <meshStandardMaterial color="#3b82f6" roughness={0.6} />
            </mesh>
            <mesh position={[3, 1.6, 4]} rotation={[0, -0.5, Math.PI / 2]}>
                <boxGeometry args={[0.1, 1.7, 1.7]} />
                <meshStandardMaterial color="#f472b6" metalness={0.5} />
            </mesh>
            
            <mesh position={[0, 0.6, 5]} rotation={[0, 0.8, 0]} castShadow>
                <boxGeometry args={[1.2, 1.2, 1.2]} />
                <meshStandardMaterial color="#a855f7" roughness={0.6} />
            </mesh>
            <mesh position={[0, 1.3, 5]} rotation={[0, 0.8, Math.PI / 2]}>
                <boxGeometry args={[0.1, 1.4, 1.4]} />
                <meshStandardMaterial color="#22c55e" metalness={0.5} />
            </mesh>
        </group>
    );
};

// --- BALLOON SYSTEM ---
export interface BalloonPhysics {
    id: string;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    baseY: number;
    color: string;
    offset: number;
}

const BALLOON_RADIUS = 0.8;
const BALLOON_BOUNCE_STRENGTH = 2.0;
const PLAYER_BOUNCE_STRENGTH = 4.0;
const BALLOON_FRICTION = 0.95;
const BALLOON_MAX_VELOCITY = 3.0;

const BALLOON_COLORS = [
    new THREE.Color('#ef4444'),
    new THREE.Color('#3b82f6'),
    new THREE.Color('#22c55e'),
    new THREE.Color('#eab308'),
    new THREE.Color('#a855f7'),
];

const COLOR_STRING_TO_INDEX: { [key: string]: number } = {
    '#ef4444': 0,
    '#3b82f6': 1,
    '#22c55e': 2,
    '#eab308': 3,
    '#a855f7': 4,
};

const GRID_CELL_SIZE = 4;

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

export const BalloonSystem = ({ 
    balloonsRef,
    playerPosRef,
    remotePlayerPositions = []
}: { 
    balloonsRef: React.MutableRefObject<BalloonPhysics[]>,
    playerPosRef: React.MutableRefObject<THREE.Vector3>,
    remotePlayerPositions?: { x: number; y: number; z: number }[]
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const colorArray = useRef<Float32Array | null>(null);
    const MAX_BALLOONS = 800;

    useEffect(() => {
        if (meshRef.current && !colorArray.current) {
            colorArray.current = new Float32Array(MAX_BALLOONS * 3);
        }
    }, []);

    useFrame((state, delta) => {
        if (!meshRef.current) return;
        
        const balloons = balloonsRef.current;
        const time = state.clock.elapsedTime;
        const dt = Math.min(delta, 0.05);

        if (balloons.length > 0) {
            const grid: Map<string, number[]> = new Map();
            for (let i = 0; i < balloons.length; i++) {
                const b = balloons[i];
                const key = getGridKey(b.x, b.z);
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key)!.push(i);
            }

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

            // Collect all player positions (local + remote)
            const allPlayerPositions = [
                playerPosRef.current,
                ...remotePlayerPositions.map(p => new THREE.Vector3(p.x, p.y, p.z))
            ];
            
            const playerBalloonDist = BALLOON_RADIUS + PLAYER_RADIUS;
            const playerBalloonDistSq = playerBalloonDist * playerBalloonDist;

            // Check collisions against all players
            for (const playerPos of allPlayerPositions) {
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
            }

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

        const colors = colorArray.current;

        for (let i = 0; i < balloons.length; i++) {
            const b = balloons[i];
            
            const bobbing = Math.sin(time * 2 + b.offset) * 0.3;
            dummy.position.set(b.x, b.y + bobbing, b.z);
            dummy.rotation.y = time * 0.5 + b.offset;
            dummy.scale.set(1, 1, 1);
            
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);

            if (colors) {
                const colorIndex = COLOR_STRING_TO_INDEX[b.color] ?? 0;
                const color = BALLOON_COLORS[colorIndex];
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            }
        }

        for (let i = balloons.length; i < MAX_BALLOONS; i++) {
            dummy.position.set(0, -100, 0);
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        
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
            frustumCulled={false}
        >
            <sphereGeometry args={[BALLOON_RADIUS, 12, 12]} />
            <meshStandardMaterial 
                roughness={0.3} 
                metalness={0.1}
            />
        </instancedMesh>
    );
};

// --- FOOTPRINT SYSTEM ---
export interface Footprint {
    id: string;
    x: number;
    z: number;
    rotation: number;
    opacity: number;
    createdAt: number;
}

export const FootprintSystem = ({ footprints }: { footprints: Footprint[] }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const MAX_FOOTPRINTS = 200;

    useFrame(() => {
        if (!meshRef.current) return;
        
        for (let i = 0; i < footprints.length && i < MAX_FOOTPRINTS; i++) {
            const fp = footprints[i];
            dummy.position.set(fp.x, 0.02, fp.z);
            dummy.rotation.set(-Math.PI / 2, 0, fp.rotation);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        
        for (let i = footprints.length; i < MAX_FOOTPRINTS; i++) {
            dummy.position.set(0, -100, 0);
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    const footprintGeometry = useMemo(() => {
        const shape = new THREE.Shape();
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
                color="#5D3A1A"
                roughness={0.9}
                metalness={0.0}
                transparent
                opacity={0.8}
            />
        </instancedMesh>
    );
};

// --- OVERWORLD PROPS ---
export interface OverWorldProps {
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
    onEnterCave: () => void;
    balloonsRef: React.MutableRefObject<BalloonPhysics[]>;
    footprints: Footprint[];
    children?: React.ReactNode;
    remotePlayerPositions?: { x: number; y: number; z: number }[];
}

// --- MAIN OVERWORLD COMPONENT ---
export const OverWorld: React.FC<OverWorldProps> = ({ 
    playerPosRef, 
    onEnterCave,
    balloonsRef,
    footprints,
    children,
    remotePlayerPositions = []
}) => {
    const { gl, scene } = useThree();
    
    // Cleanup on unmount - dispose of Three.js resources to free memory
    useEffect(() => {
        return () => {
            // Clear balloon data to free memory
            balloonsRef.current = [];
            
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
                
                // Dispose instanced meshes
                if (object instanceof THREE.InstancedMesh) {
                    if (object.geometry) {
                        object.geometry.dispose();
                    }
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
    }, [balloonsRef, gl, scene]);

    return (
        <>
            {/* Overworld atmosphere */}
            <color attach="background" args={['#87CEEB']} />
            <fog attach="fog" args={['#87CEEB', 40, 150]} />
            
            <ambientLight intensity={0.6} />
            <hemisphereLight args={['#87CEEB', '#5C4033', 0.6]} />
            <Environment preset="sunset" />
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
            <MountainBoundary />
            <PoopPile />
            
            {/* Christmas Tree - 25 units from the poop pile */}
            <ChristmasTree position={[25, 0, 0]} />
            
            {/* Portal door to cave */}
            <Door 
                position={[12, 0, 0]}
                rotation={[0, -Math.PI / 2, 0]}
                playerPosRef={playerPosRef}
                onPlayerNear={onEnterCave}
            />
            
            {/* Footprints left after climbing poop */}
            <FootprintSystem footprints={footprints} />
            
            {/* Instanced balloon system - single draw call for all balloons */}
            <BalloonSystem balloonsRef={balloonsRef} playerPosRef={playerPosRef} remotePlayerPositions={remotePlayerPositions} />

            {/* Children (player, particles, etc.) */}
            {children}
        </>
    );
};

export default OverWorld;

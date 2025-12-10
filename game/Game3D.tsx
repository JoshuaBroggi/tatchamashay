import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { Float } from '@react-three/drei';
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

// --- AUDIO SYSTEM ---
const playSound = (type: 'pop' | 'swing') => {
    try {
        const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
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

const Floor = () => (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#E6C288" />
    </mesh>
);

const Ruins = () => {
    const pillars = useMemo(() => {
        const items = [];
        for (let i = 0; i < 20; i++) {
            const x = (Math.random() - 0.5) * 80;
            const z = (Math.random() - 0.5) * 80;
            if (Math.abs(x) < 5 && Math.abs(z) < 5) continue; 
            
            items.push({
                position: [x, 2, z] as [number, number, number],
                scale: [1 + Math.random(), 4 + Math.random() * 4, 1 + Math.random()] as [number, number, number],
                rotation: [0, Math.random() * Math.PI, 0] as [number, number, number]
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

const Player = ({ controlsRef, onAttack, positionRef }: { 
    controlsRef: React.MutableRefObject<Controls>, 
    onAttack: () => void,
    positionRef: React.MutableRefObject<THREE.Vector3> 
}) => {
    const group = useRef<THREE.Group>(null);
    const swordRef = useRef<THREE.Group>(null);
    const isAttacking = useRef(false);
    const attackTime = useRef(0);
    const { camera } = useThree();

    const SPEED = 10;
    const ROTATION_SPEED = 2.5;
    const ATTACK_DURATION = 0.2;

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

        // Movement
        const speed = SPEED * delta;
        if (up) group.current.position.add(forward.clone().multiplyScalar(speed));
        if (down) group.current.position.add(forward.clone().multiplyScalar(-speed * 0.6));

        // Keep player on ground
        group.current.position.y = 0;

        // Sync ref position for game logic
        positionRef.current.copy(group.current.position);

        // --- STICKY CAMERA FOLLOW ---
        // Camera stays locked behind the player
        const dist = 12;
        const height = 8;
        
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
        <group ref={group} position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
            <mesh castShadow position={[0, 0.75, 0]}>
                <cylinderGeometry args={[0.5, 0.5, 1.5, 16]} />
                <meshStandardMaterial color="#3b82f6" />
            </mesh>
            <mesh castShadow position={[0, 1.75, 0]}>
                <sphereGeometry args={[0.4, 32, 32]} />
                <meshStandardMaterial color="#fcd34d" metalness={0.5} roughness={0.2} />
            </mesh>
            <mesh position={[0, 2.2, -0.2]} rotation={[Math.PI/4, 0, 0]}>
                <boxGeometry args={[0.1, 0.5, 0.5]} />
                <meshStandardMaterial color="red" />
            </mesh>

            {/* Sword Arm Pivot */}
            <group position={[0.6, 1.2, 0]} ref={swordRef}>
                <mesh position={[0, 0.5, 0.3]} castShadow>
                    <boxGeometry args={[0.1, 1.5, 0.2]} />
                    <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
                </mesh>
                <mesh position={[0, -0.3, 0.3]}>
                    <cylinderGeometry args={[0.08, 0.08, 0.4]} />
                    <meshStandardMaterial color="#78350f" />
                </mesh>
                <mesh position={[0, -0.1, 0.3]} rotation={[Math.PI/2, 0, 0]}>
                    <boxGeometry args={[0.4, 0.1, 0.1]} />
                    <meshStandardMaterial color="#fcd34d" />
                </mesh>
            </group>
        </group>
    );
};

const Balloon = ({ position, color, id }: { position: [number, number, number], color: string, id: string }) => {
    const mesh = useRef<THREE.Mesh>(null);
    const offset = useMemo(() => Math.random() * 100, []);

    useFrame((state) => {
        if (!mesh.current) return;
        // Simple gentle bobbing
        mesh.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + offset) * 0.5;
        mesh.current.rotation.y += 0.01;
    });

    return (
        <group position={[position[0], 0, position[2]]}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                <mesh ref={mesh} position={[0, position[1], 0]} castShadow>
                    <sphereGeometry args={[0.8, 32, 32]} />
                    <meshPhysicalMaterial 
                        color={color} 
                        roughness={0.1} 
                        clearcoat={1} 
                        transmission={0.2}
                        thickness={1}
                    />
                </mesh>
                <mesh position={[0, position[1] - 1.2, 0]}>
                    <cylinderGeometry args={[0.02, 0.02, 1.5]} />
                    <meshBasicMaterial color="white" transparent opacity={0.5} />
                </mesh>
            </Float>
        </group>
    );
};

const Particles = ({ particles }: { particles: { pos: THREE.Vector3, color: string, id: string }[] }) => {
    return (
        <group>
            {particles.map(p => (
                <ParticleBurst key={p.id} position={p.pos} color={p.color} />
            ))}
        </group>
    );
};

const ParticleBurst = ({ position, color }: { position: THREE.Vector3, color: string }) => {
    const group = useRef<THREE.Group>(null);
    useFrame((state, delta) => {
        if (!group.current) return;
        group.current.children.forEach((child) => {
            const mesh = child as THREE.Mesh;
            mesh.position.add(mesh.userData.velocity.clone().multiplyScalar(delta * 5));
            mesh.scale.multiplyScalar(0.9);
        });
    });

    // Increased to 400 particles (50x original)
    const parts = useMemo(() => new Array(400).fill(0).map(() => ({
        velocity: new THREE.Vector3((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)).normalize().multiplyScalar(Math.random() + 0.5),
        scale: Math.random() * 0.3 + 0.1 // Smaller scale so it looks like confetti, not boxes
    })), []);

    return (
        <group ref={group} position={position}>
            {parts.map((p, i) => (
                <mesh key={i} userData={{ velocity: p.velocity }} scale={[p.scale, p.scale, p.scale]}>
                    <boxGeometry args={[0.2, 0.2, 0.2]} />
                    <meshBasicMaterial color={color} />
                </mesh>
            ))}
        </group>
    );
};

const Game3D: React.FC<GameProps> = ({ isPlaying, controlsRef, onScoreUpdate }) => {
    const [balloons, setBalloons] = useState<{ id: string, position: [number, number, number], color: string }[]>([]);
    const [particles, setParticles] = useState<{ id: string, pos: THREE.Vector3, color: string }[]>([]);
    
    const playerPos = useRef(new THREE.Vector3(0, 0, 0));

    useEffect(() => {
        console.log("Game3D Mounted");
    }, []);

    // Initialize Balloons
    useEffect(() => {
        if (isPlaying) {
            const newBalloons = [];
            const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];
            // Tripled to 1200 balloons for a super dense field
            for(let i=0; i<1200; i++) {
                let x = (Math.random()-0.5)*120;
                let z = (Math.random()-0.5)*120;
                // Keep starting area clear
                if (Math.abs(x) < 10 && Math.abs(z) < 10) x += 20;

                newBalloons.push({
                    id: Math.random().toString(),
                    // Lowered height range: 1.0 to 3.5 (Player height is ~1.5)
                    position: [x, 1 + Math.random() * 2.5, z] as [number, number, number],
                    color: colors[Math.floor(Math.random() * colors.length)]
                });
            }
            setBalloons(newBalloons);
        }
    }, [isPlaying]);

    const handlePopEffect = (pos: THREE.Vector3, color: string) => {
        const id = Math.random().toString();
        setParticles(prev => [...prev, { id, pos, color }]);
        setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), 1000);
    };

    const handleAttack = () => {
        const swordPos = playerPos.current.clone();
        // Shift check position slightly forward and up to match sword location
        swordPos.y += 1;
        
        const RANGE = 4.0;
        let hits = 0;

        setBalloons(prev => {
            const next = prev.filter(b => {
                const bPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
                if (bPos.distanceTo(swordPos) < RANGE) {
                    playSound('pop');
                    handlePopEffect(bPos, b.color);
                    hits++;
                    return false;
                }
                return true;
            });
            
            // Respawn mechanic: Keep the world full (Threshold raised to 1100)
            if (next.length < 1100) {
                const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];
                // Spawn multiple at once to refill faster
                for(let k=0; k<3; k++) {
                    let x = (Math.random()-0.5)*120;
                    let z = (Math.random()-0.5)*120;
                    if (Math.abs(x) < 15 && Math.abs(z) < 15) x += 20;
                    next.push({
                        id: Math.random().toString(),
                        position: [x, 1 + Math.random() * 2.5, z],
                        color: colors[Math.floor(Math.random() * colors.length)]
                    });
                }
            }
            return next;
        });

        if (hits > 0) {
            onScoreUpdate(prev => prev + hits);
        }
    };

    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight 
                position={[50, 100, 50]} 
                intensity={1.5} 
                castShadow 
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-60}
                shadow-camera-right={60}
                shadow-camera-top={60}
                shadow-camera-bottom={-60}
            />

            <Floor />
            <Ruins />
            
            <Player controlsRef={controlsRef} onAttack={handleAttack} positionRef={playerPos} />
            
            {balloons.map(b => (
                <Balloon key={b.id} {...b} />
            ))}

            <Particles particles={particles} />
        </>
    );
};

export default Game3D;
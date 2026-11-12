import React, { useRef, useMemo } from 'react';
import { Html, useProgress, Float } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Simple balloon for loading preview (same as LevelSelect)
const LoadingBalloon: React.FC<{ position: [number, number, number], color: string, seed: number }> = ({
    position,
    color,
    seed
}) => {
    const balloonRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        if (balloonRef.current) {
            balloonRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + seed) * 0.3;
            balloonRef.current.rotation.y += delta * 0.5;
        }
    });

    return (
        <group ref={balloonRef} position={position}>
            <mesh castShadow>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0, -0.6, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.8]} />
                <meshStandardMaterial color="#666666" />
            </mesh>
        </group>
    );
};

// Balloon preview scene (same as OverworldPreview from LevelSelect)
const BalloonPreview: React.FC = () => {
    const groupRef = useRef<THREE.Group>(null);

    const balloons = useMemo(() => [
        { position: [-2, 2, -1] as [number, number, number], color: '#ef4444', seed: 1 },
        { position: [1, 3, 0] as [number, number, number], color: '#3b82f6', seed: 2 },
        { position: [2, 2.5, -2] as [number, number, number], color: '#22c55e', seed: 3 },
        { position: [-1, 3.5, 1] as [number, number, number], color: '#eab308', seed: 4 },
        { position: [0, 2.8, -1.5] as [number, number, number], color: '#a855f7', seed: 5 },
    ], []);

    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.3;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Simple ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <circleGeometry args={[4, 32]} />
                <meshStandardMaterial color="#4ADE80" roughness={0.8} />
            </mesh>

            {/* Balloons */}
            {balloons.map((balloon, i) => (
                <LoadingBalloon key={i} {...balloon} />
            ))}

            {/* Sun */}
            <mesh position={[3, 4, -2]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.3} />
            </mesh>
        </group>
    );
};

export const LoadingScreen: React.FC = () => {
    const { progress } = useProgress();

    const bgColor = '#87CEEB';

    return (
        <>
            {/* Set scene background to match loading screen */}
            <color attach="background" args={[bgColor]} />
            <fog attach="fog" args={[bgColor, 15, 30]} />

            {/* Lighting */}
            <ambientLight intensity={1.0} />
            <directionalLight
                position={[5, 8, 5]}
                intensity={2}
                color="#ffffff"
                castShadow
            />
            <pointLight position={[-3, 5, -3]} color="#FFE4B5" intensity={1} />

            {/* 3D Balloon preview - same as Level Selection */}
            <group position={[0, 0, 0]}>
                <Float speed={1} rotationIntensity={0.1} floatIntensity={0.2}>
                    <BalloonPreview />
                </Float>
            </group>

            {/* Loading overlay */}
            <Html
                fullscreen
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    paddingBottom: '60px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        textAlign: 'center',
                    }}
                >
                    {/* Spinning loader */}
                    <div
                        style={{
                            width: '60px',
                            height: '60px',
                            position: 'relative',
                            marginBottom: '16px',
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                border: '5px solid rgba(255, 255, 255, 0.3)',
                                borderTop: '5px solid #ffffff',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                            }}
                        />
                    </div>

                    {/* Loading text */}
                    <p
                        style={{
                            fontSize: '20px',
                            fontWeight: '600',
                            color: '#ffffff',
                            margin: 0,
                            letterSpacing: '3px',
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        }}
                    >
                        LOADING {Math.round(progress)}%
                    </p>
                </div>

                <style>
                    {`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}
                </style>
            </Html>
        </>
    );
};

export default LoadingScreen;

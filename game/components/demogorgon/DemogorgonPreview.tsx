import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { useNavigate } from 'react-router-dom';
import { Demogorgon, DemogorgonAnimation, DemogorgonBuild } from './Demogorgon';
import { Demodog } from '../demodog/Demodog';
import { VineDog } from '../vinedog/VineDog';

export type CreatureKind = 'demogorgon' | 'demodog' | 'vinedog';

const CREATURES: { id: CreatureKind; label: string; path: string }[] = [
    { id: 'demogorgon', label: 'Demogorgon', path: '/demogorgon' },
    { id: 'demodog', label: 'Demodog', path: '/demodog' },
    { id: 'vinedog', label: 'Vine Dog', path: '/vinedog' },
];

const ANIMATIONS: { id: DemogorgonAnimation; label: string }[] = [
    { id: 'idle', label: 'Idle' },
    { id: 'walk', label: 'Stalk' },
    { id: 'attack', label: 'Attack' },
    { id: 'roar', label: 'Roar' },
];

/** Drifting spores, the signature atmosphere of the Upside Down. */
const Spores: React.FC<{ count?: number }> = ({ count = 400 }) => {
    const ref = useRef<THREE.Points>(null);
    const { geometry, speeds } = useMemo(() => {
        const positions = new Float32Array(count * 3);
        const speeds = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 14;
            positions[i * 3 + 1] = Math.random() * 7;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 14;
            speeds[i] = 0.05 + Math.random() * 0.15;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        return { geometry: g, speeds };
    }, [count]);

    useFrame((_s, delta) => {
        const attr = ref.current?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        if (!attr) return;
        for (let i = 0; i < count; i++) {
            let y = attr.getY(i) + speeds[i] * delta;
            if (y > 7) y = 0;
            attr.setY(i, y);
        }
        attr.needsUpdate = true;
    });

    return (
        <points ref={ref} geometry={geometry}>
            <pointsMaterial color="#ffb89a" size={0.035} transparent opacity={0.55} depthWrite={false} sizeAttenuation />
        </points>
    );
};

const Stage: React.FC<{
    creature: CreatureKind;
    animation: DemogorgonAnimation;
    onFinished: (a: DemogorgonAnimation) => void;
    onBuilt: (b: DemogorgonBuild) => void;
    sound: boolean;
}> = ({ creature, animation, onFinished, onBuilt, sound }) => (
    <>
        <color attach="background" args={['#0b0507']} />
        <fog attach="fog" args={['#12070a', 6, 20]} />
        <hemisphereLight args={["#b8b4c4", "#2a1a1a", 1.0]} />
        <directionalLight position={[3, 6, 4]} intensity={2.4} color="#fff0e4" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-near={1} shadow-camera-far={20} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} />
        <directionalLight position={[-4, 3, -4]} intensity={1.2} color="#ff7a55" />
        <pointLight position={[-2.5, 2.2, 3]} intensity={14} color="#6f8dff" distance={9} />
        <Environment resolution={256}>
            <Lightformer form="rect" intensity={2.2} color="#fff0e6" position={[4, 4, 3]} scale={[6, 3, 1]} />
            <Lightformer form="rect" intensity={0.9} color="#ff6a4a" position={[-5, 2, -3]} scale={[6, 4, 1]} />
            <Lightformer form="ring" intensity={1.2} color="#5a7dff" position={[0, 6, 0]} scale={4} rotation={[Math.PI / 2, 0, 0]} />
        </Environment>

        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[12, 64]} />
            <meshStandardMaterial color="#1a0d0f" roughness={0.9} />
        </mesh>

        {creature === 'vinedog' ? (
            <VineDog key="vinedog" animation={animation} onAnimationFinished={onFinished} onBuilt={onBuilt} sound={sound} />
        ) : creature === 'demodog' ? (
            <Demodog key="demodog" animation={animation} onAnimationFinished={onFinished} onBuilt={onBuilt} sound={sound} />
        ) : (
            <Demogorgon key="demogorgon" animation={animation} onAnimationFinished={onFinished} onBuilt={onBuilt} sound={sound} />
        )}
        <Spores />
        <OrbitControls key={creature} target={creature === 'demogorgon' ? [0, 1.2, 0.2] : [0, 0.7, 0.1]} minDistance={1.5} maxDistance={9} maxPolarAngle={Math.PI / 2 - 0.02} />
    </>
);

export const DemogorgonPreview: React.FC<{ initial?: CreatureKind }> = ({ initial = 'demogorgon' }) => {
    const navigate = useNavigate();
    const creature = initial;
    const [animation, setAnimation] = useState<DemogorgonAnimation>('idle');
    const [exporting, setExporting] = useState(false);
    // Browsers keep audio locked until the first click, so the first button press unlocks it.
    const [sound, setSound] = useState(true);
    const buildRef = useRef<DemogorgonBuild | null>(null);

    const handleBuilt = useCallback((b: DemogorgonBuild) => {
        buildRef.current = b;
    }, []);

    const handleFinished = useCallback(() => setAnimation('idle'), []);

    const exportGlb = useCallback(() => {
        const build = buildRef.current;
        if (!build) return;
        setExporting(true);
        new GLTFExporter().parse(
            build.rig.root,
            result => {
                const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${creature}.glb`;
                a.click();
                URL.revokeObjectURL(url);
                setExporting(false);
            },
            error => {
                console.error('Demogorgon GLB export failed', error);
                setExporting(false);
            },
            { binary: true, animations: build.clips },
        );
    }, [creature]);

    return (
        <div className="relative w-full h-screen bg-black">
            <Canvas shadows camera={{ position: [3.2, 1.8, 4.2], fov: 42 }} gl={{ antialias: true }}>
                <Suspense fallback={null}>
                    <Stage creature={creature} animation={animation} onFinished={handleFinished} onBuilt={handleBuilt} sound={sound} />
                </Suspense>
            </Canvas>

            <div className="absolute top-4 left-4 flex items-center gap-3 text-white">
                <button
                    onClick={() => navigate('/')}
                    className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-sm"
                >
                    Home
                </button>
                <h1 className="text-lg font-black tracking-widest text-red-400">{CREATURES.find(c => c.id === creature)!.label.toUpperCase()}</h1>
                {CREATURES.map(c => (
                    <button
                        key={c.id}
                        onClick={() => navigate(c.path)}
                        className={`px-3 py-1.5 rounded text-sm ${creature === c.id ? 'bg-red-600' : 'bg-white/10 hover:bg-white/20'}`}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 backdrop-blur px-3 py-2 rounded-xl border border-white/10">
                {ANIMATIONS.map(a => (
                    <button
                        key={a.id}
                        onClick={() => setAnimation(a.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            animation === a.id ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'
                        }`}
                    >
                        {a.label}
                    </button>
                ))}
                <button
                    onClick={() => setSound(s => !s)}
                    className={`ml-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        sound ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'
                    }`}
                >
                    {sound ? 'Sound on' : 'Sound off'}
                </button>
                <button
                    onClick={exportGlb}
                    disabled={exporting}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-gray-200 hover:bg-white/20 disabled:opacity-50"
                >
                    {exporting ? 'Exporting…' : 'Export GLB'}
                </button>
            </div>
        </div>
    );
};

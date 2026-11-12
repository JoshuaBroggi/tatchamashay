import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { VineDog } from './VineDog';

/** Where the Vine Dog hides, in level coordinates (the far north-west corner of the jungle). */
export const VINE_DOG_TREASURE_POSITION: [number, number] = [-27.6, 23.1];
export const VINE_DOG_TREASURE_SCORE = 100;

const COLLECT_RANGE = 4.5;
/** You start to hear it breathing from this far away. */
const HEARING_RANGE = 24;
const GAME_HEIGHT = 3.2;

interface VineDogTreasureProps {
    playerPosRef: React.MutableRefObject<THREE.Vector3>;
    /** Called once, when the player walks up to it. */
    onCollect: () => void;
}

/**
 * A hidden collectible. It stands still and breathes, quietly at first and louder as the player
 * gets close. Walking up to it makes it roar, awards the score, and it vanishes after the roar.
 * Like the dinosaur eggs, it is tracked per player and does not touch shared game state.
 */
export const VineDogTreasure: React.FC<VineDogTreasureProps> = ({ playerPosRef, onCollect }) => {
    const [phase, setPhase] = useState<'waiting' | 'roaring' | 'gone'>('waiting');
    // Loudness in eighths, so we only re-render when it audibly changes.
    const [hearing, setHearing] = useState(0);
    const hearingRef = useRef(0);

    const [x, z] = VINE_DOG_TREASURE_POSITION;
    // Face the middle of the arena, where players arrive from.
    const facing = Math.atan2(-x, -z);

    useFrame(() => {
        if (phase !== 'waiting') return;
        const dx = playerPosRef.current.x - x;
        const dz = playerPosRef.current.z - z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        const next = Math.round(Math.max(0, 1 - dist / HEARING_RANGE) * 8) / 8;
        if (next !== hearingRef.current) {
            hearingRef.current = next;
            setHearing(next);
        }

        if (dist < COLLECT_RANGE) {
            setPhase('roaring');
            onCollect();
        }
    });

    if (phase === 'gone') return null;

    return (
        <group position={[x, 0, z]} rotation={[0, facing, 0]}>
            <VineDog
                height={GAME_HEIGHT}
                animation={phase === 'roaring' ? 'roar' : 'idle'}
                sound={phase === 'roaring' || hearing > 0}
                volume={phase === 'roaring' ? 0.9 : hearing * 0.6}
                onAnimationFinished={animation => {
                    if (animation === 'roar') setPhase('gone');
                }}
            />
            {/* A faint green glow from its slits, so a careful eye can spot it in the foliage. */}
            <pointLight position={[0, 1.6, 0]} color="#b6e04a" intensity={1.4} distance={9} decay={2} />
        </group>
    );
};

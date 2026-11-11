import * as THREE from 'three';
import { deg, Pose, rotate, TAU } from '../demogorgon/animations';
import { DemogorgonRig, PETAL_COUNT } from '../demogorgon/rig';
import { buildQuadrupedClips, JawStyle } from '../demodog/animations';

/**
 * The Vine Dog shares the Demodog's quadruped skeleton, so it uses the same baked
 * Idle / Walk / Attack / Roar poses. Only the jaws differ: they are bind-posed CLOSED as a
 * long snout, so openness counts up from 0 (shut) to about 1 radian (wide open).
 */
const jaws = (p: Pose, open: number, curl: number, t = 0, wobble = 0) => {
    for (let i = 0; i < PETAL_COUNT; i++) {
        const w = wobble * Math.sin(TAU * (t * 2.5 + i / PETAL_COUNT));
        rotate(p, `petal${i}_base`, deg(Math.max(0, open + w)), 0, 0);
        rotate(p, `petal${i}_tip`, deg(curl + w * 0.8), 0, 0);
    }
};

export const VINE_DOG_JAWS: JawStyle = { petals: jaws, rest: 0.04, coil: 0.4, wide: 1.1, snap: 0, recover: 0.2 };

/** Bakes Idle, Walk, Attack and Roar clips for a rig produced by buildVineDogRig. */
export const buildVineDogClips = (rig: DemogorgonRig): THREE.AnimationClip[] => buildQuadrupedClips(rig, VINE_DOG_JAWS);

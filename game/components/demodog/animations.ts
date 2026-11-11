import * as THREE from 'three';
import {
    bake,
    both,
    CLIP_NAMES,
    move,
    newPose,
    petals,
    Pose,
    resetPose,
    rotate,
    sampleKeys,
    smooth,
    deg,
    TAU,
} from '../demogorgon/animations';
import { DemogorgonRig, PETAL_COUNT } from '../demogorgon/rig';
import { DOG_TOE_COUNT } from './rig';

/**
 * Demodog animation clips, using the same Idle / Walk / Attack / Roar names as the Demogorgon.
 *
 * Axes (bind pose is world-aligned, body runs along +Z):
 *   Spine, neck, head: +X pitches the front end down, -X lifts it.
 *   Tail (points back): +X raises the tip. Y rotation sways spine and tail sideways.
 *   Legs hang down: +X swings the foot back, -X swings it forward.
 *   Petals: `petals(open)` as for the Demogorgon, 1.5 is a flat flower, smaller closes it.
 */

/** How a quadruped's petal head moves: how to pose the jaws and the openness values to use. */
export interface JawStyle {
    petals: (p: Pose, open: number, curl: number, t?: number, wobble?: number) => void;
    rest: number;
    coil: number;
    wide: number;
    snap: number;
    recover: number;
}

/** The Demodog's petals are bind-posed flat, so openness counts up toward a flat flower. */
export const DEMODOG_JAWS: JawStyle = { petals, rest: 0.8, coil: 1.1, wide: 1.63, snap: 0.2, recover: 0.65 };

const IDLE_DURATION = 4;
const WALK_DURATION = 1;
const ATTACK_DURATION = 1.6;
const ROAR_DURATION = 3.2;

const FOOT_BONES = ['L', 'R'].flatMap(S => [
    ...Array.from({ length: DOG_TOE_COUNT }, (_, k) => `toeF${k}${S}`),
    ...Array.from({ length: DOG_TOE_COUNT }, (_, k) => `toeR${k}${S}`),
]);

const tail = (p: Pose, lift: number, swayDegrees: number, ph: number) => {
    // Each tail segment lags the one before it, so the sway travels down the tail like a whip.
    const lags = [1.0, 0.6, 0.2, -0.2];
    lags.forEach((lag, i) => {
        rotate(p, `tail${i + 1}`, lift * (i === 0 ? 1 : 0.6), swayDegrees * (0.7 + i * 0.35) * Math.sin(ph + lag));
    });
};

const crouch = (p: Pose, front: number, rear: number) => {
    both(p, 'humerus', -front * 0.5);
    both(p, 'radius', front);
    both(p, 'femur', -rear * 0.6);
    both(p, 'tibia', rear);
};

/** Low predator stance every clip starts from. */
const rest = (): Pose => {
    const p = newPose();
    crouch(p, 12, 18);
    rotate(p, 'spine2', 2);
    rotate(p, 'neck1', 4);
    rotate(p, 'neck2', 3);
    rotate(p, 'head', -2);
    rotate(p, 'tail1', 8);
    rotate(p, 'tail2', 4);
    return p;
};

/** Keeps paws flat on the ground whatever the legs are doing. */
const flatPaws = (pose: Pose): Pose => {
    for (const S of ['L', 'R']) {
        const hum = pose.rot[`humerus${S}`]?.[0] ?? 0;
        const rad = pose.rot[`radius${S}`]?.[0] ?? 0;
        rotate(pose, `pawF${S}`, -(hum + rad));
        const fem = pose.rot[`femur${S}`]?.[0] ?? 0;
        const tib = pose.rot[`tibia${S}`]?.[0] ?? 0;
        rotate(pose, `metaR${S}`, -(fem + tib));
    }
    return pose;
};

const idlePose = (t: number, st: JawStyle): Pose => {
    const ph = (t / IDLE_DURATION) * TAU;
    const p = rest();
    const breath = Math.sin(ph);

    rotate(p, 'spine2', -1.2 * breath);
    rotate(p, 'chest', -1.5 * breath);
    // The faceless head sweeps side to side, hunting by smell.
    rotate(p, 'neck1', 2.5 * Math.sin(ph * 2 + 1), 9 * Math.sin(ph), 1.5 * Math.sin(ph));
    rotate(p, 'neck2', 3 * Math.sin(ph * 2 + 0.4), 12 * Math.sin(ph + 0.5), 3 * Math.sin(ph * 2));
    rotate(p, 'head', 2 * Math.sin(ph * 2), 8 * Math.sin(ph + 1), 3 * Math.sin(ph * 2 + 2));
    tail(p, 0, 9, ph);
    both(p, 'humerus', 1.5 * Math.sin(ph + 2));
    st.petals(p, st.rest + 0.08 * Math.sin(ph * 2), 0.05, t / IDLE_DURATION, 0.06);
    return p;
};

const walkPose = (t: number, st: JawStyle): Pose => {
    const ph = (t / WALK_DURATION) * TAU;
    const p = rest();

    // Diagonal pairs move together: front-left with rear-right, then front-right with rear-left.
    for (const [F, B, offset] of [['L', 'R', 0], ['R', 'L', Math.PI]] as const) {
        const f = ph + offset;
        const swing = Math.max(0, -Math.sin(f)); // 1 while the paw is in the air
        const plant = Math.max(0, Math.sin(f));
        rotate(p, `humerus${F}`, -26 * Math.cos(f));
        rotate(p, `radius${F}`, -34 * swing + 6 * plant);
        rotate(p, `femur${B}`, -24 * Math.cos(f));
        rotate(p, `tibia${B}`, 36 * swing + 4 * plant);
        for (let k = 0; k < DOG_TOE_COUNT; k++) {
            rotate(p, `toeF${k}${F}`, 10 * swing);
            rotate(p, `toeR${k}${B}`, 12 * swing);
        }
    }

    // The spine snakes with each stride; the head stays level and low.
    rotate(p, 'spine1', 2 * Math.sin(ph * 2), 6 * Math.cos(ph));
    rotate(p, 'spine2', 0, -7 * Math.cos(ph));
    rotate(p, 'chest', 0, -5 * Math.cos(ph));
    rotate(p, 'neck2', 3 * Math.sin(ph * 2 + 0.5), 7 * Math.cos(ph));
    rotate(p, 'head', 3 * Math.sin(ph * 2), -4 * Math.cos(ph));
    tail(p, 4, 14, ph);
    st.petals(p, st.rest + 0.05 + 0.08 * Math.sin(ph * 2), 0.05, t / WALK_DURATION, 0.06);
    return p;
};

const attackKeys = (st: JawStyle): { t: number; pose: Pose }[] => {
    const ready = rest();
    st.petals(ready, st.rest, 0.04);

    // Sink onto the haunches, head cocked back, petals starting to part.
    const coil = rest();
    crouch(coil, 14, 36);
    rotate(coil, 'spine1', -6);
    rotate(coil, 'spine2', -8);
    rotate(coil, 'chest', -6);
    rotate(coil, 'neck1', -14);
    rotate(coil, 'head', -8);
    rotate(coil, 'tail1', 12);
    move(coil, 'root', 0, 0, -0.14);
    st.petals(coil, st.coil, 0.2);

    // Pounce: legs stretched out, body flat, petals blown wide open.
    const pounce = rest();
    both(pounce, 'humerus', -52);
    both(pounce, 'radius', -14);
    both(pounce, 'femur', 26);
    both(pounce, 'tibia', 8);
    rotate(pounce, 'spine1', -4);
    rotate(pounce, 'spine2', 4);
    rotate(pounce, 'chest', 8);
    rotate(pounce, 'neck1', 10);
    rotate(pounce, 'neck2', 6);
    rotate(pounce, 'tail1', 16);
    move(pounce, 'root', 0, 0, 0.8);
    st.petals(pounce, st.wide, 0.55);

    // Land and snap the petals shut on the target.
    const bite = rest();
    crouch(bite, 20, 24);
    rotate(bite, 'chest', 6);
    rotate(bite, 'neck1', 14);
    rotate(bite, 'neck2', 8);
    rotate(bite, 'head', 6);
    move(bite, 'root', 0, 0, 0.85);
    st.petals(bite, st.snap, 0);

    const recover = rest();
    crouch(recover, 12, 18);
    move(recover, 'root', 0, 0, 0.4);
    st.petals(recover, st.recover, 0.05);

    const end = rest();
    st.petals(end, st.rest, 0.04);

    return [
        { t: 0, pose: ready },
        { t: 0.38, pose: coil },
        { t: 0.58, pose: pounce },
        { t: 0.82, pose: bite },
        { t: 1.15, pose: recover },
        { t: ATTACK_DURATION, pose: end },
    ];
};

const roarKeys = (st: JawStyle): { t: number; pose: Pose }[] => {
    const ready = rest();
    st.petals(ready, st.rest, 0.04);

    // Rear up on the front legs and rock the head back.
    const inhale = rest();
    crouch(inhale, 8, 30);
    rotate(inhale, 'spine1', -6);
    rotate(inhale, 'spine2', -10);
    rotate(inhale, 'chest', -10);
    rotate(inhale, 'neck1', -16);
    rotate(inhale, 'head', -10);
    rotate(inhale, 'tail1', 14);
    st.petals(inhale, st.coil, 0.15);

    const roar = rest();
    crouch(roar, 4, 34);
    rotate(roar, 'spine1', -10);
    rotate(roar, 'spine2', -16);
    rotate(roar, 'chest', -18);
    rotate(roar, 'neck1', -24);
    rotate(roar, 'neck2', -14);
    rotate(roar, 'head', -12);
    rotate(roar, 'tail1', 22);
    rotate(roar, 'tail2', 10);
    st.petals(roar, st.wide, 0.6);

    const relax = rest();
    st.petals(relax, st.rest, 0.08);

    const end = rest();
    st.petals(end, st.rest, 0.04);

    return [
        { t: 0, pose: ready },
        { t: 0.6, pose: inhale },
        { t: 1.0, pose: roar },
        { t: 2.3, pose: roar },
        { t: 2.8, pose: relax },
        { t: ROAR_DURATION, pose: end },
    ];
};

const roarPose = (keys: { t: number; pose: Pose }[], t: number): Pose => {
    const p = sampleKeys(keys, t);
    // Chest-deep tremor while the roar is held, with the petals flexing out of sync.
    const env = smooth(0.95, 1.15, t) * (1 - smooth(2.25, 2.6, t));
    const trem = env * Math.sin(t * 46);
    rotate(p, 'chest', 1.4 * trem);
    rotate(p, 'neck2', 2 * trem, 3 * Math.sin(t * 38) * env);
    rotate(p, 'head', 2.5 * Math.sin(t * 41) * env, 0, 2 * trem);
    rotate(p, 'tail2', 0, 8 * Math.sin(t * 7) * env);
    for (let i = 0; i < PETAL_COUNT; i++) {
        rotate(p, `petal${i}_base`, deg(0.16 * env * Math.sin(t * 22 + i * 1.3)));
        rotate(p, `petal${i}_tip`, deg(0.22 * env * Math.sin(t * 26 + i * 1.9)));
    }
    return p;
};

/** Bakes Idle, Walk, Attack and Roar clips for any rig that shares the quadruped bone names. */
export const buildQuadrupedClips = (rig: DemogorgonRig, st: JawStyle): THREE.AnimationClip[] => {
    resetPose(rig);
    rig.root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const groundY = FOOT_BONES.reduce((lowest, name) => {
        rig.bones[name].getWorldPosition(v);
        return Math.min(lowest, v.y);
    }, Infinity);
    const ground = { y: groundY, bones: FOOT_BONES };

    const attack = attackKeys(st);
    const roar = roarKeys(st);
    const clips = [
        bake(rig, CLIP_NAMES.idle, IDLE_DURATION, t => idlePose(t, st), ground, flatPaws),
        bake(rig, CLIP_NAMES.walk, WALK_DURATION, t => walkPose(t, st), ground, flatPaws),
        bake(rig, CLIP_NAMES.attack, ATTACK_DURATION, t => sampleKeys(attack, t), ground, flatPaws),
        bake(rig, CLIP_NAMES.roar, ROAR_DURATION, t => roarPose(roar, t), ground, flatPaws),
    ];

    resetPose(rig);
    rig.root.updateMatrixWorld(true);
    return clips;
};

/** Bakes Idle, Walk, Attack and Roar clips for a rig produced by buildDemodogRig. */
export const buildDemodogClips = (rig: DemogorgonRig): THREE.AnimationClip[] => buildQuadrupedClips(rig, DEMODOG_JAWS);

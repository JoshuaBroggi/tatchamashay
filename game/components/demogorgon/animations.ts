import * as THREE from 'three';
import { DemogorgonRig, PETAL_COUNT, PETAL_FLAT, TOE_COUNT } from './rig';

/**
 * Keyframed Demogorgon animations, baked to ordinary THREE.AnimationClips.
 *
 * Poses are authored as Euler offsets (degrees, XYZ) relative to each bone's bind pose.
 * Because the bind pose is world-aligned, the axes read like this:
 *   Spine / neck / head:  +X pitches forward (head looks down), -X leans back.
 *   Arms / legs (hang down): +X swings the limb BACK, -X swings it forward.
 *   Left arm Z:  +Z moves it outward. Right-side bones mirror Y and Z automatically.
 *   Petals: the bind pose is a flat, fully open flower. `petals(open)` takes openness in radians
 *   (PETAL_FLAT = flat); smaller values fold the petals forward into a bud.
 */

export type DemogorgonAnimation = 'idle' | 'walk' | 'attack' | 'roar';

export const CLIP_NAMES: Record<DemogorgonAnimation, string> = {
    idle: 'Idle',
    walk: 'Walk',
    attack: 'Attack',
    roar: 'Roar',
};

export const ONE_SHOT: Record<DemogorgonAnimation, boolean> = {
    idle: false,
    walk: false,
    attack: true,
    roar: true,
};

type Euler3 = [number, number, number];

export interface Pose {
    rot: Record<string, Euler3>;
    pos: Record<string, Euler3>;
}

export const TAU = Math.PI * 2;
export const FPS = 30;
export const deg = (rad: number) => (rad * 180) / Math.PI;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------
// Pose helpers
// ------------------------------------------------------------------

export const newPose = (): Pose => ({ rot: {}, pos: {} });

export const rotate = (p: Pose, bone: string, x = 0, y = 0, z = 0) => {
    const e = (p.rot[bone] ??= [0, 0, 0]);
    e[0] += x;
    e[1] += y;
    e[2] += z;
};

export const move = (p: Pose, bone: string, x = 0, y = 0, z = 0) => {
    const e = (p.pos[bone] ??= [0, 0, 0]);
    e[0] += x;
    e[1] += y;
    e[2] += z;
};

/** Apply to the left bone as given and to the right bone mirrored. */
export const both = (p: Pose, name: string, x = 0, y = 0, z = 0) => {
    rotate(p, `${name}L`, x, y, z);
    rotate(p, `${name}R`, x, -y, -z);
};

const fingers = (p: Pose, curlBase: number, curlTip: number, splay = 0) => {
    for (let k = 0; k < 4; k++) {
        const spread = splay * (k - 1.5) * 0.5;
        for (const [S, sign] of [['L', 1], ['R', -1]] as const) {
            rotate(p, `finger${k}${S}_1`, -curlBase, 0, spread * sign);
            rotate(p, `finger${k}${S}_2`, -curlTip, 0, 0);
        }
    }
};

export const petals = (p: Pose, open: number, curl: number, t = 0, wobble = 0) => {
    for (let i = 0; i < PETAL_COUNT; i++) {
        const w = wobble * Math.sin(TAU * (t * 2.5 + i / PETAL_COUNT));
        rotate(p, `petal${i}_base`, deg(open - PETAL_FLAT + w), 0, 0);
        rotate(p, `petal${i}_tip`, deg(curl + w * 0.8), 0, 0);
    }
};

/** Spread a forward lean (degrees) over the spine. */
const lean = (p: Pose, total: number) => {
    rotate(p, 'spine1', total * 0.35);
    rotate(p, 'spine2', total * 0.35);
    rotate(p, 'chest', total * 0.3);
};

/** Relaxed, hunched stance every animation starts from. */
const rest = (): Pose => {
    const p = newPose();
    lean(p, 14);
    rotate(p, 'neck1', -7);
    rotate(p, 'neck2', -6);
    rotate(p, 'head', -3);
    both(p, 'upperArm', -14, 0, 20);
    both(p, 'foreArm', -38, 0, 0);
    both(p, 'hand', -8, 0, 0);
    fingers(p, 24, 34, 8);
    // Wide, braced crouch. Feet are flattened automatically when the clip is baked.
    both(p, 'thigh', -22, 0, 11);
    both(p, 'shin', 38, 0, -7);
    return p;
};

const cloneRecord = (r: Record<string, Euler3>) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, [...v] as Euler3]));

const lerpRecord = (a: Record<string, Euler3>, b: Record<string, Euler3>, u: number) => {
    const out: Record<string, Euler3> = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const x = a[key] ?? [0, 0, 0];
        const y = b[key] ?? [0, 0, 0];
        out[key] = [x[0] + (y[0] - x[0]) * u, x[1] + (y[1] - x[1]) * u, x[2] + (y[2] - x[2]) * u];
    }
    return out;
};

/** Eased interpolation through a list of keyframe poses. */
export const sampleKeys = (keys: { t: number; pose: Pose }[], t: number): Pose => {
    if (t <= keys[0].t) return { rot: cloneRecord(keys[0].pose.rot), pos: cloneRecord(keys[0].pose.pos) };
    for (let i = 1; i < keys.length; i++) {
        if (t <= keys[i].t) {
            const a = keys[i - 1], b = keys[i];
            const u = smooth(0, 1, (t - a.t) / (b.t - a.t));
            return { rot: lerpRecord(a.pose.rot, b.pose.rot, u), pos: lerpRecord(a.pose.pos, b.pose.pos, u) };
        }
    }
    const last = keys[keys.length - 1].pose;
    return { rot: cloneRecord(last.rot), pos: cloneRecord(last.pos) };
};

// ------------------------------------------------------------------
// Clip definitions
// ------------------------------------------------------------------

const IDLE_DURATION = 4;
const idlePose = (t: number): Pose => {
    const ph = (t / IDLE_DURATION) * TAU;
    const breath = Math.sin(ph);
    const p = rest();

    lean(p, 1.2 * breath);
    rotate(p, 'chest', -1.8 * breath);
    // The faceless head sweeps slowly from side to side, as if sniffing for prey.
    rotate(p, 'neck1', 2 * Math.sin(ph * 2 + 1), 8 * Math.sin(ph), 1.5 * Math.sin(ph));
    rotate(p, 'neck2', 3 * Math.sin(ph * 2 + 0.4), 9 * Math.sin(ph + 0.5), 2.5 * Math.sin(ph * 2));
    rotate(p, 'head', 2 * Math.sin(ph * 2), 6 * Math.sin(ph + 1), 3 * Math.sin(ph * 2 + 2));

    both(p, 'upperArm', 1.5 * Math.sin(ph + 1.5), 0, 1.5 * breath);
    both(p, 'foreArm', 2 * breath);
    for (let k = 0; k < 4; k++) {
        for (const S of ['L', 'R']) {
            rotate(p, `finger${k}${S}_1`, -7 * Math.sin(ph * 2 + k * 0.9 + (S === 'R' ? 1.7 : 0)));
            rotate(p, `finger${k}${S}_2`, -9 * Math.sin(ph * 2 + k * 0.9 + 0.6 + (S === 'R' ? 1.7 : 0)));
        }
    }

    rotate(p, 'hips', 0, 0, 1.4 * Math.sin(ph));
    petals(p, 0.8 + 0.08 * Math.sin(ph * 2), 0.04, t / IDLE_DURATION, 0.05);
    return p;
};

const WALK_DURATION = 1.3;
const walkPose = (t: number): Pose => {
    const ph = (t / WALK_DURATION) * TAU;
    const p = rest();

    for (const [S, offset] of [['L', 0], ['R', Math.PI]] as const) {
        const f = ph + offset;
        const swing = Math.max(0, -Math.sin(f)); // 0..1 while the foot is in the air
        const thigh = -30 * Math.cos(f);
        const shin = 6 + 38 * swing + 4 * Math.max(0, Math.sin(f));
        rotate(p, `thigh${S}`, thigh);
        rotate(p, `shin${S}`, shin);
        rotate(p, `meta${S}`, 14 * swing); // on top of the automatic flat-foot correction
        for (let k = 0; k < TOE_COUNT; k++) rotate(p, `toe${k}${S}`, 14 * swing);

        // Arms counter-swing against the legs.
        const arm = 24 * Math.cos(f);
        rotate(p, `upperArm${S}`, arm, 0, 0);
        rotate(p, `foreArm${S}`, -14 * Math.max(0, -Math.cos(f)) - 4);
        rotate(p, `hand${S}`, -4 * Math.sin(f));
    }

    // Shoulders twist against the hips, the whole frame rolls with each step.
    rotate(p, 'hips', 0, 7 * Math.cos(ph), 3 * Math.sin(ph));
    rotate(p, 'spine1', 0, -4 * Math.cos(ph));
    rotate(p, 'spine2', 0, -4 * Math.cos(ph), -2 * Math.sin(ph));
    rotate(p, 'chest', 0, -3 * Math.cos(ph));
    lean(p, 6);
    rotate(p, 'neck2', 2 * Math.sin(ph * 2), -4 * Math.sin(ph + 0.4));
    rotate(p, 'head', 3 * Math.sin(ph * 2 + 0.5), 5 * Math.cos(ph), 2 * Math.sin(ph));
    petals(p, 0.85 + 0.08 * Math.sin(ph * 2), 0.05, t / WALK_DURATION, 0.05);
    return p;
};

const ATTACK_DURATION = 1.8;
const attackKeys = (): { t: number; pose: Pose }[] => {
    const ready = rest();
    petals(ready, 0.8, 0.04);

    // Coil back, petals begin to part.
    const wind = rest();
    lean(wind, -14);
    rotate(wind, 'neck1', -8);
    rotate(wind, 'head', -14);
    both(wind, 'upperArm', 30, 0, 22);
    both(wind, 'foreArm', -28);
    both(wind, 'thigh', -14);
    both(wind, 'shin', 22);
    petals(wind, 1.1, 0.2);
    move(wind, 'root', 0, 0, -0.14);

    // Lunge: petals blown fully open, arms thrust forward, one leg driving.
    const strike = rest();
    lean(strike, 34);
    rotate(strike, 'neck1', 10);
    rotate(strike, 'neck2', 4);
    both(strike, 'upperArm', -98, 0, 16);
    both(strike, 'foreArm', -14);
    both(strike, 'hand', 4);
    fingers(strike, 0, 4, 22);
    rotate(strike, 'thighL', -38);
    rotate(strike, 'shinL', 16);
    rotate(strike, 'thighR', 20);
    rotate(strike, 'shinR', 34);
    rotate(strike, 'hips', 0, 6);
    petals(strike, 1.6, 0.5);
    move(strike, 'root', 0, 0, 0.5);

    // Claws rake inward.
    const rake = rest();
    lean(rake, 30);
    rotate(rake, 'neck1', 8);
    both(rake, 'upperArm', -82, 0, -24);
    both(rake, 'foreArm', -40);
    fingers(rake, 34, 38, 4);
    rotate(rake, 'thighL', -34);
    rotate(rake, 'shinL', 16);
    rotate(rake, 'thighR', 18);
    rotate(rake, 'shinR', 32);
    rotate(rake, 'hips', 0, -5);
    petals(rake, 1.5, 0.4);
    move(rake, 'root', 0, 0, 0.55);

    // Petals snap shut around the target.
    const snap = rest();
    lean(snap, 24);
    rotate(snap, 'neck1', 10);
    both(snap, 'upperArm', -60, 0, -6);
    both(snap, 'foreArm', -30);
    fingers(snap, 28, 32, 2);
    rotate(snap, 'thighL', -28);
    rotate(snap, 'shinL', 14);
    rotate(snap, 'thighR', 14);
    rotate(snap, 'shinR', 28);
    petals(snap, 0.25, 0);
    move(snap, 'root', 0, 0, 0.5);

    const recover = rest();
    lean(recover, 12);
    both(recover, 'upperArm', -22, 0, 8);
    petals(recover, 0.7, 0.05);
    move(recover, 'root', 0, 0, 0.2);

    const end = rest();
    petals(end, 0.8, 0.04);

    return [
        { t: 0, pose: ready },
        { t: 0.4, pose: wind },
        { t: 0.58, pose: strike },
        { t: 0.76, pose: rake },
        { t: 0.98, pose: snap },
        { t: 1.35, pose: recover },
        { t: ATTACK_DURATION, pose: end },
    ];
};

const ROAR_DURATION = 3.2;
const roarKeys = (): { t: number; pose: Pose }[] => {
    const ready = rest();
    petals(ready, 0.8, 0.04);

    const inhale = rest();
    lean(inhale, -10);
    rotate(inhale, 'neck1', -10);
    rotate(inhale, 'head', -20);
    both(inhale, 'upperArm', -8, 0, 30);
    both(inhale, 'foreArm', -24);
    both(inhale, 'thigh', -10);
    both(inhale, 'shin', 16);
    petals(inhale, 1.1, 0.15);

    const roar = rest();
    lean(roar, -18);
    rotate(roar, 'neck1', -14);
    rotate(roar, 'neck2', -10);
    rotate(roar, 'head', -26);
    both(roar, 'upperArm', -34, 0, 64);
    both(roar, 'foreArm', -42);
    both(roar, 'hand', -10);
    fingers(roar, 0, 6, 26);
    both(roar, 'thigh', -18);
    both(roar, 'shin', 28);
    petals(roar, 1.65, 0.6);

    const relax = rest();
    lean(relax, 4);
    petals(relax, 0.8, 0.08);

    const end = rest();
    petals(end, 0.8, 0.04);

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
    // Violent tremor while the roar is held, with the petals flexing out of sync.
    const env = smooth(0.95, 1.15, t) * (1 - smooth(2.25, 2.6, t));
    const trem = env * Math.sin(t * 58);
    rotate(p, 'chest', 1.2 * trem);
    rotate(p, 'neck2', 2 * trem, 3 * Math.sin(t * 43) * env);
    rotate(p, 'head', 2.5 * Math.sin(t * 51) * env, 0, 2 * trem);
    both(p, 'upperArm', 0, 0, 3 * Math.sin(t * 47) * env);
    for (let i = 0; i < PETAL_COUNT; i++) {
        rotate(p, `petal${i}_base`, deg(0.16 * env * Math.sin(t * 22 + i * 1.3)));
        rotate(p, `petal${i}_tip`, deg(0.22 * env * Math.sin(t * 26 + i * 1.9)));
    }
    return p;
};

// ------------------------------------------------------------------
// Baking
// ------------------------------------------------------------------

const toRad = Math.PI / 180;

const applyPose = (rig: DemogorgonRig, pose: Pose) => {
    const euler = new THREE.Euler();
    const delta = new THREE.Quaternion();
    for (const [name, bone] of Object.entries(rig.bones)) {
        const r = pose.rot[name] ?? [0, 0, 0];
        delta.setFromEuler(euler.set(r[0] * toRad, r[1] * toRad, r[2] * toRad, 'XYZ'));
        bone.quaternion.copy(rig.bindQuat[name]).multiply(delta);
        const o = pose.pos[name] ?? [0, 0, 0];
        bone.position.copy(rig.bindPos[name]).add(new THREE.Vector3(o[0], o[1], o[2]));
    }
};

export const resetPose = (rig: DemogorgonRig) => applyPose(rig, newPose());

const TOE_BONES = ['L', 'R'].flatMap(S => Array.from({ length: TOE_COUNT }, (_, k) => `toe${k}${S}`));

/** Keeps each foot level with the ground whatever the leg is doing; poses add lift on top. */
const flatFeet = (pose: Pose): Pose => {
    for (const S of ['L', 'R']) {
        const thigh = pose.rot[`thigh${S}`]?.[0] ?? 0;
        const shin = pose.rot[`shin${S}`]?.[0] ?? 0;
        rotate(pose, `meta${S}`, -(thigh + shin));
    }
    return pose;
};

/** Lifts or lowers the whole body so the lowest foot always rests on the ground. */
const planted = (rig: DemogorgonRig, pose: Pose, groundY: number, footBones: string[]): Pose => {
    applyPose(rig, pose);
    rig.root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let lowest = Infinity;
    for (const name of footBones) {
        rig.bones[name].getWorldPosition(v);
        lowest = Math.min(lowest, v.y);
    }
    move(pose, 'root', 0, groundY - lowest, 0);
    return pose;
};

/**
 * Bakes a pose function into an AnimationClip. `ground` names the bones that must rest on the floor
 * (the lowest one is pinned to `ground.y` each frame); `prepare` post-processes every sampled pose.
 */
export const bake = (
    rig: DemogorgonRig,
    name: string,
    duration: number,
    poseAt: (t: number) => Pose,
    ground: { y: number; bones: string[] },
    prepare: (pose: Pose) => Pose = pose => pose,
): THREE.AnimationClip => {
    const frames = Math.round(duration * FPS);
    const times: number[] = [];
    const poses: Pose[] = [];
    for (let f = 0; f <= frames; f++) {
        const t = (f / frames) * duration;
        times.push(t);
        poses.push(planted(rig, prepare(poseAt(t)), ground.y, ground.bones));
    }

    const rotBones = new Set<string>();
    const posBones = new Set<string>();
    poses.forEach(p => {
        Object.keys(p.rot).forEach(b => rotBones.add(b));
        Object.keys(p.pos).forEach(b => posBones.add(b));
    });

    const tracks: THREE.KeyframeTrack[] = [];
    const euler = new THREE.Euler();
    const q = new THREE.Quaternion();
    for (const bone of rotBones) {
        const values: number[] = [];
        const prev = new THREE.Quaternion();
        poses.forEach((p, i) => {
            const r = p.rot[bone] ?? [0, 0, 0];
            q.setFromEuler(euler.set(r[0] * toRad, r[1] * toRad, r[2] * toRad, 'XYZ'));
            q.premultiply(rig.bindQuat[bone]); // bind * delta
            if (i > 0 && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
            prev.copy(q);
            values.push(q.x, q.y, q.z, q.w);
        });
        tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
    }
    for (const bone of posBones) {
        const values: number[] = [];
        poses.forEach(p => {
            const o = p.pos[bone] ?? [0, 0, 0];
            const b = rig.bindPos[bone];
            values.push(b.x + o[0], b.y + o[1], b.z + o[2]);
        });
        tracks.push(new THREE.VectorKeyframeTrack(`${bone}.position`, times, values));
    }
    return new THREE.AnimationClip(name, duration, tracks);
};

/** Bakes Idle, Walk, Attack and Roar clips for a rig produced by buildDemogorgonRig. */
export const buildDemogorgonClips = (rig: DemogorgonRig): THREE.AnimationClip[] => {
    resetPose(rig);
    rig.root.updateMatrixWorld(true);
    const groundY = TOE_BONES.reduce((acc, name) => {
        const v = new THREE.Vector3();
        rig.bones[name].getWorldPosition(v);
        return Math.min(acc, v.y);
    }, Infinity);

    const ground = { y: groundY, bones: TOE_BONES };
    const attack = attackKeys();
    const roar = roarKeys();
    const clips = [
        bake(rig, CLIP_NAMES.idle, IDLE_DURATION, idlePose, ground, flatFeet),
        bake(rig, CLIP_NAMES.walk, WALK_DURATION, walkPose, ground, flatFeet),
        bake(rig, CLIP_NAMES.attack, ATTACK_DURATION, t => sampleKeys(attack, t), ground, flatFeet),
        bake(rig, CLIP_NAMES.roar, ROAR_DURATION, t => roarPose(roar, t), ground, flatFeet),
    ];

    resetPose(rig);
    rig.root.updateMatrixWorld(true);
    return clips;
};

import * as THREE from 'three';
import {
    C,
    DemogorgonRig,
    gauss,
    makeSkinTextures,
    MeshBuilder,
    newPart,
    noise3,
    partToGeometry,
    PETAL_COUNT,
    petalRadial,
    makeFace,
    profile,
    pushVertex,
    SkeletonBuilder,
    smoothstep,
    V,
} from '../demogorgon/rig';
import { DOG_TOE_COUNT } from '../demodog/rig';

/**
 * Procedural Vine Dog from Stranger Things: Tales from '85: a four-legged creature woven out
 * of black vines, with glowing yellow-green slits, leaf-blade thorns down its back, spindly
 * vine legs ending in leaf-blade feet, and a tail that curls over its back into a pair of
 * leaf blades. Its head is a long closed snout that splits into five red, toothed jaws around
 * a ringed throat with a glowing yellow centre.
 *
 * It shares the Demodog's quadruped bone names, so the same baked clips drive it. Units are
 * metres, it faces +Z, Y is up. The bind pose has the jaws CLOSED; rotating a petal bone about
 * its local +X opens it.
 */

// ------------------------------------------------------------------
// Colours
// ------------------------------------------------------------------

const VINE_DARK = C(0x1a1f21);
const VINE_MID = C(0x333c3d);
const VINE_BLUE = C(0x26323d);
const MOSS = C(0x56702b);
const LIME = C(0x9cc23c);
const RED = C(0xc4281f);
const RED_DEEP = C(0x6a0f10);
const RED_EDGE = C(0xe06a3a);
const ORANGE = C(0xd4701f);
const TOOTH_BASE = C(0xd0502a);
const TOOTH = C(0xf3cf86);
/** Values above 1 make a vertex read as lit up even in shadow. */
const GLOW = new THREE.Color(3.4, 3.1, 0.5);
const GLOW_HOT = new THREE.Color(4.5, 3.6, 0.4);

/** Black vine bark with a blue sheen, moss creeping in toward the extremities, and glowing slits. */
const vineSkin = (p: THREE.Vector3, green = 0): THREE.Color => {
    const c = VINE_DARK.clone().lerp(VINE_MID, noise3(p.x * 9, p.y * 9, p.z * 9));
    c.lerp(VINE_BLUE, smoothstep(0.5, 0.85, noise3(p.x * 4 + 2, p.y * 4, p.z * 4)) * 0.7);
    c.lerp(MOSS, green * 0.85 + smoothstep(0.68, 0.92, noise3(p.x * 5 + 3, p.y * 5, p.z * 5)) * 0.3);
    // Thin glowing slits, denser toward the front of the body.
    const slit = 1 - smoothstep(0, 0.03, Math.abs(noise3(p.x * 10 + 11, p.y * 22, p.z * 7) - 0.5));
    const where = smoothstep(0.4, 0.7, noise3(p.x * 3 + 5, p.y * 3, p.z * 3)) * smoothstep(-0.4, 0.8, p.z);
    c.lerp(GLOW, slit * where);
    return c;
};

// ------------------------------------------------------------------
// Anatomy (bind pose)
// ------------------------------------------------------------------

const BEAK_BASE = V(0, 1.12, 1.17);
const BEAK_AXIS = V(0, 0.2, 1);
const FACE = makeFace(BEAK_BASE, BEAK_AXIS, 1);
const JAW_LENGTH = 0.62;
const JAW_BASE_RADIUS = 0.105;

const TORSO = [
    V(0, 0.7, -0.62), // rear cap
    V(0, 0.72, -0.4), // hips
    V(0, 0.76, -0.05), // spine1
    V(0, 0.8, 0.28), // spine2
    V(0, 0.84, 0.56), // chest
    V(0, 0.95, 0.82), // neck1
    V(0, 1.05, 1.0), // neck2
    V(0, 1.1, 1.15), // head
];
const TORSO_BONES = ['hips', 'hips', 'spine1', 'spine2', 'chest', 'neck1', 'neck2'];
const TORSO_CURVE = new THREE.CatmullRomCurve3(TORSO, false, 'centripetal');
const TORSO_RADIUS = profile([
    [0, 0.05, 0.05],
    [0.5, 0.15, 0.19],
    [1, 0.17, 0.22],
    [2, 0.15, 0.19],
    [3, 0.17, 0.22],
    [4, 0.2, 0.26],
    [4.6, 0.15, 0.2],
    [5, 0.1, 0.14],
    [6, 0.095, 0.12],
    [7, 0.1, 0.11],
]);

const TAIL = [V(0, 0.74, -0.62), V(0, 0.8, -0.98), V(0, 1.0, -1.28), V(0, 1.3, -1.4), V(0, 1.55, -1.22)];

const frontLeg = (side: 1 | -1) => ({
    shoulder: V(0.22 * side, 0.74, 0.5),
    elbow: V(0.36 * side, 0.5, 0.34),
    wrist: V(0.3 * side, 0.24, 0.6),
    ball: V(0.3 * side, 0.035, 0.72),
});

const rearLeg = (side: 1 | -1) => ({
    hip: V(0.22 * side, 0.7, -0.42),
    knee: V(0.34 * side, 0.46, -0.18),
    hock: V(0.28 * side, 0.28, -0.6),
    ball: V(0.28 * side, 0.035, -0.46),
});

const toeJoints = (ball: THREE.Vector3, side: 1 | -1, k: number, len: number) => {
    const dx = (k - 1) * 0.05 * side;
    const base = ball.clone().add(V(dx * 0.5, 0, 0));
    const tip = ball.clone().add(V(dx * 2, 0.012, len));
    return { base, mid: base.clone().lerp(tip, 0.5).add(V(0, 0.01, 0)), tip };
};

const sideName = (side: 1 | -1) => (side === 1 ? 'L' : 'R');

// ------------------------------------------------------------------
// Skeleton
// ------------------------------------------------------------------

const jawHalfAngle = (Math.PI / PETAL_COUNT) * 0.97;
const jawRadius = (t: number) => JAW_BASE_RADIUS * (1 - 0.78 * Math.pow(t, 1.1)) + 0.008;

const buildSkeleton = (): SkeletonBuilder => {
    const sk = new SkeletonBuilder();
    sk.add('root', null, V(0, 0, 0));
    sk.add('hips', 'root', TORSO[1]);
    sk.add('spine1', 'hips', TORSO[2]);
    sk.add('spine2', 'spine1', TORSO[3]);
    sk.add('chest', 'spine2', TORSO[4]);
    sk.add('neck1', 'chest', TORSO[5]);
    sk.add('neck2', 'neck1', TORSO[6]);
    sk.add('head', 'neck2', TORSO[7]);

    // Jaw petals. Local X = hinge tangent, Y = along the jaw, Z = outward. +X opens the jaw.
    for (let i = 0; i < PETAL_COUNT; i++) {
        const radial = petalRadial(FACE, i);
        const hinge = new THREE.Vector3().crossVectors(FACE.axis, radial).normalize();
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(hinge, FACE.axis, radial));
        sk.add(`petal${i}_base`, 'head', BEAK_BASE.clone().addScaledVector(radial, JAW_BASE_RADIUS), q);
        sk.add(
            `petal${i}_tip`,
            `petal${i}_base`,
            BEAK_BASE.clone().addScaledVector(FACE.axis, JAW_LENGTH * 0.5).addScaledVector(radial, jawRadius(0.5)),
        );
    }

    sk.add('tail1', 'hips', TAIL[0]);
    sk.add('tail2', 'tail1', TAIL[1]);
    sk.add('tail3', 'tail2', TAIL[2]);
    sk.add('tail4', 'tail3', TAIL[3]);

    for (const side of [1, -1] as const) {
        const S = sideName(side);
        const f = frontLeg(side);
        sk.add(`humerus${S}`, 'chest', f.shoulder);
        sk.add(`radius${S}`, `humerus${S}`, f.elbow);
        sk.add(`pawF${S}`, `radius${S}`, f.wrist);
        for (let k = 0; k < DOG_TOE_COUNT; k++) sk.add(`toeF${k}${S}`, `pawF${S}`, toeJoints(f.ball, side, k, 0.17).base);

        const r = rearLeg(side);
        sk.add(`femur${S}`, 'hips', r.hip);
        sk.add(`tibia${S}`, `femur${S}`, r.knee);
        sk.add(`metaR${S}`, `tibia${S}`, r.hock);
        for (let k = 0; k < DOG_TOE_COUNT; k++) sk.add(`toeR${k}${S}`, `metaR${S}`, toeJoints(r.ball, side, k, 0.15).base);
    }
    return sk;
};

// ------------------------------------------------------------------
// Body: a braided core wrapped in loose vine ropes
// ------------------------------------------------------------------

const buildBody = (mb: MeshBuilder) => {
    mb.tube({
        joints: TORSO,
        bones: TORSO_BONES,
        next: 'head',
        ringsPerSegment: 12,
        sides: 26,
        ref: V(1, 0, 0),
        capStart: false,
        radius: s => {
            const [rx, rz] = TORSO_RADIUS(s);
            return [rx * 0.93, rz * 0.93];
        },
        // Strands braided around the core.
        shape: (s, phi) => 1 + 0.08 * Math.sin(3 * phi + s * 3) + 0.05 * Math.sin(5 * phi - s * 4.5),
        color: (s, _phi, p) => vineSkin(p, smoothstep(5.5, 7, s) * 0.3),
    });

    // Thick ropes spiralling the length of the body and neck, half of them wound the other way.
    const ROPES = 10;
    for (let k = 0; k < ROPES; k++) {
        const dir = k % 2 === 0 ? 1 : -1;
        const phase = (k / ROPES) * Math.PI * 2;
        const joints: THREE.Vector3[] = [];
        const bones: string[] = [];
        for (let s = 0.9; s <= 6.8; s += 0.37) {
            const c = TORSO_CURVE.getPoint(s / 7);
            const [rx, rz] = TORSO_RADIUS(s);
            const phi = phase + dir * (s - 0.9) * (1.1 + 0.12 * (k % 3));
            joints.push(c.clone().add(V(Math.cos(phi) * rx * 1.0, Math.sin(phi) * rz * 1.0, 0)));
            bones.push(TORSO_BONES[Math.min(Math.floor(s), TORSO_BONES.length - 1)]);
        }
        bones.pop();
        const n = bones.length;
        mb.tube({
            joints,
            bones,
            ringsPerSegment: 3,
            sides: 8,
            capStart: false,
            radius: s => {
                const r = 0.034 + 0.012 * noise3(k * 3.1, s * 0.7, 1);
                const rr = r * (0.25 + 0.75 * smoothstep(0, 0.8, s)) * (0.25 + 0.75 * (1 - smoothstep(n - 0.9, n, s)));
                return [rr, rr];
            },
            color: (_s, _phi, p) => vineSkin(p, 0.15),
        });
    }

    // Leaf-blade thorns down the spine.
    const spikes: [number, number][] = [[1.15, 0.2], [1.85, 0.27], [2.55, 0.31], [3.25, 0.29], [3.95, 0.25], [4.65, 0.19]];
    for (const [s, len] of spikes) {
        const c = TORSO_CURVE.getPoint(s / 7);
        const [, rz] = TORSO_RADIUS(s);
        const base = c.clone().add(V(0, rz * 0.95, 0));
        mb.spike(TORSO_BONES[Math.floor(s)], base, V(0, 0.8, -0.6), len, 0.034, VINE_MID, LIME);
        // A smaller pair flanking each thorn.
        for (const sign of [-1, 1]) {
            mb.spike(TORSO_BONES[Math.floor(s)], base.clone().add(V(0.07 * sign, -0.03, 0.05)), V(0.5 * sign, 0.7, -0.5), len * 0.55, 0.022, VINE_MID, MOSS);
        }
    }

    // Tail: curls up and over the back.
    mb.tube({
        joints: TAIL,
        bones: ['tail1', 'tail2', 'tail3', 'tail4'],
        prev: 'hips',
        ringsPerSegment: 10,
        sides: 14,
        radius: profile([
            [0, 0.12, 0.125],
            [1, 0.09, 0.09],
            [2, 0.066, 0.066],
            [3, 0.05, 0.05],
            [4, 0.03, 0.03],
        ]),
        shape: (s, phi) => 1 + 0.1 * Math.sin(2 * phi + s * 5),
        color: (s, _phi, p) => vineSkin(p, smoothstep(1.8, 4, s)),
    });

    // The tail ends in a forked pair of leaf blades.
    const tip = TAIL[4];
    const blades: THREE.Vector3[][] = [
        [tip, tip.clone().add(V(0.05, 0.12, 0.08)), tip.clone().add(V(0.13, 0.22, 0.2))],
        [tip, tip.clone().add(V(-0.04, 0.1, -0.1)), tip.clone().add(V(-0.12, 0.14, -0.24))],
    ];
    for (const joints of blades) {
        mb.tube({
            joints,
            bones: ['tail4', 'tail4'],
            ringsPerSegment: 8,
            sides: 10,
            capStart: false,
            ref: V(1, 0, 0),
            radius: s => {
                const w = 0.085 * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * (s / 2))), 0.9) + 0.001;
                return [w, 0.009];
            },
            color: (s, _phi, p) => vineSkin(p, 0.5).lerp(LIME, smoothstep(0.6, 2, s) * 0.8),
        });
    }
};

// ------------------------------------------------------------------
// Legs: thin twisted vines ending in leaf-blade feet
// ------------------------------------------------------------------

const legTwist = (s: number, phi: number) => 1 + 0.14 * Math.sin(2 * phi + s * 5) + 0.22 * gauss(s, 1, 0.1);

const buildLegs = (mb: MeshBuilder) => {
    for (const side of [1, -1] as const) {
        const S = sideName(side);
        const f = frontLeg(side);
        mb.tube({
            joints: [f.shoulder, f.elbow, f.wrist, f.ball],
            bones: [`humerus${S}`, `radius${S}`, `pawF${S}`],
            prev: 'chest',
            ringsPerSegment: 12,
            sides: 14,
            radius: profile([
                [0, 0.095, 0.095],
                [0.5, 0.072, 0.072],
                [1, 0.05, 0.05],
                [1.5, 0.046, 0.046],
                [2, 0.034, 0.034],
                [3, 0.036, 0.036],
            ]),
            shape: legTwist,
            color: (s, _phi, p) => vineSkin(p, smoothstep(1.6, 3, s) * 0.7),
        });

        const r = rearLeg(side);
        mb.tube({
            joints: [r.hip, r.knee, r.hock, r.ball],
            bones: [`femur${S}`, `tibia${S}`, `metaR${S}`],
            prev: 'hips',
            ringsPerSegment: 12,
            sides: 14,
            radius: profile([
                [0, 0.12, 0.12],
                [0.5, 0.098, 0.098],
                [1, 0.058, 0.058],
                [1.5, 0.05, 0.05],
                [2, 0.037, 0.037],
                [3, 0.039, 0.039],
            ]),
            shape: legTwist,
            color: (s, _phi, p) => vineSkin(p, smoothstep(1.6, 3, s) * 0.7),
        });

        // Feet: three broad leaf blades each, tips lifting slightly.
        const feet: [string, THREE.Vector3, number][] = [
            ['F', f.ball, 0.17],
            ['R', r.ball, 0.15],
        ];
        for (const [kind, ball, len] of feet) {
            for (let k = 0; k < DOG_TOE_COUNT; k++) {
                const t = toeJoints(ball, side, k, len);
                const bone = `toe${kind}${k}${S}`;
                mb.tube({
                    joints: [t.base, t.mid, t.tip],
                    bones: [bone, bone],
                    prev: kind === 'F' ? `pawF${S}` : `metaR${S}`,
                    ringsPerSegment: 8,
                    sides: 10,
                    ref: V(1, 0, 0),
                    radius: s => {
                        const w = 0.032 * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * (s / 2))), 0.8) + 0.001;
                        return [w, 0.008];
                    },
                    color: (s, _phi, p) => vineSkin(p, 0.4).lerp(LIME, smoothstep(0.4, 2, s) * 0.85),
                });
            }
        }
    }
};

// ------------------------------------------------------------------
// Head: a long closed snout of five jaw-petals, opening onto a glowing, toothed throat
// ------------------------------------------------------------------

const buildHead = (mb: MeshBuilder, sk: SkeletonBuilder) => {
    const A = FACE.axis, E1 = FACE.e1, E2 = FACE.e2;
    const ringPoint = (theta: number, radius: number, along: number) =>
        BEAK_BASE.clone().addScaledVector(A, along).addScaledVector(E1, Math.cos(theta) * radius).addScaledVector(E2, Math.sin(theta) * radius);

    // Throat: a red lip, then a funnel falling to a glowing yellow core.
    mb.revolve('head', BEAK_BASE, A, E1, E2, [
        { r: 0.12, a: -0.012, color: RED_DEEP },
        { r: 0.108, a: 0.012, color: RED },
        { r: 0.09, a: 0.014, color: RED },
        { r: 0.078, a: -0.012, color: RED_DEEP },
        { r: 0.065, a: -0.05, color: ORANGE },
        { r: 0.045, a: -0.09, color: GLOW },
        { r: 0.022, a: -0.125, color: GLOW_HOT },
        { r: 0.002, a: -0.14, color: GLOW_HOT },
    ]);

    // Concentric rings of fine teeth around the throat.
    const rings = [
        { count: 26, radius: 0.094, along: 0.008, length: 0.036, forward: 0.15 },
        { count: 20, radius: 0.077, along: -0.02, length: 0.032, forward: -0.1 },
        { count: 14, radius: 0.058, along: -0.055, length: 0.028, forward: -0.3 },
    ];
    rings.forEach((ring, ri) => {
        for (let t = 0; t < ring.count; t++) {
            const theta = ((t + (ri % 2) * 0.5) / ring.count) * Math.PI * 2;
            const base = ringPoint(theta, ring.radius, ring.along);
            const out = E1.clone().multiplyScalar(Math.cos(theta)).addScaledVector(E2, Math.sin(theta));
            const dir = out.negate().multiplyScalar(0.9).addScaledVector(A, ring.forward);
            mb.spike('head', base, dir, ring.length, 0.0038, TOOTH_BASE, TOOTH);
        }
    });

    const GRID_T = 64;
    const GRID_S = 12;
    for (let i = 0; i < PETAL_COUNT; i++) {
        const radial = petalRadial(FACE, i);
        const theta = Math.PI / 2 + (i * Math.PI * 2) / PETAL_COUNT;
        const tangent = new THREE.Vector3().crossVectors(A, radial).normalize();
        const baseIdx = sk.indexOf(`petal${i}_base`);
        const tipIdx = sk.indexOf(`petal${i}_tip`);
        const skinFor = (t: number): [number, number][] => {
            const wTip = smoothstep(0.2, 0.65, t);
            return [[baseIdx, 1 - wTip], [tipIdx, wTip]];
        };
        const thickness = (t: number) => 0.012 * (1 - 0.5 * t);

        const surfacePoint = (t: number, s: number, outer: boolean) => {
            const phi = theta + s * jawHalfAngle;
            const rho = jawRadius(t) + (outer ? 0.5 : -0.5) * thickness(t);
            return ringPoint(phi, Math.max(rho, 0.0008), JAW_LENGTH * t);
        };

        const part = newPart();
        const addSurface = (outer: boolean) => {
            const start = part.pos.length / 3;
            for (let a = 0; a <= GRID_T; a++) {
                const t = a / GRID_T;
                for (let b = 0; b <= GRID_S; b++) {
                    const s = (b / GRID_S) * 2 - 1;
                    const pos = surfacePoint(t, s, outer);
                    let col: THREE.Color;
                    if (outer) {
                        col = vineSkin(pos, smoothstep(0.5, 0.92, t));
                        col.lerp(LIME, smoothstep(0.9, 1, t) * 0.8);
                    } else {
                        // Inside the jaw: red flesh with fine cross ridges, orange along the rim.
                        const ridge = 0.5 + 0.5 * Math.sin(t * 90);
                        col = RED_DEEP.clone().lerp(RED, 0.45 + 0.55 * ridge);
                        col.lerp(RED_EDGE, smoothstep(0.78, 1, Math.abs(s)) * 0.7);
                        col.lerp(ORANGE, smoothstep(0.85, 1, t) * 0.5);
                    }
                    pushVertex(part, pos, V(0, 1, 0), [t * 2, (s * 0.5 + 0.5) * 0.6], col, skinFor(t));
                }
            }
            const stride = GRID_S + 1;
            for (let a = 0; a < GRID_T; a++) {
                for (let b = 0; b < GRID_S; b++) {
                    const i0 = start + a * stride + b;
                    // Windings opposite for the two faces; the material is double-sided.
                    if (outer) part.index.push(i0, i0 + 1, i0 + stride, i0 + 1, i0 + stride + 1, i0 + stride);
                    else part.index.push(i0, i0 + stride, i0 + 1, i0 + 1, i0 + stride, i0 + stride + 1);
                }
            }
            return start;
        };
        const innerStart = addSurface(false);
        const outerStart = addSurface(true);

        // Close the long edges so the jaw has thickness.
        for (const edge of [0, GRID_S]) {
            const base = part.pos.length / 3;
            for (let a = 0; a <= GRID_T; a++) {
                for (const startIdx of [innerStart, outerStart]) {
                    const src = startIdx + a * (GRID_S + 1) + edge;
                    const pos = new THREE.Vector3(part.pos[src * 3], part.pos[src * 3 + 1], part.pos[src * 3 + 2]);
                    pushVertex(part, pos, V(0, 1, 0), [a / GRID_T, 0], RED_EDGE, skinFor(a / GRID_T));
                }
            }
            for (let a = 0; a < GRID_T; a++) {
                const i0 = base + a * 2;
                part.index.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
            }
        }
        mb.addPart(partToGeometry(part, true));

        // Long thin teeth down both inner edges of the jaw.
        for (const edgeSign of [-1, 1]) {
            for (let n = 0; n < 26; n++) {
                const t = 0.05 + (n / 25) * 0.9;
                const base = surfacePoint(t, edgeSign * 0.97, false);
                const toAxis = BEAK_BASE.clone().addScaledVector(A, JAW_LENGTH * t).sub(base).normalize();
                const dir = toAxis.multiplyScalar(0.8).addScaledVector(A, 0.35).addScaledVector(tangent, -edgeSign * 0.15);
                const size = Math.sin(Math.PI * (0.1 + 0.8 * t));
                mb.spike(t < 0.4 ? `petal${i}_base` : `petal${i}_tip`, base, dir, 0.022 + 0.026 * size, 0.0042, TOOTH_BASE, TOOTH);
            }
        }
    }
};

// ------------------------------------------------------------------
// Entry point
// ------------------------------------------------------------------

export const buildVineDogRig = (): DemogorgonRig => {
    const sk = buildSkeleton();
    const mb = new MeshBuilder(sk);
    buildBody(mb);
    buildLegs(mb);
    buildHead(mb, sk);

    const geometry = mb.merge();
    geometry.computeBoundingBox();
    const height = geometry.boundingBox!.max.y;

    const { bump, albedo } = makeSkinTextures();
    albedo.dispose();
    const material = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.42,
        metalness: 0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.3,
        bumpMap: bump,
        bumpScale: 2.5,
        side: THREE.DoubleSide,
    });

    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = 'VineDogBody';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const root = new THREE.Group();
    root.name = 'VineDog';
    root.add(sk.list[0]);
    root.add(mesh);
    root.updateMatrixWorld(true);

    const skeleton = new THREE.Skeleton(sk.list);
    mesh.bind(skeleton, new THREE.Matrix4());

    const bones: Record<string, THREE.Bone> = {};
    const bindQuat: Record<string, THREE.Quaternion> = {};
    const bindPos: Record<string, THREE.Vector3> = {};
    for (const bone of sk.list) {
        bones[bone.name] = bone;
        bindQuat[bone.name] = bone.quaternion.clone();
        bindPos[bone.name] = bone.position.clone();
    }

    return {
        root,
        mesh,
        skeleton,
        bones,
        bindQuat,
        bindPos,
        height,
        dispose: () => {
            geometry.dispose();
            material.dispose();
            bump.dispose();
            skeleton.dispose();
        },
    };
};

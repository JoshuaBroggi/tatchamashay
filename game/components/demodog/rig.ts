import * as THREE from 'three';
import {
    buildFace,
    addPetalBones,
    C,
    DemogorgonRig,
    FLESH_DEEP,
    gauss,
    HORN,
    HORN_BASE,
    makeFace,
    makeSkinTextures,
    MeshBuilder,
    noise3,
    profile,
    SkeletonBuilder,
    smoothstep,
    V,
} from '../demogorgon/rig';

/**
 * Procedural Demodog: the Upside Down's four-legged hunter, built the same way as the
 * Demogorgon (one SkinnedMesh on a bone skeleton, baked animation clips) and sharing its
 * five-petal flower face.
 *
 * Units are metres, it faces +Z and Y is up. It stands about 1.2 m tall to the top of its face
 * and is about 2.9 m long with the tail. Bones are authored in a world-aligned bind pose
 * (identity rotation) except the petal bones. Spine and tail rotate about X to pitch; legs hang
 * down, so negative X swings a leg forward.
 */

export const DOG_TOE_COUNT = 3;

// ------------------------------------------------------------------
// Colours: slick, wet, grey-brown hide with a paler belly
// ------------------------------------------------------------------

const DOG_A = C(0x7a6e68);
const DOG_B = C(0x9a8a80);
const DOG_DARK = C(0x453a38);
const DOG_BELLY = C(0xb48f86);
const DOG_VEIN = C(0x7a4a52);

/** `top` is 1 along the spine and 0 along the belly. */
const dogSkin = (p: THREE.Vector3, top: number): THREE.Color => {
    const c = DOG_A.clone().lerp(DOG_B, noise3(p.x * 5, p.y * 5, p.z * 5));
    c.lerp(DOG_DARK, smoothstep(0.5, 0.8, noise3(p.x * 3 + 7, p.y * 3, p.z * 3)) * 0.6);
    c.lerp(DOG_DARK, top * 0.35);
    c.lerp(DOG_BELLY, (1 - top) * 0.5 + smoothstep(0.55, 0.15, p.y) * 0.1);
    const vein = 1 - smoothstep(0, 0.03, Math.abs(noise3(p.x * 13, p.y * 13, p.z * 13) - 0.5));
    c.lerp(DOG_VEIN, vein * 0.35);
    return c;
};

// ------------------------------------------------------------------
// Anatomy (bind pose)
// ------------------------------------------------------------------

const FACE = makeFace(V(0, 0.95, 1.32), V(0, -0.1, 1), 0.75);

const REAR = V(0, 0.8, -0.62);
const TORSO_JOINTS = [
    V(0, 0.8, -0.45),  // hips
    V(0, 0.84, -0.1),  // spine1
    V(0, 0.88, 0.25),  // spine2
    V(0, 0.9, 0.55),   // chest
    V(0, 0.98, 0.82),  // neck1
    V(0, 1.0, 1.0),    // neck2
    V(0, 0.98, 1.14),  // head
];

const TAIL_JOINTS = [V(0, 0.82, -0.62), V(0, 0.8, -0.95), V(0, 0.72, -1.3), V(0, 0.6, -1.65), V(0, 0.5, -1.95)];

const frontLeg = (side: 1 | -1) => ({
    shoulder: V(0.19 * side, 0.8, 0.52),
    elbow: V(0.26 * side, 0.5, 0.36),
    wrist: V(0.22 * side, 0.22, 0.6),
    ball: V(0.22 * side, 0.045, 0.72),
});

const rearLeg = (side: 1 | -1) => ({
    hip: V(0.19 * side, 0.78, -0.48),
    knee: V(0.25 * side, 0.52, -0.18),
    hock: V(0.2 * side, 0.32, -0.62),
    ball: V(0.2 * side, 0.045, -0.46),
});

const toeJoints = (ball: THREE.Vector3, side: 1 | -1, k: number, len: number) => {
    const dx = (k - 1) * 0.045 * side;
    return {
        base: ball.clone().add(V(dx * 0.5, 0, 0)),
        tip: ball.clone().add(V(dx * 1.4, -0.02, len)),
    };
};

const sideName = (side: 1 | -1) => (side === 1 ? 'L' : 'R');

const buildSkeleton = (): SkeletonBuilder => {
    const sk = new SkeletonBuilder();
    sk.add('root', null, V(0, 0, 0));
    sk.add('hips', 'root', TORSO_JOINTS[0]);
    sk.add('spine1', 'hips', TORSO_JOINTS[1]);
    sk.add('spine2', 'spine1', TORSO_JOINTS[2]);
    sk.add('chest', 'spine2', TORSO_JOINTS[3]);
    sk.add('neck1', 'chest', TORSO_JOINTS[4]);
    sk.add('neck2', 'neck1', TORSO_JOINTS[5]);
    sk.add('head', 'neck2', TORSO_JOINTS[6]);
    addPetalBones(sk, FACE);

    sk.add('tail1', 'hips', TAIL_JOINTS[0]);
    sk.add('tail2', 'tail1', TAIL_JOINTS[1]);
    sk.add('tail3', 'tail2', TAIL_JOINTS[2]);
    sk.add('tail4', 'tail3', TAIL_JOINTS[3]);

    for (const side of [1, -1] as const) {
        const S = sideName(side);
        const f = frontLeg(side);
        sk.add(`humerus${S}`, 'chest', f.shoulder);
        sk.add(`radius${S}`, `humerus${S}`, f.elbow);
        sk.add(`pawF${S}`, `radius${S}`, f.wrist);
        for (let k = 0; k < DOG_TOE_COUNT; k++) sk.add(`toeF${k}${S}`, `pawF${S}`, toeJoints(f.ball, side, k, 0.13).base);

        const r = rearLeg(side);
        sk.add(`femur${S}`, 'hips', r.hip);
        sk.add(`tibia${S}`, `femur${S}`, r.knee);
        sk.add(`metaR${S}`, `tibia${S}`, r.hock);
        for (let k = 0; k < DOG_TOE_COUNT; k++) sk.add(`toeR${k}${S}`, `metaR${S}`, toeJoints(r.ball, side, k, 0.12).base);
    }
    return sk;
};

// ------------------------------------------------------------------
// Body parts. On a horizontal tube the section's v axis is up: sin(phi) > 0 is the back.
// ------------------------------------------------------------------

const torsoShape = (s: number, phi: number): number => {
    const sp = Math.sin(phi), side = Math.abs(Math.cos(phi));
    const top = Math.max(0, sp), bottom = Math.max(0, -sp);
    let m = 1;
    m += 0.09 * top * gauss(side, 0, 0.25) * (0.5 + 0.5 * Math.cos(s * 10)) * smoothstep(1.2, 2, s) * (1 - smoothstep(5, 5.6, s)); // vertebrae
    m += 0.04 * side * gauss(s, 3.4, 1.0) * Math.sin(s * 22); // ribs
    m += 0.12 * side * gauss(s, 4.2, 0.45); // shoulder mass
    m += 0.1 * side * gauss(s, 0.9, 0.4); // haunches
    m -= 0.16 * bottom * gauss(s, 2.2, 0.55); // belly tucked up
    m += 0.08 * bottom * gauss(s, 4.3, 0.4); // keel of the chest
    return m;
};

const buildTorso = (mb: MeshBuilder) => {
    mb.tube({
        joints: [REAR, ...TORSO_JOINTS],
        bones: ['hips', 'hips', 'spine1', 'spine2', 'chest', 'neck1', 'neck2'],
        next: 'head',
        ringsPerSegment: 12,
        sides: 26,
        ref: V(1, 0, 0),
        capStart: false,
        radius: profile([
            [0, 0.05, 0.05],
            [0.5, 0.14, 0.17],
            [1, 0.16, 0.2],
            [2, 0.13, 0.165],
            [3, 0.145, 0.19],
            [4, 0.17, 0.24],
            [4.6, 0.14, 0.2],
            [5, 0.1, 0.15],
            [6, 0.085, 0.12],
            [7, 0.085, 0.11],
        ]),
        shape: torsoShape,
        color: (s, phi, p) => {
            const c = dogSkin(p, 0.5 + 0.5 * Math.sin(phi));
            if (s > 6.1) c.lerp(FLESH_DEEP, smoothstep(6.1, 7, s) * 0.8); // raw flesh where the face attaches
            return c;
        },
    });

    // Tail: thick at the root, whipping down to a point.
    mb.tube({
        joints: TAIL_JOINTS,
        bones: ['tail1', 'tail2', 'tail3', 'tail4'],
        prev: 'hips',
        ringsPerSegment: 10,
        sides: 14,
        radius: profile([
            [0, 0.07, 0.075],
            [1, 0.06, 0.06],
            [2, 0.045, 0.045],
            [3, 0.028, 0.028],
            [3.9, 0.012, 0.012],
            [4, 0.003, 0.003],
        ]),
        color: (_s, phi, p) => dogSkin(p, 0.5 + 0.5 * Math.sin(phi)),
    });
};

const buildLegs = (mb: MeshBuilder) => {
    for (const side of [1, -1] as const) {
        const S = sideName(side);

        const f = frontLeg(side);
        mb.tube({
            joints: [f.shoulder, f.elbow, f.wrist, f.ball],
            bones: [`humerus${S}`, `radius${S}`, `pawF${S}`],
            prev: 'chest',
            ringsPerSegment: 12,
            sides: 18,
            radius: profile([
                [0, 0.125, 0.125],
                [0.4, 0.12, 0.115],
                [0.9, 0.068, 0.064],
                [1, 0.062, 0.058],
                [1.5, 0.056, 0.052],
                [2, 0.038, 0.037],
                [2.3, 0.05, 0.028],
                [3, 0.054, 0.025],
            ]),
            shape: (s, phi) => 1 + 0.14 * gauss(s, 0.45, 0.3) * (0.6 + 0.4 * Math.sin(phi)) + 0.08 * gauss(s, 1.3, 0.25),
            color: (_s, _phi, p) => dogSkin(p, 0.4),
        });

        const r = rearLeg(side);
        mb.tube({
            joints: [r.hip, r.knee, r.hock, r.ball],
            bones: [`femur${S}`, `tibia${S}`, `metaR${S}`],
            prev: 'hips',
            ringsPerSegment: 12,
            sides: 18,
            radius: profile([
                [0, 0.165, 0.16],
                [0.4, 0.16, 0.15],
                [0.9, 0.09, 0.088],
                [1, 0.078, 0.074],
                [1.5, 0.066, 0.06],
                [2, 0.044, 0.042],
                [2.3, 0.05, 0.036],
                [3, 0.058, 0.028],
            ]),
            shape: s => 1 + 0.22 * gauss(s, 0.4, 0.3) + 0.14 * gauss(s, 1.5, 0.3),
            color: (_s, _phi, p) => dogSkin(p, 0.4),
        });

        const claws: [string, THREE.Vector3, number][] = [
            ['F', f.ball, 0.13],
            ['R', r.ball, 0.12],
        ];
        for (const [kind, ball, len] of claws) {
            for (let k = 0; k < DOG_TOE_COUNT; k++) {
                const t = toeJoints(ball, side, k, len);
                mb.tube({
                    joints: [t.base, t.tip],
                    bones: [`toe${kind}${k}${S}`],
                    prev: kind === 'F' ? `pawF${S}` : `metaR${S}`,
                    ringsPerSegment: 8,
                    sides: 10,
                    radius: s => {
                        const claw = smoothstep(0.55, 1, s);
                        const rr = 0.022 * (1 - 0.3 * s) * (1 - Math.pow(claw, 0.75)) + 0.0012;
                        return [rr, rr * 0.85];
                    },
                    color: (s, _phi, p) => dogSkin(p, 0.3).lerp(HORN_BASE, smoothstep(0.5, 0.62, s)).lerp(HORN, smoothstep(0.75, 1, s)),
                });
            }
        }
    }
};

export const buildDemodogRig = (): DemogorgonRig => {
    const sk = buildSkeleton();
    const mb = new MeshBuilder(sk);
    buildTorso(mb);
    buildFace(mb, sk, FACE);
    buildLegs(mb);

    const geometry = mb.merge();
    geometry.computeBoundingBox();
    const height = geometry.boundingBox!.max.y;

    const { bump, albedo } = makeSkinTextures();
    const material = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        map: albedo,
        roughness: 0.38,
        metalness: 0,
        clearcoat: 0.55,
        clearcoatRoughness: 0.25,
        bumpMap: bump,
        bumpScale: 2.2,
        side: THREE.DoubleSide,
    });

    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = 'DemodogBody';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const root = new THREE.Group();
    root.name = 'Demodog';
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
            albedo.dispose();
            skeleton.dispose();
        },
    };
};

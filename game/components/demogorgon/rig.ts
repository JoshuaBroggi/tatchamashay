import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural Demogorgon: a single SkinnedMesh bound to a real bone skeleton.
 *
 * Units are metres, the creature faces +Z, Y is up, and it stands about 2.2 m tall.
 * The anatomy follows the show's creature: pale, leathery, heavily muscled and human in
 * proportion, with a flat five-petal flower for a face (black throat ringed with teeth,
 * red scaled petals edged with serrations).
 *
 * Every bone is authored in a world-aligned bind pose (identity rotation) except the
 * petal bones, which are oriented so local X is the petal's hinge axis. The bind pose has
 * the flower fully open (flat); closing a petal is a negative rotation about its local X.
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------
// Public types
// ------------------------------------------------------------------

export const PETAL_COUNT = 5;
export const TOE_COUNT = 4;
/** Petal openness (radians) at which the flower is flat, matching the bind pose. */
export const PETAL_FLAT = 1.5;

export interface DemogorgonRig {
    /** Contains the root bone and the skinned mesh. Animation clips bind to this. */
    root: THREE.Group;
    mesh: THREE.SkinnedMesh;
    skeleton: THREE.Skeleton;
    bones: Record<string, THREE.Bone>;
    /** Local bind rotation of each bone (animation tracks are authored relative to it). */
    bindQuat: Record<string, THREE.Quaternion>;
    /** Local bind position of each bone. */
    bindPos: Record<string, THREE.Vector3>;
    /** Standing height in metres. */
    height: number;
    dispose: () => void;
}

// ------------------------------------------------------------------
// Small maths helpers
// ------------------------------------------------------------------

const smoothstep = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

const gauss = (x: number, centre: number, width: number) => Math.exp(-Math.pow((x - centre) / width, 2));

const hash3 = (x: number, y: number, z: number) => {
    const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return h - Math.floor(h);
};

/** Trilinear value noise in [0, 1]. */
const noise3 = (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    return l(
        l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
        l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
        w,
    );
};

/** Piecewise profile through [s, rx, rz] keys with smooth blending. */
const profile = (keys: [number, number, number][]) => (s: number): [number, number] => {
    if (s <= keys[0][0]) return [keys[0][1], keys[0][2]];
    for (let i = 1; i < keys.length; i++) {
        if (s <= keys[i][0]) {
            const t = smoothstep(keys[i - 1][0], keys[i][0], s);
            return [
                keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * t,
                keys[i - 1][2] + (keys[i][2] - keys[i - 1][2]) * t,
            ];
        }
    }
    const last = keys[keys.length - 1];
    return [last[1], last[2]];
};

// ------------------------------------------------------------------
// Skin colouring
// ------------------------------------------------------------------

const C = (hex: number) => new THREE.Color(hex);
const SKIN_LIGHT = C(0xcdbfb4);
const SKIN_GREY = C(0xa89b93);
const SKIN_PINK = C(0xc2968f);
const SKIN_BROWN = C(0x8d7565);
const SKIN_VEIN = C(0x7c6f86);
const SKIN_VEIN_RED = C(0x9a5650);
const FLESH_RED = C(0x8a2c27);
const FLESH_DEEP = C(0x3a0b0b);
const PETAL_DARK = C(0x2e0a09);
const PETAL_RED = C(0x8c2a21);
const PETAL_TAN = C(0xb87762);
const HORN = C(0xd2bf96);
const HORN_BASE = C(0x7d6a52);
const TEETH = C(0xe6d8b6);
const TEETH_BASE = C(0xa06c5c);

/**
 * Pale, mottled, leathery skin: grey-beige with pink flushes, darker browning toward the
 * hands and feet, and faint blue and red veins. `p` is the bind-pose position.
 */
const skinColor = (p: THREE.Vector3): THREE.Color => {
    const base = SKIN_LIGHT.clone().lerp(SKIN_GREY, noise3(p.x * 5, p.y * 5, p.z * 5));
    base.lerp(SKIN_PINK, smoothstep(0.5, 0.8, noise3(p.x * 2.6 + 9, p.y * 2.6, p.z * 2.6)) * 0.55);
    base.lerp(SKIN_BROWN, smoothstep(0.58, 0.85, noise3(p.x * 3.4, p.y * 3.4 + 4, p.z * 3.4)) * 0.45);
    const vein = 1 - smoothstep(0, 0.03, Math.abs(noise3(p.x * 11, p.y * 11, p.z * 11) - 0.5));
    base.lerp(SKIN_VEIN, vein * 0.32);
    const redVein = 1 - smoothstep(0, 0.025, Math.abs(noise3(p.x * 17 + 3, p.y * 17, p.z * 17) - 0.5));
    base.lerp(SKIN_VEIN_RED, redVein * 0.28);
    // Hands and feet are darker and more weathered.
    base.lerp(SKIN_BROWN, smoothstep(0.38, 0.05, p.y) * 0.5 + smoothstep(1.05, 0.88, p.y) * smoothstep(0.55, 0.9, Math.abs(p.x)) * 0.35);
    return base;
};

// ------------------------------------------------------------------
// Skin textures (tileable creases + pores), shared height and albedo
// ------------------------------------------------------------------

const makeSkinTextures = (): { bump: THREE.Texture; albedo: THREE.Texture } => {
    const N = 512;
    let seed = 1337;
    const rand = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const octave = (cells: number) => ({ cells, grid: Array.from({ length: cells * cells }, rand) });
    const creaseLarge = octave(5), creaseMid = octave(11), creaseSmall = octave(26), pores = octave(90), blotch = octave(7);

    const sample = (o: { cells: number; grid: number[] }, x: number, y: number) => {
        const fx = (x / N) * o.cells, fy = (y / N) * o.cells;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const g = (gx: number, gy: number) => o.grid[(gy % o.cells) * o.cells + (gx % o.cells)];
        const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx;
        const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx;
        return a + (b - a) * sy;
    };
    /** Ridged noise: 1 along thin creases, falling off to 0 either side. */
    const crease = (o: { cells: number; grid: number[] }, x: number, y: number, sharp: number) =>
        Math.pow(1 - Math.abs(sample(o, x, y) * 2 - 1), sharp);

    const bumpCanvas = document.createElement('canvas');
    const albedoCanvas = document.createElement('canvas');
    bumpCanvas.width = bumpCanvas.height = albedoCanvas.width = albedoCanvas.height = N;
    const bctx = bumpCanvas.getContext('2d')!;
    const actx = albedoCanvas.getContext('2d')!;
    const bImg = bctx.createImageData(N, N);
    const aImg = actx.createImageData(N, N);

    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            // Creases are the low points: wrinkles cut into the surface.
            const folds =
                crease(creaseLarge, x, y, 5) * 0.5 + crease(creaseMid, x, y, 6) * 0.32 + crease(creaseSmall, x, y, 7) * 0.2;
            const grain = sample(pores, x, y) * 0.5 + sample(creaseSmall, x, y) * 0.25;
            const height = Math.max(0, Math.min(1, 0.82 - folds * 0.65 + grain * 0.18));
            const tone = Math.max(0, Math.min(1, 1.0 - folds * 0.32 - (1 - sample(pores, x, y)) * 0.05));
            const mottle = sample(blotch, x, y);
            const i = (y * N + x) * 4;
            const hb = Math.round(height * 255);
            bImg.data[i] = bImg.data[i + 1] = bImg.data[i + 2] = hb;
            bImg.data[i + 3] = 255;
            // Warm the albedo slightly in the creases so they read as pink, not just dark.
            aImg.data[i] = Math.round(255 * Math.min(1, tone * (0.96 + mottle * 0.06)));
            aImg.data[i + 1] = Math.round(255 * tone * (0.9 + mottle * 0.06));
            aImg.data[i + 2] = Math.round(255 * tone * (0.88 + mottle * 0.06));
            aImg.data[i + 3] = 255;
        }
    }
    bctx.putImageData(bImg, 0, 0);
    actx.putImageData(aImg, 0, 0);

    const bump = new THREE.CanvasTexture(bumpCanvas);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.colorSpace = THREE.NoColorSpace;
    bump.anisotropy = 4;
    const albedo = new THREE.CanvasTexture(albedoCanvas);
    albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.anisotropy = 4;
    return { bump, albedo };
};

// ------------------------------------------------------------------
// Skeleton builder
// ------------------------------------------------------------------

class SkeletonBuilder {
    readonly list: THREE.Bone[] = [];
    readonly byName = new Map<string, THREE.Bone>();
    readonly worldPos = new Map<string, THREE.Vector3>();
    readonly worldQuat = new Map<string, THREE.Quaternion>();

    add(name: string, parent: string | null, pos: THREE.Vector3, worldQuat?: THREE.Quaternion) {
        const bone = new THREE.Bone();
        bone.name = name;
        const parentQ = parent ? this.worldQuat.get(parent)! : new THREE.Quaternion();
        const parentP = parent ? this.worldPos.get(parent)! : new THREE.Vector3();
        const wq = worldQuat ?? parentQ.clone();
        const invParentQ = parentQ.clone().invert();
        bone.position.copy(pos).sub(parentP).applyQuaternion(invParentQ);
        bone.quaternion.copy(invParentQ.multiply(wq));
        if (parent) this.byName.get(parent)!.add(bone);
        this.list.push(bone);
        this.byName.set(name, bone);
        this.worldPos.set(name, pos.clone());
        this.worldQuat.set(name, wq);
    }

    indexOf(name: string): number {
        const bone = this.byName.get(name);
        if (!bone) throw new Error(`Unknown bone "${name}"`);
        return this.list.indexOf(bone);
    }
}

// ------------------------------------------------------------------
// Geometry accumulation
// ------------------------------------------------------------------

interface PartBuffers {
    pos: number[];
    nrm: number[];
    uv: number[];
    col: number[];
    skinIdx: number[];
    skinW: number[];
    index: number[];
}

const newPart = (): PartBuffers => ({ pos: [], nrm: [], uv: [], col: [], skinIdx: [], skinW: [], index: [] });

const partToGeometry = (p: PartBuffers, computeNormals = false): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(p.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(p.skinIdx, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(p.skinW, 4));
    g.setIndex(p.index);
    if (computeNormals) g.computeVertexNormals();
    else g.setAttribute('normal', new THREE.Float32BufferAttribute(p.nrm, 3));
    return g;
};

const pushVertex = (
    p: PartBuffers,
    pos: THREE.Vector3,
    nrm: THREE.Vector3,
    uv: [number, number],
    col: THREE.Color,
    skin: [number, number][],
) => {
    p.pos.push(pos.x, pos.y, pos.z);
    p.nrm.push(nrm.x, nrm.y, nrm.z);
    p.uv.push(uv[0], uv[1]);
    p.col.push(col.r, col.g, col.b);
    const sorted = skin.filter(s => s[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = sorted.reduce((acc, s) => acc + s[1], 0) || 1;
    for (let i = 0; i < 4; i++) {
        p.skinIdx.push(sorted[i]?.[0] ?? 0);
        p.skinW.push(sorted[i] ? sorted[i][1] / total : 0);
    }
};

/**
 * Smooth normals for a rows x cols grid of positions whose columns wrap around.
 * Normal = dP/dcol x dP/drow, which matches the (a, c, b) triangle winding used below.
 */
const gridNormals = (grid: THREE.Vector3[][], cols: number): THREE.Vector3[][] => {
    const rows = grid.length;
    return grid.map((row, k) =>
        row.map((_p, j) => {
            const jp = grid[k][(j + 1) % cols], jm = grid[k][(j - 1 + cols) % cols];
            const kp = grid[Math.min(k + 1, rows - 1)][j], km = grid[Math.max(k - 1, 0)][j];
            const n = new THREE.Vector3().crossVectors(jp.clone().sub(jm), kp.clone().sub(km));
            return n.lengthSq() < 1e-14 ? V(0, 1, 0) : n.normalize();
        }),
    );
};

interface TubeOptions {
    /** Bind-pose joint positions the tube flows through. */
    joints: THREE.Vector3[];
    /** bones[i] drives the stretch joints[i] -> joints[i + 1]. */
    bones: string[];
    /** Bone that blends into the first segment (e.g. the parent limb). */
    prev?: string;
    /** Bone that blends into the last segment. */
    next?: string;
    /** Half-extents (x across the frame's u axis, z across v) at parameter s in [0, joints.length - 1]. */
    radius: (s: number) => [number, number];
    /** Optional muscle shaping: radial multiplier at ring parameter s and angle phi around the tube. */
    shape?: (s: number, phi: number) => number;
    color: (s: number, phi: number, p: THREE.Vector3) => THREE.Color;
    ringsPerSegment?: number;
    sides?: number;
    /** Reference direction used to orient the elliptical cross-section. */
    ref?: THREE.Vector3;
    /** Round off the start of the tube (default). Disable where the tube must start open. */
    capStart?: boolean;
}

const BUMP_UNIT = 0.45; // metres per skin-texture repeat

class MeshBuilder {
    readonly parts: THREE.BufferGeometry[] = [];

    constructor(private readonly skeleton: SkeletonBuilder) {}

    tube(o: TubeOptions) {
        const n = o.bones.length;
        const rps = o.ringsPerSegment ?? 8;
        const sides = o.sides ?? 16;
        const curve = new THREE.CatmullRomCurve3(o.joints, false, 'centripetal');
        const ref = o.ref ?? V(1, 0, 0);
        const boneIdx = o.bones.map(b => this.skeleton.indexOf(b));
        const prevIdx = o.prev ? this.skeleton.indexOf(o.prev) : -1;
        const nextIdx = o.next ? this.skeleton.indexOf(o.next) : -1;
        const capStart = o.capStart ?? true;

        const rings = n * rps + 1;
        const grid: THREE.Vector3[][] = [];
        const colours: THREE.Color[][] = [];
        const skins: [number, number][][] = [];
        const uvs: [number, number][][] = [];
        let pathLen = 0;
        let lastCenter: THREE.Vector3 | null = null;

        for (let k = 0; k < rings; k++) {
            const s = k / rps;
            const tCurve = Math.min(1, s / n);
            const center = curve.getPoint(tCurve);
            const tangent = curve.getTangent(tCurve).normalize();
            if (lastCenter) pathLen += center.distanceTo(lastCenter);
            lastCenter = center;

            const u = ref.clone().addScaledVector(tangent, -ref.dot(tangent)).normalize();
            const v = new THREE.Vector3().crossVectors(tangent, u);
            // Round off the start so limb ends close up inside the body instead of leaving an open rim.
            const cap = capStart && s < 0.25 ? Math.max(0.12, Math.sqrt(1 - Math.pow(1 - s / 0.25, 2))) : 1;
            const [baseRx, baseRz] = o.radius(s);
            const rx = baseRx * cap, rz = baseRz * cap;

            const seg = Math.min(Math.floor(s + 1e-6), n - 1);
            const f = s - seg;
            const wPrev = f < 0.3 ? 0.5 * (1 - f / 0.3) : 0;
            const wNext = f > 0.7 ? 0.5 * ((f - 0.7) / 0.3) : 0;
            const skin: [number, number][] = [[boneIdx[seg], 1 - wPrev - wNext]];
            const prevBone = seg > 0 ? boneIdx[seg - 1] : prevIdx;
            const nextBone = seg < n - 1 ? boneIdx[seg + 1] : nextIdx;
            if (wPrev > 0 && prevBone >= 0) skin.push([prevBone, wPrev]);
            if (wNext > 0 && nextBone >= 0) skin.push([nextBone, wNext]);

            const circumference = Math.PI * (rx + rz);
            const row: THREE.Vector3[] = [];
            const colRow: THREE.Color[] = [];
            const uvRow: [number, number][] = [];
            for (let j = 0; j <= sides; j++) {
                const phi = (j / sides) * Math.PI * 2;
                const m = o.shape ? o.shape(s, phi) : 1;
                const pos = center
                    .clone()
                    .addScaledVector(u, Math.cos(phi) * rx * m)
                    .addScaledVector(v, Math.sin(phi) * rz * m);
                row.push(pos);
                colRow.push(o.color(s, phi, pos));
                uvRow.push([(j / sides) * (circumference / BUMP_UNIT + 0.001), pathLen / BUMP_UNIT]);
            }
            grid.push(row);
            colours.push(colRow);
            skins.push(skin);
            uvs.push(uvRow);
        }

        const normals = gridNormals(grid, sides);
        const part = newPart();
        for (let k = 0; k < rings; k++) {
            for (let j = 0; j <= sides; j++) {
                pushVertex(part, grid[k][j], normals[k][j], uvs[k][j], colours[k][j], skins[k]);
            }
        }
        const stride = sides + 1;
        for (let k = 0; k < rings - 1; k++) {
            for (let j = 0; j < sides; j++) {
                const a = k * stride + j, b = (k + 1) * stride + j, c = a + 1, d = b + 1;
                part.index.push(a, c, b, c, d, b);
            }
        }
        this.parts.push(partToGeometry(part));
    }

    /** A tooth, claw or spike: a tapered cone from `base` along `dir`, bound to one bone. */
    spike(
        boneName: string,
        base: THREE.Vector3,
        dir: THREE.Vector3,
        length: number,
        radius: number,
        colorBase: THREE.Color = TEETH_BASE,
        colorTip: THREE.Color = TEETH,
    ) {
        const tip = base.clone().addScaledVector(dir.clone().normalize(), length);
        const taper = (s: number) => radius * (1 - Math.pow(s, 1.1)) + 0.0004;
        this.tube({
            joints: [base, tip],
            bones: [boneName],
            ringsPerSegment: 3,
            sides: 6,
            capStart: false,
            radius: s => [taper(s), taper(s)],
            color: s => colorBase.clone().lerp(colorTip, smoothstep(0, 0.5, s)),
            ref: Math.abs(dir.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0),
        });
    }

    /** A surface of revolution about the face axis, bound to one bone. Profile rows are [radius, along-axis]. */
    revolve(
        boneName: string,
        centre: THREE.Vector3,
        axis: THREE.Vector3,
        e1: THREE.Vector3,
        e2: THREE.Vector3,
        rows: { r: number; a: number; color: THREE.Color }[],
        segments = 40,
    ) {
        const bone = this.skeleton.indexOf(boneName);
        const grid: THREE.Vector3[][] = rows.map(row =>
            Array.from({ length: segments }, (_, j) => {
                const phi = (j / segments) * Math.PI * 2;
                return centre
                    .clone()
                    .addScaledVector(axis, row.a)
                    .addScaledVector(e1, Math.cos(phi) * row.r)
                    .addScaledVector(e2, Math.sin(phi) * row.r);
            }),
        );
        const normals = gridNormals(grid, segments);
        const part = newPart();
        rows.forEach((row, k) => {
            for (let j = 0; j < segments; j++) {
                pushVertex(part, grid[k][j], normals[k][j], [(j / segments) * 2, k / rows.length], row.color, [[bone, 1]]);
            }
        });
        for (let k = 0; k < rows.length - 1; k++) {
            for (let j = 0; j < segments; j++) {
                const a = k * segments + j, b = (k + 1) * segments + j;
                const c = k * segments + ((j + 1) % segments), d = (k + 1) * segments + ((j + 1) % segments);
                part.index.push(a, c, b, c, d, b);
            }
        }
        this.parts.push(partToGeometry(part));
    }

    addPart(g: THREE.BufferGeometry) {
        this.parts.push(g);
    }

    merge(): THREE.BufferGeometry {
        const merged = mergeGeometries(this.parts, false);
        this.parts.forEach(p => p.dispose());
        if (!merged) throw new Error('Failed to merge Demogorgon geometry');
        return merged;
    }
}

// ------------------------------------------------------------------
// Anatomy (bind pose)
// ------------------------------------------------------------------

/** Centre of the flower face and the direction it looks. */
const FACE_CENTER = V(0, 1.93, 0.36);
const FACE_AXIS = V(0, 0.12, 1).normalize();
const FACE_E1 = V(1, 0, 0);
const FACE_E2 = new THREE.Vector3().crossVectors(FACE_AXIS, FACE_E1).normalize();

/** The torso tube starts below the hips so the pelvis closes around the tops of the thighs. */
const PELVIS_BOTTOM = V(0, 0.93, -0.01);
const TORSO_JOINTS = [
    V(0, 1.0, 0.0),   // hips
    V(0, 1.2, 0.0),   // spine1
    V(0, 1.42, 0.03), // spine2
    V(0, 1.64, 0.07), // chest
    V(0, 1.78, 0.12), // neck1
    V(0, 1.86, 0.18), // neck2
    V(0, 1.9, 0.22),  // head
];

const armJoints = (side: 1 | -1) => ({
    clavStart: V(0.04 * side, 1.7, 0.08),
    shoulder: V(0.27 * side, 1.68, 0.04),
    elbow: V(0.35 * side, 1.31, -0.02),
    wrist: V(0.38 * side, 0.96, 0.08),
    palm: V(0.39 * side, 0.87, 0.1),
});

const legJoints = (side: 1 | -1) => ({
    hip: V(0.15 * side, 1.0, 0.0),
    knee: V(0.18 * side, 0.55, 0.04),
    ankle: V(0.17 * side, 0.11, -0.03),
    ball: V(0.18 * side, 0.04, 0.17),
});

/** Finger k (0 = thumb) of the hand on `side`: base point, knuckle and tip. */
const fingerJoints = (side: 1 | -1, k: number) => {
    const { palm } = armJoints(side);
    const spread = [-0.045, -0.015, 0.015, 0.045][k] * side;
    const len = k === 0 ? 0.8 : [1, 1.08, 1, 0.85][k];
    const base = palm.clone().add(V(spread, 0, 0));
    const knuckle = base.clone().add(V(spread * 0.7, -0.105 * len, 0.035));
    const tip = knuckle.clone().add(V(spread * 0.8, -0.095 * len, 0.075));
    return { base, knuckle, tip };
};

const toeJoints = (side: 1 | -1, k: number) => {
    const { ball } = legJoints(side);
    const dx = (k - 1.5) * 0.04 * side;
    const len = [0.12, 0.15, 0.14, 0.1][k];
    return {
        base: ball.clone().add(V(dx * 0.5, 0, -0.005)),
        tip: ball.clone().add(V(dx * 1.4, -0.018, len)),
    };
};

const sideName = (side: 1 | -1) => (side === 1 ? 'L' : 'R');

/** Direction (in world bind space) from the face axis out to petal i. */
const petalRadial = (i: number): THREE.Vector3 => {
    const theta = Math.PI / 2 + (i * Math.PI * 2) / PETAL_COUNT;
    return FACE_E1.clone().multiplyScalar(Math.cos(theta)).addScaledVector(FACE_E2, Math.sin(theta)).normalize();
};

const PETAL_START = 0.14; // radius where a petal leaves the fleshy lip
const PETAL_LENGTH = 0.31;

/** Half-width of a petal at t in [0, 1]: broad kite shape tapering to a point. */
const petalHalfWidth = (t: number) =>
    t < 0.35 ? 0.1 + 0.06 * smoothstep(0, 0.35, t) : 0.16 * Math.pow(Math.max(0, 1 - (t - 0.35) / 0.65), 0.85);

// ------------------------------------------------------------------
// Skeleton definition
// ------------------------------------------------------------------

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

    // Petals: local X = hinge tangent, local Y = along the petal, local Z = back away from the face.
    // Rotating about local +X bends the petal back; negative closes it toward the bud.
    for (let i = 0; i < PETAL_COUNT; i++) {
        const radial = petalRadial(i);
        const hinge = new THREE.Vector3().crossVectors(FACE_AXIS, radial).normalize();
        const basis = new THREE.Matrix4().makeBasis(hinge, radial, FACE_AXIS.clone().negate());
        const q = new THREE.Quaternion().setFromRotationMatrix(basis);
        sk.add(`petal${i}_base`, 'head', FACE_CENTER.clone().addScaledVector(radial, PETAL_START), q);
        sk.add(`petal${i}_tip`, `petal${i}_base`, FACE_CENTER.clone().addScaledVector(radial, PETAL_START + PETAL_LENGTH * 0.45));
    }

    for (const side of [1, -1] as const) {
        const S = sideName(side);
        const arm = armJoints(side);
        sk.add(`clav${S}`, 'chest', arm.clavStart);
        sk.add(`upperArm${S}`, `clav${S}`, arm.shoulder);
        sk.add(`foreArm${S}`, `upperArm${S}`, arm.elbow);
        sk.add(`hand${S}`, `foreArm${S}`, arm.wrist);
        for (let k = 0; k < 4; k++) {
            const f = fingerJoints(side, k);
            sk.add(`finger${k}${S}_1`, `hand${S}`, f.base);
            sk.add(`finger${k}${S}_2`, `finger${k}${S}_1`, f.knuckle);
        }

        const leg = legJoints(side);
        sk.add(`thigh${S}`, 'hips', leg.hip);
        sk.add(`shin${S}`, `thigh${S}`, leg.knee);
        sk.add(`meta${S}`, `shin${S}`, leg.ankle);
        for (let k = 0; k < TOE_COUNT; k++) {
            sk.add(`toe${k}${S}`, `meta${S}`, toeJoints(side, k).base);
        }
    }
    return sk;
};

// ------------------------------------------------------------------
// Body parts
// ------------------------------------------------------------------

/** phi = 0 is +X, phi = PI/2 is the tube's v axis. On the torso v points backward; on limbs it points forward. */
const torsoShape = (s: number, phi: number): number => {
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const front = Math.max(0, -sp), back = Math.max(0, sp), side = Math.abs(cp);
    let m = 1;
    m += 0.3 * front * gauss(s, 3.95, 0.4) * gauss(side, 0.6, 0.35); // pectorals
    m += 0.05 * front * gauss(s, 3.05, 0.3) * gauss(side, 0.25, 0.2); // sternum ridge between them
    m += 0.075 * front * smoothstep(1.3, 1.9, s) * (1 - smoothstep(3.0, 3.4, s)) * Math.pow(0.5 + 0.5 * Math.cos(s * 12.5), 2); // abs bands
    m += 0.12 * front * gauss(s, 2.2, 0.5) * gauss(side, 0.18, 0.18); // abs centre line
    m += 0.12 * side * gauss(s, 3.7, 0.5) * (1 - front * 0.5); // lats
    m += 0.18 * back * gauss(s, 4.1, 0.6) * gauss(side, 0.5, 0.45); // shoulder blades
    m += 0.04 * side * gauss(s, 3.0, 0.9) * Math.sin(s * 24); // ribs
    m += 0.2 * back * gauss(s, 0.85, 0.35) * gauss(side, 0.55, 0.35); // glutes
    return m;
};

const buildTorso = (mb: MeshBuilder) => {
    const radius = profile([
        [0, 0.05, 0.05],
        [0.45, 0.17, 0.13],
        [1.05, 0.2, 0.145],
        [2, 0.158, 0.115],
        [3, 0.19, 0.13],
        [4.1, 0.235, 0.15],
        [4.7, 0.15, 0.11],
        [5.25, 0.095, 0.09],
        [6, 0.08, 0.08],
        [7, 0.075, 0.075],
        [8, 0.075, 0.075],
    ]);
    mb.tube({
        joints: [PELVIS_BOTTOM, ...TORSO_JOINTS],
        bones: ['hips', 'hips', 'spine1', 'spine2', 'chest', 'neck1', 'neck2'],
        next: 'head',
        ringsPerSegment: 12,
        sides: 28,
        ref: V(1, 0, 0),
        capStart: false,
        radius,
        shape: torsoShape,
        color: (s, _phi, p) => {
            const c = skinColor(p);
            // Neck base reddens into raw flesh where the face attaches.
            if (s > 5.7) c.lerp(FLESH_DEEP, smoothstep(5.7, 7.2, s) * 0.85);
            return c;
        },
    });
};

const armShape = (s: number, phi: number): number => {
    const sp = Math.sin(phi), side = Math.abs(Math.cos(phi));
    const front = Math.max(0, sp), back = Math.max(0, -sp); // v is forward on a hanging arm
    let m = 1;
    m += 0.16 * front * gauss(s, 0.65, 0.24); // biceps
    m += 0.14 * back * gauss(s, 0.55, 0.28); // triceps
    m += 0.1 * side * gauss(s, 1.3, 0.22); // forearm extensors
    m += 0.05 * (front + back) * gauss(s, 1.2, 0.18);
    return m;
};

const buildArms = (mb: MeshBuilder) => {
    for (const side of [1, -1] as const) {
        const S = sideName(side);
        const arm = armJoints(side);

        // Trapezius / collar mass bridging the torso and the shoulder.
        mb.tube({
            joints: [arm.clavStart, arm.shoulder],
            bones: [`clav${S}`],
            prev: 'chest',
            ringsPerSegment: 6,
            sides: 16,
            radius: s => [0.06 + 0.035 * s, 0.07 + 0.03 * s],
            color: (_s, _phi, p) => skinColor(p),
        });

        const armRadius = profile([
            [0, 0.09, 0.09],
            [0.3, 0.105, 0.098],
            [0.9, 0.076, 0.072],
            [1, 0.062, 0.058],
            [1.3, 0.07, 0.062],
            [2, 0.035, 0.03],
            [2.25, 0.046, 0.019],
            [3, 0.04, 0.016],
        ]);
        mb.tube({
            joints: [arm.shoulder, arm.elbow, arm.wrist, arm.palm],
            bones: [`upperArm${S}`, `foreArm${S}`, `hand${S}`],
            prev: `clav${S}`,
            ringsPerSegment: 12,
            sides: 20,
            radius: armRadius,
            shape: armShape,
            color: (s, _phi, p) => skinColor(p).lerp(SKIN_PINK, gauss(s, 1.0, 0.18) * 0.4), // redder elbows
        });

        for (let k = 0; k < 4; k++) {
            const f = fingerJoints(side, k);
            mb.tube({
                joints: [f.base, f.knuckle, f.tip],
                bones: [`finger${k}${S}_1`, `finger${k}${S}_2`],
                prev: `hand${S}`,
                ringsPerSegment: 8,
                sides: 10,
                radius: s => {
                    const r = s < 1 ? 0.0175 - 0.003 * s : 0.0145 - 0.004 * (s - 1);
                    // Last third tapers into a hooked horn claw.
                    const claw = smoothstep(1.55, 2, s);
                    const rr = r * (1 - Math.pow(claw, 0.75)) + 0.001;
                    // Knuckles are a touch fatter than the joints between them.
                    return [rr * (1 + 0.1 * gauss(s, 1, 0.12)), rr * 0.9];
                },
                color: (s, _phi, p) =>
                    skinColor(p).lerp(SKIN_BROWN, 0.3).lerp(HORN_BASE, smoothstep(1.5, 1.62, s)).lerp(HORN, smoothstep(1.7, 2, s)),
            });
        }
    }
};

const legShape = (s: number, phi: number): number => {
    const sp = Math.sin(phi);
    const front = Math.max(0, sp), back = Math.max(0, -sp); // v is forward on a leg
    const side = Math.abs(Math.cos(phi));
    let m = 1;
    m += 0.16 * front * gauss(s, 0.5, 0.32); // quadriceps
    m += 0.12 * back * gauss(s, 0.35, 0.3); // hamstrings
    m += 0.1 * side * gauss(s, 0.3, 0.3);
    m += 0.075 * front * gauss(s, 1.0, 0.1); // kneecap
    m += 0.32 * back * gauss(s, 1.45, 0.24); // calf
    m += 0.1 * front * gauss(s, 1.35, 0.2) * side; // shin ridge
    return m;
};

const buildLegs = (mb: MeshBuilder) => {
    for (const side of [1, -1] as const) {
        const S = sideName(side);
        const leg = legJoints(side);
        const legRadius = profile([
            [0, 0.125, 0.125],
            [0.4, 0.118, 0.115],
            [0.9, 0.075, 0.074],
            [1, 0.068, 0.066],
            [1.5, 0.056, 0.054],
            [2, 0.038, 0.037],
            [2.2, 0.056, 0.036],
            [3, 0.066, 0.028],
        ]);
        mb.tube({
            joints: [leg.hip, leg.knee, leg.ankle, leg.ball],
            bones: [`thigh${S}`, `shin${S}`, `meta${S}`],
            prev: 'hips',
            ringsPerSegment: 12,
            sides: 22,
            ref: V(1, 0, 0),
            radius: legRadius,
            shape: legShape,
            color: (s, _phi, p) =>
                skinColor(p).lerp(SKIN_PINK, gauss(s, 1.0, 0.16) * 0.35).lerp(SKIN_BROWN, smoothstep(1.9, 3, s) * 0.4),
        });

        // Heel pad behind the ankle.
        mb.tube({
            joints: [leg.ankle.clone().add(V(0, -0.045, -0.075)), leg.ankle.clone().add(V(0, -0.045, 0.02))],
            bones: [`meta${S}`],
            ringsPerSegment: 5,
            sides: 14,
            radius: s => [0.04 - 0.004 * s, 0.043 - 0.01 * s],
            color: (_s, _phi, p) => skinColor(p).lerp(SKIN_BROWN, 0.5),
        });

        for (let k = 0; k < TOE_COUNT; k++) {
            const t = toeJoints(side, k);
            mb.tube({
                joints: [t.base, t.tip],
                bones: [`toe${k}${S}`],
                prev: `meta${S}`,
                ringsPerSegment: 8,
                sides: 10,
                radius: s => {
                    const r = 0.024 - 0.006 * s;
                    const claw = smoothstep(0.66, 1, s);
                    const rr = r * (1 - Math.pow(claw, 0.75)) + 0.0012;
                    return [rr, rr * 0.8];
                },
                color: (s, _phi, p) =>
                    skinColor(p).lerp(SKIN_BROWN, 0.45).lerp(HORN_BASE, smoothstep(0.6, 0.7, s)).lerp(HORN, smoothstep(0.8, 1, s)),
            });
        }
    }
};

/** The flower face: fleshy lip, black toothed throat, and five scaled, serrated petals. */
const buildHead = (mb: MeshBuilder, sk: SkeletonBuilder) => {
    const ringPoint = (theta: number, radius: number, along: number) =>
        FACE_CENTER.clone()
            .addScaledVector(FACE_AXIS, along)
            .addScaledVector(FACE_E1, Math.cos(theta) * radius)
            .addScaledVector(FACE_E2, Math.sin(theta) * radius);

    // Lip and throat: a swollen red rim, then a funnel falling into black.
    mb.revolve('head', FACE_CENTER, FACE_AXIS, FACE_E1, FACE_E2, [
        { r: 0.17, a: -0.004, color: PETAL_TAN },
        { r: 0.155, a: 0.016, color: PETAL_RED },
        { r: 0.125, a: 0.04, color: FLESH_RED },
        { r: 0.1, a: 0.038, color: FLESH_RED },
        { r: 0.088, a: 0.014, color: PETAL_DARK },
        { r: 0.082, a: -0.03, color: FLESH_DEEP },
        { r: 0.068, a: -0.08, color: C(0x1a0405) },
        { r: 0.048, a: -0.14, color: C(0x080102) },
        { r: 0.022, a: -0.2, color: C(0x020000) },
        { r: 0.002, a: -0.23, color: C(0x000000) },
    ]);

    // Fangs ringed around the throat, each ring offset from the last so they interlock.
    const rings = [
        { count: 34, radius: 0.096, along: 0.026, length: 0.06, inward: 0.9, forward: 0.12, thick: 0.0055 },
        { count: 28, radius: 0.082, along: -0.012, length: 0.05, inward: 0.85, forward: -0.25, thick: 0.0048 },
        { count: 20, radius: 0.066, along: -0.06, length: 0.042, inward: 0.85, forward: -0.45, thick: 0.004 },
        { count: 12, radius: 0.046, along: -0.11, length: 0.034, inward: 0.85, forward: -0.55, thick: 0.0032 },
    ];
    rings.forEach((ring, ri) => {
        for (let t = 0; t < ring.count; t++) {
            const theta = ((t + (ri % 2) * 0.5) / ring.count) * Math.PI * 2;
            const base = ringPoint(theta, ring.radius, ring.along);
            const radialDir = FACE_E1.clone().multiplyScalar(Math.cos(theta)).addScaledVector(FACE_E2, Math.sin(theta));
            const dir = radialDir.negate().multiplyScalar(ring.inward).addScaledVector(FACE_AXIS, ring.forward);
            mb.spike('head', base, dir, ring.length * (0.8 + 0.4 * hash3(t, ri, 3)), ring.thick);
        }
    });

    // Petals.
    const GRID_T = 96;
    const GRID_S = 20;
    const STRIPES = 21;
    for (let i = 0; i < PETAL_COUNT; i++) {
        const radial = petalRadial(i);
        const tangent = new THREE.Vector3().crossVectors(FACE_AXIS, radial).normalize();
        const baseIdx = sk.indexOf(`petal${i}_base`);
        const tipIdx = sk.indexOf(`petal${i}_tip`);
        const skinFor = (t: number): [number, number][] => {
            const wTip = smoothstep(0.2, 0.65, t);
            return [[baseIdx, 1 - wTip], [tipIdx, wTip]];
        };
        const thickness = (t: number) => 0.016 * (1 - 0.6 * t);

        /** Papillae: oblique chevrons radiating from the centre rib toward the tip. */
        const ridge = (t: number, s: number) => {
            const phase = t * STRIPES - Math.abs(s) * 2.6;
            const wave = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
            return smoothstep(0.3, 0.95, wave) * smoothstep(0.02, 0.18, t) * (1 - smoothstep(0.93, 1, t));
        };

        const surfacePoint = (t: number, s: number, front: boolean) => {
            const rho = PETAL_START + t * PETAL_LENGTH;
            const h = petalHalfWidth(t);
            const cup = 0.02 * s * s * (1 - 0.5 * t);
            const along = -0.01 * t + cup + (front ? 0.5 * thickness(t) + 0.0045 * ridge(t, s) : -0.5 * thickness(t));
            return FACE_CENTER.clone()
                .addScaledVector(radial, rho)
                .addScaledVector(tangent, s * h)
                .addScaledVector(FACE_AXIS, along);
        };

        const part = newPart();
        const addSurface = (front: boolean) => {
            const start = part.pos.length / 3;
            for (let a = 0; a <= GRID_T; a++) {
                const t = a / GRID_T;
                for (let b = 0; b <= GRID_S; b++) {
                    const s = (b / GRID_S) * 2 - 1;
                    const pos = surfacePoint(t, s, front);
                    let col: THREE.Color;
                    if (front) {
                        // Face side: dark red-brown flesh, brighter along the ridges, tan toward the rim.
                        const r = ridge(t, s);
                        col = PETAL_DARK.clone().lerp(PETAL_RED, 0.35 + 0.65 * r);
                        col.lerp(C(0xc26b4b), r * 0.35 * noise3(pos.x * 40, pos.y * 40, pos.z * 40));
                        col.lerp(PETAL_TAN, smoothstep(0.82, 1, Math.abs(s)) * 0.55);
                        col.lerp(FLESH_DEEP, (1 - smoothstep(0, 0.12, t)) * 0.5);
                        col.lerp(PETAL_DARK, smoothstep(0.88, 1, t) * 0.4);
                    } else {
                        col = skinColor(pos).lerp(SKIN_PINK, smoothstep(0.4, 1, t) * 0.5);
                        col.lerp(PETAL_RED, smoothstep(0.85, 1, Math.abs(s)) * 0.3);
                    }
                    pushVertex(part, pos, V(0, 1, 0), [t * 1.6, (s * 0.5 + 0.5) * 0.7], col, skinFor(t));
                }
            }
            const stride = GRID_S + 1;
            for (let a = 0; a < GRID_T; a++) {
                for (let b = 0; b < GRID_S; b++) {
                    const i0 = start + a * stride + b;
                    // Front faces the viewer (+axis); back is wound the other way. Material is double-sided.
                    if (front) part.index.push(i0, i0 + stride, i0 + 1, i0 + 1, i0 + stride, i0 + stride + 1);
                    else part.index.push(i0, i0 + 1, i0 + stride, i0 + 1, i0 + stride + 1, i0 + stride);
                }
            }
            return start;
        };
        const backStart = addSurface(false);
        const frontStart = addSurface(true);

        // Close the two long edges so the petal has visible thickness.
        for (const edge of [0, GRID_S]) {
            const base = part.pos.length / 3;
            for (let a = 0; a <= GRID_T; a++) {
                for (const startIdx of [backStart, frontStart]) {
                    const src = startIdx + a * (GRID_S + 1) + edge;
                    const pos = new THREE.Vector3(part.pos[src * 3], part.pos[src * 3 + 1], part.pos[src * 3 + 2]);
                    pushVertex(part, pos, V(0, 1, 0), [a / GRID_T, 0], PETAL_TAN, skinFor(a / GRID_T));
                }
            }
            for (let a = 0; a < GRID_T; a++) {
                const i0 = base + a * 2;
                part.index.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
            }
        }
        mb.addPart(partToGeometry(part, true));

        // Serrated rim of small teeth along both edges.
        for (const edgeSign of [-1, 1]) {
            for (let n = 0; n < 22; n++) {
                const t = 0.06 + (n / 21) * 0.9;
                const base = surfacePoint(t, edgeSign * 0.985, true);
                const outward = tangent.clone().multiplyScalar(edgeSign).addScaledVector(radial, 0.55);
                const dir = outward.normalize().addScaledVector(FACE_AXIS, 0.35);
                const bone = t < 0.4 ? `petal${i}_base` : `petal${i}_tip`;
                const size = Math.sin(Math.PI * (0.1 + 0.8 * t));
                mb.spike(bone, base, dir, 0.015 + 0.015 * size, 0.0045 + 0.002 * size, TEETH_BASE, C(0xd8c4a0));
            }
        }
        // Fine spines studding the back of the petal.
        for (let n = 0; n < 12; n++) {
            const t = 0.15 + (n / 11) * 0.7;
            const base = surfacePoint(t, 0, false);
            mb.spike(
                t < 0.4 ? `petal${i}_base` : `petal${i}_tip`,
                base,
                FACE_AXIS.clone().negate().addScaledVector(radial, 0.3),
                0.018,
                0.004,
                SKIN_BROWN,
                HORN,
            );
        }
    }
};

// ------------------------------------------------------------------
// Entry point
// ------------------------------------------------------------------

export const buildDemogorgonRig = (): DemogorgonRig => {
    const sk = buildSkeleton();
    const mb = new MeshBuilder(sk);

    buildTorso(mb);
    buildHead(mb, sk);
    buildArms(mb);
    buildLegs(mb);

    const geometry = mb.merge();
    geometry.computeBoundingBox();
    const height = geometry.boundingBox!.max.y;

    const { bump, albedo } = makeSkinTextures();
    const material = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        map: albedo,
        roughness: 0.62,
        metalness: 0,
        clearcoat: 0.18,
        clearcoatRoughness: 0.5,
        bumpMap: bump,
        bumpScale: 3,
        side: THREE.DoubleSide,
    });

    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = 'DemogorgonBody';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const rootBone = sk.list[0];
    const root = new THREE.Group();
    root.name = 'Demogorgon';
    root.add(rootBone);
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

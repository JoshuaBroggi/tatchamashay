// The treasure chest, after the design mockup's render/chest.html: dark wood
// planks, rusty iron bands and rivets, a brass lock and glowing runes. Built
// at the mockup's size and scaled to 0.6 m wide. The body is hollow so a
// treasure can rise out of it, and the lid is its own Xform on the hinge.

import { THREE, G, M, merge } from '../lib/kit.mjs';

export const meta = {
  id: 'chest',
  displayName: 'Treasure Chest',
  file: 'Chest.usdz',
  kind: 'chest',
  idleMotion: 'none',
  textures: {
    'textures/chest_wood.png': { kind: 'wood', planks: 5, seed: 5 },
    'textures/chest_lid_wood.png': { kind: 'wood', planks: 7, seed: 9, across: true },
    'textures/chest_iron.png': { kind: 'iron', seed: 3 },
  },
};

const W = 1.2, D = 0.72, H = 0.58, R = D / 2, T = 0.045; // width, depth, body height, lid radius, wall

// Glyphs drawn as short strokes on a 1x1 grid: [x1, y1, x2, y2] each.
const GLYPHS = [
  [[0, 0, 0, 1], [0, 1, 0.6, 0.75], [0, 0.6, 0.6, 0.35]],
  [[0, 0, 0, 1], [0, 1, 0.6, 0.6], [0.6, 0.6, 0.6, 0]],
  [[0.3, 0, 0.3, 1], [0.3, 0.8, 0.7, 0.55], [0.7, 0.55, 0.3, 0.3]],
  [[0, 0, 0.3, 1], [0.3, 1, 0.6, 0], [0.12, 0.45, 0.48, 0.45]],
  [[0.3, 0, 0.3, 1], [0, 0.65, 0.6, 0.35], [0, 0.35, 0.6, 0.65]],
  [[0.6, 1, 0, 0.5], [0, 0.5, 0.6, 0]],
  [[0, 0, 0.6, 1], [0, 1, 0.6, 0]],
];

function runeStrip(width, height) {
  const parts = [], n = GLYPHS.length, cell = width / n, s = height;
  GLYPHS.forEach((strokes, gi) => {
    const ox = -width / 2 + cell * gi + (cell - s * 0.6) / 2;
    for (const [x1, y1, x2, y2] of strokes) {
      const a = new THREE.Vector2(ox + x1 * s, (y1 - 0.5) * s), b = new THREE.Vector2(ox + x2 * s, (y2 - 0.5) * s);
      const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5);
      parts.push([new THREE.BoxGeometry(len + s * 0.1, s * 0.12, 0.006), { p: [mid.x, mid.y, 0], r: [0, 0, Math.atan2(b.y - a.y, b.x - a.x)] }]);
    }
  });
  return merge(parts);
}

const box = (w, h, d, p) => [new THREE.BoxGeometry(w, h, d), { p }];
const rivet = new THREE.SphereGeometry(0.014, 10, 8);

export function build() {
  // Hollow body: floor and four walls.
  const body = merge([
    box(W, T, D, [0, T / 2, 0]),
    box(W, H, T, [0, H / 2, D / 2 - T / 2]),
    box(W, H, T, [0, H / 2, -D / 2 + T / 2]),
    box(T, H, D - 2 * T, [W / 2 - T / 2, H / 2, 0]),
    box(T, H, D - 2 * T, [-W / 2 + T / 2, H / 2, 0]),
  ]);

  // Iron: corner posts, a ring band at the foot and the rim, two straps
  // (front, back and underneath), rivets and side handles.
  const iron = [];
  for (const x of [-1, 1]) for (const z of [-1, 1]) iron.push(box(0.07, H + 0.01, 0.07, [x * (W / 2 - 0.02), H / 2, z * (D / 2 - 0.02)]));
  const ring = (y, h) => {
    const o = 0.008;
    iron.push(box(W + 2 * o, h, 0.02, [0, y, D / 2 + o - 0.01]), box(W + 2 * o, h, 0.02, [0, y, -D / 2 - o + 0.01]),
      box(0.02, h, D, [W / 2 + o - 0.01, y, 0]), box(0.02, h, D, [-W / 2 - o + 0.01, y, 0]));
  };
  ring(0.06, 0.07); ring(H - 0.035, 0.06);
  for (const x of [-0.36, 0.36]) {
    iron.push(box(0.08, H + 0.012, 0.016, [x, H / 2, D / 2 + 0.008]), box(0.08, H + 0.012, 0.016, [x, H / 2, -D / 2 - 0.008]),
      box(0.08, 0.016, D + 0.016, [x, -0.002, 0]));
    for (let y = 0.1; y < H - 0.05; y += 0.09) iron.push([rivet, { p: [x, y, D / 2 + 0.017] }]);
  }
  for (let x = -0.55; x <= 0.56; x += 0.11) for (const y of [0.06, H - 0.035]) iron.push([rivet, { p: [x, y, D / 2 + 0.014] }]);
  for (const x of [-1, 1]) {
    iron.push([new THREE.TorusGeometry(0.08, 0.014, 10, 24, Math.PI), { p: [x * (W / 2 + 0.03), H * 0.62, 0], r: [0, Math.PI / 2, Math.PI] }]);
  }

  const runes = runeStrip(0.62, 0.07);
  const base = G('Base', {}, [
    M('Body', body, 'Wood'),
    M('InnerFloor', new THREE.PlaneGeometry(W - 2 * T, D - 2 * T).rotateX(-Math.PI / 2), 'Inside', { p: [0, T + 0.002, 0] }),
    M('InnerGlow', new THREE.PlaneGeometry(W - 2 * T - 0.01, D - 2 * T - 0.01).rotateX(-Math.PI / 2), 'Glow', { p: [0, H * 0.45, 0] }),
    M('Iron', merge(iron), 'Iron'),
    M('LockPlate', new THREE.BoxGeometry(0.16, 0.2, 0.025), 'Brass', { p: [0, H - 0.08, D / 2 + 0.02] }),
    M('Keyhole', merge([
      [new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16), { r: [Math.PI / 2, 0, 0] }],
      [new THREE.BoxGeometry(0.014, 0.04, 0.012), { p: [0, -0.022, 0] }],
    ]), 'Inside', { p: [0, H - 0.07, D / 2 + 0.031] }),
    M('Runes', runes, 'Rune', { p: [0, 0.2, D / 2 + 0.019] }),
  ]);

  // Lid: half cylinder over the body, hinged along the back top edge.
  // Rotating `Lid` about its X axis by a negative angle opens it.
  const lidIron = [];
  for (const x of [-0.36, 0.36, -W / 2 + 0.03, W / 2 - 0.03]) {
    lidIron.push([new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.08, 48, 1, true, 0, Math.PI), { p: [x, 0, 0], r: [0, 0, Math.PI / 2] }]);
    for (let t = 0.15; t < Math.PI; t += 0.35) lidIron.push([rivet, { p: [x, Math.sin(t) * (R + 0.02), Math.cos(t) * (R + 0.02)] }]);
  }
  const lid = G('Lid', { p: [0, H, -D / 2] }, [
    G('LidParts', { p: [0, 0, D / 2] }, [
      M('LidWood', new THREE.CylinderGeometry(R, R, W, 48, 1, false, 0, Math.PI), 'LidWood', { r: [0, 0, Math.PI / 2] }),
      M('LidUnderside', new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), 'Inside', { p: [0, 0.001, 0] }),
      M('LidIron', merge(lidIron), 'Iron'),
      M('LidRunes', runeStrip(0.5, 0.06), 'Rune', { p: [0, R * 0.72 + 0.01, R * 0.72 + 0.01], r: [-Math.PI / 4, 0, 0] }),
      M('Hasp', new THREE.BoxGeometry(0.1, 0.16, 0.02), 'Brass', { p: [0, -0.02, R + 0.015] }),
    ]),
  ]);

  const root = G('Chest', { s: 0.5 }, [base, lid]);
  const materials = {
    Wood: { map: 'textures/chest_wood.png', roughness: 0.85 },
    LidWood: { map: 'textures/chest_lid_wood.png', roughness: 0.85 },
    Iron: { map: 'textures/chest_iron.png', roughness: 0.5, metallic: 0.85 },
    Brass: { color: '#C9973C', roughness: 0.3, metallic: 0.7 },
    Inside: { color: '#1A0F06', roughness: 1 },
    Glow: { color: '#FFD890', emissive: '#FFD890', emissiveIntensity: 1.5, roughness: 1 },
    Rune: { color: '#7FE3F0', emissive: '#7FE3F0', emissiveIntensity: 1.2, roughness: 0.4 },
  };
  return {
    root, materials,
    movingParts: [{ part: 'Lid', motion: 'hinge', axis: [1, 0, 0], openDegrees: -110 }],
    namedParts: {
      lid: 'Lid', base: 'Base',
      innerGlow: 'InnerGlow', runes: ['Runes', 'LidRunes'],
    },
  };
}

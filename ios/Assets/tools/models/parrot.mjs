// Captain Squawk: a round little parrot in a three-cornered hat, on a perch.

import { THREE, G, M, merge, eye, starShape, extrude, faceMaterials, tint } from '../lib/kit.mjs';

export const meta = {
  id: 'parrot',
  displayName: 'Captain Squawk',
  file: 'Parrot.usdz',
  kind: 'treasure',
  description: 'A chatty pirate parrot in a three-cornered hat.',
  defaultColor: '#3CC46B',
  idleMotion: 'flap',
};

const ellipsoid = (r, s) => new THREE.SphereGeometry(r, 32, 24).scale(...s);

function wing(side) {
  return G(side < 0 ? 'WingLeft' : 'WingRight', { p: [side * 0.25, 0.58, -0.02] }, [
    M(side < 0 ? 'WingLeftFeathers' : 'WingRightFeathers', merge([
      [ellipsoid(0.2, [0.28, 1, 0.62]), { p: [side * 0.03, -0.14, -0.02], r: [0.2, 0, side * 0.12] }],
      [ellipsoid(0.12, [0.25, 1, 0.55]), { p: [side * 0.035, -0.3, -0.06], r: [0.35, 0, side * 0.1] }],
    ]), 'Tint'),
  ]);
}

export function build(color) {
  const tail = [-0.08, 0, 0.08].map((x, i) => [ellipsoid(0.08, [0.6, 1, 0.3]).translate(0, -0.12, 0), { p: [x, 0.3, -0.2], r: [-0.6, 0, x * 2.5] }]);
  const hat = merge([
    [new THREE.CylinderGeometry(0.27, 0.27, 0.025, 3), { r: [0, Math.PI / 2, 0] }],
    [new THREE.SphereGeometry(0.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, 0.01, 0], s: [1, 0.8, 1] }],
  ]);
  const root = G('Parrot', { s: 0.24 }, [
    M('Body', ellipsoid(0.28, [1, 1.3, 0.95]), 'Tint', { p: [0, 0.45, 0], r: [-0.12, 0, 0] }),
    M('Belly', ellipsoid(0.22, [0.82, 1.05, 0.5]), 'Belly', { p: [0, 0.4, 0.15], r: [-0.12, 0, 0] }),
    M('Head', new THREE.SphereGeometry(0.22, 32, 24), 'Tint', { p: [0, 0.84, 0.04] }),
    M('Tail', merge(tail), 'Tint'),
    wing(-1), wing(1),
    M('FacePatches', merge([[-0.095, 1], [0.095, 1]].map(([x]) => [ellipsoid(0.08, [1, 1, 0.5]), { p: [x, 0.87, 0.2] }])), 'Face'),
    eye('EyeLeft', 0.05, { p: [-0.095, 0.88, 0.225] }),
    eye('EyeRight', 0.05, { p: [0.095, 0.88, 0.225] }),
    M('Beak', merge([
      [new THREE.ConeGeometry(0.07, 0.17, 24), { p: [0, 0.79, 0.27], r: [Math.PI / 2 + 0.55, 0, 0] }],
      [new THREE.SphereGeometry(0.07, 24, 16), { p: [0, 0.82, 0.22] }],
    ]), 'Beak'),
    M('BeakLower', new THREE.ConeGeometry(0.04, 0.07, 16), 'BeakDark', { p: [0, 0.75, 0.24], r: [Math.PI / 2 + 0.9, 0, 0] }),
    G('Hat', { p: [0, 1.02, 0.02], r: [-0.1, 0, 0] }, [
      M('HatFelt', hat, 'Hat'),
      M('HatBand', new THREE.TorusGeometry(0.15, 0.012, 8, 40).rotateX(Math.PI / 2), 'Gold', { p: [0, 0.025, 0] }),
      M('HatStar', extrude(starShape(5, 0.05, 0.022), 0.01, 0.004), 'Gold', { p: [0, 0.07, 0.13], r: [-0.4, 0, 0] }),
    ]),
    M('Feet', merge([-0.08, 0.08].flatMap((x) => [-0.25, 0, 0.25].map((a) => [new THREE.CapsuleGeometry(0.018, 0.06, 4, 8), { p: [x + a * 0.08, 0.1, 0.06], r: [Math.PI / 2 - 0.3, a, 0] }]))), 'Beak'),
    M('Perch', new THREE.CylinderGeometry(0.04, 0.04, 0.8, 16).rotateZ(Math.PI / 2), 'Perch', { p: [0, 0.06, 0.03] }),
  ]);
  return {
    root,
    materials: {
      ...faceMaterials,
      Tint: tint({ roughness: 0.55 }, color),
      Belly: { color: '#FFD84A', roughness: 0.6 },
      Face: { color: '#FFFFFF', roughness: 0.6 },
      Beak: { color: '#FFA43A', roughness: 0.35 },
      BeakDark: { color: '#3B2C2A', roughness: 0.4 },
      Hat: { color: '#2C2A3A', roughness: 0.7 },
      Gold: { color: '#F2C14E', roughness: 0.3, metallic: 0.5 },
      Perch: { color: '#8A5A33', roughness: 0.8 },
    },
    movingParts: [
      { part: 'WingLeft', motion: 'flap', axis: [0, 0, 1], degrees: -35 },
      { part: 'WingRight', motion: 'flap', axis: [0, 0, 1], degrees: 35 },
    ],
  };
}

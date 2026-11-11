// Tumble the Sea Turtle: a smiley turtle with a patterned shell and a
// red bandana, with four flippers that can paddle.

import { THREE, G, M, merge, eye, smileGeo, alignY, faceMaterials, tint } from '../lib/kit.mjs';

export const meta = {
  id: 'turtle',
  displayName: 'Tumble the Sea Turtle',
  file: 'Turtle.usdz',
  kind: 'treasure',
  description: 'A friendly sea turtle who loves to paddle.',
  defaultColor: '#2FB5A6',
  idleMotion: 'flap',
};

const flipper = (name, p, yaw, size) => G(name, { p, r: [0, yaw, 0] }, [
  M(`${name}Skin`, new THREE.SphereGeometry(size, 24, 12).scale(0.5, 0.14, 1).translate(0, 0, size * 0.8), 'Skin'),
]);

export function build(color) {
  const SY = 0.62, SR = 0.42, base = 0.16;
  const plates = [];
  const spots = [[0, 1], [0.55, 0.62], [0.55, 1.88], [0.55, 3.14], [0.55, 4.4], [0.55, 5.66]];
  for (const [tilt, a] of spots) {
    const n = new THREE.Vector3(Math.sin(tilt) * Math.sin(a), Math.cos(tilt), Math.sin(tilt) * Math.cos(a));
    const p = [n.x * SR, base + n.y * SR * SY, n.z * SR];
    const nn = new THREE.Vector3(n.x / SR, n.y / (SR * SY), n.z / SR).normalize();
    plates.push([new THREE.CylinderGeometry(0.1, 0.11, 0.03, 6), { p, q: alignY(nn.toArray()) }]);
  }
  const root = G('Turtle', { s: 0.5 }, [
    M('Shell', new THREE.SphereGeometry(SR, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), 'Tint', { p: [0, base, 0], s: [1, SY, 1] }),
    M('ShellPattern', merge(plates), 'Pattern'),
    M('ShellRim', new THREE.TorusGeometry(SR, 0.045, 12, 64).rotateX(Math.PI / 2), 'Rim', { p: [0, base, 0] }),
    M('Belly', new THREE.SphereGeometry(SR * 0.95, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 'Rim', { p: [0, base, 0], s: [1, 0.3, 1] }),
    G('Head', { p: [0, 0.24, 0.48] }, [
      M('HeadSkin', merge([
        [new THREE.SphereGeometry(0.17, 32, 24), { s: [1, 0.92, 1] }],
        [new THREE.CylinderGeometry(0.1, 0.11, 0.16, 16), { p: [0, -0.04, -0.12], r: [Math.PI / 2 - 0.3, 0, 0] }],
      ]), 'Skin'),
      eye('EyeLeft', 0.05, { p: [-0.075, 0.05, 0.13] }),
      eye('EyeRight', 0.05, { p: [0.075, 0.05, 0.13] }),
      M('Smile', smileGeo(0.05, 0.01), 'Smile', { p: [0, -0.04, 0.16], r: [-0.3, 0, 0] }),
      M('Cheeks', merge([-1, 1].map((x) => [new THREE.SphereGeometry(0.03, 12, 8), { p: [x * 0.11, -0.02, 0.12], s: [1, 0.6, 0.4], r: [0, x * 0.6, 0] }])), 'Cheek'),
      M('Bandana', merge([
        [new THREE.SphereGeometry(0.175, 32, 12, 0, Math.PI * 2, 0, 1.0), { p: [0, 0.015, 0], r: [-0.4, 0, 0] }],
        [new THREE.SphereGeometry(0.04, 12, 8), { p: [0, 0.12, -0.14] }],
        [new THREE.ConeGeometry(0.035, 0.12, 8), { p: [0.03, 0.08, -0.2], r: [-2.2, 0, 0.4] }],
        [new THREE.ConeGeometry(0.035, 0.12, 8), { p: [-0.03, 0.08, -0.2], r: [-2.2, 0, -0.4] }],
      ]), 'Bandana'),
    ]),
    flipper('FlipperFrontLeft', [-0.36, 0.14, 0.2], -1.1, 0.22),
    flipper('FlipperFrontRight', [0.36, 0.14, 0.2], 1.1, 0.22),
    flipper('FlipperBackLeft', [-0.3, 0.12, -0.28], -2.3, 0.14),
    flipper('FlipperBackRight', [0.3, 0.12, -0.28], 2.3, 0.14),
    M('TailTip', new THREE.ConeGeometry(0.05, 0.14, 12), 'Skin', { p: [0, 0.13, -0.47], r: [-Math.PI / 2 - 0.2, 0, 0] }),
  ]);
  return {
    root,
    materials: {
      ...faceMaterials,
      Tint: tint({ roughness: 0.35, clearcoat: 0.6 }, color),
      Pattern: { color: '#F2E3A6', roughness: 0.5 },
      Rim: { color: '#F7EBC4', roughness: 0.6 },
      Skin: { color: '#93D67E', roughness: 0.55 },
      Bandana: { color: '#E8414B', roughness: 0.7 },
    },
    movingParts: [
      { part: 'FlipperFrontLeft', motion: 'flap', axis: [0, 0, 1], degrees: 25 },
      { part: 'FlipperFrontRight', motion: 'flap', axis: [0, 0, 1], degrees: -25 },
      { part: 'FlipperBackLeft', motion: 'flap', axis: [0, 0, 1], degrees: 15 },
      { part: 'FlipperBackRight', motion: 'flap', axis: [0, 0, 1], degrees: -15 },
    ],
  };
}

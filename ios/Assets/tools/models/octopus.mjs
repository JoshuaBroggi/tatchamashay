// Wobbles the Octopus: a round, smiling octopus with eight curly arms.

import { THREE, G, M, merge, eye, smileGeo, faceMaterials, tint } from '../lib/kit.mjs';

export const meta = {
  id: 'octopus',
  displayName: 'Wobbles the Octopus',
  file: 'Octopus.usdz',
  kind: 'treasure',
  description: 'A giggly octopus with eight curly arms.',
  defaultColor: '#FF7A9C',
  idleMotion: 'wiggle',
};

function arm(angle) {
  const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const at = (r, y) => dir.clone().multiplyScalar(r).setY(y);
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const curve = new THREE.CatmullRomCurve3([
    at(0.18, 0.36), at(0.34, 0.16), at(0.52, 0.07), at(0.66, 0.1),
    at(0.7, 0.2).add(side.clone().multiplyScalar(0.06)), at(0.6, 0.25).add(side.clone().multiplyScalar(0.1)),
  ]);
  const seg = 48, rad = 10;
  const geo = new THREE.TubeGeometry(curve, seg, 0.085, rad, false);
  const pos = geo.attributes.position;
  for (let s = 0; s <= seg; s++) {
    const t = s / seg, c = curve.getPointAt(t), k = 1 - 0.7 * t;
    for (let j = 0; j <= rad; j++) {
      const i = s * (rad + 1) + j;
      pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, c.y + (pos.getY(i) - c.y) * k, c.z + (pos.getZ(i) - c.z) * k);
    }
  }
  geo.computeVertexNormals();
  return [[geo], [new THREE.SphereGeometry(0.085 * 0.3, 10, 8), { p: curve.getPointAt(1).toArray() }]];
}

export function build(color) {
  const arms = [];
  for (let i = 0; i < 8; i++) arms.push(...arm((i / 8) * Math.PI * 2 + Math.PI / 8));
  const root = G('Octopus', { s: 0.28 }, [
    M('Head', new THREE.SphereGeometry(0.42, 48, 32), 'Tint', { p: [0, 0.66, 0], s: [1, 1.12, 0.95] }),
    M('Arms', merge(arms), 'Tint'),
    eye('EyeLeft', 0.1, { p: [-0.15, 0.72, 0.33] }),
    eye('EyeRight', 0.1, { p: [0.15, 0.72, 0.33] }),
    M('Smile', smileGeo(0.075, 0.016), 'Smile', { p: [0, 0.54, 0.385], r: [-0.25, 0, 0] }),
    M('Cheeks', merge([
      [new THREE.SphereGeometry(0.06, 16, 12), { p: [-0.25, 0.57, 0.3], s: [1, 0.6, 0.4] }],
      [new THREE.SphereGeometry(0.06, 16, 12), { p: [0.25, 0.57, 0.3], s: [1, 0.6, 0.4] }],
    ]), 'Cheek'),
    M('Spots', merge([[-0.2, 0.95, 0.18], [0.24, 0.9, 0.2], [0.05, 1.05, 0.1], [-0.3, 0.75, -0.15], [0.28, 0.8, -0.2]]
      .map((p) => [new THREE.SphereGeometry(0.045, 12, 8), { p, s: [1, 1, 0.5], q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(p[0], p[1] - 0.66, p[2]).normalize()) }])), 'Spot'),
  ]);
  return {
    root,
    materials: { ...faceMaterials, Tint: tint({ roughness: 0.4, clearcoat: 0.6 }, color), Spot: { color: '#FFFFFF', roughness: 0.4, opacity: 0.55 } },
  };
}

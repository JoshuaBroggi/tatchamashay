// An original, friendly eight-legged spider. Three independently paintable areas.
import { THREE, G, M, merge, eye, smileGeo, faceMaterials, tint } from '../lib/kit.mjs';

export const meta = {
  id: 'spider', displayName: 'Silky the Spider', file: 'Spider.usdz', kind: 'treasure',
  description: 'A curious little spider with eight long legs and a silky coat.',
  defaultColor: '#5C3B2B', idleMotion: 'wiggle',
};

export function build(color) {
  const legs = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = 0.16 - i * 0.12;
      const spread = (1.5 - i) * 0.20;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.13, 0.19, z),
        new THREE.Vector3(side * 0.32, 0.30, z + spread * 0.5),
        new THREE.Vector3(side * 0.47, 0.26, z + spread),
        new THREE.Vector3(side * 0.59, 0.025, z + spread * 1.4),
      ]);
      legs.push([new THREE.TubeGeometry(curve, 20, 0.023, 8, false)]);
      legs.push([new THREE.SphereGeometry(0.025, 10, 8), { p: curve.getPoint(1).toArray() }]);
    }
  }
  const root = G('Spider', { s: 0.36 }, [
    M('Abdomen', new THREE.SphereGeometry(0.25, 40, 24), 'Tint', { p: [0, 0.27, -0.22], s: [0.9, 0.85, 1.25] }),
    M('Head', new THREE.SphereGeometry(0.19, 32, 24), 'Tint', { p: [0, 0.22, 0.12], s: [1, 0.85, 1] }),
    M('Legs', merge(legs), 'Tint'),
    eye('EyeLeft', 0.058, { p: [-0.073, 0.27, 0.275] }),
    eye('EyeRight', 0.058, { p: [0.073, 0.27, 0.275] }),
    ...[-1, 1].flatMap(side => [0, 1, 2].map(i =>
      M(`SmallEye${side < 0 ? 'L' : 'R'}${i}`, new THREE.SphereGeometry(0.016, 12, 8), 'Pupil',
        { p: [side * (0.07 + i * 0.038), 0.34 - i * 0.022, 0.22 - i * 0.016] }))),
    M('Smile', smileGeo(0.04, 0.008), 'Smile', { p: [0, 0.17, 0.293] }),
  ]);
  return { root, materials: { ...faceMaterials, Tint: tint({ roughness: 0.8 }, color) } };
}

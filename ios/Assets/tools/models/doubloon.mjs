// The Lucky Doubloon: a big chunky coin with a star and a ring of dots.

import { THREE, G, M, merge, starShape, extrude, tint } from '../lib/kit.mjs';

export const meta = {
  id: 'doubloon',
  displayName: 'Lucky Doubloon',
  file: 'Doubloon.usdz',
  kind: 'treasure',
  description: 'A lucky golden coin. Flip it for a wish!',
  defaultColor: '#F5B83D',
  idleMotion: 'spin',
};

export function build(color) {
  const sides = [1, -1].flatMap((s) => {
    const z = s * 0.05;
    const dots = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      dots.push([new THREE.SphereGeometry(0.018, 10, 8), { p: [Math.cos(a) * 0.33, Math.sin(a) * 0.33, z] }]);
    }
    return [[extrude(starShape(5, 0.2, 0.09), 0.02, 0.01), { p: [0, 0, z], r: [0, s > 0 ? 0 : Math.PI, 0] }], ...dots];
  });
  const root = G('Doubloon', { s: 0.3 }, [
    G('Coin', { p: [0, 0.48, 0] }, [
      M('Face', new THREE.CylinderGeometry(0.4, 0.4, 0.1, 72).rotateX(Math.PI / 2), 'Tint'),
      M('Rim', merge([
        [new THREE.TorusGeometry(0.4, 0.04, 12, 72), { p: [0, 0, 0.035] }],
        [new THREE.TorusGeometry(0.4, 0.04, 12, 72), { p: [0, 0, -0.035] }],
      ]), 'Tint'),
      M('Stamp', merge(sides), 'Tint'),
    ]),
  ]);
  return {
    root,
    materials: {
      Tint: tint({ roughness: 0.3, metallic: 0.45, clearcoat: 1 }, color),
    },
  };
}

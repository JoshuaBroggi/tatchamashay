// The Sparkle Crown: a chunky crown with jewels and a velvet cushion.

import { THREE, G, M, merge, tint } from '../lib/kit.mjs';

export const meta = {
  id: 'crown',
  displayName: 'Sparkle Crown',
  file: 'Crown.usdz',
  kind: 'treasure',
  description: 'A jewelled crown fit for a pirate king or queen.',
  defaultColor: '#F2C14E',
  idleMotion: 'spin',
};

export function build(color) {
  const band = new THREE.LatheGeometry([[0.38, 0], [0.42, 0], [0.44, 0.3], [0.4, 0.3], [0.38, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 72);
  const points = [], balls = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.sin(a) * 0.41, z = Math.cos(a) * 0.41;
    points.push([new THREE.ConeGeometry(0.11, 0.32, 4), { p: [x, 0.44, z], r: [0, a + Math.PI / 4, 0], s: [1, 1, 0.35] }]);
    balls.push([new THREE.SphereGeometry(0.045, 16, 12), { p: [x * 1.0, 0.62, z * 1.0] }]);
  }
  const gems = { GemRed: [], GemBlue: [], GemGreen: [] };
  const kinds = Object.keys(gems);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    gems[kinds[i % 3]].push([new THREE.OctahedronGeometry(0.06, 0), { p: [Math.sin(a) * 0.445, 0.15, Math.cos(a) * 0.445], r: [0, a, 0], s: [1, 1.2, 0.5] }]);
  }
  const root = G('Crown', { s: 0.3 }, [
    M('Band', band, 'Tint'),
    M('Points', merge(points), 'Tint'),
    M('Rim', merge([
      [new THREE.TorusGeometry(0.43, 0.02, 10, 72).rotateX(Math.PI / 2), { p: [0, 0.02, 0] }],
      [new THREE.TorusGeometry(0.42, 0.018, 10, 72).rotateX(Math.PI / 2), { p: [0, 0.29, 0] }],
    ]), 'Tint'),
    M('Pearls', merge(balls), 'Pearl'),
    ...kinds.map((k) => M(k, merge(gems[k]), k)),
    M('Velvet', new THREE.SphereGeometry(0.39, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), 'Velvet', { p: [0, 0.12, 0], s: [1, 0.55, 1] }),
    M('TopJewel', new THREE.SphereGeometry(0.06, 20, 16), 'GemBlue', { p: [0, 0.36, 0] }),
  ]);
  return {
    root,
    materials: {
      Tint: tint({ roughness: 0.3, metallic: 0.45, clearcoat: 1 }, color),
      Pearl: { color: '#FFF8EE', roughness: 0.2, clearcoat: 1 },
      GemRed: { color: '#FF3355', emissive: '#FF3355', emissiveIntensity: 0.25, roughness: 0.05, clearcoat: 1 },
      GemBlue: { color: '#3A8DFF', emissive: '#3A8DFF', emissiveIntensity: 0.25, roughness: 0.05, clearcoat: 1 },
      GemGreen: { color: '#2FD47A', emissive: '#2FD47A', emissiveIntensity: 0.25, roughness: 0.05, clearcoat: 1 },
      Velvet: { color: '#A3123A', roughness: 0.95 },
    },
  };
}

// The Giggle Potion: a round glass flask of fizzy potion with a cork,
// bubbles floating out of the top and a heart tag on a string.

import { THREE, G, M, merge, heartShape, extrude, tint } from '../lib/kit.mjs';

export const meta = {
  id: 'potion',
  displayName: 'Giggle Potion',
  file: 'Potion.usdz',
  kind: 'treasure',
  description: 'A fizzy potion that makes everyone giggle.',
  defaultColor: '#9B6BFF',
  idleMotion: 'bob',
};

const C = 0.34, R = 0.32; // flask bulb centre height and radius

function bulbProfile(r, yTop) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (i / 24) * Math.PI;
    const y = C + Math.sin(a) * r;
    if (y > yTop) break;
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * r), y));
  }
  return pts;
}

export function build(color) {
  const glass = [...bulbProfile(R, C + R * 0.88), new THREE.Vector2(0.1, 0.68), new THREE.Vector2(0.095, 0.86), new THREE.Vector2(0.12, 0.88), new THREE.Vector2(0.12, 0.9)];
  const fill = C + 0.06;
  const liquid = bulbProfile(R - 0.02, fill);
  liquid.push(new THREE.Vector2(0.0001, fill));
  const bubbles = [[0.06, 0.95, 0.02, 0.03], [-0.05, 1.05, 0.0, 0.035], [0.03, 1.17, -0.02, 0.025], [-0.1, 0.3, 0.12, 0.025], [0.12, 0.22, 0.05, 0.02], [0.02, 0.35, -0.15, 0.03]];
  const root = G('Potion', { s: 0.28 }, [
    M('Liquid', new THREE.LatheGeometry(liquid, 48), 'Tint'),
    M('Flask', new THREE.LatheGeometry(glass, 48), 'Glass'),
    M('Cork', new THREE.CylinderGeometry(0.1, 0.085, 0.14, 24), 'Cork', { p: [0, 0.92, 0] }),
    M('Bubbles', merge(bubbles.map(([x, y, z, r]) => [new THREE.SphereGeometry(r, 16, 12), { p: [x, y, z] }])), 'Bubble'),
    M('String', new THREE.TorusGeometry(0.105, 0.012, 8, 32).rotateX(Math.PI / 2), 'Cork', { p: [0, 0.74, 0] }),
    G('Tag', { p: [0.08, 0.66, 0.18], r: [0.15, 0.4, -0.15] }, [
      M('Heart', extrude(heartShape(0.14), 0.02, 0.008), 'Heart'),
    ]),
  ]);
  return {
    root,
    materials: {
      Tint: tint({ roughness: 0.15, clearcoat: 1 }, color),
      Glass: { color: '#EAF8FF', roughness: 0.04, opacity: 0.25, clearcoat: 1 },
      Cork: { color: '#B07A47', roughness: 0.9 },
      Bubble: { color: '#FFFFFF', roughness: 0.05, opacity: 0.55, emissive: '#FFFFFF', emissiveIntensity: 0.2 },
      Heart: { color: '#FF5C8A', roughness: 0.4 },
    },
  };
}

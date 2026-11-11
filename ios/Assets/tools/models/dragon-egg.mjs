// The Dragon Egg: a speckled egg sitting in a twig nest.

import { THREE, G, M, merge, rng, alignY, tint } from '../lib/kit.mjs';

export const meta = {
  id: 'dragon-egg',
  displayName: 'Dragon Egg',
  file: 'DragonEgg.usdz',
  kind: 'treasure',
  description: 'A warm, wobbly egg. Something inside is about to say hello!',
  defaultColor: '#4FC48A',
  idleMotion: 'wiggle',
};

const H = 0.88, RW = 0.33;
const profile = (t) => new THREE.Vector2(Math.max(0.0001, Math.sin(t) * RW * (1 + 0.16 * Math.cos(t))), ((1 - Math.cos(t)) / 2) * H);

export function build(color) {
  const pts = [];
  for (let i = 0; i <= 40; i++) pts.push(profile((i / 40) * Math.PI));
  const egg = new THREE.LatheGeometry(pts, 64);

  const R = rng(21), spots = [];
  for (let i = 0; i < 18; i++) {
    const t = 0.5 + R() * 2.0, a = R() * Math.PI * 2;
    const p = profile(t), d = 0.002;
    // Surface normal from the profile tangent.
    const p2 = profile(t + 0.01), dx = p2.x - p.x, dy = p2.y - p.y;
    const nr = new THREE.Vector3(dy * Math.sin(a), -dx, dy * Math.cos(a)).normalize();
    const r = 0.03 + R() * 0.035;
    spots.push([new THREE.SphereGeometry(r, 16, 8), { p: [(p.x + d) * Math.sin(a), p.y, (p.x + d) * Math.cos(a)], q: alignY(nr.toArray()), s: [1, 0.25, 1] }]);
  }

  const twigs = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + R() * 0.2;
    twigs.push([new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), {
      p: [Math.sin(a) * 0.36, 0.05 + R() * 0.06, Math.cos(a) * 0.36],
      r: [Math.PI / 2 + (R() - 0.5) * 0.5, a + Math.PI / 2 + (R() - 0.5) * 0.4, (R() - 0.5) * 0.3],
    }]);
  }

  const root = G('DragonEgg', { s: 0.3 }, [
    G('Egg', { p: [0, 0.03, 0] }, [
      M('Shell', egg, 'Tint'),
      M('Speckles', merge(spots), 'Speckle'),
    ]),
    M('Nest', merge([
      [new THREE.TorusGeometry(0.36, 0.09, 12, 48).rotateX(Math.PI / 2), { p: [0, 0.07, 0], s: [1, 0.7, 1] }],
      ...twigs,
    ]), 'Nest'),
  ]);
  return {
    root,
    materials: {
      Tint: tint({ roughness: 0.35, clearcoat: 0.7 }, color),
      Speckle: { color: '#F6C945', roughness: 0.3, metallic: 0.4 },
      Nest: { color: '#9A6B3E', roughness: 0.95 },
    },
    idleMotionPart: 'Egg', // the nest stays still
  };
}

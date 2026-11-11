// The Star Compass: a puffy five-point star with a working-looking compass
// set into both faces and a loop at the top.

import { THREE, G, M, merge, starShape, extrude, tint } from '../lib/kit.mjs';

export const meta = {
  id: 'star-compass',
  displayName: 'Star Compass',
  file: 'StarCompass.usdz',
  kind: 'treasure',
  description: 'A shining star with a compass that always points to adventure.',
  defaultColor: '#FFC93C',
  idleMotion: 'spin',
};

function face(side) {
  const name = side > 0 ? 'Front' : 'Back';
  const z = side * 0.115;
  const ticks = [0, 1, 2, 3].map((i) => [new THREE.BoxGeometry(0.012, 0.035, 0.004), { p: [Math.sin(i * Math.PI / 2) * 0.13, Math.cos(i * Math.PI / 2) * 0.13, 0], r: [0, 0, -i * Math.PI / 2] }]);
  return G(`Compass${name}`, { p: [0, 0, z], r: [0, side > 0 ? 0 : Math.PI, 0] }, [
    M(`Case${name}`, new THREE.TorusGeometry(0.17, 0.03, 16, 48), 'Brass'),
    M(`Dial${name}`, new THREE.CircleGeometry(0.17, 48), 'Dial', { p: [0, 0, -0.005] }),
    M(`Ticks${name}`, merge(ticks), 'Ink', { p: [0, 0, 0.0] }),
    M(`NeedleNorth${name}`, new THREE.ConeGeometry(0.03, 0.12, 4), 'Needle', { p: [0, 0.06, 0.008], s: [1, 1, 0.3] }),
    M(`NeedleSouth${name}`, new THREE.ConeGeometry(0.03, 0.12, 4), 'NeedleTail', { p: [0, -0.06, 0.008], r: [0, 0, Math.PI], s: [1, 1, 0.3] }),
    M(`Pin${name}`, new THREE.SphereGeometry(0.018, 12, 8), 'Brass', { p: [0, 0, 0.012] }),
    M(`Glass${name}`, new THREE.SphereGeometry(0.17, 32, 8, 0, Math.PI * 2, 0, 0.5).rotateX(Math.PI / 2), 'Glass', { p: [0, 0, -0.14] }),
  ]);
}

export function build(color) {
  const root = G('StarCompass', { s: 0.3 }, [
    G('Pendant', { p: [0, 0.55, 0] }, [
      M('Star', extrude(starShape(5, 0.5, 0.24), 0.12, 0.05), 'Tint'),
      face(1), face(-1),
      M('Loop', new THREE.TorusGeometry(0.06, 0.018, 12, 32), 'Brass', { p: [0, 0.6, 0] }),
    ]),
  ]);
  return {
    root,
    materials: {
      Tint: tint({ roughness: 0.3, metallic: 0.15, clearcoat: 1 }, color),
      Brass: { color: '#C9973C', roughness: 0.3, metallic: 0.6 },
      Dial: { color: '#FFF4DA', roughness: 0.6 },
      Ink: { color: '#3B2C2A', roughness: 0.6 },
      Needle: { color: '#E8333A', roughness: 0.4 },
      NeedleTail: { color: '#F5F5F5', roughness: 0.4 },
      Glass: { color: '#E8FBFF', roughness: 0.05, opacity: 0.18, clearcoat: 1 },
    },
  };
}

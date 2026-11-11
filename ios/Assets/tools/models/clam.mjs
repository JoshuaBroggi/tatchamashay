// The Glow Shell: a scalloped clam, half open, holding a glowing pearl.

import { THREE, G, M, flipped, tint } from '../lib/kit.mjs';

export const meta = {
  id: 'clam',
  displayName: 'Glow Shell',
  file: 'GlowShell.usdz',
  kind: 'treasure',
  description: 'A scalloped shell that opens to show a glowing pearl.',
  defaultColor: '#FF9E7A',
  idleMotion: 'bob',
};

// Half a flattened dome with ribs fanning out from the hinge at -Z.
function half(top, inset = 0) {
  const r = 0.5 - inset;
  const geo = top
    ? new THREE.SphereGeometry(r, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2)
    : new THREE.SphereGeometry(r, 64, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const fan = Math.atan2(x, z + 0.5);
    const rib = 1 + 0.035 * Math.cos(fan * 22) * Math.min(1, Math.hypot(x, z + 0.5) * 2);
    p.setXYZ(i, x * rib, y * 0.32, z * rib);
  }
  geo.computeVertexNormals();
  return geo;
}

export function build(color) {
  const hinge = [0, 0, -0.46];
  const root = G('GlowShell', { s: 0.3, p: [0, 0.16 * 0.3, 0] }, [
    G('Bottom', {}, [
      M('ShellBottom', half(false), 'Tint'),
      M('ShellBottomInside', flipped(half(false, 0.012)), 'Inside'),
    ]),
    // `Top` pivots on the hinge; rotate it about X (negative opens wider).
    G('Top', { p: hinge, r: [-0.75, 0, 0] }, [
      G('TopShape', { p: [0, 0, -hinge[2]] }, [
        M('ShellTop', half(true), 'Tint'),
        M('ShellTopInside', flipped(half(true, 0.012)), 'Inside'),
      ]),
    ]),
    M('Pearl', new THREE.SphereGeometry(0.15, 32, 24), 'Pearl', { p: [0, 0.1, 0.02] }),
    M('PearlGlow', new THREE.SphereGeometry(0.2, 32, 24), 'Halo', { p: [0, 0.1, 0.02] }),
  ]);
  return {
    root,
    materials: {
      Tint: tint({ roughness: 0.35, clearcoat: 0.8 }, color),
      Inside: { color: '#FFD9E6', roughness: 0.25, clearcoat: 1 },
      Pearl: { color: '#FFF6FB', emissive: '#FFE8F4', emissiveIntensity: 0.9, roughness: 0.15, clearcoat: 1 },
      Halo: { color: '#FFF0F8', emissive: '#FFD6EC', emissiveIntensity: 0.6, opacity: 0.22, roughness: 1 },
    },
    movingParts: [{ part: 'Top', motion: 'hinge', axis: [1, 0, 0], openDegrees: -60 }],
  };
}

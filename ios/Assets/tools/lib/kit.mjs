// Small modelling kit shared by the model files: named groups and meshes,
// geometry merging, a seeded random, and a few reusable parts (eyes, stars).

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE };

function place(obj, { p, r, s, q } = {}) {
  if (p) obj.position.set(...p);
  if (r) obj.rotation.set(...r);
  if (q) obj.quaternion.copy(q);
  if (s !== undefined) Array.isArray(s) ? obj.scale.set(...s) : obj.scale.setScalar(s);
  return obj;
}

// Named Xform. `children` may contain nulls (skipped).
export function G(name, t = {}, children = []) {
  const g = place(new THREE.Group(), t);
  g.name = name;
  for (const c of children) if (c) g.add(c);
  return g;
}

// Named mesh bound to material `mat` (a key of the model's material table).
export function M(name, geo, mat, t = {}) {
  const m = place(new THREE.Mesh(geo), t);
  m.name = name;
  m.userData.mat = mat;
  return m;
}

// Bake transforms into geometry so many small pieces become one prim.
// parts: [[geometry, {p, r, s, q}], ...]
export function merge(parts) {
  const geos = parts.map(([geo, t]) => {
    const o = place(new THREE.Object3D(), t);
    o.updateMatrix();
    let g = geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.index) g = mergeVertices(g);
    return g.applyMatrix4(o.matrix);
  });
  return mergeGeometries(geos);
}

// Same shape, facing inward (for the inside of shells and bowls).
export function flipped(geo) {
  const g = geo.clone();
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  const n = g.attributes.normal;
  for (let i = 0; i < n.array.length; i++) n.array[i] = -n.array[i];
  return g;
}

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// Quaternion that turns +Y onto `dir` (orient pieces to a surface normal).
export const alignY = (dir) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());

export function starShape(points, outer, inner) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 ? inner : outer;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

export function heartShape(size) {
  const k = size / 1.6, s = new THREE.Shape();
  s.moveTo(0, -0.9 * k);
  s.bezierCurveTo(0.2 * k, -0.6 * k, 1 * k, -0.3 * k, 0.8 * k, 0.3 * k);
  s.bezierCurveTo(0.6 * k, 0.8 * k, 0.05 * k, 0.75 * k, 0, 0.3 * k);
  s.bezierCurveTo(-0.05 * k, 0.75 * k, -0.6 * k, 0.8 * k, -0.8 * k, 0.3 * k);
  s.bezierCurveTo(-1 * k, -0.3 * k, -0.2 * k, -0.6 * k, 0, -0.9 * k);
  return s;
}

export const extrude = (shape, depth, bevel) => {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, curveSegments: 16, bevelEnabled: !!bevel,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3,
  });
  g.translate(0, 0, -depth / 2);
  return g;
};

// Cartoon eye looking down +Z: white ball, dark pupil, sparkle.
// Uses the shared materials EyeWhite, Pupil, Sparkle.
export function eye(name, r, t) {
  return G(name, t, [
    M(`${name}White`, new THREE.SphereGeometry(r, 24, 16), 'EyeWhite'),
    M(`${name}Pupil`, new THREE.SphereGeometry(r * 0.58, 20, 14), 'Pupil', { p: [0, 0, r * 0.55] }),
    M(`${name}Sparkle`, new THREE.SphereGeometry(r * 0.2, 10, 8), 'Sparkle', { p: [r * 0.22, r * 0.28, r * 1.02] }),
  ]);
}

// Smile arc lying in the XY plane, facing +Z.
export const smileGeo = (r, tube) => new THREE.TorusGeometry(r, tube, 8, 24, Math.PI).rotateZ(Math.PI);

// Materials most characters share.
export const faceMaterials = {
  EyeWhite: { color: '#FFFFFF', roughness: 0.25 },
  Pupil: { color: '#1B1622', roughness: 0.15, clearcoat: 1 },
  Sparkle: { color: '#FFFFFF', emissive: '#FFFFFF', roughness: 0.1 },
  Smile: { color: '#3A1E24', roughness: 0.5 },
  Cheek: { color: '#FF9DB5', roughness: 0.7 },
};

// The material the app recolors. Near-white so a multiplied tint shows the
// chosen color faithfully; `previewColor` is used only for preview thumbnails.
export function tint(opts = {}, previewColor) {
  return { color: previewColor ?? '#EDEDED', roughness: 0.45, ...opts };
}

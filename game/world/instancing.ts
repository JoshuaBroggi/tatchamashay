/**
 * Shared instancing utilities for consolidating repeated meshes
 * into fewer InstancedMesh draw calls, with drawRange support.
 */

import * as THREE from 'three';

/**
 * Reusable dummy Object3D for matrix computation.
 * NEVER create new Object3D instances inside useFrame.
 */
export const sharedDummy = new THREE.Object3D();

/**
 * Reusable temp vectors to avoid per-frame allocations.
 * These are module-level singletons, safe for single-threaded use.
 */
export const _tempVec3A = new THREE.Vector3();
export const _tempVec3B = new THREE.Vector3();
export const _tempVec3C = new THREE.Vector3();
export const _tempVec3D = new THREE.Vector3();
export const _tempColor = new THREE.Color();
export const _tempMatrix = new THREE.Matrix4();
export const _tempQuat = new THREE.Quaternion();
export const _tempEuler = new THREE.Euler();

/**
 * Hide an instance by moving it far away and scaling to zero.
 */
export function hideInstance(
  mesh: THREE.InstancedMesh,
  index: number,
  dummy: THREE.Object3D = sharedDummy
): void {
  dummy.position.set(0, -1000, 0);
  dummy.scale.set(0, 0, 0);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

/**
 * Set drawRange on an InstancedMesh to only render the first N instances.
 */
export function setInstancedDrawRange(
  mesh: THREE.InstancedMesh,
  count: number
): void {
  mesh.geometry.setDrawRange(0, mesh.geometry.index
    ? mesh.geometry.index.count
    : mesh.geometry.attributes.position.count
  );
  mesh.count = count;
}

/**
 * Determine if an object at (x, z) is within update distance from camera at (cx, cz).
 */
export function isWithinUpdateDistance(
  x: number, z: number,
  cx: number, cz: number,
  maxDistance: number
): boolean {
  const dx = x - cx;
  const dz = z - cz;
  return (dx * dx + dz * dz) <= maxDistance * maxDistance;
}

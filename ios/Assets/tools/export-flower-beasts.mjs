// Reproduce the family's procedural creatures from the pinned web source, without a browser.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const sourceCommit = '2b397b3cad58d17722b5bd907433863b4881c9df';
try { execFileSync('git', ['cat-file', '-e', sourceCommit], { cwd: repo, stdio: 'ignore' }); }
catch { execFileSync('git', ['fetch', 'origin', 'claude/demogorgon-rig-animate-6a2474'], { cwd: repo, stdio: 'inherit' }); }

const sourcePlugin = {
  name: 'pinned-procedural-source',
  setup(b) {
    b.onResolve({ filter: /^source:/ }, args => ({ path: args.path.slice(7), namespace: 'git-source' }));
    b.onResolve({ filter: /^\./, namespace: 'git-source' }, args => ({
      path: path.posix.normalize(path.posix.join(path.posix.dirname(args.importer), args.path)) + '.ts',
      namespace: 'git-source',
    }));
    b.onLoad({ filter: /.*/, namespace: 'git-source' }, args => {
      let contents = execFileSync('git', ['show', `${sourceCommit}:${args.path}`], { cwd: repo, encoding: 'utf8' });
      // Omit browser-only wrinkle maps. Geometry, weights, vertex colors and Idle stay original.
      if (args.path === 'game/components/demogorgon/rig.ts') {
        const start = contents.indexOf('export const makeSkinTextures =');
        const end = contents.indexOf('\n};', start) + 3;
        if (start < 0 || end < 3) throw new Error('Pinned source texture function missing');
        contents = contents.slice(0, start) +
          'export const makeSkinTextures = () => ({bump: new THREE.Texture(), albedo: new THREE.Texture()});' + contents.slice(end);
      }
      return { contents, loader: 'ts', resolveDir: here };
    });
  },
};
const entry = `
import { buildDemogorgonRig } from 'source:game/components/demogorgon/rig.ts';
import { buildDemogorgonClips } from 'source:game/components/demogorgon/animations.ts';
import { buildDemodogRig } from 'source:game/components/demodog/rig.ts';
import { buildDemodogClips } from 'source:game/components/demodog/animations.ts';
import { buildVineDogRig } from 'source:game/components/vinedog/rig.ts';
import { buildVineDogClips } from 'source:game/components/vinedog/animations.ts';
export const builders = {demogorgon: [buildDemogorgonRig, buildDemogorgonClips],
 demodog: [buildDemodogRig, buildDemodogClips], 'vine-dog': [buildVineDogRig, buildVineDogClips]};`;
await fs.mkdir(path.join(here, '.build'), { recursive: true });
const compiled = path.join(here, '.build/flower-source.mjs');
await build({ stdin: { contents: entry, resolveDir: here, loader: 'ts' }, bundle: true,
  packages: 'external', platform: 'node', format: 'esm', outfile: compiled, plugins: [sourcePlugin] });
const { builders } = await import(compiled);
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => {
    this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.();
  }); }
};
for (const [id, [makeRig, makeClips]] of Object.entries(builders)) {
  const rig = makeRig();
  const idle = makeClips(rig).find(clip => clip.name === 'Idle');
  if (!idle) throw new Error(`${id}: missing Idle`);
  const originalMaterial = rig.mesh.material;
  rig.mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, side: THREE.DoubleSide });
  rig.root.userData = { title: id, sourceCommit,
    source: `https://github.com/JoshuaBroggi/tatchamashay/tree/${sourceCommit}/game/components`,
    usage: 'Joshua requested these three characters for the private family iPhone build.' };
  const bytes = await new GLTFExporter().parseAsync(rig.root, { binary: true, animations: [idle] });
  const dest = path.resolve(here, `../Sources/FlowerBeasts/${id}.glb`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(bytes));
  console.log(`${id}: ${bytes.byteLength} bytes; ${rig.skeleton.bones.length} joints; Idle ${idle.duration}s`);
  rig.mesh.material.dispose();
  rig.mesh.material = originalMaterial;
  rig.dispose();
}

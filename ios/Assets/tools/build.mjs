// Builds every model in ./models into ios/Assets/Models/*.usdz, checks each
// with usdchecker, renders Quick Look thumbnails and rewrites manifest.json.
//
//   cd ios/Assets/tools && npm install && npm run build      # all models
//   node build.mjs octopus parrot                          # just these ids
//
// Needs macOS (usdcat, usdzip, usdchecker and usdrecord ship with the OS).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { THREE } from './lib/kit.mjs';
import { toUSDA } from './lib/usd.mjs';
import { woodPNG, ironPNG } from './lib/textures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(here, '..');
const out = { models: path.join(assets, 'Models'), thumbs: path.join(assets, 'Thumbnails'), stage: path.join(here, '.build') };
const ORDER = ['chest', 'octopus', 'clam', 'parrot', 'crown', 'star-compass', 'potion', 'dragon-egg', 'turtle', 'doubloon'];
const LIMIT = { chest: 2e6, treasure: 1.5e6 };

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

function stageModel(dir, mod, built, textures) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'textures'), { recursive: true });
  const usda = toUSDA(built.root, built.materials);
  fs.writeFileSync(path.join(dir, 'model.usda'), usda.text);
  for (const t of usda.textures) {
    const spec = textures[t];
    if (!spec) throw new Error(`${mod.meta.id}: no texture recipe for ${t}`);
    fs.writeFileSync(path.join(dir, t), spec.kind === 'wood' ? woodPNG(spec) : ironPNG(spec));
  }
  return usda;
}

// Binary USD (usdc) is about a third of the size of the text layer.
function pack(dir, usda, dest) {
  fs.rmSync(dest, { force: true });
  run('usdcat', ['model.usda', '-o', 'model.usdc'], { cwd: dir });
  run('usdzip', [dest, 'model.usdc', ...usda.textures], { cwd: dir });
}

// Renders the packed file with usdrecord (Hydra Storm) from a three-quarter
// camera with a key light and a soft dome. Quick Look's `qlmanage -t` returns
// no image for USDZ when run from a script, so it is not used.
function thumbnail(usdz, name, root, yaw = 0.6) {
  root.updateMatrixWorld(true);
  const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
  const f = 35, aperture = 20.955, fov = 2 * Math.atan(aperture / 2 / f);
  const dist = (sphere.radius / Math.sin(fov / 2)) * 1.05;
  const cam = new THREE.PerspectiveCamera();
  const c = sphere.center;
  cam.position.set(c.x + Math.sin(yaw) * dist * 0.94, c.y + dist * 0.34, c.z + Math.cos(yaw) * dist * 0.94);
  cam.lookAt(c);
  cam.updateMatrix();
  const m = cam.matrix.elements, rows = [0, 4, 8, 12].map((o) => `(${m.slice(o, o + 4).map((v) => v.toFixed(6)).join(', ')})`);
  const dir = path.dirname(usdz);
  const scene = path.join(dir, 'thumbnail.usda');
  fs.writeFileSync(scene, `#usda 1.0
(
    defaultPrim = "Thumbnail"
    metersPerUnit = 1
    upAxis = "Y"
)
def Xform "Thumbnail"
{
    def Xform "Model" (
        prepend references = @./${path.basename(usdz)}@
    )
    {
    }
    def Camera "Camera"
    {
        matrix4d xformOp:transform = ( ${rows.join(', ')} )
        uniform token[] xformOpOrder = ["xformOp:transform"]
        float focalLength = ${f}
        float horizontalAperture = ${aperture}
        float verticalAperture = ${aperture}
        float2 clippingRange = (${(dist * 0.05).toFixed(4)}, ${(dist * 10).toFixed(2)})
    }
    def DistantLight "Key"
    {
        float inputs:intensity = 2.2
        color3f inputs:color = (1, 0.95, 0.86)
        float3 xformOp:rotateXYZ = (-45, 35, 0)
        uniform token[] xformOpOrder = ["xformOp:rotateXYZ"]
    }
    def DomeLight "Sky"
    {
        float inputs:intensity = 0.9
        color3f inputs:color = (0.82, 0.9, 1)
    }
}
`);
  run('usdrecord', ['--camera', '/Thumbnail/Camera', '--imageWidth', '512', '--disableCameraLight', scene, path.join(out.thumbs, name)]);
}

function heightMeters(root) {
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root);
  return +(b.max.y - b.min.y).toFixed(3);
}

async function main() {
  const only = process.argv.slice(2);
  for (const d of Object.values(out)) fs.mkdirSync(d, { recursive: true });
  const manifestPath = path.join(assets, 'manifest.json');
  const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { models: [] };
  const entries = new Map(old.models.map((m) => [m.id, m]));
  let failed = false;

  for (const id of ORDER) {
    if (only.length && !only.includes(id)) continue;
    const mod = await import(`./models/${id}.mjs`);
    const { meta } = mod;
    const built = mod.build();
    const dest = path.join(out.models, meta.file);
    const usda = stageModel(path.join(out.stage, id), mod, built, meta.textures ?? {});
    pack(path.join(out.stage, id), usda, dest);

    const size = fs.statSync(dest).size;
    const limit = meta.kind === 'chest' ? LIMIT.chest : LIMIT.treasure;
    let check;
    try { check = run('usdchecker', ['--arkit', dest]).trim(); } catch (e) { check = `FAILED\n${e.stdout}${e.stderr}`; failed = true; }
    if (size > limit) { console.error(`${id}: ${size} bytes is over the ${limit} byte budget`); failed = true; }
    console.log(`${id.padEnd(13)} ${(size / 1024).toFixed(0).padStart(5)} KB  ${check.split('\n').pop()}`);
    if (check.startsWith('FAILED')) console.error(check);

    if (path.dirname(dest) !== path.join(out.stage, id)) fs.copyFileSync(dest, path.join(out.stage, id, meta.file));
    thumbnail(path.join(out.stage, id, meta.file), `${id}.png`, built.root);
    // A second, throwaway copy painted in the default color shows what the
    // child sees first; only its thumbnail is kept.
    if (meta.defaultColor) {
      const pdir = path.join(out.stage, `${id}-preview`);
      const pbuilt = mod.build(meta.defaultColor);
      const pusda = stageModel(pdir, mod, pbuilt, meta.textures ?? {});
      const pdest = path.join(pdir, meta.file);
      pack(pdir, pusda, pdest);
      thumbnail(pdest, `${id}-default-color.png`, pbuilt.root);
    }
    // Hinged parts (chest lid, shell top) get an extra thumbnail with them
    // swung open, to show the pivot is on the hinge.
    const hinges = (built.movingParts ?? []).filter((m) => m.motion === 'hinge');
    if (hinges.length) {
      const obuilt = mod.build(meta.defaultColor);
      for (const h of hinges) {
        const part = obuilt.root.getObjectByName(h.part);
        part.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...h.axis), THREE.MathUtils.degToRad(h.openDegrees)));
      }
      const odir = path.join(out.stage, `${id}-open`);
      const ousda = stageModel(odir, mod, obuilt, meta.textures ?? {});
      const odest = path.join(odir, meta.file);
      pack(odir, ousda, odest);
      thumbnail(odest, `${id}-open.png`, obuilt.root);
    }

    const tintable = [...new Set(usda.meshNames.filter((m) => m.mat === 'Tint').map((m) => m.name))];
    entries.set(id, {
      id,
      displayName: meta.displayName,
      kind: meta.kind,
      file: `Models/${meta.file}`,
      thumbnail: `Thumbnails/${id}.png`,
      description: meta.description,
      heightMeters: heightMeters(built.root),
      tintMaterial: tintable.length ? 'Tint' : undefined,
      tintableParts: tintable,
      defaultColor: meta.defaultColor,
      idleMotion: meta.idleMotion,
      idleMotionPart: built.idleMotionPart,
      movingParts: built.movingParts ?? [],
      namedParts: built.namedParts,
    });
  }

  const models = ORDER.filter((id) => entries.has(id)).map((id) => entries.get(id));
  fs.writeFileSync(manifestPath, JSON.stringify({ ...old, version: 1, models }, null, 2) + '\n');
  if (failed) { console.error('Some models failed their checks.'); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });

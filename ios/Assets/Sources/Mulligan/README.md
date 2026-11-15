# Mulligan source

Joshua requested **Mulligan** on 15 November 2026: “use standard idle looping and all motions.”
All three supplied toy photographs describe this one creature. This is a new iPhone-first Blender
model and rig made by Codex from those references, rather than an imported or archived mesh.

The adaptation keeps the reference's hunched olive body, long forelimbs and shorter rear legs,
pink snout and extremities, yellow teeth/claws, narrow eyeless head and dark branching ridges across the
back and rump. It has four limbs and no tail. The material gradient is preserved; whole-body
tinting is disabled so selecting an app color does not erase the authored markings.

The underlying character and reference photographs are not represented as original designs or
CC-BY material. Joshua supplied the photographs for this private family build; their original
photographer/manufacturer and source URLs were not supplied. `source-record.json` records the
request, filenames, reference-image hashes, generator revision and tool version. Reference photos
are not shipped in the app or copied into this repository. The manifest's provenance is displayed
by the existing Treasure makers & credits screen.

## Files and reproduction

- `build-mulligan.py`: complete deterministic authoring recipe, seed 714, with no external assets.
- `mulligan.blend`: source mesh, skin weights and 30-joint deforming armature.
- `authoring-record.json`: source geometry and animation metadata.
- `delivery-record.json`: the final packed USDZ's size, hash, geometry and joint-sample metadata.
- `render-mulligan.py`, `idle-preview.gif`, `rear-preview.png`, `front-preview.png` and
  `side-preview.png`: source art review; not app captures.

Joshua's head-shape correction on 15 November is reflected in generator revision 2. The skull
is 45% narrower and the lower jaw 50% narrower than revision 1, retaining the snout's depth and
height. Lips, teeth, mouth lining and forehead ridges follow those proportions. The same
centerline skeleton, skin assignments and baked idle are retained.

Run with Blender 4.5 from the repository root:

```sh
blender --background --factory-startup --python ios/Assets/Sources/Mulligan/build-mulligan.py
blender --background --factory-startup --python ios/Assets/tools/convert-rigged-beasts.py -- mulligan
blender --background --factory-startup --python ios/Assets/Sources/Mulligan/render-mulligan.py
ffmpeg -framerate 6 -pattern_type glob -i 'ios/Assets/tools/.build/mulligan-preview/idle-*.png' \
  -filter_complex 'split[a][b];[a]palettegen=reserve_transparent=1:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5' \
  -loop 0 -y ios/Assets/Sources/Mulligan/idle-preview.gif
```

The source `Idle` action is baked at 24 fps, frames 1–145: one six-second, in-place loop with
breathing, head turn/nod, jaw opening, weight shifts and toe flex. The generator solves planted
wrists/ankles offline and keys the final joint poses. There are no object-transform animation,
runtime IK, drivers or physics dependencies. The shared converter exports `GentleIdle`, normalizes
to a 0.32 m longest dimension, Y-up/meters/+Z-facing with feet on the ground, and reduces the source's
12,084 triangles to the configured 12,000-triangle budget.

## Delivery evidence

The shared converter accepted the final **678,051-byte** USDZ: one skeleton, 30 joints, one clip,
145 rotation samples and 29 changing joints; Root is stationary. The transparent thumbnail is
512 × 512. Source pose renders were inspected from the front and rear, including jaw/head changes.
This is art/conversion evidence, not observed RealityKit playback.

Simulator compilation and signed iPhone compilation both succeeded. No local tests, UI tests,
walkthroughs or runtime animation checks were run. The app was **not installed or launched** for
this change; on-phone appearance, animation and performance remain unobserved. Existing generic
catalog coverage already enumerates every `BuiltInModel` and skeletal manifest entry for CI.

![Blender source idle, not app playback](idle-preview.gif)
![Blender front source render](front-preview.png)
![Blender side source render](side-preview.png)
![Blender rear source render](rear-preview.png)

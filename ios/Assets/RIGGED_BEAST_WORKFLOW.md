# Adding rigged beasts to the iPhone app

This is the shared delivery contract for new creatures, regardless of authoring tool. The spelling is **Tatchamashay**. Creatures are animated treasures in a private family hunt, not enemies. Joshua explicitly requested Demogorgon, Demodog and Vine Dog on 15 November 2026, superseding their earlier exclusion for this family build. This is not a statement of ownership of those characters. Other excluded/held assets in `BEASTS.md` remain excluded/held.

## Worktree and coordination

Never switch branches in `/Users/joshuabroggi/tatchamashay`. Fetch origin and create a fresh `codex/<task>` worktree from `origin/main`. If PR #22 is not merged, apply its dependency commits to your own branch before using this pipeline, or explicitly coordinate a stacked branch from `origin/codex/rigged-beast-treasures`. Do not edit another agent's worktree. You are not alone in the repo; preserve others' changes and keep shared edits additive.

Own your new creature's source, USDZ, thumbnail and config entries. Coordinate the small additions to `Records.swift`, `manifest.json` and shared tooling. Keep creature-specific rig logic out of SwiftUI screens. No signing or release-script changes. Do not merge your own PR.

## Choose the authoring route

| Input | Workflow | Best fit |
|---|---|---|
| Existing GLB/glTF with a skeleton, weights and baked idle | Add a job to `tools/rigged-beasts.json`, then run the Blender converter | Existing web models and other approved model sources |
| Native Blender `.blend` with a deforming armature and keyed idle action | Add the same job, pointing `source` at the `.blend` | New creatures built for iPhone without a web dependency |
| Directly authored iPhone `.usdz` containing UsdSkel joints and time samples | Add the same job with `thumbnailSource` and `heightMeters`; it is packaged without converting the animation | USD/UsdSkel generators or native USD authoring tools |

A Swift file containing primitive shapes is not by itself a rigged beast. The common app loader expects a USDZ with a genuinely deforming skeleton. Prefer `.blend` or direct USD authoring for new iPhone-first creatures. Use the web route when there is an existing rig worth preserving.

## Asset contract

- Stable lowercase kebab-case ID; never rename a saved ID.
- One USDZ per creature, at most **2,000,000 bytes**, with one looping, in-place idle clip. Use `GentleIdle` as its exported name. `clip` in the config records the source action's exact name.
- A real skeleton, bind/rest transforms, skin indices/weights, and baked joint animation. Exporting a static mesh, embedding a rig without time samples, or merely rotating the whole model is not sufficient.
- Final USD stage: **Y up, meters, faces +Z**, centered on X/Z with feet on Y=0; aim for a 0.32 m longest dimension. Blender authoring/import space is Z-up, facing -Y; the converter normalizes size and exports Y-up.
- Keep meshes around 12,000 triangles total by default, with small textures (converter caps USDZ texture sizes at 512 px). Avoid runtime cloth, physics, drivers or IK dependencies: bake the final joint poses.
- Provide a transparent 512×512 PNG thumbnail. The GLB/.blend route renders it; direct USDZ packaging requires a supplied PNG.
- Preserve original materials unless a redesign is requested. List exact mesh names in `tintableParts` only when recoloring the entire mesh is sensible; leave eyes/mouth details out of those meshes. Empty lists are supported. The three flower creatures preserve their authored colors.
- Record creator, source URL, source revision, modifications and usage in `provenance`. For CC-BY inputs also supply full `attribution` (original author/title/profile/source/license links and changes). Do not invent a license or call a character adaptation original.
- Motion is visible in the picker, large preview, chest reveal and collection detail. Reuse `TreasureModelView`, `TreasureEntities` and `IdleMotionPlayer`. Respect the parent's Less motion and iOS Reduce Motion settings; avoid animated views for offscreen tiles.

## Config and build

From the repository root, with Blender 4.5 available:

```sh
cd ios/Assets/tools
npm ci
node export-flower-beasts.mjs  # only to reproduce the existing three procedural creatures
```

Then from the repository root:

```sh
/path/to/Blender --background --factory-startup \
  --python ios/Assets/tools/convert-rigged-beasts.py -- your-beast-id
```

Omit the ID to rebuild every configured creature. `--config /absolute/path/jobs.json` selects another job file; source paths are relative to that file. The old CC-BY toy adaptations still have their separate `import-beasts.py` recipe; don't rebuild those incidentally.

Example job in the config's `beasts` array:

```json
{
  "id": "moss-muncher",
  "displayName": "Moss Muncher",
  "source": "../Sources/MossMuncher/moss-muncher.blend",
  "clip": "Idle",
  "file": "Models/MossMuncher.usdz",
  "thumbnail": "Thumbnails/moss-muncher.png",
  "description": "A mossy friend practicing a little dance.",
  "defaultColor": "#56702B",
  "speed": 1,
  "triangleBudget": 12000,
  "tintableParts": [],
  "provenance": {
    "title": "Moss Muncher",
    "creator": "Actual creator",
    "source": "https://github.com/JoshuaBroggi/tatchamashay",
    "usage": "Record actual ownership, permission or license here.",
    "changes": "Describe the real adaptations here."
  }
}
```

For direct USDZ replace `source` with the native USDZ path and add `thumbnailSource` (PNG path) and `heightMeters`. The tool checks the native stage's skeleton/animation, units and size, copies the files and adds the same catalog entry. It does not re-export the native animation. Your source must already meet the framing, skin binding and looping requirements.

The generic converter refuses missing rigs/actions, missing skin weights/bind/rest transforms, missing or unchanging joint animation samples, multiple clips, wrong USD units/axis, or oversized files. It writes model entries **additively**, preserving existing IDs and sounds. This static conversion inspection does not prove RealityKit playback on a phone.

## App registration

1. Add the `BuiltInModel` enum case and its display name, spoken name, SF Symbol and default color in `Sources/Models/Records.swift`. Keep the display name identical to the generated manifest.
2. Build/package with the config above. `Models/`, `Thumbnails/` and `manifest.json` are already bundled; `Sources/` and tooling are not.
3. Keep provenance/attribution in the manifest. Credits render those records directly; do not maintain another handwritten list in the view.
4. The picker discovers the enum case; skeletal entries use live `TreasureModelView` tiles. `Get ready` calls the same loader and requires an available animation for skeletal entries. Keep those shared paths generic.
5. Keep old saves loading. Adding a creature must not change GPS rules, parent-confirmed placement, collection uniqueness or the saved copies of existing treasures.

## Build, delivery and evidence

Joshua's current instruction is **do not run tests**. Do not invoke `scripts/build.sh test`, walkthroughs or local UI tests. Compilation and requested device installation are allowed. Use `cd ios && mkdir -p build && scripts/build.sh build`; `ios/scripts/device.sh` builds, installs and attempts to open the app on the paired iPhone. A locked phone can accept installation but refuse launch. Report that accurately; do not clear family data.

Add meaningful catalog coverage for new metadata/contracts where necessary, but leave execution to the existing GitHub checks unless Joshua changes the instruction. Report conversion output, file sizes, build result, device installation/launch result and anything you did not observe. A Blender render is not a simulator screenshot. An available animation is not proof of visible motion. Do not claim playback was verified without observing it.

Open a PR with source records, renders and these limits. Future beast work starts only when Joshua initiates it; this document does not authorize creating extra creatures now.

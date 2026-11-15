# Restored Vine Dog

The six-legged Vine Dog is restored from the iPhone asset in commit
`dd6eb4b` (1,675,111 bytes), originally generated from the family’s procedural rig at
`2b397b3cad58d17722b5bd907433863b4881c9df`. Joshua explicitly requested this creature for the
private family iPhone app. This records the requested use, not ownership or a CC-BY license for
the character design. The full provenance is retained in `manifest.json`.

`Sources/FlowerBeasts/vine-dog.glb` retains the skeleton, skin weights, vertex colors and Idle clip.
`Models/VineDog.usdz` contains one GentleIdle clip, 58 bones, six legs, and the original closed
snout and vine details. Wrinkle maps were omitted and mesh detail reduced for iPhone. The shared
loader applies the saved color to its single body area, Material_0, and plays the skeletal idle unless motion is reduced.
Saved `vine-dog` IDs, names, colors, sounds, placements and collection snapshots are unchanged.

Rebuild with Blender 4.5 or newer, from the repository root:

```sh
/path/to/Blender --background --factory-startup --python ios/Assets/tools/convert-rigged-beasts.py -- vine-dog
```

The converter validates the skeleton, skin bindings, changing idle, tint material and 2 MB budget,
then updates the manifest while preserving other entries. The procedural build also preserves this
entry. Models, thumbnails and the manifest are bundled locally; no network download is needed.

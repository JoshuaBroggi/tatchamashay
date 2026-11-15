# Character movement on the optional map

The Map settings switch **Show 3D** enables character exploration. It starts off. **Use 2D map**
keeps the character on a flat map. Existing treasure and collection behavior remains the default.

The active character is loaded through `TreasureEntities` from a collection's immutable saved look.
The map has one small RealityKit viewport; it does not load a second catalog or fetch models.
Existing procedural moving parts provide flapping and paddling. Other treasures float when moving.
Optional `locomotion` metadata adds a gait without changing collection-preview idle animations:

- `parts` names articulated entities, with a rotation `axis`, amplitude in `degrees`, and `phase` in
  radians.
- `joints` names skeletal joints by their final path component, with the same rotation fields.
  Walking uses the saved resting transforms, stops the idle controller, and restores the transforms
  when stopping or turning motion off.

Vine Dog uses its six existing shoulder and hip joints. Demogorgon uses its two hip joints and
opposing upper arms. Both are the family's earlier procedural rigs, not downloaded replacement
models. Demogorgon's USDZ, source GLB and thumbnail are restored from commit
`ce65d11` on the earlier iPhone restoration branch; its manifest records the original procedural
source commit `2b397b3cad58d17722b5bd907433863b4881c9df` and Joshua's requested private family use.
This provenance does not claim ownership of the character design or a third-party asset license.
Vine Dog retains the asset and provenance described in [VINE_DOG.md](VINE_DOG.md).

The models retain their original skin weights and GentleIdle animation. The map supplies a small
procedural gait using the existing skeleton; no animation is baked into, or removed from, the
collection's model. `rigged-beasts.json` retains the locomotion fields during conversion. Both USDZ
files remain below 2 MB. Models, thumbnails, sounds and saved selections work locally.

# Flower creatures

Demogorgon, Demodog, and Vine Dog are restored from the iPhone assets in commit
`29e0cc0363fefaf334f78cbdb51360d42aa2d98f`, originally generated from the family's procedural rigs
at `2b397b3cad58d17722b5bd907433863b4881c9df`. Joshua explicitly requested these characters for the
private family iPhone app on 15 November 2026. This records the requested use, not ownership or a
CC-BY license for the character designs. Each manifest entry retains the full source and changes.

The GLBs here retain the source skeleton, weights, vertex colors and Idle clip. The shipped USDZs
retain one GentleIdle clip and stay below 2 MB each. Original browser wrinkle maps were omitted and
mesh detail was reduced for the phone. The existing Material_0 body material supports the app's
selected color and finish, including the Color & texture editor.

To rebuild with Blender 4.5 or newer, run from the repository root:

```sh
/path/to/Blender --background --factory-startup --python ios/Assets/tools/convert-rigged-beasts.py -- demogorgon demodog vine-dog
```

The converter reads `ios/Assets/tools/rigged-beasts.json`, validates skeletons, skin bindings, a
changing idle clip and the named tint material, and updates the existing manifest without removing
other models or sounds. Follow the current root and iOS AGENTS.md for testing and phone delivery.

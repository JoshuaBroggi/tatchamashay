# Tatchamashay 2.0 assets

The treasure chest, the built-in treasures and the sound effects for the iPhone app. Everything here is made from scratch by the scripts in `tools/`: no downloaded models, textures or samples, and nothing from the 1.x game's `public/models/`. The designs are original and avoid film, game and brand characters.

| Folder | What's in it |
|---|---|
| `Models/` | One USDZ per model: the chest and 9 treasures |
| `Thumbnails/` | Renders of every model (see [Thumbnails](#thumbnails)) |
| `Sounds/` | Short AAC sounds (`.m4a`): four effects and eight treasure sounds |
| `manifest.json` | One entry per model and per sound. The app reads this instead of hard-coding file or part names |
| `tools/` | The generators. Re-run them after changing a model |

## The treasures

| id | Name | Idle motion | Tintable parts |
|---|---|---|---|
| `octopus` | Wobbles the Octopus | wiggle | Head, Arms |
| `clam` | Glow Shell | bob | ShellBottom, ShellTop |
| `parrot` | Captain Squawk | flap | Body, Head, Tail, wing feathers |
| `crown` | Sparkle Crown | spin | Band, Points, Rim |
| `star-compass` | Star Compass | spin | Star |
| `potion` | Giggle Potion | bob | Liquid |
| `dragon-egg` | Dragon Egg | wiggle (egg only) | Shell |
| `turtle` | Tumble the Sea Turtle | flap | Shell |
| `doubloon` | Lucky Doubloon | spin | Face, Rim, Stamp |

Each treasure is 0.13–0.35 m tall and stands on y = 0, facing +Z. Files are 80–400 KB, the chest is about 690 KB.

## manifest.json

```jsonc
{
  "version": 1,
  "models": [ /* one entry per model, below */ ],
  "sounds": [ { "id": "dig", "file": "Sounds/dig.m4a", "use": "Each tap of Dig!" } ]
}
```

Model fields:

| Field | Meaning |
|---|---|
| `id` | Stable identifier. Save this with a treasure, never the display name |
| `displayName` | Name shown to the child before they rename it |
| `kind` | `"chest"` or `"treasure"` |
| `file` | USDZ path, relative to this folder |
| `thumbnail` | PNG path, relative to this folder |
| `description` | One friendly sentence for the reveal screen (treasures only) |
| `heightMeters` | Height at scale 1, for framing the camera and placing the model in the chest |
| `tintMaterial` | Name of the recolorable material (`"Tint"`). Absent on the chest |
| `tintableParts` | Names of the meshes that use the tint material. Find each with `entity.findEntity(named:)` and set its material's base color to the child's color |
| `defaultColor` | The tint color before the child picks one, as `#RRGGBB` (sRGB) |
| `idleMotion` | `spin`, `bob`, `wiggle`, `flap` or `none`. USDZ carries no animation from these tools, so the app plays the motion in code |
| `idleMotionPart` | Optional. Apply `idleMotion` to this part only (the dragon egg wiggles while its nest stays still). Absent means the whole model |
| `movingParts` | Parts with their own pivot, each `{ part, motion, axis, ... }`. `motion: "flap"` gives `degrees`, the swing either side of rest; `motion: "hinge"` gives `openDegrees`, the angle that opens it. `axis` is in the part's parent space |
| `namedParts` | Chest only: `lid`, `base`, `innerGlow` and `runes` part names |

Suggested motions: **spin** a slow turn about Y (one turn every 4–6 s); **bob** up and down about 2 cm every 2 s; **wiggle** a rock of ±8° about Z; **flap** swing each `movingParts` entry by its `degrees`, about 3 times a second, with a gentle bob for the whole model.

### Tinting

The tint material is near-white (`#EDEDED`), so either approach shows the chosen color accurately:

- replace the base color of the material on each `tintableParts` mesh, or
- multiply it (`PhysicallyBasedMaterial.baseColor.tint`).

Other parts (eyes, gems, beaks, glass) keep their own fixed colors.

### The chest

`Chest.usdz` is 0.6 m wide and 0.49 m tall, with this structure:

```
Chest
├── Base        body (hollow, so a treasure can rise out), iron, lock plate, Runes, InnerFloor, InnerGlow
└── Lid         pivot on the back hinge
    └── LidParts  LidWood, LidUnderside, LidIron, LidRunes, Hasp
```

To open it, rotate `Lid` about its X axis from 0° to `openDegrees` (−110°). `InnerGlow` is a warm emissive plane inside the body. It is hidden while the lid is shut, so the app can leave it or turn it off. `Runes` and `LidRunes` are emissive cyan, so the app can pulse their opacity during the reveal.

The Glow Shell has a hinge too: `Top` opens further with `openDegrees` (−60°).

## Rebuilding

Needs macOS (it uses Apple's `usdcat`, `usdzip`, `usdchecker` and `usdrecord`) and Node 20 or later.

```bash
cd ios/Assets/tools
npm install
npm run build             # every model, thumbnail and manifest entry
node build.mjs parrot     # just one model
npm run sounds            # the sound effects and treasure sounds
```

Each model is a small JavaScript file in `tools/models/`. It builds the model from three.js shapes, with named groups and meshes, and a table of materials. `lib/usd.mjs` writes it out as USD, keeping the groups (so the lid and wings keep their pivots) and the names. three.js's own `USDZExporter` was not used, because it flattens the hierarchy and renames every part. The chest's wood and iron textures are drawn pixel by pixel in `lib/textures.mjs`, after the look of the design mockup's `render/chest.html`.

The build checks every file with `usdchecker --arkit` and fails if a treasure is over 1.5 MB or the chest is over 2 MB. To add a treasure, copy a file in `tools/models/`, add its id to `ORDER` in `build.mjs`, and run the build. Name any part the child can recolor with the `Tint` material.

## Thumbnails

These are rendered with `usdrecord` from the packed USDZ files. Quick Look (`qlmanage -t`) does not produce USDZ thumbnails when run from a script.

- `<id>.png`: the shipped file as it is, with the tint parts in neutral white.
- `<id>-default-color.png`: the same model painted in its `defaultColor`, as the child first sees it.
- `chest-open.png`, `clam-open.png`: the hinged part swung to `openDegrees`.

The renderer has no reflections, so metal looks darker here than it will in the app.

## Sounds

| File | Plays when |
|---|---|
| `dig.m4a` | Each tap of Dig! (three spade scoops, 1.3 s) |
| `chest_creak.m4a` | The chest lid opening (1.5 s) |
| `reveal_sparkle.m4a` | The treasure rising out of the chest (1.6 s) |
| `finale_fanfare.m4a` | The last treasure of an adventure is found (2.4 s) |

Each treasure also has its own sound, which the child picks when inventing one. The file name is the
`TreasureSound` id the app stores in a treasure's look.

| File | Sounds like |
|---|---|
| `boing.m4a` | A wobbly spring (0.9 s) |
| `toot.m4a` | Two short horn toots (0.9 s) |
| `giggle.m4a` | Bouncy "hee hee hee" chirps (1.0 s) |
| `splash.m4a` | A splash with droplets (1.1 s) |
| `ding.m4a` | One clear bell (1.4 s) |
| `snore.m4a` | A rumbly snore and a whistle (1.5 s) |
| `chime.m4a` | Three soft rising bells (1.3 s) |
| `fanfare.m4a` | A tiny "ta-daa!" (1.1 s) |

They are synthesized by `tools/sounds.mjs` (mono, 44.1 kHz, AAC 96 kbps). They are placeholders until someone listens to them on a phone.

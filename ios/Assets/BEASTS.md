# Rigged treasure companions

The current iPhone catalog includes the restored Demogorgon, Demodog and Vine Dog and the
family-requested Mulligan. Their provenance is read from the manifest in Parents → Settings →
Treasure makers & credits. See [FlowerBeasts source notes](Sources/FlowerBeasts/README.md) for
the restored rigs and [RIGGED_BEAST_WORKFLOW.md](RIGGED_BEAST_WORKFLOW.md) for the shared pipeline.
The procedural Silky the Spider keeps its current model and saved appearances.

## Mulligan — family-requested iPhone-first beast

Joshua requested **Mulligan** on 15 November 2026 from five supplied views of the same toy, with
standard looping idle motions. The new Blender source follows its olive hunch, long forelimbs,
pink snout/lower limbs, yellow teeth and claws, and black branching back/rump ridges. It is a
character adaptation for the private family build, not a claim of original character or photo
rights, and is not labeled CC-BY. Manifest provenance feeds the existing in-app credits.

`mulligan` adds one 1,101,448-byte USDZ, a transparent 512 × 512 thumbnail and a 30-joint skin. Its
single six-second `GentleIdle` combines breathing, head turns, jaw movement, planted-foot weight
shifts and toe flex. The converter records 21,598 triangles, 145 joint samples and 29 changing
joints with a stationary Root. Authored colors are retained. The enum/manifest additions reuse
the shared parent preview, chest/detail animation player, Less motion and automatic asset checks.
The detailed revision rebuilds the skull as a narrow wedge and the lower jaw as thin rails
meeting at a pointed chin. It adds 88 fine teeth, violet mouth lining/folds, a curved red tongue,
nostril recesses, finer facial branches, 19 woven chest-cord layers, 20 shoulder nodules and
forearm creases. The open jaw eases between 39 and 49 degrees in the idle. The same skeleton
and shared playback path are retained; limb baking preserves bind roll so the markings and paws
face correctly. The richer geometry uses a 22,000-triangle budget and stays below 2 MB.

The [complete source and art renders](Sources/Mulligan/README.md) include the deterministic
authoring script, `.blend`, source/reference records, export metadata and idle preview. Simulator
and signed iPhone builds succeeded. No local tests or app walkthroughs ran. No app installation,
launch or observed RealityKit playback is claimed for this change.

## Excluded

| Source | Why it is not bundled |
|---|---|
| `snake_attack_animations_multiple.glb` — Imagigoo | Its single combined `Animation` is not separated into a clearly safe idle. Leave out the attack presentation. |
| `cartoon_flesh-eating_plant_with_animations.glb` — Jungle Jim | Only `Armature\|Attack1` and `Armature\|Roar`; biting mouth is a poor fit for this first companion set. |
| `war_dinosaur_-_rigged.glb` — Lezalit | No animation clips despite its rigged name; combat presentation. |
| `banana_tree.glb` — DJMiddi | No animation clips; scenery rather than a creature. |
| `jungle_tree.glb` — kobaltsecond6c7d6150917a4267 | No animation clips; scenery rather than a creature. Author name above is the exact embedded value. |
| `deathvader*`, `distortus_rex`, `jurassic_world_mosasaurus`, `rigged_mosasaurus_lego`, `scorpion/` FBX | Explicitly prohibited. No imports or derivatives. |
| `fluffy unicorn.glb`, `super lobster.glb` | On hold pending Joshua's confirmation of Tripo commercial terms. |

Original sources remain recoverable from `v1-web-final` if the web directory moves or is retired.

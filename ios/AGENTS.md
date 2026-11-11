# Tatchamashay 2.0 — iOS app

SwiftUI iPhone app (iOS 18+, MapKit, RealityKit): a private, parent-run pirate treasure hunt.
`PLAN.md` is the product plan; its "Product rules" win over the design mockups. The repo root
`AGENTS.md` is about the old 1.x web game, not this app.

## Build, test, run

Built with Xcode 27 and `xcodegen` (`brew install xcodegen`). The `.xcodeproj` is generated from
`project.yml` and is not committed.

```bash
cd ios
scripts/build.sh build              # generate the project and build for the simulator
scripts/build.sh test               # unit tests and the end-to-end walkthrough
scripts/walkthrough.sh <sim-udid>   # all tests on one simulator, plus screenshots
open Tatchamashay.xcodeproj         # after any build.sh run
```

Warnings are errors (`SWIFT_TREAT_WARNINGS_AS_ERRORS`). Swift 6 language mode.

`scripts/walkthrough.sh` puts the simulator at the walkthrough's spot with
`xcrun simctl location <udid> set 37.7694,-122.4862`, runs every test, and saves screenshots
(full size in `build/screenshots`, small JPEGs in `docs/screenshots`). The walkthrough UI test
(`UITests/FamilySliceUITests.swift`) is milestone 1's definition of done: set up, hide a treasure
on a reviewed spot, walk up, double-tap Dig!, open the chest, restart, check the chest, replay.

To try it by hand: boot a simulator, set its location as above, install
`build/Build/Products/Debug-iphonesimulator/Tatchamashay.app`, and grant location with
`xcrun simctl privacy <udid> grant location com.tatchamashay.app`. Launch with `-resetFamily`
(debug builds only) to start from an empty family.

## Layout

| Folder | What lives there |
|---|---|
| `Sources/Models/Records.swift` | The plan's data and access model as types: `ParentAccount`, `ChildProfile`, `TreasureDesign`/`TreasureVersion`, `ChestPlacement`, `Adventure`, `CollectionRecord`, `PublicationState`, `SyncState`, `HuntRun` |
| `Sources/Rules/FindRules.swift` | GPS rules: freshness, accuracy, Dig! radius with hysteresis, warm/cold |
| `Sources/Services/FamilyStore.swift` | `FamilyStore` protocol, the shared record rules (`FamilyData` extension), and the on-device `LocalFamilyStore` |
| `Sources/Services/FamilyModel.swift` | Observable app state over a store; Demo mode's separate in-memory family |
| `Sources/Rules/AdventureRules.swift` | 3–5 treasures per adventure, `HuntProgress` (next treasure, finale) |
| `Sources/Services/TreasureCatalog.swift` | `Assets/manifest.json` as types: treasures, chest, sounds |
| `Sources/Services/TreasureEntities.swift` | Loads USDZ models, tints them, plays idle motions; the chest with its lid |
| `Sources/Services/StoryLibrary.swift` | `Content/Stories/` front matter as types; placeholder filling |
| `Sources/Services/GuideVoice.swift`, `SoundEffects.swift`, `PlaySettings.swift` | Spoken guide, sound effects, and the grown-up's sound/voice/motion switches |
| `Sources/Views/Hunt`, `Chest`, `Parent`, `Shared` | Screens, by milestone-2 track |
| `Assets/` | Built-in models, thumbnails and sounds (bundled: `manifest.json`, `Models/`, `Sounds/`, `Thumbnails/`) |
| `Content/Stories/` | Guide, starter adventures, hide flow (bundled as `Stories/`) |
| `Tests/` | Unit tests (Swift Testing) |
| `UITests/` | The end-to-end walkthrough |

The one third-party dependency is [Yams](https://github.com/jpsim/Yams) (MIT, via Swift Package
Manager in `project.yml`), for the stories' YAML.

## Milestone 2 ownership

Five tracks build milestone 2 in parallel. Each owns its folders; nobody edits another track's
folders. Shared files change only additively (new types, cases, optional fields, methods), each
change with tests, so another track's code keeps compiling.

| Track | Owns |
|---|---|
| A. Parent setup | `Views/Parent/`, offline **Get ready** |
| B. The hunt | `Views/Hunt/`, `LocationService` |
| C. Guide and story | `Views/Guide/`, how `StoryLibrary` and `GuideVoice` are used in screens |
| D. Chest and reveal | `Views/Chest/` |
| E. Child creation | `Views/Create/` |
| Shared (additive only, with tests) | `Records.swift`, `FamilyStore`, `FamilyModel`, `Theme`, `AdventureRules`, `TreasureCatalog`, `TreasureEntities`, `TreasureModelView`, `StoryLibrary`, `GuideVoice`, `SoundEffects`, `PlaySettings` |

Shared pieces to use instead of writing your own:

- **Models:** `TreasureCatalog.bundled` (entries, thumbnails, sound files), `TreasureModelView(look:)`
  for a treasure on screen, `TreasureEntities.treasure(_:)` / `.chest()` for your own RealityKit
  scene. `ChestEntity` has `lid`, `innerGlow`, `runes`, `setLidOpen(_:)` and `setRuneGlow(_:)`.
- **Stories:** `StoryLibrary.bundled` → `GuideStory`, `AdventureStory`, `HideFlowStory`. Fill lines
  with `StoryContext` (`guide.lines(for: .greeting, context:)`); lines it can't fill are dropped.
- **Sound and voice:** `AppModel.sounds.play(.dig)`, `AppModel.voice.speak(lines, as: guide)`. Both
  check `PlaySettings`; tests use `SilentSoundEffects` and `SilentGuideVoice`.
- **Motion:** read `PlaySettings.reducesMotion(system:)` with SwiftUI's `accessibilityReduceMotion`
  before any big animation. `PlaySettings` is in the environment.
- **Adventures:** `Adventure.readiness`, `Adventure.isFull`, `FamilyModel.progress` (`HuntProgress`:
  `next`, `nextNumber`, `step(afterFinding:)` → `.next` or `.finale`). A starter adventure sets
  `Adventure.storyID`/`guideID` and `ChestPlacement.storyTreasureID`.
- **Chest reveal:** `ChestOpeningView(look:foundAgain:hiddenBy:onDone:)` plays the reveal for a find
  that is already saved; `onDone` runs once, when the child taps **Into my chest**. While it is on
  screen `AppModel.isRevealing` is true: the guide waits for it to turn false before speaking (it is
  set on appear and cleared on close). The reveal becomes skippable once a whole one has been seen
  on this phone (`RevealMemory`, cleared by `-resetFamily`).
- UI tests launch with `-silent` so nothing speaks.

## Rules that the code enforces

- One collection record per child per placement. `recordFind` is safe to repeat: the same hunt
  run never adds twice; a replay run adds a "found it again" sticker. A failed save changes nothing,
  so a retry behaves like the first try.
- A collection stores a saved copy (`TreasureLook`) of the version found. The chest only reads
  saved copies; editing a design adds a version and deleting it never touches chests.
- An adventure holds at most 5 treasures, each once, in play order; 3 makes it ready. The hunt
  looks for the first one not yet found this run, and the last find leads to the finale.
- Built-in treasure ids are the manifest's. Looks saved with milestone 1 ids (`gem`, `orb`) load as
  the nearest new treasure; never rename an id.
- Placements must belong to the family and carry a review time that isn't in the future. Only the
  parent's hide flow creates them, after zooming in to a detailed map and confirming the spot.
- GPS: fixes older than 10 s or worse than 30 m are ignored. Dig! appears within 40 m and hides
  only after 4 s beyond 60 m. With no trusted fix the map says it's foggy and points to We found it.
- Demo mode uses its own in-memory family and is the only place with automatic placement and the
  "Sail here" button.

## The backend seam (milestone 3)

Replace `LocalFamilyStore` with another `FamilyStore`. Keep the rules in the `FamilyData`
extension (or enforce the same ones on the server), including the unique (child, placement) key.
Every record carries `syncState`; local records stay `waitingToSync` until a server exists.

## Simulator note

The simulator stops sending location updates while the location doesn't change, so after about
10 seconds standing still the hunt turns foggy. A real phone keeps reporting. Nudge the location
(`xcrun simctl location <udid> set …`) to get a fresh fix.

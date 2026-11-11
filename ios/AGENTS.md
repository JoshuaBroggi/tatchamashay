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
| `Sources/Views/Hunt`, `Chest`, `Parent`, `Shared` | Screens, by milestone-2 track |
| `Tests/` | Unit tests (Swift Testing) |
| `UITests/` | The end-to-end walkthrough |

Sibling work owns `Content/Stories/` (story content) and `Assets/` (3D models). Add them to
`project.yml` as resources when they land.

## Rules that the code enforces

- One collection record per child per placement. `recordFind` is safe to repeat: the same hunt
  run never adds twice; a replay run adds a "found it again" sticker. A failed save changes nothing,
  so a retry behaves like the first try.
- A collection stores a saved copy (`TreasureLook`) of the version found. The chest only reads
  saved copies; editing a design adds a version and deleting it never touches chests.
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

# Tatchamashay 2.0 — iOS app

## Automatic phone delivery

Follow the root `AGENTS.md` automatic-delivery rule: after the initial required testing, automatically
commit, push, and merge each completed update, then immediately install and launch app changes on
Joshua's connected physical iPhone. Push, merge, and phone deployment have standing user approval.
Test in the live installed app without adding approval, staging, or pre-release device-QA gates.
Preserve the phone's saved family and collections; never launch with reset or test-fixture arguments.


SwiftUI iPhone app (iOS 18+, MapKit, RealityKit): a private family treasure map. Read `PLAN.md` for
current product rules. This is the sole supported game; `archive/browser/` is retired reference
source. The app has no live multiplayer backend.

## Product invariants

- The child is always the player. Map and My Chest are the only child tabs.
- Parents create/edit/place beasts behind the Parents gate. No role switching or child creation flow.
- All valid, saved, unfound placements across all legacy adventure groups appear on the map. Collection
  order is unrestricted. Target selection must reset GPS tracking without hiding other markers.
- A collection is unique for (child, placement) for its lifetime. Save before celebration. Failed
  writes change nothing. Old run IDs/stickers remain decodable, but new play does not replay hunts.
- Collected appearances are immutable saved copies. Editing/removing designs or placements must never
  change the chest. Preserve stable IDs and legacy decoding, including unused story fields.
- Only parents confirm real locations on a detailed map; validate family ownership, coordinates and
  review timestamps in the store. Automatic placement belongs only in isolated Demo mode.
- GPS uses freshness/accuracy checks and hysteresis. Keep the parent's We found it fallback.
- There are no stories, narrative openings/finales, ordered hunts, minimum-three or maximum-five
  restrictions, or manual Get ready flow. Asset checks are automatic and do not require a network.

## Build and test

Xcode 27, Swift 6 and `xcodegen` (`brew install xcodegen`). Warnings are errors. The generated
`.xcodeproj` and build outputs are not committed. There are no third-party Swift packages.

```bash
cd ios
scripts/build.sh build
scripts/build.sh test
# For one simulator, pass its UUID as the second argument.
```

UI tests launch with `-silent`, `-resetFamily`, or `-huntFixture` (debug-only). `-huntFixture` installs
reviewed treasures in Golden Gate Park. Grant location on a new simulator:

```bash
xcrun simctl privacy <udid> grant location com.tatchamashay.app
xcrun simctl location <udid> set 37.7694,-122.4862
```

The simulator stops reporting unchanged location after about ten seconds; nudge the location for a
fresh fix. Check reveals and location behavior on a real phone before shipping.

## Layout

- `Sources/App/TatchamashayApp.swift`: child tabs, parent gate, real/demo separation.
- `Sources/Services/FamilyModel.swift`: map eligibility, selected child, parent writes and collection.
- `Sources/Services/FamilyStore.swift`: validated, atomic mutations and local JSON persistence.
- `Sources/Models/Records.swift`: current records plus legacy adventure/story fields for decoding.
- `Sources/Rules/FindRules.swift`, `SetupRules.swift`: GPS and detailed-map review rules.
- `Sources/Views/Hunt/`: all-unfound map, target selection and reveal presentation.
- `Sources/Views/Parent/`: single beast editor, spot review and parent settings.
- `Sources/Views/Chest/`: saved collection, reveal and interactive 3D detail.
- `Sources/Services/AssetReadiness.swift`: automatic bundled model/sound checks.
- `Assets/`: original bundled models, thumbnails and sounds; `Assets/README.md` covers regeneration.
- `Tests/`, `UITests/`: rules/persistence tests and simulator journey tests.

Use `TreasureModelView`, `TreasureEntities`, `TreasureCatalog`, `SoundEffects` and `PlaySettings` rather
than rebuilding their functionality. Respect reduced motion. Keep animation and asset I/O out of
per-frame game updates. Future sync must enforce the same store rules server-side.

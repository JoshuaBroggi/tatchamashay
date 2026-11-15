# Tatchamashay agent guidance

## Automatic delivery — standing user authorization

For every completed update, run the initial required testing appropriate to the change, commit the
intended files, push, and merge into `main` in the same session. These actions are already authorized;
do not pause for another approval or leave a finished update waiting in an unmerged PR.

For app or content updates, immediately build the signed iPhone app, install it on Joshua's connected
physical iPhone, and launch it. Update the existing app in place, preserving family data and collection
snapshots; do not use reset or test-fixture launch arguments on the phone. Test behavior in the live
installed app. Do not add staging, manual review, release checklists, extra QA gates, or waiting periods
beyond the initial required testing. This delivery rule overrides older instructions to wait for human
review or complete device QA before shipping.

If an actual push, merge, signing, installation, or launch failure prevents completion, resolve it when
possible and report the exact remaining blocker promptly. Never claim delivery without observing it.

The iPhone app is the sole supported game. Start with `ios/AGENTS.md`, then `ios/PLAN.md`.
All gameplay, character, treasure, collection and asset work belongs in `ios/`.

- Build/test with `ios/scripts/build.sh build` and `ios/scripts/build.sh test` from the root.
- Follow the Swift, persistence, parent-control and location rules in `ios/AGENTS.md`.
- Use `ios/Assets/manifest.json`, `ios/Sources/Services/TreasureCatalog.swift` and the shared record
  definitions as the authoritative content contract. New content must be usable and tested on iPhone.
- `archive/browser/` is retired reference source. Its npm build/dev/deploy commands are disabled.
  Do not add browser gameplay, duplicate content definitions, or browser parity work.
- No web admin product exists in this checkout. If requested later, it must administer the same
  canonical content and enforce the same rules. It must not introduce a second game or catalog.
- Preserve existing saved IDs and collection snapshots when porting approved historical content.
- Do not ship archived models without provenance review and integration into the iPhone pipeline.

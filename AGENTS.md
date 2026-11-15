# Tatchamashay agent guidance

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

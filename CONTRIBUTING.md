# Contributing to Tatchamashay

All supported product work targets the iPhone game in `ios/`. Read `ios/AGENTS.md` and `ios/PLAN.md`
before making changes. Use a task branch and a pull request describing the behavior and verification.

Run `ios/scripts/build.sh build` and appropriate tests with `ios/scripts/build.sh test`. Exercise changed
journeys in the simulator; check location, sound, performance and reveals on an iPhone before shipping.

Add characters and treasures through `ios/Assets/` and its manifest, Swift catalog and record types.
Follow `ios/Assets/README.md` for generation and format requirements. Preserve saved content IDs and
collected appearance snapshots. Verify provenance before importing any historical browser assets.

Do not implement features in `archive/browser/` or maintain browser parity. Future admin tools must
operate on the same content contract and validation rules used by the iPhone game.

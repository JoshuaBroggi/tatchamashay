# Procedural source exports

These GLBs are generated source intermediates, not bundled app resources. Reproduce them with `cd ios/Assets/tools && npm ci && node export-flower-beasts.mjs`.

The exporter reads the exact rig and animation modules at commit `2b397b3cad58d17722b5bd907433863b4881c9df` from the retained `claude/demogorgon-rig-animate-6a2474` branch. It never switches any checkout. Browser wrinkle maps are omitted, original per-vertex colors and skin weights remain, and only `Idle` is exported. No Attack/Roar/Walk clips or Web Audio code are included.

Joshua explicitly requested these three adaptations for the private family iPhone build on 15 November 2026. The source history and scope are recorded in `manifest.json` under `provenance`; these are not represented as CC-BY or original character designs. See `../../RIGGED_BEAST_WORKFLOW.md` for the common delivery contract.

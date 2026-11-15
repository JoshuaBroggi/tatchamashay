# Tatchamashay 2.0 — design mockups

Screen mockups for the 2.0 game: a realistic, grown-up-kid treasure hunt. 2.0 shares **nothing** with the 1.x look (no balloons, no cartoon purple and green menus).

Live canvas (owner access): https://claude.ai/artifact/8XQXtfNXXRkZFzJNwSDkKx

## Visual direction

- **Mood:** painterly, sunlit forest ruins with moss, stone and old wood. Reference: [`assets/forest-ruins-reference.webp`](assets/forest-ruins-reference.webp).
- **Colors**
  - Grounds: deep forest `#08110B` / `#0E1A12` / `#15271B` / `#1F3826`
  - Borders: `#2E5236` (quiet) / `#4E7A4A` (strong)
  - Text: `#F8FAEF` (primary) / `#C3D5B6` (secondary) / `#86A07E` (muted)
  - Treasure gold `#D4A24C`: main buttons, scores, legendary items
  - Rune cyan `#7FE3F0`: magic, runes, the air meter, hunt signals
  - Invented-treasure pink `#E9A3C9`: anything a player made themselves
- **Type:** Barlow Condensed 800 (uppercase, letter-spaced) for headlines and buttons; Inter 400/600 for body text.
- **Shapes:** square corners, 1px borders, dark translucent panels (`rgba(8,17,11,0.7)`) over the game scene. No rounded "bubbly" UI.

## Screens (`screens/`)

Each `.dc.html` file is one screen. They are static HTML with inline styles, readable as a spec. Sizes and positions are in `screens/canvas.json`. Images are linked from `assets/`.

| # | File | What it shows |
|---|------|---------------|
| 1 | Main | Title screen over the forest art |
| 2 | CharacterSelect | Pick an explorer role (Scout, Climber, Cartographer, Diver, Engineer, Medic) with stats |
| 3 | LevelSelect | Pick an expedition (Sunken Temple, Tomb of the Salt King, Lost Observatory) |
| 4 | Lobby | Crew of up to 4 with a 4-character room code; the leader starts |
| 5 | HUD | In-game overlay: objective, health/air, treasure score, minimap, crew, tool bar, interact prompt |
| 6 | TreasureFound | Relic-found moment (desktop) |
| 7 | Results | End of expedition: relics recovered, crew scores and awards |
| 8 | MobileHUD | Landscape phone overlay with a thumbstick and action buttons |
| 9 | PirateMap | Parchment treasure map over real streets, with an X, a trail and a clue |
| 10 | RealWorld | Live camera hunt: compass, distance, warm/cold signal, dig button |
| 11 | MagicReveal | Rune circle as the treasure rises |
| 12 | Vault | Collection grid with rarity glows and filters |
| 13 | InventTreasure | A player (example: Emmanuel) invents a treasure and buries it at a real spot |
| 14–17 | Chest1–4 | Chest opening, frame by frame: unearthed → lid cracks → Super Lobster reveal → Death Vader reveal |

The menu screens (1–8) are desktop-first at 1280×720. The real-world loop (9–17) is phone portrait at 390×844.

## Assets (`assets/`)

- `chest-frame-1..4.jpg`: 3D renders of the chest sequence (780×1688). The chest is built procedurally in `render/chest.html`; the characters are the repo's own GLB models.
- `super-lobster.png`, `death-vader.png`: transparent renders of `public/models/super lobster.glb` and `public/models/deathvader-optimized.glb`.

## Re-rendering the chest

```bash
python3 docs/design/2.0/render/server.py   # serves on http://127.0.0.1:8765
```

Open `http://127.0.0.1:8765/chest.html` and call `shoot({...}, 'name.jpg')` in the console. The options are listed in `build()`. Output goes to `render/out/`. The chest (wood and iron textures, runes, lid hinge, light beam, particles and bloom) is plain three.js 0.160, which is already a dependency, so it can be lifted into the game.

## Open questions for the build

- Is 2.0 both an on-screen expedition game (screens 1–8) and an outdoor phone game (9–17), or only the outdoor one?
- Explorer roles, expeditions, relic names and clues are placeholders.

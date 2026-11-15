# Tatchamashay 2.0 — Product plan

## Platform and content authority

The iPhone app is the sole supported game. Browser gameplay and its PartyKit server are retired in
`archive/browser/`. All new characters and features must be integrated and tested in the iPhone app.
The iPhone manifest, catalog and record types define the content contract. Any future web tool is
admin-only and must use that same contract and validation rules; no parallel game is maintained.

## The journey

The child is always the player. A parent prepares beasts and chooses safe locations; the child opens
the map, chooses any unfound treasure, finds it, opens its chest and keeps exploring. Parents may
collaborate with the child while creating a beast, without a separate role or handoff in the app.

## Navigation

- **Map** opens by default and shows every unfound placement across the family's saved hunts.
- **My Chest** shows the selected child's saved collection.
- **Parents** opens a temporary sheet behind a parental gate. It contains beast creation, editing,
  placement, child profiles, sound and motion controls, and the isolated Demo mode. Closing it
  returns to the same child. Unfinished creation stays intact when switching apps.
- Initial setup asks for a parent's name and child's pirate name. Children have no accounts.

There is no child Make tab, parent player, role switch, hide-for-parent handoff, story chooser,
narrative goal, prescribed treasure order or story finale. Pirate styling, chest reveals and sounds
remain. Existing story text is kept in saved records for compatibility but is not displayed.

## Parent creation

1. Open Parents and choose **Create a beast** (or edit an existing design).
2. Pick the model, sparkles, name and sound in one editor with a live preview and defaults. **Color &
   texture** has three short steps: choose one to three paint colors (named swatches, nature-inspired
   palettes or a custom color), drag/tap them onto named parts, then choose a surface finish. The
   preview keeps its pinch zoom and orbit while paint or sparkles change and while switching paint
   steps. Opening the paint controls does not recreate the preview. Selecting a different beast
   starts its default look. Previously saved single-color looks remain unchanged until edited.
3. Review its location on a detailed map, optionally add a practical hint and confirm the spot.
4. Save. The beast and placement save atomically and immediately become available on the map.

One treasure is sufficient. There is no requirement to name or build an adventure, download a story,
complete a readiness checklist or create three treasures. Asset checks run automatically in parent
controls and explain any missing models or sounds; playable fallbacks remain available.

## Product rules

### Optional character exploration

Map settings includes **Show 3D**, initially off. Enabling it adds a tilted street map and the child's
selected discovered character. **Use 2D map** retains character exploration on a flat map. Turning
the mode off restores the regular map and existing chest flow. Treasure selection, placement, GPS
eligibility and collection rules stay the same in either mode.

While enabled, a new find atomically becomes the child's active character. My Chest offers **Be this
character** for any earlier discovery, with a rising-flame transition. Selections are per child and
use collected snapshots. Sound and Reduced Motion controls apply. See
[character movement](Assets/CHARACTER_MOVEMENT.md) for the canonical asset contract.

### Map and collection

- Unfound means a valid saved, nonremoved family placement that the selected child has never collected.
  Include older adventure groups. A new app launch or new placement never resets found status.
- Show all unfound markers. A selected marker determines the current hint, distance and Dig! state;
  selecting it never hides the others. A list also makes overlapping markers individually selectable.
- Allow any collection order. Reset GPS target tracking when the selection changes. A location update
  must not unexpectedly replace the selected target or recenter a map the child is exploring.
- A successful save precedes celebration. A failed save keeps the marker and offers retry. Repeated
  taps, restarts and old run identifiers never add a second collection or new replay stickers.
- After a reveal, return to the map. With no unfound treasure left, show a simple completion state
  with access to My Chest. There is no automatic replay.
- Each collection retains a saved copy of the treasure's appearance. Parent edits/removal never alter
  a collected copy. Old replay stickers remain readable as historical data.
- Child profile selection lives in parent settings. Parents never own a player collection.

### Location and placement

- Only parents place real treasure, in a place they know, after reviewing a detailed map and confirming
  the spot. Real play never generates locations. Demo mode uses separate in-memory records.
- Keep streets, paths, buildings and water visible. Never draw a direct route across obstacles.
- Ignore GPS fixes older than 10 seconds or worse than 30 metres. Dig! appears within 40 metres;
  hysteresis hides it after 4 seconds beyond 60 metres. These are starting values for outdoor testing.
- With poor GPS, show a clear signal message. The parent-confirmed **We found it** fallback works for
  the selected treasure. It never requires reaching an exact coordinate.

### Persistence, privacy and offline play

- Preserve existing child, placement, design, version and collection IDs. Decode old adventure/story
  metadata without requiring any bundled story content. Legacy child-made designs are manageable by
  parents while retaining their provenance.
- Validate family ownership, model versions, coordinates and spot review in store operations.
- Store mutations commit atomically. Failed writes change neither the in-memory state nor saved file.
- Family data stays on the phone for this release. No live multiplayer backend, public child identity,
  continuous location upload, public map or strangers' treasure.
- Models and sounds are bundled; progress saves locally. Apple Maps tiles may be unavailable offline;
  saved spots, hints, collection and the parent's confirmation remain usable.

## Implementation and acceptance

1. Replace newest-adventure/next-treasure routing with all placements, lifetime collection status,
   arbitrary target selection and atomic parent writes.
2. Consolidate creation under parent controls and reduce the child's navigation to Map and My Chest.
3. Remove runtime story services, content bundles and their package dependency. Retain legacy record
   decoding and collection snapshots.
4. Verify unit tests for old saves, multiple adventure groups, any order, repeated taps, save failures,
   profile-specific collections, one treasure and more than five placements.
5. Walk the app in the simulator: parent gate, create and review one beast, all markers, change target,
   Dig!, poor GPS confirmation, reveal, chest, restart, completion and parent editing.
6. Test outdoors with Emmanuel: map readability, GPS tolerance, sound/motion controls, and whether he
   can choose what to do next with little reading.

Future family sync must preserve these ownership and idempotency rules. Public play requires a
separate product decision; it is outside this simplification.

# Tatchamashay 2.0 — Build Plan

## Who it's for first

Five-year-old Emmanuel and a parent, outdoors together. The first release is a **private, parent-run
family adventure**: a pirate map, a short hunt in a safe place, magical reveals, and treasures Emmanuel
invents and hides for his parent. An open public world is a possible later expansion. It is only
considered after the family version is proven fun and the privacy and safety questions in "Later" are
answered.

## The first outing

1. **Setup (parent, before leaving, under 5 minutes):** pick a familiar place, such as a park or the
   backyard. Choose or make a short adventure and place 3–5 treasures on spots the parent has looked at on
   a detailed map. The app saves everything to the phone for offline play.
2. **Start:** a friendly pirate guide greets Emmanuel by his pirate name and gives one clear goal ("Find the
   three lost pieces of Captain Barnacle's compass!").
3. **Explore together:** the map shows streets and paths, plus the next X. The guide gives spoken hints.
   No straight-line arrows that pull a child across roads or obstacles.
4. **Find:** close to the spot, a big **Dig!** button appears and the chest bursts open with an animated
   treasure and a sound. If GPS is acting up, the parent taps **We found it**.
5. **Finale:** the last treasure completes the goal. A celebration ends the hunt at a natural stopping
   point ("Back to the ship!"), and the treasures go into Emmanuel's chest.
6. **His turn:** Emmanuel makes a treasure (object, color, sparkles, funny name, sound, a story the parent
   types) and hides it for the parent. The parent confirms the spot.

Hunt length is a guess until we test it with Emmanuel. Start with 3 treasures and adjust.

## What the first release includes, and what waits

| First release | Later, only if the family version earns it |
|---|---|
| One parent account; local child pirate profiles; play together on one phone | Two-phone family play (milestone 3) |
| Pirate map, guide, 3–5-treasure adventures with a finale | Public map, strangers' treasures, nearby players |
| Built-in treasures customized by color, sparkles, name, sound, story | Importing 3D files, scanning real objects |
| Everyone can collect every treasure; adventures can be replayed | Limited editions, rarity, competition |
| Parent-chosen spots only | Automatic or creator-chosen public spots |
| Works offline once downloaded | Live presence and events |

## Product rules

**Safety and placement**
- Only an adult places a chest, on a spot they have looked at on a detailed map in a place they know. The app never makes up locations for real play.
- The map always keeps enough detail (streets, water, buildings) to see hazards. The pirate look tints the map but never hides that detail.
- No straight-line "go this way" arrows. Hints describe the place ("near the big tree") and the parent guides.
- A reward never depends on reaching an exact point. The parent's **We found it** always works.
- Automatic placement exists only in a clearly labeled **Demo mode** for testing, separate from real adventures.

**Finding a treasure (GPS)**
- 40 m is a starting guess, to tune in testing.
- Use a location only when it is recent (under 10 seconds old) and accurate (better than about 30 m). Show **Dig!** once you're within range. Hide it only after you're clearly out of range (for example, past 60 m for several seconds), so it doesn't flicker as GPS drifts.
- Bad signal gets a friendly message ("The map's a bit foggy here, matey!") and points the parent to **We found it**.
- The phone's reported location is not proof that someone was there. In a private family game that's fine. Don't claim cheat-proofing.

**Collecting and replay**
- Everyone can collect every treasure; nothing runs out or disappears because someone else found it first.
- On one phone, the treasure goes to the child profile playing (the parent can pick "both of us").
- Collecting is safe to repeat. Tapping twice, or retrying after a lost connection, never gives a treasure twice. The database enforces one record per child per treasure.
- A collected treasure keeps a saved copy of what it looked like when found. If the creator later edits or deletes it, the child's chest doesn't change.
- An adventure can be replayed. Replays don't add duplicate treasures to the chest; they can award a "found it again" sticker.
- No rarity in the first release.

**Privacy**
- Children have no accounts, no public names, and no public presence. Child profiles exist inside the parent's account only.
- Location stays on the phone during play. The app doesn't send continuous location or collection events anywhere. In milestone 3, only placements the parent saves and collection records sync to the family's private data.
- Nothing about a child is visible outside the family, ever, in the first release.

**Offline**
- Before leaving, **Get ready** downloads the adventure's placements, models, sounds and guide lines, and checks the map area separately (Apple Maps can't promise offline tiles, so the app warns if the map may be blank).
- Progress saves on every find and survives restarts and lost signal.
- Behind the scenes, each record is "waiting to sync" or "synced". The child only ever sees found treasures, and a find shown as celebrated is never taken back. If the server later rejects or deletes something, the saved copy keeps it in the chest.

## Data and access model

Separate records, each with its own access rule:

| Record | What it is | Who can read / change it |
|---|---|---|
| `ParentAccount` | The adult who owns everything. Sign in with Apple. | The parent only |
| `ChildProfile` | Pirate name, avatar. No email, no login. | The parent's account only |
| `TreasureDesign` + `TreasureVersion` | The object: built-in model, color, sparkles, name, sound, story. Edits create a new version. | The family that made it |
| `ChestPlacement` | Where a version is hidden, plus a hint; links to one adventure | The family only |
| `Adventure` | Guide, goal, ordered placements, finale | The family only |
| `CollectionRecord` | Child, placement, version found, saved copy, time. One per child per placement. | The family only |
| `PublicationState` | Reserved for the later public world; always "private" for now | Not used |

- Every read and write is checked against these rules, including stored files. Knowing an ID or a file link must never expose a private hunt. Files use short-lived signed links.
- The app holds no admin or service keys. The server validates every write.

Sign in with Apple proves who owns an account, not that they're an adult, and it isn't parental consent. The first release avoids the problem by giving accounts only to parents and keeping child data inside the parent's account. Any feature that collects or shares children's data beyond the family needs a consent and age review first (see "Later").

## Reuse from the old game

The old game lives in the same repo, `github.com/joshuabroggi/tatchamashay`. Split it into two folders:
`web/` holds the old browser game, moved as is, and `ios/` holds 2.0.

| Item | Plan |
|---|---|
| Old game code | Not reused; 2.0 is written fresh. |
| License | The repo is GPL today, which conflicts with App Store distribution. Before choosing a license for `ios/`, confirm who owns the rights: commit history shows a single author, but check for code an AI tool or anyone else added, and for third-party code. If you own everything, `ios/` can have its own license. |
| 3D models | No provenance recorded. Not used in the first release. Built-in treasures are made fresh. |
| Apple Developer account | Reused: team, signing, App Store Connect. Confirm there are no existing app records or bundle IDs under the old name. |
| PartyKit | Not used. The family version doesn't need live multiplayer, and running two backends isn't justified. Look again only if the public world happens. |
| Backend | No server in milestones 0–2; everything is on the phone. Milestone 3 adds one backend for the parent account and family sync. Supabase is the leading option; CloudKit's private family sharing is the alternative. Decide before milestone 3. |

## Milestones

### Milestone 0 — Foundation (sequential, blocks everything)
1. Split the repo into `web/` and `ios/`. Confirm `web/` still builds. Settle the license question above.
2. Generate the iOS project from the draft, then build and run it in the simulator.
3. Write the data and access model above as code types, along with the safety, GPS, collection and offline rules. These shape every later step, so they come first.
4. Move automatic scattering into Demo mode only. (Done in the draft: the old automatic scattering is removed.)

**Done when:** the app runs, and the data types and rules are reviewed and merged.

### Milestone 1 — The smallest real slice (sequential, one person)
"A parent places one built-in treasure in a reviewed spot; Emmanuel finds and opens it; it's still in his chest after restarting the app."
- One parent, one child profile, one phone, no server.
- The parent places a chest on a detailed map; Dig! appears at the spot or via **We found it**; the chest-opening reveal plays; the collection is saved and safe to repeat.
- Try it in the backyard or a park.

**Done when:** the slice works outdoors and survives a restart and double taps.

### Milestone 2 — A complete little adventure (parallel tracks)
Start these once milestone 1 works. Each track owns its own screens and connects to the others only through milestone 0's data types.

| Track | Builds | Owns |
|---|---|---|
| **A. Parent setup** | Pick a place, make or choose an adventure, place 3–5 chests with hints, **Get ready** offline download | `Views/Parent/*` |
| **B. The hunt** | Pirate map styling that keeps hazards readable, GPS rules, friendly signal messages, **We found it** | `Views/Hunt/*`, `LocationService` |
| **C. Guide and story** | Pirate guide character, spoken lines, goal, finale, one or two starter adventures | `Views/Guide/*`, story content |
| **D. Chest and reveal** | Chest opening, treasure rise, sounds, haptics, the child's chest screen, replay stickers | `Views/Chest/*` |
| **E. Child creation** | Choose a built-in treasure, then pick color, sparkles, funny name and sound; parent types the story; "Hide it for Mom/Dad" with parent confirming the spot | `Views/Create/*` |
| **F. Art and sound** | 6–10 built-in animated treasures, including one or two characters Emmanuel invents; sound effects; settings to turn sound and motion down | Asset folder |

Tracks C and F can start during milestone 1, since they're content.

**Done when:** a full 3-treasure adventure with a finale plays start to finish, and Emmanuel can hide one for his parent.

### Milestone 3 — Two-phone family play (can start alongside milestone 2)
The backend work depends only on milestone 0's data types, so it can run in parallel with milestone 2.
- Choose the backend (Supabase or CloudKit private sharing).
- Parent account sign-in; invite a second parent's phone into the family.
- Sync adventures, placements and collections, applying the access rules to the database and stored files.
- Safe to repeat: the database's uniqueness rule plus the sync states described under "Offline".

**Done when:** two authorized family phones see the same adventure and collections; an outsider with an ID or link sees nothing.

### Milestone 4 — The family outing test (sequential)
Go on a real outing with Emmanuel. It passes when:
- Emmanuel knows what to do next with almost no reading.
- A parent sets up a short hunt without technical knowledge.
- The first reveal delights him.
- No chest sits on an unreviewed spot.
- Bad GPS or lost signal doesn't spoil the outing.
- Restarting the app keeps his treasures; repeat taps never duplicate them.
- No child's identity or location is visible outside the family.
- The map is readable outdoors in sunlight; sound and motion can be turned down.
- The adventure ends satisfyingly.
- **Most important:** Emmanuel asks to make or play another hunt.

What he actually enjoys decides what comes next: richer treasures, more stories, family sharing, or a public world.

## Later: a public world (not planned yet)
Before any public feature, write down and decide:
- Exactly what data leaves the phone, who sees it, and how long it's kept, with private defaults. Approximate location plus a timestamp can still identify someone.
- Age checks and parental consent for children (for example COPPA in the US).
- A named owner and process for reports, review, removal, edits after approval, and account and data deletion.
- Rules for 3D file imports: validation, texture and memory limits, supported animation, safe previews, fallbacks.
- A check against Apple's current App Review guidelines for user-made content and for apps aimed at kids. Passing review can't be guaranteed, so list concrete requirements.

## Open questions
1. Backend for milestone 3: Supabase or CloudKit private family sharing?
2. License for `ios/`, once rights are confirmed.
3. Who are Emmanuel's pirate guide and first adventure? Best invented with him.

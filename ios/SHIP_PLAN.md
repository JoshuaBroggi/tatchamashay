# Tatchamashay 2.0 — Road to the iPhone

How we get from "works in the simulator" to a production-quality app in the family's hands.
`PLAN.md` says what the game is. This says how it ships.

## Where we are (11 Nov 2026)

| | State |
|---|---|
| The game | Milestones 0–2 are on `main`: parent setup, a 3–5-treasure hunt, the pirate guide, the 3D chest reveal, My Chest, and the child inventing and hiding a treasure. 136 tests pass in the simulator. |
| On a real iPhone | Never run. Signing is switched off in `project.yml` (`CODE_SIGNING_ALLOWED: NO`). |
| This Mac | Ready. It has an Apple Development certificate, team `RAADXJAY3M`, 13 provisioning profiles, and "Joshua's iPhone" (iPhone 17 Pro Max) already paired. |
| Automatic checks | GitHub only checks the old web game (Vercel). Nothing checks the iPhone app, which is why five PRs that each passed broke when combined. |
| The repo | The old 1.x web game still sits at the root, with 230 MB of models, some based on other brands. 13 leftover worktrees and about 30 branches. |
| Pull requests | #8–#12 show as "Closed". They were not canceled: all five were combined, tested together and merged as #13. Still open: #1 design mockups, #4 Demogorgon, #6 web restyle. |

## What "production level" means here

1. Installs on both parents' iPhones without a cable, and updates arrive by themselves (TestFlight).
2. A whole outing works on a real phone: real GPS, sunlight, no signal, a phone call mid-hunt, a restart.
3. A child's treasures are never lost: not by an update, a crash, or a full disk.
4. Every change is tested automatically before it reaches `main`.
5. Nothing in the app or repo that we don't have the rights to ship.
6. One command produces a release.

A public App Store launch is **not** part of this. It is Stage 5, and only if the family test says the game is worth it.

## The stages

```
Stage 0  On Joshua's iPhone by cable ──────────────┐   (hours)
Stage 1  Clean house: repo, checks, PRs ───────────┤   (same day, parallel with 0)
                                                   ▼
Stage 2  Production hardening: six parallel tracks      (the bulk of the work)
                                                   ▼
Stage 3  TestFlight to both parents' phones
                                                   ▼
Stage 4  The family outing test with Emmanuel  →  decide what's next
                                                   ▼
Stage 5  (optional) Public App Store launch, two-phone sync
```

---

## Stage 0 — On the phone today

One session. Stage 1 can run at the same time.

1. In `project.yml`: set `DEVELOPMENT_TEAM: RAADXJAY3M`, automatic signing, and remove `CODE_SIGNING_ALLOWED: NO` for the app target. Keep tests unsigned for the simulator.
2. Build and install on "Joshua's iPhone" with `xcodebuild -allowProvisioningUpdates` and `devicectl`. This registers the bundle ID `com.tatchamashay.app` with the Apple team.
3. Add `scripts/device.sh` so installing is one command.
4. Play the whole loop on the phone and list everything that only fails on a device. Expected suspects: the 3D reveal freezing on replay, the guide's voice, sound with the silent switch on, GPS behaviour indoors.

**Needs from Joshua:** phone unlocked, plugged in or on the same Wi-Fi, Developer Mode on (Settings → Privacy & Security → Developer Mode).

**Done when:** the app opens on the phone and a one-chest hunt can be set up, found and kept.

## Stage 1 — Clean house

Nothing here is sacred; this is the restructure.

1. **Make the repo iPhone-first.**
   - Tag the current state `v1-web-final`, then move the old web game (`App.tsx`, `game/`, `party/`, `public/`, the web config files) into `web/`.
   - Delete the models we can't ship (Death Vader, Distortus Rex, the Jurassic World and LEGO mosasaurs, the unlicensed scorpion source). They stay reachable through the tag.
   - Point Vercel at `web/`, or switch its deploys off.
   - New root `README.md` and `AGENTS.md` describe the iPhone app; the web game's rules move into `web/AGENTS.md`.
   - Give `ios/` its own license file; `web/` stays GPL.
2. **Automatic iPhone checks.** A GitHub Actions workflow on a macOS runner that runs `ios/scripts/build.sh test` on every PR touching `ios/`. Make it a required check on `main`, and require branches to be up to date before merging. That alone would have caught the milestone 2 clashes.
3. **Pull requests.**
   - #1 design mockups: merge, minus `death-vader.png`, `chest-frame-4.jpg` and the forest reference image of unknown source.
   - #4 Demogorgon: close. It is another company's character.
   - #6 web restyle: close, unless the web game has a future. It restyles a game this plan retires.
4. **Tidy.** Remove the 13 finished worktrees and delete merged branches, local and remote.

**Done when:** `main` has `ios/` and `web/`, an iPhone check runs on PRs, and no stale PRs, worktrees or branches remain.

## Stage 2 — Production hardening (six parallel tracks)

Start once Stage 0 has a device build and Stage 1's check is running. Each track owns its own area.

| Track | What it does | Owns |
|---|---|---|
| **A. Real-phone quality** | Fix what Stage 0 found. Sound that respects the silent switch and ducks other audio. Survive a phone call, backgrounding and screen lock mid-hunt. Battery use over a 30-minute hunt. Map and text readable in sunlight. Tune the 40 m dig range from real walks. | `Views/Hunt`, `Views/Chest`, `LocationService`, sound and voice services |
| **B. Never lose a treasure** | Version the saved file and add migrations with tests against old files. Atomic writes and a rolling backup copy; recover from a corrupted file instead of starting empty. Include the data in iCloud device backup. A grown-up "export my family's treasures" option. | `FamilyStore`, persistence |
| **C. App shell** | App icon and launch screen. A grown-up gate in front of the Grown-ups tab (a question a five-year-old can't answer). First-run welcome polish. VoiceOver labels and Dynamic Type. Compile debug-only features (`-resetFamily`, Demo mode's "Sail here", rehearsal) out of release builds. Privacy manifest stating no data is collected. A credits screen. | `App/`, `Views/Shared`, resources |
| **D. Restructure the code** | Move models, rules and storage into a `TatchamashayCore` Swift package whose tests run in seconds without a simulator. Split the largest screens (`InventFlowView` 27 KB, `SetupHuntFlow` 24 KB) into small views. Replace the three look-alike thumbnail views with one. One design-system file for colors, type and buttons. Add screenshot tests for the main screens. | Package layout, shared UI |
| **E. Content with Emmanuel** | A third starter adventure. One or two treasures and a guide line or two that Emmanuel invents. Per-treasure sounds checked on a real speaker. Decide: keep the synthesized captain's voice or record a real one. | `Content/`, `Assets/` |
| **F. Release pipeline** | Build numbers from git. `scripts/release.sh` archives, signs and uploads to TestFlight using an App Store Connect API key. A GitHub Actions job does the same on a version tag. Crash and hang reports through Apple's own tools (Xcode Organizer, MetricKit); no third-party tracking in a children's app. | `scripts/`, workflows |

**Order inside Stage 2:** D changes file locations, so it goes first as one short PR (a day), then A, B, C, E and F run in parallel on the new layout. Every PR must pass the Stage 1 check and merges one at a time, up to date with `main`.

**Done when:** the six tracks are merged, the check is green, and `scripts/release.sh` produces an uploadable build.

## Stage 3 — TestFlight on both parents' phones

1. Create the app record in App Store Connect (name "Tatchamashay", bundle ID `com.tatchamashay.app`).
2. Upload the first build with `scripts/release.sh`.
3. Add both parents as internal testers. Internal testing needs no App Review and installs through the TestFlight app.
4. Fill in the export-compliance answer (no custom encryption) and the privacy label ("Data Not Collected").

**Needs from Joshua:** create an App Store Connect API key (Users and Access → Integrations) and save it on this Mac and as GitHub secrets. The key never goes into chat or the repo.

**Done when:** both phones install Tatchamashay from TestFlight and get the next build automatically.

## Stage 4 — The family outing test

`PLAN.md` milestone 4, on real phones. The pass criteria are listed there; the most important one is whether Emmanuel asks to play or make another hunt. Bring a notes list: every confusion, every tap that didn't work, every moment he lost interest.

**Done when:** one real outing is complete and its notes are turned into the next list of work.

## Stage 5 — Only if Stage 4 says yes

- **Two-phone family play** (`PLAN.md` milestone 3): choose Supabase or CloudKit private sharing, then sign-in and sync.
- **Public App Store release:** age rating and the Kids category rules, a privacy policy and support page, App Store screenshots, a trademark search on the name, and a legal read of the AI-tool terms the ownership check flagged.
- **A public world** stays where `PLAN.md` put it: later, behind explicit privacy and moderation decisions.

## What only Joshua can do

| When | What |
|---|---|
| Stage 0 | Unlock the phone, connect it, turn on Developer Mode. |
| Stage 1 | Say yes or no to retiring the web game (closing #6, moving it to `web/`). |
| Stage 3 | Create the App Store Connect API key and the app record's legal agreements. |
| Stage 4 | The outing with Emmanuel. |

## Risks

| Risk | What we do |
|---|---|
| The 3D reveal freezes on a real phone as it sometimes does in the simulator. | Stage 0 finds out on day one; Track A fixes it before anything else. |
| The name "Tatchamashay" or the bundle ID is taken in App Store Connect. | Check in Stage 0 when the bundle ID registers; pick a fallback before Stage 3. |
| Parallel tracks clash again. | Stage 1's required check plus one-at-a-time merges; Track D lands alone first. |
| Restructuring breaks saved data from earlier builds. | Track B's migration tests run against saved files from the current build. |

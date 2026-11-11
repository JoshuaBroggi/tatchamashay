# Story content

Words for the pirate guide, the starter adventures and the hide-a-treasure flow. Each file starts
with a YAML block between `---` lines that the app reads. The Markdown below it is for people:
character notes, grown-up tips and a read-through.

| File | `kind` | What it is |
|---|---|---|
| `guide.md` | `guide` | Captain Tumblebeard and the shared line bank for every moment of a hunt |
| `adventure-moon-pebbles.md` | `adventure` | The Three Moon Pebbles |
| `adventure-shell-party.md` | `adventure` | Nib's Shell Party |
| `hide-for-parent.md` | `hide_flow` | The child invents a treasure and hides it for the grown-up |

## Placeholders

Lines contain placeholders in braces. The app fills them in before showing or speaking a line.

| Placeholder | Filled with | Example |
|---|---|---|
| `{pirate_name}` | `ChildProfile` pirate name | Emmanuel |
| `{grown_up}` | What the child calls the parent playing, set by the parent | Dad |
| `{blank}` | The words the parent types when placing a chest | big tree |
| `{object}` | Spoken name of the built-in model the child picked | star |
| `{color}` | Spoken name of the color the child picked | blue |
| `{name}` | The treasure's funny name | Snorty Muffin |

A line with a placeholder the app can't fill should be skipped, not spoken with braces.

## Guide (`kind: guide`)

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable id. Adventures point to it with `guide`. |
| `name` | string | Display and spoken name. |
| `sidekick.name`, `sidekick.is` | string | The sidekick, for art and animation. |
| `voice.pace`, `voice.pitch` | string | Notes for a voice actor. |
| `voice.tts_rate` | number 0–1 | Text-to-speech rate, where 0.5 is normal speed. |
| `lines.<moment>.play` | `one` or `all` | `one`: pick one line at random. `all`: play every line in order. |
| `lines.<moment>.say` | list of strings | The lines. |

Moments: `greeting`, `goal_before`, `goal_after`, `hint`, `getting_close`, `dig_ready`, `foggy_gps`,
`we_found_it`, `reveal`, `next_treasure`, `finale`, `your_turn_to_hide`, `goodbye`. `guide.md` has a
table of when each one plays.

## Adventure (`kind: adventure`)

Maps to `Adventure`. Content supplies the story; the parent supplies the places. Each treasure
becomes a `ChestPlacement` once the parent puts it on the map and fills in the hint.

| Field | Type | Maps to | Meaning |
|---|---|---|---|
| `id` | string | template id | Stable id for this starter adventure. |
| `title` | string | `Adventure` title | Shown to the parent. |
| `guide` | string | `Adventure` guide | A guide `id`. |
| `fits` | list | — | Where it works: `backyard`, `small_park`. |
| `minutes` | number | — | Rough play time, to tune in testing. |
| `goal` | string | `Adventure` goal | Spoken between `goal_before` and `goal_after`. |
| `treasures` | list | ordered placements | In play order. 3 per adventure for now. |
| `treasures[].id` | string | `TreasureDesign` id | Stable id for the built-in treasure. |
| `treasures[].order` | number | placement order | 1, 2, 3. |
| `treasures[].name` | string | `TreasureDesign` name | Shown in the chest. |
| `treasures[].looks_like` | string | — | Brief for the art track. Not shown to the child. |
| `treasures[].reveal` | string | — | Spoken after the guide's `reveal` line. |
| `treasures[].hint_template` | string with `{blank}` | `ChestPlacement` hint | The parent completes the blank about the real place. |
| `treasures[].blank_asks` | string | — | Tells the parent what goes in the blank. |
| `treasures[].blank_ideas` | list of strings | — | Example answers to offer as tappable suggestions. |
| `finale` | list of strings | `Adventure` finale | Played in order after the last reveal, then the guide's `finale`. |

## Hide flow (`kind: hide_flow`)

Produces one `TreasureDesign` (first `TreasureVersion`) and one `ChestPlacement`.

| Field | Type | Meaning |
|---|---|---|
| `steps` | list | Screens in order. |
| `steps[].id` | string | Step id. |
| `steps[].who` | `child` or `parent` | Who taps on this step. Parent steps can sit behind a grown-up check. |
| `steps[].say` | list of strings | Guide lines, played in order when the step opens. |
| `steps[].choice` | string | Which `TreasureDesign` field the step sets: `object`, `color`, `sparkles`, `name`, `sound`, `story`. |
| `steps[].options` | list of `{id, say}` | Choices. `id` is stored; `say` is spoken when tapped. |
| `steps[].options_from` | string | `built_in_models`: options come from the art set, not this file. |
| `steps[].name_first`, `name_second` | lists | Word tiles; the name is one from each, joined by a space. |
| `steps[].after` | string | Spoken once the step's choice is made. |
| `steps[].parent_prompt` | string | Shown to the parent on parent steps. |
| `steps[].parent_questions` | list | Questions the parent can ask the child for the story. |
| `steps[].story_max_characters` | number | Story length limit. |
| `steps[].parent_hint_template` | string with `{blank}` | Starting hint for the placement. The parent may rewrite it. |
| `found_by_parent` | list of strings | Played in order when the parent finds the child's treasure. |

`TreasureDesign` fields set by the flow: `object` (a built-in model id), `color`, `sparkles` (`none`,
`some`, `lots`, `rainbow`), `name`, `sound`, `story`.

## Writing rules

- **Short.** 3 to 8 words per line where possible, 12 at most. One idea per line.
- **Spoken first.** Every line must make sense heard aloud by a five-year-old who can't read.
- **Places, not directions.** Hints name something the child can see ("near the big tree"). Never
  "left", "north", "past", "across" or distances.
- **Kind and calm.** No villains, danger, rarity, scores, timers or competition. Praise looking and
  helping, not speed.
- **Original.** No characters, names or phrases from existing brands, films, shows or games.
- **Keep ids stable.** Change words freely; don't rename an `id` once the app uses it.

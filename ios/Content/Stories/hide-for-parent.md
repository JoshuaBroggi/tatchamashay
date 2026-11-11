---
kind: hide_flow
id: hide-for-parent
guide: captain-tumblebeard
steps:
  - id: start
    who: child
    say:
      - "Let's make a treasure, {pirate_name}!"
      - "Then we hide it for {grown_up}."
  - id: object
    who: child
    choice: object
    say:
      - "What is your treasure?"
      - "Tap one!"
    options_from: built_in_models
    after: "Ooh, a {object}! Good choice."
  - id: color
    who: child
    choice: color
    say:
      - "What color is it?"
    options:
      - { id: red, say: "Red!" }
      - { id: orange, say: "Orange!" }
      - { id: yellow, say: "Yellow!" }
      - { id: green, say: "Green!" }
      - { id: blue, say: "Blue!" }
      - { id: purple, say: "Purple!" }
      - { id: pink, say: "Pink!" }
      - { id: gold, say: "Gold!" }
    after: "A {color} {object}. Beautiful!"
  - id: sparkles
    who: child
    choice: sparkles
    say:
      - "Does it sparkle?"
    options:
      - { id: none, say: "No sparkles. Nice and plain." }
      - { id: some, say: "A little twinkle!" }
      - { id: lots, say: "Super sparkly!" }
      - { id: rainbow, say: "Rainbow sparkles! Wow!" }
  - id: name
    who: child
    choice: name
    say:
      - "Now a funny name!"
      - "Pick one word. Then pick another."
    name_first: [Captain, Wiggly, Giggly, Snorty, Bumpy, Sleepy, Bouncy, Squishy]
    name_second: [Noodle, Pickle, Muffin, Socks, Sprout, Puddle, Button, Biscuit]
    after: "{name}! Ha ha! I love it."
  - id: sound
    who: child
    choice: sound
    say:
      - "What sound does it make?"
    options:
      - { id: boing, say: "Boing!" }
      - { id: toot, say: "Toot toot!" }
      - { id: giggle, say: "Hee hee hee!" }
      - { id: splash, say: "Splash!" }
      - { id: ding, say: "Ding!" }
      - { id: snore, say: "Zzzzz!" }
  - id: story
    who: parent
    choice: story
    say:
      - "Tell {grown_up} a story about it."
    parent_prompt: Ask your child about their treasure and type what they say, in their words.
    parent_questions:
      - Where did it come from?
      - What does it like to do?
      - Who would love to find it?
    story_max_characters: 280
  - id: hide
    who: child
    say:
      - "Now, where should we hide it?"
      - "Pick a spot with {grown_up}."
  - id: confirm_spot
    who: parent
    parent_prompt: Check the spot on the map and confirm it. Only confirm a spot you can see and know is safe to reach.
    parent_hint_template: "Look near the {blank}."
    after: "Shh! It's hidden. Don't tell!"
  - id: done
    who: child
    say:
      - "Great hiding, {pirate_name}!"
      - "Can {grown_up} find it? Let's see!"
found_by_parent:
  - "{grown_up} found {name}!"
  - "{pirate_name} made that. What a treasure!"
---

# Hide a treasure for your grown-up

After a hunt, the child invents a treasure and hides it for the parent. The child picks everything by
tapping big pictures, so no reading is needed. The parent types the story and confirms the hiding
spot.

## Steps

| # | Step | Who | What happens |
|---|---|---|---|
| 1 | `start` | Child | The captain invites the child to make a treasure. |
| 2 | `object` | Child | Picks one built-in treasure from the art set. Each picture plays its name when tapped. |
| 3 | `color` | Child | Picks one of eight colors. Each swatch says its name. |
| 4 | `sparkles` | Child | No sparkles, a little twinkle, super sparkly, or rainbow. |
| 5 | `name` | Child | Taps two word tiles to build a funny name, such as "Wiggly Pickle". Each tile has a picture and says its word. A **Mix it up** button picks two at random. |
| 6 | `sound` | Child | Picks a sound. Each button plays it. |
| 7 | `story` | Parent | The parent asks the child about the treasure and types the story in the child's words. Can be skipped. |
| 8 | `hide` | Child | The captain asks where to hide it. Child and parent pick a spot together. |
| 9 | `confirm_spot` | Parent | The parent checks the spot on the detailed map, adds a hint and confirms. Nothing is hidden until the parent confirms. |
| 10 | `done` | Child | The captain celebrates. The treasure waits for the parent to find it. |

When the parent finds it, play `found_by_parent`.

## Rules

- **The parent confirms every spot.** The child chooses a place together with the parent, and the
  parent places it on the map. The app never picks a spot for real play.
- **The hint describes the place** ("Look near the ___"), never a direction.
- **The story is optional.** Skipping it never blocks hiding.
- **Every choice is good.** The captain cheers whatever the child picks. There's no wrong answer and
  nothing is rated.
- **Name words are original and silly.** They should never spell a brand or a character's name. If
  the app later lets parents type a custom name, it should be the parent's choice to save it.

## Example

Emmanuel picks a **star**, **blue**, **rainbow sparkles**, the name **Snorty Muffin**, and the sound
**Zzzzz!**, then tells Dad: "It fell off the moon and it snores all night." Dad types that in. Together they walk to
the back step, and Dad confirms the spot with the hint "Look near the back step."

Captain: "Shh! It's hidden. Don't tell!" ... later ... "Dad found Snorty Muffin!" "Emmanuel made
that. What a treasure!"

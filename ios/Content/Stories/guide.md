---
kind: guide
id: captain-tumblebeard
name: Captain Tumblebeard
sidekick:
  name: Nib
  is: a tiny hermit crab who lives in the captain's hat
voice:
  pace: slow
  pitch: low and warm
  tts_rate: 0.45
lines:
  greeting:
    play: one
    say:
      - "Ahoy, {pirate_name}! It's me, Captain Tumblebeard!"
      - "Well, shiver my shells! {pirate_name} is here!"
      - "Ahoy there, {pirate_name}! Ready for an adventure?"
  goal_before:
    play: one
    say:
      - "I need your help, matey."
      - "Oh dear, oh dear. I lost something again."
  goal_after:
    play: all
    say:
      - "Can you help me find them?"
      - "Stay with {grown_up}. Let's go!"
  hint:
    play: one
    say:
      - "Here's a clue, matey."
      - "Listen close. Here's a clue."
      - "Nib whispered a clue to me."
  getting_close:
    play: one
    say:
      - "Ooh! You're getting close!"
      - "My beard is tingling. It's near!"
      - "Nib is dancing! Treasure is close!"
  dig_ready:
    play: one
    say:
      - "Here it is! Tap Dig, matey!"
      - "X marks the spot! Dig, dig, dig!"
  foggy_gps:
    play: one
    say:
      - "The map's a bit foggy here, matey!"
      - "Oh, fiddlesticks! My map is foggy."
      - "Foggy map! {grown_up} can help us look."
  we_found_it:
    play: one
    say:
      - "{grown_up} spotted it! Hooray!"
      - "Great eyes, crew! Let's open it!"
  reveal:
    play: one
    say:
      - "Ooooh! Look what's inside!"
      - "Treasure! You found it!"
      - "Wow! Look at that!"
  next_treasure:
    play: one
    say:
      - "Let's find the next one!"
      - "On to the next treasure!"
      - "More treasure is waiting!"
  finale:
    play: all
    say:
      - "You did it, {pirate_name}!"
      - "Into your chest they go. What a crew!"
  your_turn_to_hide:
    play: all
    say:
      - "Now it's your turn, {pirate_name}!"
      - "Make a treasure for {grown_up}."
      - "Then hide it. Can {grown_up} find it?"
  goodbye:
    play: one
    say:
      - "Bye bye, {pirate_name}! Sail safe!"
      - "Nib waves bye bye with a claw!"
      - "See you next time, matey!"
---

# Captain Tumblebeard

The pirate guide for every Tatchamashay 2.0 adventure. The captain talks to the child, never quizzes
them, and never hurries them.

## Look

- A round, short pirate with rosy cheeks and a big curly beard the color of sand.
- Little shells, a feather and a lost button are tangled in the beard. The captain doesn't mind.
- A floppy green hat with a patch on it. Nib, a tiny hermit crab with a pink striped shell, peeks out
  of the hat brim.
- A blue coat that is too long, with big gold buttons, and rain boots instead of pirate boots.
- No eye patch, no sword, no hook. The captain carries a rolled-up map and a little brass spyglass.

## Personality

- **Cheerful and gentle.** Gets excited about small things: a shiny stone, a funny leaf, a found
  treasure.
- **A bit forgetful.** Always loses things, which is why the family's help is needed. The captain is
  never upset about it; losing things is just part of the fun.
- **Proud of the crew.** Praises looking, trying and helping, not speed. Never says "fast", "first",
  "win", or "lose".
- **On the grown-up's side.** Often says "stay with {grown_up}" and hands the hard choices, like which
  way to walk, to the grown-up.

## Voice

- Short sentences, 3 to 8 words. Each line works alone when read aloud or spoken by text-to-speech.
- Easy words a five-year-old knows. A few friendly pirate words: "ahoy", "matey", "crew", "shiver my
  shells", "fiddlesticks".
- No directions. The captain never says "go left", "north" or "over there". Hints describe a place,
  and the grown-up leads.
- Never scary. No sea monsters, curses, villains or danger. The worst thing that happens is a foggy
  map.
- Sound: slow, warm and a little low, with a happy chuckle. For text-to-speech, use a slower rate
  (`tts_rate`, 0 to 1, where 0.5 is normal).

## Sidekick: Nib

Nib is a tiny hermit crab who lives in the captain's hat. Nib doesn't talk in words. Nib clicks,
dances and waves a claw. The captain "translates" ("Nib is dancing! Treasure is close!"). Nib gives
the art and sound tracks a small, cute character to animate when the child gets close or opens a
chest.

## When each line is used

| Moment | Key | When |
|---|---|---|
| Start | `greeting` | The hunt opens. Use one line. |
| Goal | `goal_before`, `goal_after` | Played before and after the adventure's own `goal` line. |
| Hint | `hint` | Lead-in before the parent's hint for the next treasure. |
| Getting close | `getting_close` | The child comes into range but **Dig!** isn't showing yet, or the parent taps "Close!". |
| Dig ready | `dig_ready` | **Dig!** appears. |
| Foggy GPS | `foggy_gps` | Location is stale or poor. Show **We found it** with it. |
| We found it | `we_found_it` | The parent taps **We found it**. |
| Reveal | `reveal` | The chest bursts open, before the treasure's own `reveal` line. |
| Between treasures | `next_treasure` | After a reveal when more are left. |
| Finale | `finale` | Played after the adventure's own finale lines. |
| Your turn | `your_turn_to_hide` | Offers the hide-for-parent flow after the finale. |
| Goodbye | `goodbye` | The session ends. |

Each group says how to play it: `play: one` picks one line at random, `play: all` plays every line
in order. Placeholders such as `{pirate_name}` are listed in the README.

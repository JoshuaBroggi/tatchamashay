import Foundation
import Testing
@testable import Tatchamashay

/// A voice that knows when it's "speaking" and counts any line started over another.
@MainActor
final class RecordingVoice: GuideVoice {
    private(set) var spoken: [[String]] = []
    private(set) var rates: [Double] = []
    private(set) var overlaps = 0
    private(set) var stops = 0
    private(set) var isSpeaking = false

    func speak(_ lines: [String], rate: Double) {
        if isSpeaking { overlaps += 1 }
        spoken.append(lines)
        rates.append(rate)
        isSpeaking = true
    }

    func stop() {
        stops += 1
        isSpeaking = false
    }

    /// The system voice finished on its own.
    func finish() { isSpeaking = false }

    var all: [String] { spoken.flatMap { $0 } }
}

@MainActor
final class TestClock {
    var now = Date(timeIntervalSince1970: 1_000_000)
    func advance(_ seconds: TimeInterval) { now.addTimeInterval(seconds) }
}

@MainActor
@Suite("The guide")
struct GuideDirectorTests {
    let library = try! StoryLibrary.load(from: .main)
    let clock = TestClock()
    let voice = RecordingVoice()
    let sounds = SilentSoundEffects()
    let run = UUID()

    func script(grownUp: String? = "Dad", hints: [String] = ["Look near the big tree.", "Look by something red.", "Look where you swing high."])
        -> GuideScript {
        let story = library.adventure("moon-pebbles")!
        return GuideScript(guide: library.guide(for: story)!, story: story,
                           context: StoryContext(pirateName: "Emmanuel", grownUp: grownUp),
                           goal: "Find it", closing: "Back to the ship!", hints: hints,
                           storyTreasureIDs: story.treasures.map(\.id))
    }

    func director() -> GuideDirector {
        let clock = clock
        return GuideDirector(voice: voice, sounds: sounds, now: { clock.now }, random: SeededRandom(seed: 3))
    }

    /// Lets the current line finish and the next one start.
    func finishLine(_ director: GuideDirector) {
        voice.finish()
        clock.advance(30)
        director.tick()
    }

    // MARK: Line choice

    @Test("The opening greets by pirate name and says the story's goal")
    func opening() {
        var random = SeededRandom(seed: 1)
        let lines = script().opening(using: &random)
        #expect(lines.first?.contains("Emmanuel") == true)
        #expect(lines.contains("My ship's lantern needs three moon pebbles. I dropped them!"))
        #expect(lines.suffix(2) == ["Can you help me find them?", "Stay with Dad. Let's go!"])
        #expect(lines.allSatisfy { !$0.contains("{") })
    }

    @Test("Lines with a placeholder the app can't fill are skipped")
    func skipsPlaceholders() {
        let noGrownUp = script(grownUp: nil)
        for seed in 0..<30 {
            var random = SeededRandom(seed: UInt64(seed))
            let lines = noGrownUp.opening(using: &random) + noGrownUp.lines(for: .foggyGPS, treasure: 0, using: &random)
                + noGrownUp.lines(for: .weFoundIt, treasure: 0, using: &random)
            #expect(lines.allSatisfy { !$0.contains("{") && !$0.contains("}") })
            #expect(!lines.contains { $0.contains("Stay with") })
        }
    }

    @Test("Hints lead in with the guide's line, then the parent's words; no hint means nothing")
    func hints() {
        var random = SeededRandom(seed: 2)
        let lines = script().lines(for: .hint, treasure: 1, using: &random)
        #expect(lines.count == 2)
        #expect(lines.last == "Look by something red.")
        #expect(script(hints: ["", " "]).lines(for: .hint, treasure: 0, using: &random).isEmpty)
        #expect(script().lines(for: .hint, treasure: 9, using: &random).isEmpty, "out of range says nothing")
        let next = script().lines(for: .nextTreasure, treasure: 2, using: &random)
        #expect(next.count == 3 && next.last == "Look where you swing high.")
    }

    @Test("The reveal adds the treasure's own line; the finale ends with the story's lines then the guide's")
    func revealAndFinale() {
        var random = SeededRandom(seed: 4)
        let reveal = script().lines(for: .reveal, treasure: 0, using: &random)
        #expect(reveal.count == 2 && reveal.last == "A blue moon pebble! It's yawning. Shh!")
        let finale = script().finale(using: &random)
        #expect(finale.prefix(4).last == "Back to the ship!")
        #expect(finale.suffix(2) == ["You did it, Emmanuel!", "Into your chest they go. What a crew!"])

        var plain = script()
        plain.story = nil
        #expect(plain.finale(using: &random).first == "Back to the ship!", "an adventure without a story uses its closing line")
        #expect(plain.lines(for: .reveal, treasure: 0, using: &random).count == 1)
    }

    @Test("Speaks at the guide's tts_rate")
    func rate() {
        let director = director()
        director.begin(run: run, script: script(), foundCount: 0, isComplete: false)
        #expect(voice.rates == [0.45])
    }

    // MARK: Timing

    @Test("Lines never start over each other, and chatter never interrupts")
    func noOverlap() {
        let director = director()
        director.begin(run: run, script: script(), foundCount: 0, isComplete: false)
        #expect(director.phase == .opening)
        let opening = voice.spoken.count

        // Chatter and clues wait out the opening.
        director.handle(HuntMoment(moment: .gettingClose, treasureIndex: 0, at: clock.now))
        director.handle(HuntMoment(moment: .hint, treasureIndex: 0, at: clock.now))
        #expect(voice.spoken.count == opening)

        director.finishOpening()
        #expect(director.phase == .hunting)
        #expect(voice.spoken.last?.last == "Look near the big tree.")

        // Talking about the clue: chatter is dropped.
        director.handle(HuntMoment(moment: .gettingClose, treasureIndex: 0, at: clock.now))
        #expect(voice.spoken.count == opening + 1)

        // Dig ready replaces the clue, stopping it first.
        let stops = voice.stops
        director.handle(HuntMoment(moment: .digReady, treasureIndex: 0, at: clock.now))
        #expect(voice.stops == stops + 1)
        #expect(director.bubble != nil)
        #expect(voice.overlaps == 0)
    }

    @Test("Nothing talks over the reveal; what came meanwhile plays after")
    func quietReveal() {
        let director = director()
        director.begin(run: run, script: script(), foundCount: 1, isComplete: false)
        #expect(director.phase == .hunting, "a run under way picks up without the opening")
        #expect(voice.spoken.isEmpty)

        director.handle(HuntMoment(moment: .digReady, treasureIndex: 1, at: clock.now))
        director.handle(HuntMoment(moment: .reveal, treasureIndex: 1, at: clock.now))
        #expect(director.phase == .holdingForReveal)
        #expect(director.bubble == nil)
        #expect(!voice.isSpeaking, "the voice stops for the reveal")
        let before = voice.spoken.count

        director.handle(HuntMoment(moment: .foggyGPS, treasureIndex: 1, at: clock.now))
        director.handle(HuntMoment(moment: .nextTreasure, treasureIndex: 2, at: clock.now))
        clock.advance(1)
        director.tick()
        director.repeatLast()
        #expect(voice.spoken.count == before, "quiet while the chest opens, even when tapped")

        clock.advance(2)
        director.tick()
        #expect(voice.spoken.last?.last == "A gold moon pebble! It's giggling. Hee hee!")

        // The next clue waits for the reveal lines to finish.
        director.tick()
        #expect(voice.spoken.count == before + 1)
        finishLine(director)
        #expect(voice.spoken.last?.last == "Look where you swing high.")
        #expect(!voice.all.contains { $0.contains("foggy") }, "chatter during the reveal is dropped")
        #expect(voice.overlaps == 0)
    }

    @Test("The same chatter isn't repeated for a while")
    func chatterCooldown() {
        let director = director()
        director.begin(run: run, script: script(), foundCount: 1, isComplete: false)
        director.handle(HuntMoment(moment: .foggyGPS, treasureIndex: 1, at: clock.now))
        voice.finish()
        clock.advance(10)
        director.tick()
        #expect(director.bubble == nil)
        director.handle(HuntMoment(moment: .foggyGPS, treasureIndex: 1, at: clock.now))
        #expect(voice.spoken.count == 1)
        clock.advance(director.chatterCooldown - 10)
        director.handle(HuntMoment(moment: .foggyGPS, treasureIndex: 1, at: clock.now))
        #expect(voice.spoken.count == 2)
    }

    @Test("The bubble clears once the line is done, and the opening times out to the first clue")
    func bubbleTiming() {
        let director = director()
        director.begin(run: run, script: script(), foundCount: 0, isComplete: false)
        voice.finish()
        clock.advance(GuideDirector.estimatedDuration(of: voice.spoken[0], rate: 0.45))
        director.tick()
        #expect(director.phase == .opening, "the opening lingers for a slow look")
        clock.advance(director.openingLinger)
        director.tick()
        #expect(director.phase == .hunting)
        #expect(voice.spoken.last?.last == "Look near the big tree.")
        finishLine(director)
        #expect(director.bubble == nil)
    }

    @Test("Tapping the guide repeats the line")
    func repeatLine() {
        let director = director()
        director.begin(run: run, script: script(), foundCount: 1, isComplete: false)
        director.handle(HuntMoment(moment: .digReady, treasureIndex: 1, at: clock.now))
        finishLine(director)
        director.repeatLast()
        #expect(voice.spoken.count == 2 && voice.spoken[0] == voice.spoken[1])
        #expect(voice.overlaps == 0)
    }

    // MARK: Finale

    @Test("The finale plays once per run, with one fanfare")
    func finaleOnce() {
        let director = director()
        director.begin(run: run, script: script(), foundCount: 2, isComplete: false)
        director.handle(HuntMoment(moment: .finale, treasureIndex: 2, at: clock.now))
        director.handle(HuntMoment(moment: .finale, treasureIndex: 2, at: clock.now))
        #expect(director.phase == .finale)
        #expect(sounds.played == [.finaleFanfare])
        #expect(voice.all.filter { $0 == "Back to the ship!" }.count == 1)

        director.finishFinale()
        #expect(director.phase == .ended)
        #expect(voice.spoken.count == 2, "goodbye")
        director.handle(HuntMoment(moment: .finale, treasureIndex: 2, at: clock.now))
        director.begin(run: run, script: script(), foundCount: 3, isComplete: true)
        #expect(sounds.played == [.finaleFanfare])
        #expect(director.phase == .ended)

        // A replay is a new run with its own finale.
        director.begin(run: UUID(), script: script(), foundCount: 0, isComplete: false)
        #expect(director.phase == .opening)
        director.handle(HuntMoment(moment: .finale, treasureIndex: 2, at: clock.now))
        #expect(sounds.played == [.finaleFanfare, .finaleFanfare])
    }

    @Test("A finale that arrives during the reveal waits for the reveal lines")
    func finaleAfterReveal() {
        let director = director()
        director.begin(run: run, script: script(), foundCount: 2, isComplete: false)
        director.handle(HuntMoment(moment: .reveal, treasureIndex: 2, at: clock.now))
        director.handle(HuntMoment(moment: .finale, treasureIndex: 2, at: clock.now))
        #expect(sounds.played.isEmpty)
        clock.advance(director.revealHold)
        director.tick()
        #expect(voice.spoken.last?.last == "The silver moon pebble! It twinkles like a star!")
        finishLine(director)
        #expect(director.phase == .finale)
        #expect(sounds.played == [.finaleFanfare])
        #expect(voice.overlaps == 0)
    }

    @Test("A finished run doesn't replay its finale after a restart")
    func finishedRun() {
        let director = director()
        director.begin(run: run, script: script(), foundCount: 3, isComplete: true)
        director.handle(HuntMoment(moment: .finale, treasureIndex: 2, at: clock.now))
        #expect(director.phase == .ended)
        #expect(sounds.played.isEmpty && voice.spoken.isEmpty)
    }

    // MARK: Settings

    @Test("With the spoken guide off, the bubble still shows but nothing is said")
    func voiceOff() {
        let settings = PlaySettings(defaults: nil, systemReduceMotion: { false })
        settings.spokenGuideOn = false
        let silent = SilentGuideVoice(settings: settings)
        let director = GuideDirector(voice: silent, sounds: SilentSoundEffects(settings: settings), now: { .now })
        director.begin(run: run, script: script(), foundCount: 0, isComplete: false)
        #expect(silent.spoken.isEmpty)
        #expect(director.bubble?.contains("Emmanuel") == true)
    }

    @Test("A family's adventure becomes a script with its names, hints and story")
    func scriptFromFamily() throws {
        let fixture = Fixture()
        var adventure = fixture.adventure
        adventure.storyID = "moon-pebbles"
        var placement = fixture.placement
        placement.storyTreasureID = "moon-pebble-blue"
        let script = try #require(GuideScript(adventure: adventure, placements: [placement], child: fixture.child,
                                              parent: fixture.parent, library: library))
        #expect(script.guide.id == "captain-tumblebeard")
        #expect(script.context.pirateName == "Captain E")
        #expect(script.context.grownUp == "Parent")
        #expect(script.hints == ["By the big tree"])
        #expect(script.story?.id == "moon-pebbles")
        #expect(GuideScript(adventure: adventure, placements: [], child: fixture.child, parent: fixture.parent,
                            library: library) == nil, "nothing hidden, nothing to say")
    }
}

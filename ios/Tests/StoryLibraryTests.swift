import Foundation
import Testing
@testable import Tatchamashay

@Suite("The story library")
struct StoryLibraryTests {
    let library = try! StoryLibrary.load(from: .main)

    @Test("Reads the guide, both starter adventures and the hide flow from the bundle")
    func loadsBundledStories() throws {
        let guide = try #require(library.guide("captain-tumblebeard"))
        #expect(guide.name == "Captain Tumblebeard")
        #expect(guide.voice.ttsRate == 0.45)
        #expect(guide.sidekick?.name == "Nib")
        for moment in GuideMoment.allCases {
            #expect(guide.group(moment) != nil, "guide has \(moment.rawValue)")
        }
        #expect(guide.group(.goalAfter)?.play == .all)
        #expect(guide.group(.greeting)?.play == .one)

        #expect(library.adventures.map(\.id).sorted() == ["moon-pebbles", "shell-party"])
        let pebbles = try #require(library.adventure("moon-pebbles"))
        #expect(pebbles.treasures.map(\.order) == [1, 2, 3])
        #expect(pebbles.treasures[0].blankIdeas.contains("big tree"))
        #expect(pebbles.finale.last == "Back to the ship!")
        #expect(library.guide(for: pebbles)?.id == guide.id)

        let hide = try #require(library.hideFlow)
        #expect(hide.steps.first?.id == "start")
        let color = try #require(hide.step("color"))
        #expect(color.choice == .color)
        #expect(color.options.count == 8)
        #expect(color.options.allSatisfy { TreasureColor(rawValue: $0.id) != nil }, "every offered color is a TreasureColor")
        let sparkles = try #require(hide.step("sparkles"))
        #expect(sparkles.options.map(\.id) == Sparkles.allCases.map(\.rawValue))
        let sound = try #require(hide.step("sound"))
        #expect(sound.options.allSatisfy { TreasureSound(rawValue: $0.id) != nil }, "every offered sound is a TreasureSound")
        #expect(hide.step("object")?.optionsFrom == "built_in_models")
        #expect(hide.step("name")?.nameFirst.count == 8)
        #expect(hide.step("story")?.storyMaxCharacters == 280)
        #expect(hide.step("story")?.who == .parent)
        #expect(hide.foundByParent.count == 2)
    }

    @Test("Placeholders are filled")
    func fills() {
        let context = StoryContext(pirateName: "Emmanuel", grownUp: "Dad")
        #expect(context.fill("Ahoy, {pirate_name}! Stay with {grown_up}.") == "Ahoy, Emmanuel! Stay with Dad.")
        #expect(context.fill("No placeholders.") == "No placeholders.")
    }

    @Test("A line whose placeholder can't be filled is skipped")
    func skipsUnfillable() {
        let context = StoryContext(pirateName: "Emmanuel")
        #expect(context.fill("Make a treasure for {grown_up}.") == nil)
        #expect(context.fill("Unknown {captain}.") == nil)
        #expect(context.fill("Broken {pirate_name") == nil)
        #expect(StoryContext(pirateName: "  ").fill("Hi {pirate_name}") == nil, "blank values don't count")
        #expect(context.fill(["Hi {pirate_name}!", "For {grown_up}.", "Go!"]) == ["Hi Emmanuel!", "Go!"])
    }

    @Test("play: one picks one fillable line; play: all keeps every fillable line in order")
    func playModes() throws {
        let guide = try #require(library.guide("captain-tumblebeard"))
        let context = StoryContext(pirateName: "Emmanuel", grownUp: "Dad")
        var random = SeededRandom(seed: 7)
        let greeting = guide.lines(for: .greeting, context: context, using: &random)
        #expect(greeting.count == 1)
        #expect(greeting[0].contains("Emmanuel"))
        #expect(guide.lines(for: .goalAfter, context: context) == ["Can you help me find them?", "Stay with Dad. Let's go!"])
        // Without a grown-up's name, only the line that doesn't need it plays.
        #expect(guide.lines(for: .goalAfter, context: StoryContext()) == ["Can you help me find them?"])
        // "Foggy map! {grown_up} can help us look." is never picked without a grown-up.
        for seed in 0..<20 {
            var r = SeededRandom(seed: UInt64(seed))
            let foggy = guide.lines(for: .foggyGPS, context: StoryContext(), using: &r)
            #expect(foggy.count == 1 && !foggy[0].contains("{"))
        }
    }

    @Test("A hint template takes the parent's words")
    func hints() throws {
        let treasure = try #require(library.adventure("moon-pebbles")?.treasures.first)
        #expect(treasure.hint(blank: "big tree") == "Look near the big tree.")
        #expect(treasure.hint(blank: "") == nil)
    }

    @Test("A made treasure fills object, color and name")
    func lookContext() throws {
        let look = TreasureLook(model: .starCompass, color: .blue, name: "Snorty Muffin")
        let context = StoryContext(pirateName: "Emmanuel", grownUp: "Dad", look: look)
        let color = try #require(library.hideFlow?.step("color")?.after)
        #expect(context.fill(color) == "A blue star. Beautiful!")
        #expect(context.fill(library.hideFlow?.foundByParent ?? []) == ["Dad found Snorty Muffin!", "Emmanuel made that. What a treasure!"])
    }

    @Test("Front matter is the block between the first two --- lines")
    func frontMatter() throws {
        #expect(StoryLibrary.frontMatter(of: "---\nkind: guide\n---\n# Body\n---\n") == "kind: guide")
        #expect(StoryLibrary.frontMatter(of: "# No front matter") == nil)
        #expect(StoryLibrary.frontMatter(of: "---\nkind: guide\n") == nil)
    }

    @Test("An unknown kind is an error")
    func unknownKind() {
        var library = StoryLibrary(guides: [], adventures: [])
        #expect(throws: StoryLibrary.LoadError.unknownKind("poem", file: "x.md")) {
            try library.add(yaml: "kind: poem", file: "x.md")
        }
    }
}

/// A repeatable random source for tests.
struct SeededRandom: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed &+ 0x9E37_79B9_7F4A_7C15 }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

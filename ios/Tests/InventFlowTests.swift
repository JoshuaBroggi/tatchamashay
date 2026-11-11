import Foundation
import Testing
@testable import Tatchamashay

@Suite("The child's invent-and-hide flow")
struct InventFlowTests {
    let story = try! #require(StoryLibrary.load(from: .main).hideFlow)

    /// A flow with every child choice made, standing on `step`.
    static func picked(upTo step: InventStep) -> InventFlow {
        var flow = InventFlow()
        while flow.step != step {
            switch flow.step {
            case .object: flow.model = .starCompass
            case .color: flow.color = .blue
            case .sparkles: flow.sparkles = .rainbow
            case .name:
                flow.tapWord("Snorty")
                flow.tapWord("Muffin")
            case .sound: flow.sound = .snore
            case .story: flow.setStory("It fell off the moon.")
            default: break
            }
            flow.next()
        }
        return flow
    }

    @Test("Screens come in the story's order, with the grown-up's turn before the spot")
    func order() {
        let storyIDs = story.steps.map(\.id)
        let flowIDs = InventStep.allCases.filter { $0 != .handoff }.map(\.rawValue)
        #expect(flowIDs == storyIDs, "every story step has a screen, in order")
        #expect(InventStep.allCases.firstIndex(of: .handoff) == InventStep.allCases.firstIndex(of: .confirmSpot)! - 1)
        #expect(InventStep.story.isGrownUps && InventStep.confirmSpot.isGrownUps && InventStep.handoff.isGrownUps)
        #expect(!InventStep.object.isGrownUps && !InventStep.hide.isGrownUps)
    }

    @Test("Each choice screen waits for its one choice")
    func oneChoicePerScreen() {
        var flow = InventFlow()
        #expect(flow.step == .start)
        flow.next()
        #expect(flow.step == .object)
        flow.next()
        #expect(flow.step == .object, "no treasure picked yet")
        flow.model = .crown
        flow.next()
        #expect(flow.step == .color)
        flow.next()
        #expect(flow.step == .color)
        flow.color = .pink
        flow.next()
        flow.next()
        #expect(flow.step == .sparkles)
        flow.sparkles = Sparkles.none
        flow.next()
        #expect(flow.step == .name)
        flow.tapWord("Wiggly")
        #expect(flow.name == "Wiggly" && flow.canContinue)
        flow.next()
        #expect(flow.step == .sound)
        flow.next()
        #expect(flow.step == .sound)
        flow.sound = .boing
        flow.next()
        #expect(flow.step == .story)
    }

    @Test("The story is optional and capped")
    func optionalStory() {
        var flow = Self.picked(upTo: .story)
        flow.setStory("")
        #expect(flow.canContinue, "skipping the story never blocks hiding")
        flow.setStory(String(repeating: "a", count: 400))
        #expect(flow.story.count == 280)
        #expect(story.step("story")?.storyMaxCharacters == 280)
    }

    @Test("Name tiles: first word, then second; mix it up; or the grown-up types one")
    func names() {
        var flow = InventFlow()
        #expect(flow.wantsFirstWord)
        flow.tapWord("Bumpy")
        #expect(!flow.wantsFirstWord)
        flow.tapWord("Pickle")
        #expect(flow.name == "Bumpy Pickle")
        flow.tapWord("Socks")
        #expect(flow.name == "Bumpy Socks", "tapping again swaps the second word")

        flow.typedName = "  Sir Sparkle  "
        #expect(flow.name == "Sir Sparkle")
        flow.tapWord("Puddle")
        #expect(flow.typedName.isEmpty && flow.name == "Bumpy Puddle", "a tile replaces the typed name")

        flow.clearName()
        #expect(flow.name.isEmpty && flow.wantsFirstWord)

        let first = story.step("name")!.nameFirst, second = story.step("name")!.nameSecond
        var a = SeededRandom(seed: 3), b = SeededRandom(seed: 3)
        var one = InventFlow(), two = InventFlow()
        one.mixName(first: first, second: second, using: &a)
        two.mixName(first: first, second: second, using: &b)
        #expect(one.name == two.name)
        let words = one.name.split(separator: " ").map(String.init)
        #expect(words.count == 2 && first.contains(words[0]) && second.contains(words[1]))
    }

    @Test("The look is built only from the child's choices")
    func look() throws {
        #expect(InventFlow().look == nil)
        let flow = Self.picked(upTo: .hide)
        let look = try #require(flow.look)
        #expect(look == TreasureLook(model: .starCompass, color: .blue, sparkles: .rainbow, name: "Snorty Muffin",
                                     sound: .snore, story: "It fell off the moon."))
        #expect(InventFlow().previewLook.color == BuiltInModel.crown.defaultColor, "the preview has a color before one is picked")
    }

    @Test("Hiding waits for the save, and done waits for the grown-up's confirmed spot")
    func hidingNeedsSaveAndConfirmation() throws {
        var flow = Self.picked(upTo: .hide)
        flow.next()
        #expect(flow.step == .hide, "not saved yet")
        let look = try #require(flow.look)
        let design = UUID(), version = UUID()
        flow.didSave(design: design, version: version, look: look)
        #expect(flow.step == .handoff)
        flow.next()
        #expect(flow.step == .confirmSpot)
        flow.next()
        #expect(flow.step == .confirmSpot, "Next never skips the grown-up's confirmation")
        #expect(!flow.isHidden)
        flow.didHide()
        #expect(flow.step == .done && flow.isHidden)
        #expect(!flow.canGoBack, "a hidden treasure stays hidden")
    }

    @Test("Going back and changing a choice needs a fresh save into the same design")
    func changeAfterSave() throws {
        var flow = Self.picked(upTo: .hide)
        let design = UUID()
        flow.didSave(design: design, version: UUID(), look: try #require(flow.look))
        flow.back()
        flow.back()
        #expect(flow.step == .story)
        flow.next()
        #expect(flow.step == .hide && !flow.needsSave)
        flow.back()
        flow.back()
        flow.back()
        #expect(flow.step == .name)
        flow.tapWord("Biscuit")
        #expect(flow.needsSave)
        #expect(flow.designToSave == design, "saving again adds a version, not a second treasure")
    }

    @Test("Editing starts from the newest look and saves into the same design")
    func editing() {
        let parent = ParentAccount(displayName: "Dad")
        let child = ChildProfile(parentID: parent.id, pirateName: "Captain E")
        var design = TreasureDesign(familyID: parent.id, maker: .child(child.id),
                                    look: TreasureLook(model: .potion, color: .green, sparkles: .lots, name: "Giggly Noodle",
                                                       sound: .toot, story: "Bubbles."))
        design.edit(to: TreasureLook(model: .potion, color: .purple, sparkles: .lots, name: "Giggly Noodle", sound: .toot))
        let flow = InventFlow(editing: design)
        #expect(flow.step == .object && !flow.canGoBack)
        #expect(flow.look == design.current.look)
        #expect(flow.designToSave == design.id)
    }

    @Test("Spoken prompts fill in names and choices")
    func spokenLines() {
        let context = StoryContext(pirateName: "Captain E", grownUp: "Dad", object: "star", color: "blue", name: "Snorty Muffin")
        #expect(story.prompt(for: .start, context: context) == ["Let's make a treasure, Captain E!", "Then we hide it for Dad."])
        #expect(story.reply(for: .object, context: context) == "Ooh, a star! Good choice.")
        #expect(story.reply(for: .name, context: context) == "Snorty Muffin! Ha ha! I love it.")
        #expect(story.reply(for: .confirmSpot, context: context) == "Shh! It's hidden. Don't tell!")
        #expect(story.prompt(for: .handoff, context: context).isEmpty, "the app's own screen has no story line")
        #expect(story.optionLine("red", in: .color) == "Red!")
    }

    @Test("Every color, sparkle and sound the story offers exists in the app, and each sound has a file")
    func optionsExist() {
        let catalog = TreasureCatalog.bundled
        for option in story.step("color")!.options { #expect(TreasureColor(rawValue: option.id) != nil, "\(option.id)") }
        for option in story.step("sparkles")!.options { #expect(Sparkles(rawValue: option.id) != nil, "\(option.id)") }
        for option in story.step("sound")!.options {
            let sound = TreasureSound(rawValue: option.id)
            #expect(sound != nil, "\(option.id)")
            if let sound { #expect(catalog.soundURL(for: SoundEffect(sound)) != nil, "\(option.id) has a file") }
        }
        for sound in TreasureSound.allCases { #expect(SoundEffect(sound).rawValue == sound.rawValue) }
        for model in BuiltInModel.allCases { #expect(catalog.colorThumbnailURL(for: model) != nil) }
    }
}

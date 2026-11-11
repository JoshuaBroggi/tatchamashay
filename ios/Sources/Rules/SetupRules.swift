import Foundation

// Parent setup: the rules for choosing a play area and spots on the map, and for a hunt being
// built before it's saved. Pure, so the screens and the tests agree.

/// When the map is detailed enough to choose something on it.
enum MapReview {
    /// A chest's spot: zoomed in until paths, roads and water show (camera distance in meters).
    static let spotDistance: Double = 1_200
    /// The play area: close enough to recognise the neighborhood.
    static let areaDistance: Double = 6_000
    /// Where spot review starts, so the parent zooms in from the play area.
    static let spotStartDistance: Double = 2_500

    static func isDetailedForSpot(cameraDistance: Double) -> Bool { cameraDistance <= spotDistance }
    static func isDetailedForArea(cameraDistance: Double) -> Bool { cameraDistance <= areaDistance }

    /// A spot can be confirmed only on a detailed map, with a center, after the parent ticks the check.
    static func canConfirmSpot(cameraDistance: Double, center: Coordinate?, checked: Bool) -> Bool {
        center != nil && checked && isDetailedForSpot(cameraDistance: cameraDistance)
    }
}

/// A hunt the parent is setting up. Nothing is saved until `records` goes to `saveHuntSetup`.
struct HuntDraft: Hashable, Sendable {
    var playArea: PlayArea?
    var title: String
    var goal: String
    var finale: String = "Back to the ship!"
    var guideID: String?
    var storyID: String?
    var chests: [Chest]

    struct Chest: Identifiable, Hashable, Sendable {
        var id = UUID()
        /// The starter adventure's treasure this chest plays. Nil for the parent's own.
        var storyTreasureID: String?
        var name: String
        var model: BuiltInModel?
        /// The story's hint with `{blank}`; nil when the parent writes the whole clue.
        var hintTemplate: String?
        var blankAsks: String?
        var blankIdeas: [String] = []
        /// The parent's words: the blank when there's a template, the whole clue otherwise.
        var clueWords = ""
        var spot: Coordinate?
        var reviewedAt: Date?

        /// The clue the guide says, or nil if it isn't filled yet.
        var hint: String? {
            let words = clueWords.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !words.isEmpty else { return nil }
            guard let hintTemplate else { return words }
            return StoryContext(blank: words).fill(hintTemplate)
        }

        var hasSpot: Bool { spot != nil && reviewedAt != nil }
        var isComplete: Bool { model != nil && hint != nil && hasSpot && !name.trimmed.isEmpty }

        /// What's left, in the order the parent does it.
        var missing: [Step] {
            var steps: [Step] = []
            if model == nil { steps.append(.treasure) }
            if hint == nil { steps.append(.clue) }
            if !hasSpot { steps.append(.spot) }
            return steps
        }
    }

    enum Step: Hashable, Sendable { case treasure, clue, spot }

    /// A blank hunt with no chests yet; the parent adds 3–5.
    static func blank(area: PlayArea?) -> HuntDraft {
        HuntDraft(playArea: area, title: "", goal: "Find the lost treasure!", chests: [])
    }

    /// A hunt from a starter adventure: one chest per story treasure, in story order.
    init(story: AdventureStory, area: PlayArea?) {
        playArea = area
        title = story.title
        goal = story.goal
        finale = story.finale.last ?? "Back to the ship!"
        guideID = story.guide
        storyID = story.id
        chests = story.treasures.prefix(Adventure.treasureCount.upperBound).map { treasure in
            Chest(storyTreasureID: treasure.id, name: treasure.name, model: Self.storyModel(of: treasure),
                  hintTemplate: treasure.hintTemplate, blankAsks: treasure.blankAsks, blankIdeas: treasure.blankIdeas)
        }
    }

    init(playArea: PlayArea?, title: String, goal: String, chests: [Chest]) {
        self.playArea = playArea
        self.title = title
        self.goal = goal
        self.chests = chests
    }

    /// The built-in model a story treasure asks for, read from its `model` field once the story
    /// files have one (`model: clam`). Read by name so this keeps compiling before and after that
    /// field lands; nil means the parent picks.
    static func storyModel(of treasure: AdventureStory.Treasure) -> BuiltInModel? {
        storyModelFromMirror(treasure)
    }

    static func storyModelFromMirror(_ subject: Any) -> BuiltInModel? {
        guard let value = Mirror(reflecting: subject).children.first(where: { $0.label == "model" })?.value else {
            return nil
        }
        // Casting from Any unwraps an optional field.
        if let model = value as? BuiltInModel { return model }
        if let id = value as? String { return BuiltInModel(savedID: id) }
        return nil
    }

    var canAddChest: Bool { chests.count < Adventure.treasureCount.upperBound }
    var canRemoveChest: Bool { storyID == nil && !chests.isEmpty }

    /// A new chest for a hunt the parent writes.
    mutating func addChest() {
        guard canAddChest else { return }
        chests.append(Chest(name: "", model: nil))
    }

    var completeCount: Int { chests.filter(\.isComplete).count }

    var canSave: Bool {
        Adventure.treasureCount.contains(chests.count) && chests.allSatisfy(\.isComplete) && !title.trimmed.isEmpty
    }

    /// One plain sentence on what's left, or nil when it's ready to save.
    var whatsLeft: String? {
        if title.trimmed.isEmpty { return "Give your hunt a name." }
        let needed = Adventure.treasureCount.lowerBound - chests.count
        if needed > 0 { return "Add \(needed) more \(needed == 1 ? "chest" : "chests")." }
        let left = chests.count - completeCount
        if left > 0 { return "Finish \(left) more \(left == 1 ? "chest" : "chests")." }
        return nil
    }

    /// The records to save, with placements in play order. Nil until `canSave`.
    func records(family parent: ParentAccount, now: Date = .now) -> (Adventure, [TreasureDesign], [ChestPlacement])? {
        guard canSave else { return nil }
        var adventure = Adventure(familyID: parent.id, title: title.trimmed, goal: goal.trimmed.isEmpty ? "Find the lost treasure!" : goal.trimmed)
        adventure.finale = finale
        adventure.guideID = guideID
        adventure.storyID = storyID
        adventure.playArea = playArea
        adventure.createdAt = now
        var designs: [TreasureDesign] = []
        var placements: [ChestPlacement] = []
        for chest in chests {
            guard let model = chest.model, let hint = chest.hint, let spot = chest.spot,
                  let reviewedAt = chest.reviewedAt else { return nil }
            let look = TreasureLook(model: model, color: model.defaultColor, name: chest.name.trimmed)
            let design = TreasureDesign(familyID: parent.id, maker: .parent(parent.id), look: look, now: now)
            var placement = ChestPlacement(
                familyID: parent.id, adventureID: adventure.id, designID: design.id, versionID: design.current.id,
                spot: spot, hint: hint, placedBy: parent.id, reviewedAt: reviewedAt
            )
            placement.storyTreasureID = chest.storyTreasureID
            placement.hintBlank = chest.hintTemplate == nil ? nil : chest.clueWords.trimmed
            designs.append(design)
            placements.append(placement)
        }
        adventure.placementIDs = placements.map(\.id)
        return (adventure, designs, placements)
    }
}

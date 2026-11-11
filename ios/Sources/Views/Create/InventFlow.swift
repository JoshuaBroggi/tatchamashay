import Foundation

/// The screens of the hide-for-parent flow, in order. Raw values are the step ids in
/// `Content/Stories/hide-for-parent.md`, except `handoff`, the app's own "Grown-up's turn" screen
/// between the child choosing to hide it and the parent confirming the spot.
enum InventStep: String, CaseIterable, Sendable {
    case start, object, color, sparkles, name, sound, story, hide
    case handoff
    case confirmSpot = "confirm_spot"
    case done

    /// Who holds the phone.
    var isGrownUps: Bool { self == .story || self == .handoff || self == .confirmSpot }
}

/// Everything the child has picked so far, and which screen comes next. Pure data, so the rules are
/// easy to test: one choice per screen, nothing hidden until the grown-up confirms the spot.
struct InventFlow: Sendable {
    private(set) var step: InventStep = .start

    var model: BuiltInModel?
    var color: TreasureColor?
    var sparkles: Sparkles?
    /// The two word tiles. The name is "first second".
    private(set) var nameFirst: String?
    private(set) var nameSecond: String?
    /// A name the grown-up typed instead of the tiles.
    var typedName = ""
    var sound: TreasureSound?
    private(set) var story = ""
    let storyLimit: Int

    /// The design this flow makes a new version of, when the child edits an old invention.
    let editing: TreasureDesign.ID?
    /// Set once the invention is saved, at the `hide` step.
    private(set) var saved: Saved?
    /// Set once the grown-up confirmed the spot and the placement exists.
    private(set) var isHidden = false

    struct Saved: Hashable, Sendable {
        var designID: TreasureDesign.ID
        var versionID: TreasureVersion.ID
        var look: TreasureLook
    }

    init(storyLimit: Int = 280) {
        self.storyLimit = storyLimit
        editing = nil
    }

    /// Starts from an old invention's newest look, to make a new version of it.
    init(editing design: TreasureDesign, storyLimit: Int = 280) {
        self.storyLimit = storyLimit
        editing = design.id
        let look = design.current.look
        model = look.model
        color = look.color
        sparkles = look.sparkles
        typedName = look.name
        sound = look.sound
        story = String(look.story.prefix(storyLimit))
        step = .object
    }

    // MARK: Choices

    var name: String {
        let typed = typedName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !typed.isEmpty { return typed }
        return [nameFirst, nameSecond].compactMap { $0 }.joined(separator: " ")
    }

    /// Whether the name screen wants its first or second word next.
    var wantsFirstWord: Bool { nameFirst == nil }

    /// Taps one word tile: the first word, then the second (tapping again swaps the second).
    /// A typed name gives way to the tiles.
    mutating func tapWord(_ word: String) {
        typedName = ""
        if nameFirst == nil { nameFirst = word } else { nameSecond = word }
    }

    /// **Mix it up**: two random words.
    mutating func mixName(first: [String], second: [String], using random: inout some RandomNumberGenerator) {
        guard let a = first.randomElement(using: &random), let b = second.randomElement(using: &random) else { return }
        typedName = ""
        nameFirst = a
        nameSecond = b
    }

    mutating func clearName() {
        typedName = ""
        nameFirst = nil
        nameSecond = nil
    }

    mutating func setStory(_ text: String) { story = String(text.prefix(storyLimit)) }

    /// The treasure as picked, or nil until every child choice is made.
    var look: TreasureLook? {
        guard let model, let color, let sparkles, let sound, !name.isEmpty else { return nil }
        return TreasureLook(model: model, color: color, sparkles: sparkles, name: name, sound: sound,
                            story: story.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    /// What the 3D preview shows: the picks so far, with the treasure's own color until one is picked.
    var previewLook: TreasureLook {
        let model = model ?? .crown
        return TreasureLook(model: model, color: color ?? model.defaultColor, sparkles: sparkles ?? .none,
                            name: name.isEmpty ? model.displayName : name, sound: sound ?? .chime)
    }

    // MARK: Moving between screens

    /// Whether the big Next button works on this screen.
    var canContinue: Bool {
        switch step {
        case .start: true
        case .object: model != nil
        case .color: color != nil
        case .sparkles: sparkles != nil
        case .name: !name.isEmpty
        case .sound: sound != nil
        case .story: true // optional: skipping never blocks hiding
        case .hide: !needsSave
        case .handoff: true
        case .confirmSpot: isHidden
        case .done: false
        }
    }

    mutating func next() {
        guard canContinue, let index = InventStep.allCases.firstIndex(of: step),
              index + 1 < InventStep.allCases.count else { return }
        step = InventStep.allCases[index + 1]
    }

    var canGoBack: Bool {
        switch step {
        case .start, .done: false
        case .object: editing == nil
        default: true
        }
    }

    mutating func back() {
        guard canGoBack, let index = InventStep.allCases.firstIndex(of: step), index > 0 else { return }
        step = InventStep.allCases[index - 1]
    }

    /// The design to save into: the one already saved this time, or the one being edited. Saving
    /// again after going back adds a version instead of a second treasure.
    var designToSave: TreasureDesign.ID? { saved?.designID ?? editing }

    /// The invention is saved: on to the grown-up. A change after going back needs a new save.
    mutating func didSave(design: TreasureDesign.ID, version: TreasureVersion.ID, look: TreasureLook) {
        saved = Saved(designID: design, versionID: version, look: look)
        if step == .hide { next() }
    }

    /// Whether the picks differ from what was saved, so hiding needs a fresh save first.
    var needsSave: Bool { saved == nil || saved?.look != look }

    /// The grown-up confirmed the spot and the placement was saved.
    mutating func didHide() {
        guard step == .confirmSpot, saved != nil else { return }
        isHidden = true
        next()
    }

    /// Progress dots: the child's choice screens.
    static let choiceSteps: [InventStep] = [.object, .color, .sparkles, .name, .sound, .story, .hide, .confirmSpot]
}

// MARK: - Spoken lines

extension HideFlowStory {
    /// What the captain says on arriving at a screen, filled in. Empty for the app's own screens.
    func prompt(for step: InventStep, context: StoryContext) -> [String] {
        context.fill(self.step(step.rawValue)?.say ?? [])
    }

    /// What the captain says once the screen's choice is made, if anything.
    func reply(for step: InventStep, context: StoryContext) -> String? {
        self.step(step.rawValue)?.after.flatMap(context.fill)
    }

    /// What an option says when tapped, e.g. "Red!" for a color.
    func optionLine(_ id: String, in step: InventStep) -> String? {
        self.step(step.rawValue)?.options.first { $0.id == id }?.say
    }
}

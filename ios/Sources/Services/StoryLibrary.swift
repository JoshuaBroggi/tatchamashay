import Foundation
import Yams

/// The guide, starter adventures and hide-a-treasure flow from `Content/Stories/`, read from each
/// file's YAML front matter. Fields are documented in `Content/Stories/README.md`.
struct StoryLibrary: Sendable {
    var guides: [GuideStory]
    /// Sorted by title.
    var adventures: [AdventureStory]
    var hideFlow: HideFlowStory?

    /// The stories in the app bundle. Empty if they're missing, so screens can still show text.
    static let bundled: StoryLibrary = (try? load(from: .main)) ?? StoryLibrary(guides: [], adventures: [])

    init(guides: [GuideStory], adventures: [AdventureStory], hideFlow: HideFlowStory? = nil) {
        self.guides = guides
        self.adventures = adventures.sorted { $0.title < $1.title }
        self.hideFlow = hideFlow
    }

    func guide(_ id: String) -> GuideStory? { guides.first { $0.id == id } }
    func adventure(_ id: String) -> AdventureStory? { adventures.first { $0.id == id } }
    /// The guide for an adventure, or the first guide if it names none we have.
    func guide(for adventure: AdventureStory) -> GuideStory? { guide(adventure.guide) ?? guides.first }

    enum LoadError: Error, Equatable {
        case missingFolder
        case noFrontMatter(file: String)
        case unknownKind(String, file: String)
    }

    static func load(from bundle: Bundle) throws -> StoryLibrary {
        guard let folder = bundle.url(forResource: "Stories", withExtension: nil) else { throw LoadError.missingFolder }
        return try load(folder: folder)
    }

    /// Reads every `.md` file with front matter. Files without front matter (the README) are skipped.
    static func load(folder: URL) throws -> StoryLibrary {
        let files = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "md" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
        var library = StoryLibrary(guides: [], adventures: [])
        for file in files {
            let text = try String(contentsOf: file, encoding: .utf8)
            guard let yaml = frontMatter(of: text) else { continue }
            try library.add(yaml: yaml, file: file.lastPathComponent)
        }
        library.adventures.sort { $0.title < $1.title }
        return library
    }

    /// Parses one file's front matter and adds it.
    mutating func add(yaml: String, file: String) throws {
        let decoder = YAMLDecoder()
        switch try decoder.decode(KindOnly.self, from: yaml).kind {
        case "guide": guides.append(try decoder.decode(GuideStory.self, from: yaml))
        case "adventure": adventures.append(try decoder.decode(AdventureStory.self, from: yaml))
        case "hide_flow": hideFlow = try decoder.decode(HideFlowStory.self, from: yaml)
        case let other: throw LoadError.unknownKind(other, file: file)
        }
    }

    /// The YAML between a file's opening `---` line and the next `---` line, or nil.
    static func frontMatter(of text: String) -> String? {
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false)
        guard lines.first?.trimmingCharacters(in: .whitespaces) == "---",
              let end = lines.dropFirst().firstIndex(where: { $0.trimmingCharacters(in: .whitespaces) == "---" })
        else { return nil }
        return lines[1..<end].joined(separator: "\n")
    }

    private struct KindOnly: Decodable { var kind: String }
}

// MARK: - Placeholders

/// What the app knows right now, for filling `{pirate_name}`, `{grown_up}` and the rest. A line
/// with a placeholder that isn't known (or isn't a placeholder at all) is skipped, never spoken
/// with braces.
struct StoryContext: Hashable, Sendable {
    var pirateName: String?
    var grownUp: String?
    /// The words the parent typed into a hint's blank.
    var blank: String?
    var object: String?
    var color: String?
    var name: String?

    init(pirateName: String? = nil, grownUp: String? = nil, blank: String? = nil,
         object: String? = nil, color: String? = nil, name: String? = nil) {
        self.pirateName = pirateName
        self.grownUp = grownUp
        self.blank = blank
        self.object = object
        self.color = color
        self.name = name
    }

    /// Fills from a treasure the child made.
    init(pirateName: String?, grownUp: String?, look: TreasureLook) {
        self.init(pirateName: pirateName, grownUp: grownUp, object: look.model.spokenName,
                  color: look.color.spokenName, name: look.name)
    }

    func value(for placeholder: String) -> String? {
        let value: String? = switch placeholder {
        case "pirate_name": pirateName
        case "grown_up": grownUp
        case "blank": blank
        case "object": object
        case "color": color
        case "name": name
        default: nil
        }
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }

    /// The line with every placeholder filled, or nil if any can't be.
    func fill(_ line: String) -> String? {
        var result = ""
        var rest = line[...]
        while let open = rest.firstIndex(of: "{") {
            result += rest[..<open]
            guard let close = rest[open...].firstIndex(of: "}") else { return nil }
            guard let value = value(for: String(rest[rest.index(after: open)..<close])) else { return nil }
            result += value
            rest = rest[rest.index(after: close)...]
        }
        if rest.contains("}") { return nil }
        return result + rest
    }

    /// The lines that can be filled, in order.
    func fill(_ lines: [String]) -> [String] { lines.compactMap(fill) }
}

// MARK: - Guide

struct GuideStory: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let sidekick: Sidekick?
    let voice: Voice
    let lines: [String: LineGroup]

    struct Sidekick: Decodable, Hashable, Sendable {
        let name: String
        let `is`: String
    }

    struct Voice: Decodable, Hashable, Sendable {
        let pace: String?
        let pitch: String?
        /// 0–1, where 0.5 is normal speed.
        let ttsRate: Double

        enum CodingKeys: String, CodingKey {
            case pace, pitch
            case ttsRate = "tts_rate"
        }
    }

    func group(_ moment: GuideMoment) -> LineGroup? { lines[moment.rawValue] }

    /// The lines to say for a moment: one random fillable line for `play: one`, every fillable line in
    /// order for `play: all`. Empty if nothing can be filled.
    func lines(for moment: GuideMoment, context: StoryContext) -> [String] {
        var random = SystemRandomNumberGenerator()
        return lines(for: moment, context: context, using: &random)
    }

    func lines(for moment: GuideMoment, context: StoryContext,
               using random: inout some RandomNumberGenerator) -> [String] {
        guard let group = group(moment) else { return [] }
        let filled = context.fill(group.say)
        switch group.play {
        case .all: return filled
        case .one: return filled.randomElement(using: &random).map { [$0] } ?? []
        }
    }
}

struct LineGroup: Decodable, Hashable, Sendable {
    enum Play: String, Decodable, Sendable {
        /// Pick one line at random.
        case one
        /// Play every line in order.
        case all
    }

    let play: Play
    let say: [String]
}

/// When the guide speaks. `guide.md` has a table of when each one plays.
enum GuideMoment: String, CaseIterable, Sendable {
    case greeting
    case goalBefore = "goal_before"
    case goalAfter = "goal_after"
    case hint
    case gettingClose = "getting_close"
    case digReady = "dig_ready"
    case foggyGPS = "foggy_gps"
    case weFoundIt = "we_found_it"
    case reveal
    case nextTreasure = "next_treasure"
    case finale
    case yourTurnToHide = "your_turn_to_hide"
    case goodbye
}

// MARK: - Adventure

/// A starter adventure. The content supplies the story; the parent supplies the places, turning each
/// treasure into a `ChestPlacement` (with `storyTreasureID`) and the whole into an `Adventure`
/// (with `storyID` and `guideID`).
struct AdventureStory: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    /// A guide `id`.
    let guide: String
    let fits: [String]
    let minutes: Int?
    let goal: String
    /// In play order.
    let treasures: [Treasure]
    /// Played in order after the last reveal, then the guide's `finale`.
    let finale: [String]

    struct Treasure: Decodable, Identifiable, Hashable, Sendable {
        let id: String
        let order: Int
        let name: String
        /// A brief for the art track. Not shown to the child.
        let looksLike: String?
        /// Spoken after the guide's `reveal` line.
        let reveal: String
        /// Contains `{blank}`, which the parent fills about the real place.
        let hintTemplate: String
        /// Tells the parent what goes in the blank.
        let blankAsks: String?
        let blankIdeas: [String]

        enum CodingKeys: String, CodingKey {
            case id, order, name, reveal
            case looksLike = "looks_like"
            case hintTemplate = "hint_template"
            case blankAsks = "blank_asks"
            case blankIdeas = "blank_ideas"
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            order = try c.decode(Int.self, forKey: .order)
            name = try c.decode(String.self, forKey: .name)
            looksLike = try c.decodeIfPresent(String.self, forKey: .looksLike)
            reveal = try c.decode(String.self, forKey: .reveal)
            hintTemplate = try c.decode(String.self, forKey: .hintTemplate)
            blankAsks = try c.decodeIfPresent(String.self, forKey: .blankAsks)
            blankIdeas = try c.decodeIfPresent([String].self, forKey: .blankIdeas) ?? []
        }

        /// The hint with the parent's words in the blank, or nil if they left it empty.
        func hint(blank: String) -> String? { StoryContext(blank: blank).fill(hintTemplate) }
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        guide = try c.decode(String.self, forKey: .guide)
        fits = try c.decodeIfPresent([String].self, forKey: .fits) ?? []
        minutes = try c.decodeIfPresent(Int.self, forKey: .minutes)
        goal = try c.decode(String.self, forKey: .goal)
        treasures = try c.decode([Treasure].self, forKey: .treasures).sorted { $0.order < $1.order }
        finale = try c.decodeIfPresent([String].self, forKey: .finale) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, guide, fits, minutes, goal, treasures, finale
    }

    func treasure(_ id: String) -> Treasure? { treasures.first { $0.id == id } }
}

// MARK: - Hide flow

/// The child invents a treasure and hides it for the grown-up.
struct HideFlowStory: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let guide: String?
    let steps: [Step]
    /// Played in order when the parent finds the child's treasure.
    let foundByParent: [String]

    enum CodingKeys: String, CodingKey {
        case id, guide, steps
        case foundByParent = "found_by_parent"
    }

    func step(_ id: String) -> Step? { steps.first { $0.id == id } }

    struct Step: Decodable, Identifiable, Hashable, Sendable {
        enum Who: String, Decodable, Sendable { case child, parent }

        /// Which `TreasureLook` field a step sets.
        enum Choice: String, Decodable, Sendable { case object, color, sparkles, name, sound, story }

        struct Option: Decodable, Identifiable, Hashable, Sendable {
            /// Stored, e.g. a `TreasureColor` or `Sparkles` raw value.
            let id: String
            /// Spoken when tapped.
            let say: String
        }

        let id: String
        let who: Who
        let say: [String]
        let choice: Choice?
        let options: [Option]
        /// `built_in_models`: options come from `TreasureCatalog`, not this file.
        let optionsFrom: String?
        let nameFirst: [String]
        let nameSecond: [String]
        /// Spoken once the step's choice is made.
        let after: String?
        let parentPrompt: String?
        let parentQuestions: [String]
        let storyMaxCharacters: Int?
        let parentHintTemplate: String?

        enum CodingKeys: String, CodingKey {
            case id, who, say, choice, options, after
            case optionsFrom = "options_from"
            case nameFirst = "name_first"
            case nameSecond = "name_second"
            case parentPrompt = "parent_prompt"
            case parentQuestions = "parent_questions"
            case storyMaxCharacters = "story_max_characters"
            case parentHintTemplate = "parent_hint_template"
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            who = try c.decode(Who.self, forKey: .who)
            say = try c.decodeIfPresent([String].self, forKey: .say) ?? []
            choice = try c.decodeIfPresent(Choice.self, forKey: .choice)
            options = try c.decodeIfPresent([Option].self, forKey: .options) ?? []
            optionsFrom = try c.decodeIfPresent(String.self, forKey: .optionsFrom)
            nameFirst = try c.decodeIfPresent([String].self, forKey: .nameFirst) ?? []
            nameSecond = try c.decodeIfPresent([String].self, forKey: .nameSecond) ?? []
            after = try c.decodeIfPresent(String.self, forKey: .after)
            parentPrompt = try c.decodeIfPresent(String.self, forKey: .parentPrompt)
            parentQuestions = try c.decodeIfPresent([String].self, forKey: .parentQuestions) ?? []
            storyMaxCharacters = try c.decodeIfPresent(Int.self, forKey: .storyMaxCharacters)
            parentHintTemplate = try c.decodeIfPresent(String.self, forKey: .parentHintTemplate)
        }
    }
}

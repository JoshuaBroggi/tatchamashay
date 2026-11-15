import Foundation

// The family's records, one type per row of PLAN.md's "Data and access model".
// Everything belongs to one parent account. Children never have accounts of their own.

/// Reserved for a possible public world. Every record is private in the first release.
enum PublicationState: String, Codable, Hashable, Sendable {
    case `private`
}

/// Whether a record has reached the family's private server. There is no server until milestone 3,
/// so on-device records stay `waitingToSync`. The child never sees this.
enum SyncState: String, Codable, Hashable, Sendable {
    case waitingToSync
    case synced
}

/// The adult who owns everything. Sign in with Apple arrives in milestone 3; until then the account
/// exists only on this phone.
struct ParentAccount: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var displayName: String
    /// The Sign in with Apple user identifier, once the parent signs in (milestone 3).
    var appleUserID: String?
    var createdAt = Date()
    /// What the child calls this grown-up ("Dad", "Mom", "Auntie Jo"), for the guide's `{grown_up}`.
    /// Nil until the parent says; `grownUpName` falls back to `displayName`.
    var childCallsMe: String?

    /// The word the guide says for `{grown_up}`.
    var grownUpName: String {
        let called = childCallsMe?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return called.isEmpty ? displayName : called
    }
}

/// A child's pirate profile. No email, no login, no public name. It lives inside the parent's account.
struct ChildProfile: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var parentID: ParentAccount.ID
    var pirateName: String
    var avatar: PirateAvatar = .parrot
    var syncState: SyncState = .waitingToSync
}

enum PirateAvatar: String, Codable, CaseIterable, Identifiable, Sendable {
    case parrot, octopus, shark, turtle

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .parrot: "bird.fill"
        case .octopus: "drop.fill"
        case .shark: "fish.fill"
        case .turtle: "tortoise.fill"
        }
    }
}

/// Creation provenance. New designs are parent-made; child cases remain for legacy saves.
enum TreasureMaker: Codable, Hashable, Sendable {
    case parent(ParentAccount.ID)
    case child(ChildProfile.ID)
}

/// A treasure as an idea: its maker and its history of looks. Editing never changes an old version;
/// it adds a new one, so anything already found keeps the look it had.
struct TreasureDesign: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var familyID: ParentAccount.ID
    var maker: TreasureMaker
    private(set) var versions: [TreasureVersion]
    var deletedAt: Date?
    var syncState: SyncState = .waitingToSync
    var publication: PublicationState = .private

    init(id: UUID = UUID(), familyID: ParentAccount.ID, maker: TreasureMaker, look: TreasureLook, now: Date = .now) {
        self.id = id
        self.familyID = familyID
        self.maker = maker
        self.versions = [TreasureVersion(designID: id, number: 1, look: look, createdAt: now)]
    }

    var current: TreasureVersion { versions[versions.count - 1] }

    func version(_ id: TreasureVersion.ID) -> TreasureVersion? {
        versions.first { $0.id == id }
    }

    /// Records an edit as a new version and returns it.
    @discardableResult
    mutating func edit(to look: TreasureLook, now: Date = .now) -> TreasureVersion {
        let next = TreasureVersion(designID: id, number: current.number + 1, look: look, createdAt: now)
        versions.append(next)
        syncState = .waitingToSync
        return next
    }
}

/// One frozen look of a treasure. Never changed after it is made.
struct TreasureVersion: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var designID: TreasureDesign.ID
    var number: Int
    var look: TreasureLook
    var createdAt: Date
}

/// Everything you see and hear when a treasure appears.
struct TreasureLook: Codable, Hashable, Sendable {
    var model: BuiltInModel
    var color: TreasureColor
    var sparkles: Sparkles = .some
    var name: String
    var sound: TreasureSound = .chime
    /// Legacy story text, retained for save compatibility and never shown in the journey.
    var story: String = ""
    /// Optional so every previously saved, single-color look decodes unchanged.
    var paint: TreasurePaint?
}

/// The built-in treasures. Raw values are the ids in `Assets/manifest.json`; `TreasureCatalog` has
/// each one's files and parts. Never rename a raw value: saved looks store it.
enum BuiltInModel: RawRepresentable, Codable, CaseIterable, Hashable, Identifiable, Sendable {
    case octopus, clam, parrot, crown
    case starCompass
    case potion
    case dragonEgg
    case turtle, doubloon, spider
    case demogorgon, demodog, vineDog
    /// Keep models saved by another app version intact, even when their assets aren't bundled.
    case unavailable(String)

    /// Only bundled models can be chosen for a new beast.
    static let allCases: [BuiltInModel] = [
        .octopus, .clam, .parrot, .crown, .starCompass, .potion, .dragonEgg, .turtle, .doubloon, .spider,
        .demogorgon, .demodog, .vineDog
    ]

    var rawValue: String {
        switch self {
        case .octopus: "octopus"
        case .clam: "clam"
        case .parrot: "parrot"
        case .crown: "crown"
        case .starCompass: "star-compass"
        case .potion: "potion"
        case .dragonEgg: "dragon-egg"
        case .turtle: "turtle"
        case .doubloon: "doubloon"
        case .spider: "spider"
        case .demogorgon: "demogorgon"
        case .demodog: "demodog"
        case .vineDog: "vine-dog"
        case .unavailable(let savedID): savedID
        }
    }

    init?(rawValue: String) {
        guard let model = Self.allCases.first(where: { $0.rawValue == rawValue }) else { return nil }
        self = model
    }

    var id: String { rawValue }

    /// Ids saved before the real models arrived (milestone 1), mapped to the nearest new treasure.
    static let legacyIDs: [String: BuiltInModel] = ["gem": .clam, "orb": .starCompass]

    /// Reads a current id or a milestone 1 id.
    init?(savedID: String) {
        guard let model = BuiltInModel(rawValue: savedID) ?? Self.legacyIDs[savedID] else { return nil }
        self = model
    }

    init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = BuiltInModel(savedID: raw) ?? .unavailable(raw)
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }

    /// Matches the manifest's `displayName`; a test keeps them in step.
    var displayName: String {
        switch self {
        case .octopus: "Wobbles the Octopus"
        case .clam: "Glow Shell"
        case .parrot: "Captain Squawk"
        case .crown: "Sparkle Crown"
        case .starCompass: "Star Compass"
        case .potion: "Giggle Potion"
        case .dragonEgg: "Dragon Egg"
        case .turtle: "Tumble the Sea Turtle"
        case .doubloon: "Lucky Doubloon"
        case .spider: "Silky the Spider"
        case .demogorgon: "Demogorgon"
        case .demodog: "Demodog"
        case .vineDog: "Vine Dog"
        case .unavailable: "Saved beast"
        }
    }

    /// The short word the guide says for the `{object}` placeholder: "Ooh, a shell!"
    var spokenName: String {
        switch self {
        case .octopus: "octopus"
        case .clam: "shell"
        case .parrot: "parrot"
        case .crown: "crown"
        case .starCompass: "star"
        case .potion: "potion"
        case .dragonEgg: "dragon egg"
        case .turtle: "turtle"
        case .doubloon: "coin"
        case .spider: "spider"
        case .demogorgon: "Demogorgon"
        case .demodog: "Demodog"
        case .vineDog: "vine dog"
        case .unavailable: "treasure"
        }
    }

    /// An SF Symbol for small lists, where a 3D model would be too heavy.
    var symbol: String {
        switch self {
        case .octopus: "drop.fill"
        case .clam: "seal.fill"
        case .parrot: "bird.fill"
        case .crown: "crown.fill"
        case .starCompass: "star.fill"
        case .potion: "flask.fill"
        case .dragonEgg: "oval.portrait.fill"
        case .turtle: "tortoise.fill"
        case .doubloon: "circle.circle.fill"
        case .spider: "ladybug.fill"
        case .demogorgon: "figure.stand"
        case .demodog: "pawprint.fill"
        case .vineDog: "leaf.fill"
        case .unavailable: "shippingbox.fill"
        }
    }

    /// The closest `TreasureColor` to the manifest's `defaultColor`.
    var defaultColor: TreasureColor {
        switch self {
        case .octopus: .pink
        case .clam: .coral
        case .parrot: .green
        case .crown, .doubloon: .gold
        case .starCompass: .yellow
        case .potion: .purple
        case .dragonEgg: .moss
        case .turtle: .sea
        case .spider: .chestnut
        case .demogorgon: .coral
        case .demodog: .moss
        case .vineDog: .green
        case .unavailable: .gold
        }
    }
}

/// Saved color values, shared by the parent editor and legacy collections.
enum TreasureColor: String, Codable, CaseIterable, Identifiable, Sendable {
    case gold, sea, coral, storm, moss, ruby
    case red, orange, yellow, green, blue, purple, pink
    case charcoal, walnut, chestnut, copper, sand, cream, white
    case burgundy, terracotta, amber, peach, lemon
    case pine, emerald, olive, sage, mint, lime
    case navy, cobalt, teal, turquoise, sky, ice
    case plum, orchid, lavender, mauve, rose, blush

    var id: String { rawValue }

    var displayName: String { rawValue.capitalized }

    /// The word the guide says for the `{color}` placeholder.
    var spokenName: String { rawValue }

    /// sRGB components, so both SwiftUI and RealityKit can use them.
    var rgb: (red: Double, green: Double, blue: Double) {
        switch self {
        case .gold: (0.83, 0.64, 0.30)
        case .sea: (0.50, 0.89, 0.94)
        case .coral: (0.95, 0.45, 0.55)
        case .storm: (0.55, 0.45, 0.95)
        case .moss: (0.45, 0.75, 0.40)
        case .ruby: (0.85, 0.15, 0.20)
        case .red: (0.90, 0.20, 0.20)
        case .orange: (0.98, 0.55, 0.15)
        case .yellow: (1.00, 0.82, 0.20)
        case .green: (0.25, 0.77, 0.42)
        case .blue: (0.20, 0.50, 0.95)
        case .purple: (0.60, 0.42, 1.00)
        case .pink: (1.00, 0.48, 0.61)
        case .charcoal: (0.09, 0.10, 0.12)
        case .walnut: (0.19, 0.14, 0.12)
        case .chestnut: (0.36, 0.23, 0.17)
        case .copper: (0.65, 0.36, 0.21)
        case .sand: (0.80, 0.66, 0.46)
        case .cream: (0.95, 0.88, 0.73)
        case .white: (0.98, 0.98, 0.95)
        case .burgundy: (0.33, 0.09, 0.16)
        case .terracotta: (0.72, 0.30, 0.21)
        case .amber: (0.89, 0.59, 0.16)
        case .peach: (1.00, 0.72, 0.51)
        case .lemon: (0.97, 0.92, 0.51)
        case .pine: (0.08, 0.24, 0.20)
        case .emerald: (0.12, 0.52, 0.36)
        case .olive: (0.37, 0.42, 0.19)
        case .sage: (0.58, 0.69, 0.49)
        case .mint: (0.63, 0.88, 0.72)
        case .lime: (0.70, 0.85, 0.30)
        case .navy: (0.07, 0.14, 0.26)
        case .cobalt: (0.12, 0.29, 0.70)
        case .teal: (0.07, 0.43, 0.46)
        case .turquoise: (0.18, 0.72, 0.72)
        case .sky: (0.48, 0.71, 0.91)
        case .ice: (0.76, 0.90, 0.94)
        case .plum: (0.24, 0.11, 0.30)
        case .orchid: (0.59, 0.32, 0.67)
        case .lavender: (0.73, 0.63, 0.87)
        case .mauve: (0.57, 0.33, 0.47)
        case .rose: (0.80, 0.40, 0.54)
        case .blush: (0.95, 0.75, 0.80)
        }
    }

    static let paletteRows: [(name: String, colors: [TreasureColor])] = [
        ("Earth & silk", [.charcoal, .walnut, .chestnut, .copper, .sand, .cream, .white]),
        ("Ember & gold", [.burgundy, .ruby, .red, .terracotta, .orange, .amber, .gold, .peach, .yellow, .lemon]),
        ("Forest & moss", [.pine, .emerald, .green, .olive, .moss, .sage, .mint, .lime]),
        ("Ocean & cobalt", [.navy, .cobalt, .blue, .teal, .turquoise, .sea, .sky, .ice]),
        ("Orchid & rose", [.plum, .purple, .storm, .orchid, .lavender, .mauve, .rose, .pink, .coral, .blush]),
    ]
}

enum Sparkles: String, Codable, CaseIterable, Identifiable, Sendable {
    case none, some, lots, rainbow
    var id: String { rawValue }
}

/// The treasure's own sound. `chime`, `fanfare` and `giggle` came first; the rest are the
/// hide-for-parent flow's choices. Each has a file in the manifest's `sounds` under the same id;
/// play it with `SoundEffect(sound)`.
enum TreasureSound: String, Codable, CaseIterable, Identifiable, Sendable {
    case chime, fanfare, giggle
    case boing, toot, splash, ding, snore
    var id: String { rawValue }
}

/// A latitude and longitude, kept free of CoreLocation so records stay plain data.
struct Coordinate: Codable, Hashable, Sendable {
    var latitude: Double
    var longitude: Double
}

/// Where one treasure version is hidden. Only a parent creates one, after looking at the spot on a
/// detailed map. `reviewedAt` records that review; real play never invents a spot.
struct ChestPlacement: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var familyID: ParentAccount.ID
    var adventureID: Adventure.ID
    var designID: TreasureDesign.ID
    var versionID: TreasureVersion.ID
    var spot: Coordinate
    /// Describes the place, never a direction: "near the big tree".
    var hint: String
    var placedBy: ParentAccount.ID
    var reviewedAt: Date
    var syncState: SyncState = .waitingToSync
    var publication: PublicationState = .private
    /// The starter adventure's treasure this placement plays (`treasures[].id` in its story file),
    /// for its reveal line. Nil for treasures the family made.
    var storyTreasureID: String?
    /// The parent's words for the story hint's `{blank}`; `hint` already has them filled in.
    /// Nil for hints the parent wrote whole.
    var hintBlank: String?
}

/// A legacy hunt area, retained in saved records. Parents review each new placement individually.
struct PlayArea: Codable, Hashable, Sendable {
    var center: Coordinate
    /// Roughly how far the hunt reaches from `center`, in meters.
    var radiusMeters: Double = 250
    /// The parent's name for it: "Our backyard", "Golden Gate Park".
    var name: String = ""
}

/// A legacy grouping of placements. The map combines all groups and ignores their story metadata.
struct Adventure: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var familyID: ParentAccount.ID
    var title: String
    var guideName: String = "Captain Tumblebeard"
    var goal: String
    /// Saved membership order; it does not constrain discovery order.
    var placementIDs: [ChestPlacement.ID] = []
    /// The closing line shown when the last treasure is found ("Back to the ship!").
    var finale: String = "Back to the ship!"
    /// Legacy guide identifier; runtime play does not load narrative content.
    var guideID: String?
    /// Legacy story identifier, retained for existing saved groups.
    var storyID: String?
    /// Where the hunt happens. Nil for milestone 1 adventures.
    var playArea: PlayArea?
    /// Legacy creator metadata; the child remains the player regardless of who created a design.
    var hiddenBy: ChildProfile.ID?
    var createdAt = Date()
    var syncState: SyncState = .waitingToSync
    var publication: PublicationState = .private
}

/// How a treasure was found.
enum FindMethod: String, Codable, Hashable, Sendable {
    /// The child tapped Dig! within range.
    case dig
    /// The parent tapped We found it.
    case parentConfirmed
}

/// A treasure in a child's chest. There is at most one per child per placement, and it carries a
/// saved copy of the treasure as it looked when found, so later edits or deletes never change it.
struct CollectionRecord: Identifiable, Codable, Hashable, Sendable {
    struct Key: Codable, Hashable, Sendable {
        var childID: ChildProfile.ID
        var placementID: ChestPlacement.ID
    }

    var id = UUID()
    var familyID: ParentAccount.ID
    var childID: ChildProfile.ID
    var placementID: ChestPlacement.ID
    var versionID: TreasureVersion.ID
    var savedCopy: TreasureLook
    var foundAt: Date
    var method: FindMethod
    /// The hunt run that first found it. Retrying within the same run is a no-op.
    var firstRunID: HuntRun.ID
    /// Later replays that found it again. Each earns a "found it again" sticker, never a duplicate.
    var foundAgainRunIDs: [HuntRun.ID] = []
    var syncState: SyncState = .waitingToSync

    var key: Key { Key(childID: childID, placementID: placementID) }
    var foundAgainCount: Int { foundAgainRunIDs.count }
}

/// Legacy run metadata retained for decoding older collections; new finds never reset progress.
struct HuntRun: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var adventureID: Adventure.ID
    var childID: ChildProfile.ID
    var startedAt = Date()
}

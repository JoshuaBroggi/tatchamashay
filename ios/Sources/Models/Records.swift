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

/// Who made a treasure: a parent, or a child with the parent's help.
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
    /// A short story the parent types.
    var story: String = ""
}

/// Built-in treasures drawn in code. Real models from the art track replace these later.
enum BuiltInModel: String, Codable, CaseIterable, Identifiable, Sendable {
    case gem, doubloon, crown, potion, orb

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .gem: "Sea Gem"
        case .doubloon: "Gold Doubloon"
        case .crown: "Sunken Crown"
        case .potion: "Mermaid's Potion"
        case .orb: "Storm Orb"
        }
    }

    var symbol: String {
        switch self {
        case .gem: "diamond.fill"
        case .doubloon: "circle.circle.fill"
        case .crown: "crown.fill"
        case .potion: "flask.fill"
        case .orb: "globe.americas.fill"
        }
    }

    var defaultColor: TreasureColor {
        switch self {
        case .gem: .sea
        case .doubloon: .gold
        case .crown: .gold
        case .potion: .coral
        case .orb: .storm
        }
    }
}

enum TreasureColor: String, Codable, CaseIterable, Identifiable, Sendable {
    case gold, sea, coral, storm, moss, ruby

    var id: String { rawValue }

    var displayName: String { rawValue.capitalized }

    /// sRGB components, so both SwiftUI and RealityKit can use them.
    var rgb: (red: Double, green: Double, blue: Double) {
        switch self {
        case .gold: (0.83, 0.64, 0.30)
        case .sea: (0.50, 0.89, 0.94)
        case .coral: (0.95, 0.45, 0.55)
        case .storm: (0.55, 0.45, 0.95)
        case .moss: (0.45, 0.75, 0.40)
        case .ruby: (0.85, 0.15, 0.20)
        }
    }
}

enum Sparkles: String, Codable, CaseIterable, Identifiable, Sendable {
    case none, some, lots
    var id: String { rawValue }
}

enum TreasureSound: String, Codable, CaseIterable, Identifiable, Sendable {
    case chime, fanfare, giggle
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
}

/// A hunt: a guide, a goal, placements in order, and a finale.
struct Adventure: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var familyID: ParentAccount.ID
    var title: String
    var guideName: String = "Captain Barnacle"
    var goal: String
    var placementIDs: [ChestPlacement.ID] = []
    var finale: String = "Back to the ship!"
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

/// One play-through of an adventure. Replaying starts a new run.
struct HuntRun: Identifiable, Codable, Hashable, Sendable {
    var id = UUID()
    var adventureID: Adventure.ID
    var childID: ChildProfile.ID
    var startedAt = Date()
}

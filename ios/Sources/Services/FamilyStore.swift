import Foundation

/// Everything one family has, as stored.
struct FamilyData: Codable, Hashable, Sendable {
    /// The saved file's format. Bump `FamilyMigrations.currentVersion` and add a step when it changes.
    var schemaVersion = FamilyMigrations.currentVersion
    var parent: ParentAccount?
    var children: [ChildProfile] = []
    var designs: [TreasureDesign] = []
    var adventures: [Adventure] = []
    var placements: [ChestPlacement] = []
    var collections: [CollectionRecord] = []

    func child(_ id: ChildProfile.ID) -> ChildProfile? { children.first { $0.id == id } }
    func design(_ id: TreasureDesign.ID) -> TreasureDesign? { designs.first { $0.id == id } }
    func adventure(_ id: Adventure.ID) -> Adventure? { adventures.first { $0.id == id } }
    func placement(_ id: ChestPlacement.ID) -> ChestPlacement? { placements.first { $0.id == id } }

    func collection(_ key: CollectionRecord.Key) -> CollectionRecord? {
        collections.first { $0.key == key }
    }

    /// A child's chest, newest first. Built only from saved copies, never from live designs.
    func chest(for childID: ChildProfile.ID) -> [CollectionRecord] {
        collections.filter { $0.childID == childID }.sorted { $0.foundAt > $1.foundAt }
    }
}

extension FamilyData {
    /// Lenient on purpose: a file from an older app may lack the version or a list, and still loads.
    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init()
        schemaVersion = try c.decodeIfPresent(Int.self, forKey: .schemaVersion) ?? 1
        parent = try c.decodeIfPresent(ParentAccount.self, forKey: .parent)
        children = try c.decodeIfPresent([ChildProfile].self, forKey: .children) ?? []
        designs = try c.decodeIfPresent([TreasureDesign].self, forKey: .designs) ?? []
        adventures = try c.decodeIfPresent([Adventure].self, forKey: .adventures) ?? []
        placements = try c.decodeIfPresent([ChestPlacement].self, forKey: .placements) ?? []
        collections = try c.decodeIfPresent([CollectionRecord].self, forKey: .collections) ?? []
    }
}

/// The outcome of recording a find. Every case means the treasure is in the chest.
enum CollectResult: Hashable, Sendable {
    /// First time this child found this placement.
    case newTreasure(CollectionRecord)
    /// Found again on a replay: a sticker, not a second treasure.
    case foundAgain(CollectionRecord)
    /// This run already counted it (a double tap or a retry). Nothing changed.
    case alreadyCounted(CollectionRecord)

    var record: CollectionRecord {
        switch self {
        case .newTreasure(let r), .foundAgain(let r), .alreadyCounted(let r): r
        }
    }
}

enum FamilyStoreError: Error, Equatable {
    case noParent
    case parentAlreadySet
    /// The record belongs to another family, or points at something outside this one.
    case notInFamily
    case unknownChild
    case unknownPlacement
    case unknownTreasure
    /// A placement must record when the parent reviewed the spot, and that can't be in the future.
    case unreviewedSpot
    /// An adventure holds at most `Adventure.treasureCount.upperBound` treasures, each once.
    case adventureFull
    /// A new hunt needs at least `Adventure.treasureCount.lowerBound` treasures.
    case notEnoughTreasure
    /// `saveHuntSetup` only saves new adventures.
    case adventureAlreadySaved
    /// The family always keeps at least one child profile.
    case lastChild
}

/// Where the family's records live. On-device for now; milestone 3 swaps in a backend that keeps
/// the same rules, including one collection record per child per placement.
protocol FamilyStore: Sendable {
    func load() async throws -> FamilyData
    func createFamily(parent: ParentAccount, child: ChildProfile) async throws -> FamilyData
    func saveChild(_ child: ChildProfile) async throws -> FamilyData
    /// Removes a child profile and that child's chest. The last profile can't be removed.
    func removeChild(_ id: ChildProfile.ID) async throws -> FamilyData
    /// Updates the parent's own details (never their id).
    func saveParent(_ parent: ParentAccount) async throws -> FamilyData
    /// Saves a whole new hunt at once (adventure, treasures, placements in play order), or nothing.
    func saveHuntSetup(_ adventure: Adventure, designs: [TreasureDesign],
                       placements: [ChestPlacement]) async throws -> FamilyData
    func saveDesign(_ design: TreasureDesign) async throws -> FamilyData
    /// Removes a design and its placements. Chests keep their saved copies.
    func deleteDesign(_ id: TreasureDesign.ID) async throws -> FamilyData
    func saveAdventure(_ adventure: Adventure) async throws -> FamilyData
    func place(_ placement: ChestPlacement) async throws -> FamilyData
    /// Saves a new adventure and places its first treasure in one write, so a failed placement
    /// never leaves an empty adventure behind. The placement follows the same rules as `place`.
    func saveAdventure(_ adventure: Adventure, placing placement: ChestPlacement) async throws -> FamilyData
    func removePlacement(_ id: ChestPlacement.ID) async throws -> FamilyData
    /// Safe to repeat: the same run never adds a treasure twice.
    func recordFind(child: ChildProfile.ID, placement: ChestPlacement.ID, run: HuntRun.ID,
                    method: FindMethod, at date: Date) async throws -> (CollectResult, FamilyData)
}

extension FamilyStore {
    /// Two writes, for stores that can't do both at once. `LocalFamilyStore` does it in one.
    func saveAdventure(_ adventure: Adventure, placing placement: ChestPlacement) async throws -> FamilyData {
        _ = try await saveAdventure(adventure)
        return try await place(placement)
    }
}

// MARK: - The rules, shared by every store

extension FamilyData {
    private func requireParent() throws -> ParentAccount {
        guard let parent else { throw FamilyStoreError.noParent }
        return parent
    }

    private func requireFamily(_ familyID: ParentAccount.ID) throws {
        guard try requireParent().id == familyID else { throw FamilyStoreError.notInFamily }
    }

    mutating func createFamily(parent: ParentAccount, child: ChildProfile) throws {
        guard self.parent == nil else { throw FamilyStoreError.parentAlreadySet }
        guard child.parentID == parent.id else { throw FamilyStoreError.notInFamily }
        self.parent = parent
        children = [child]
    }

    mutating func saveChild(_ child: ChildProfile) throws {
        try requireFamily(child.parentID)
        upsert(child, in: &children)
    }

    mutating func removeChild(_ id: ChildProfile.ID) throws {
        _ = try requireParent()
        guard child(id) != nil else { throw FamilyStoreError.unknownChild }
        guard children.count > 1 else { throw FamilyStoreError.lastChild }
        children.removeAll { $0.id == id }
        collections.removeAll { $0.childID == id }
        let placed = Set(placements.map(\.designID))
        designs.removeAll { $0.maker == .child(id) && !placed.contains($0.id) }
    }

    mutating func saveParent(_ updated: ParentAccount) throws {
        try requireFamily(updated.id)
        parent = updated
    }

    /// All or nothing: on any broken rule, nothing changes.
    mutating func saveHuntSetup(_ adventure: Adventure, designs: [TreasureDesign],
                                placements: [ChestPlacement], now: Date) throws {
        guard self.adventure(adventure.id) == nil else { throw FamilyStoreError.adventureAlreadySaved }
        guard Adventure.treasureCount.contains(placements.count) else {
            throw placements.count > Adventure.treasureCount.upperBound
                ? FamilyStoreError.adventureFull : FamilyStoreError.notEnoughTreasure
        }
        guard placements.map(\.id) == adventure.placementIDs || adventure.placementIDs.isEmpty else {
            throw FamilyStoreError.unknownPlacement
        }
        var copy = self
        var empty = adventure
        empty.placementIDs = []
        try copy.saveAdventure(empty)
        for design in designs { try copy.saveDesign(design) }
        for placement in placements {
            guard placement.adventureID == adventure.id else { throw FamilyStoreError.unknownPlacement }
            try copy.place(placement, now: now)
        }
        self = copy
    }

    mutating func saveDesign(_ design: TreasureDesign) throws {
        try requireFamily(design.familyID)
        if case .child(let childID) = design.maker, self.child(childID) == nil {
            throw FamilyStoreError.unknownChild
        }
        upsert(design, in: &designs)
    }

    mutating func deleteDesign(_ id: TreasureDesign.ID) throws {
        _ = try requireParent()
        let removed = Set(placements.filter { $0.designID == id }.map(\.id))
        placements.removeAll { removed.contains($0.id) }
        for i in adventures.indices {
            adventures[i].placementIDs.removeAll { removed.contains($0) }
        }
        designs.removeAll { $0.id == id }
    }

    mutating func saveAdventure(_ adventure: Adventure) throws {
        try requireFamily(adventure.familyID)
        guard adventure.placementIDs.allSatisfy({ placement($0)?.adventureID == adventure.id }) else {
            throw FamilyStoreError.unknownPlacement
        }
        guard Set(adventure.placementIDs).count == adventure.placementIDs.count,
              adventure.placementIDs.count <= Adventure.treasureCount.upperBound else {
            throw FamilyStoreError.adventureFull
        }
        if let hiddenBy = adventure.hiddenBy, child(hiddenBy) == nil { throw FamilyStoreError.unknownChild }
        upsert(adventure, in: &adventures)
    }

    mutating func saveAdventure(_ adventure: Adventure, placing placement: ChestPlacement, now: Date) throws {
        try saveAdventure(adventure)
        try place(placement, now: now)
    }

    mutating func place(_ placement: ChestPlacement, now: Date) throws {
        try requireFamily(placement.familyID)
        try requireFamily(placement.placedBy)
        guard placement.reviewedAt <= now else { throw FamilyStoreError.unreviewedSpot }
        guard let adventureIndex = adventures.firstIndex(where: { $0.id == placement.adventureID }) else {
            throw FamilyStoreError.notInFamily
        }
        guard let design = design(placement.designID), design.version(placement.versionID) != nil else {
            throw FamilyStoreError.unknownTreasure
        }
        try requireFamily(design.familyID)
        let isNew = !adventures[adventureIndex].placementIDs.contains(placement.id)
        if isNew && adventures[adventureIndex].isFull { throw FamilyStoreError.adventureFull }
        upsert(placement, in: &placements)
        if isNew {
            adventures[adventureIndex].placementIDs.append(placement.id)
        }
    }

    mutating func removePlacement(_ id: ChestPlacement.ID) throws {
        _ = try requireParent()
        placements.removeAll { $0.id == id }
        for i in adventures.indices {
            adventures[i].placementIDs.removeAll { $0 == id }
        }
    }

    mutating func recordFind(child childID: ChildProfile.ID, placement placementID: ChestPlacement.ID,
                             run: HuntRun.ID, method: FindMethod, at date: Date) throws -> CollectResult {
        let parent = try requireParent()
        guard child(childID)?.parentID == parent.id else { throw FamilyStoreError.unknownChild }

        let key = CollectionRecord.Key(childID: childID, placementID: placementID)
        if let index = collections.firstIndex(where: { $0.key == key }) {
            var record = collections[index]
            if record.firstRunID == run || record.foundAgainRunIDs.contains(run) {
                return .alreadyCounted(record)
            }
            record.foundAgainRunIDs.append(run)
            record.syncState = .waitingToSync
            collections[index] = record
            return .foundAgain(record)
        }

        guard let placement = placement(placementID) else { throw FamilyStoreError.unknownPlacement }
        try requireFamily(placement.familyID)
        guard let version = design(placement.designID)?.version(placement.versionID) else {
            throw FamilyStoreError.unknownTreasure
        }
        let record = CollectionRecord(
            familyID: parent.id, childID: childID, placementID: placementID, versionID: version.id,
            savedCopy: version.look, foundAt: date, method: method, firstRunID: run
        )
        collections.append(record)
        return .newTreasure(record)
    }

    private func upsert<T: Identifiable>(_ item: T, in list: inout [T]) {
        if let i = list.firstIndex(where: { $0.id == item.id }) { list[i] = item } else { list.append(item) }
    }
}

// MARK: - On-device store

/// Reads and writes the whole family file.
protocol FamilyPersistence: Sendable {
    func read() throws -> FamilyData?
    func write(_ data: FamilyData) throws
}

/// Keeps data only in memory. Used by Demo mode so it never touches the family file.
final class MemoryPersistence: FamilyPersistence, @unchecked Sendable {
    private let lock = NSLock()
    private var stored: FamilyData?

    init(_ initial: FamilyData? = nil) { stored = initial }

    func read() throws -> FamilyData? { lock.withLock { stored } }
    func write(_ data: FamilyData) throws { lock.withLock { stored = data } }
}

/// The on-device store. Writes run one at a time, and a failed save leaves memory unchanged,
/// so a retry behaves exactly like the first try.
actor LocalFamilyStore: FamilyStore {
    private let persistence: any FamilyPersistence
    private var cache: FamilyData?
    private let clock: @Sendable () -> Date

    init(persistence: any FamilyPersistence, clock: @escaping @Sendable () -> Date = { .now }) {
        self.persistence = persistence
        self.clock = clock
    }

    func load() throws -> FamilyData {
        if let cache { return cache }
        let data = try persistence.read() ?? FamilyData()
        cache = data
        return data
    }

    func createFamily(parent: ParentAccount, child: ChildProfile) throws -> FamilyData {
        try change { try $0.createFamily(parent: parent, child: child) }
    }

    func saveChild(_ child: ChildProfile) throws -> FamilyData { try change { try $0.saveChild(child) } }
    func removeChild(_ id: ChildProfile.ID) throws -> FamilyData { try change { try $0.removeChild(id) } }
    func saveParent(_ parent: ParentAccount) throws -> FamilyData { try change { try $0.saveParent(parent) } }

    func saveHuntSetup(_ adventure: Adventure, designs: [TreasureDesign],
                       placements: [ChestPlacement]) throws -> FamilyData {
        let now = clock()
        return try change { try $0.saveHuntSetup(adventure, designs: designs, placements: placements, now: now) }
    }
    func saveDesign(_ design: TreasureDesign) throws -> FamilyData { try change { try $0.saveDesign(design) } }
    func deleteDesign(_ id: TreasureDesign.ID) throws -> FamilyData { try change { try $0.deleteDesign(id) } }
    func saveAdventure(_ adventure: Adventure) throws -> FamilyData { try change { try $0.saveAdventure(adventure) } }

    func place(_ placement: ChestPlacement) throws -> FamilyData {
        let now = clock()
        return try change { try $0.place(placement, now: now) }
    }

    func saveAdventure(_ adventure: Adventure, placing placement: ChestPlacement) throws -> FamilyData {
        let now = clock()
        return try change { try $0.saveAdventure(adventure, placing: placement, now: now) }
    }

    func removePlacement(_ id: ChestPlacement.ID) throws -> FamilyData { try change { try $0.removePlacement(id) } }

    func recordFind(child: ChildProfile.ID, placement: ChestPlacement.ID, run: HuntRun.ID,
                    method: FindMethod, at date: Date) throws -> (CollectResult, FamilyData) {
        var data = try load()
        let result = try data.recordFind(child: child, placement: placement, run: run, method: method, at: date)
        if case .alreadyCounted = result { return (result, data) }
        try persistence.write(data)
        cache = data
        return (result, data)
    }

    private func change(_ apply: (inout FamilyData) throws -> Void) throws -> FamilyData {
        var data = try load()
        try apply(&data)
        try persistence.write(data)
        cache = data
        return data
    }
}

extension JSONEncoder {
    static var family: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return encoder
    }
}

extension JSONDecoder {
    static var family: JSONDecoder {
        let decoder = JSONDecoder()
        return decoder
    }
}

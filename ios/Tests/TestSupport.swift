import Foundation
@testable import Tatchamashay

/// A family with one parent, one child, one adventure and one hidden treasure.
struct Fixture {
    let parent = ParentAccount(displayName: "Parent")
    let child: ChildProfile
    let design: TreasureDesign
    let adventure: Adventure
    let placement: ChestPlacement
    let spot = Coordinate(latitude: 37.7694, longitude: -122.4862)

    static let originalLook = TreasureLook(model: .crown, color: .gold, name: "Captain's Crown", story: "Shiny.")

    init() {
        child = ChildProfile(parentID: parent.id, pirateName: "Captain E")
        design = TreasureDesign(familyID: parent.id, maker: .parent(parent.id), look: Self.originalLook)
        let adventure = Adventure(familyID: parent.id, title: "Test Hunt", goal: "Find it")
        placement = ChestPlacement(
            familyID: parent.id, adventureID: adventure.id, designID: design.id, versionID: design.current.id,
            spot: spot, hint: "By the big tree", placedBy: parent.id, reviewedAt: Date(timeIntervalSince1970: 0)
        )
        self.adventure = adventure
    }

    /// A store already holding the family and its one placement.
    func makeStore(persistence: any FamilyPersistence = MemoryPersistence()) async throws -> LocalFamilyStore {
        let store = LocalFamilyStore(persistence: persistence)
        _ = try await store.createFamily(parent: parent, child: child)
        _ = try await store.saveAdventure(adventure)
        _ = try await store.saveDesign(design)
        _ = try await store.place(placement)
        return store
    }
}

/// Persistence whose next writes fail, as if the save was lost.
final class FlakyPersistence: FamilyPersistence, @unchecked Sendable {
    struct LostWrite: Error {}

    private let lock = NSLock()
    private var stored: FamilyData?
    private var failuresLeft = 0
    private(set) var writes = 0

    func failNextWrites(_ count: Int) { lock.withLock { failuresLeft = count } }

    func read() throws -> FamilyData? { lock.withLock { stored } }

    func write(_ data: FamilyData) throws {
        try lock.withLock {
            if failuresLeft > 0 {
                failuresLeft -= 1
                throw LostWrite()
            }
            writes += 1
            stored = data
        }
    }
}

func temporaryFileURL() -> URL {
    FileManager.default.temporaryDirectory
        .appending(path: "tatchamashay-tests-\(UUID().uuidString)")
        .appending(path: "family.json")
}

import Foundation
import Testing
@testable import Tatchamashay

@Suite("Legacy groups never gate the map")
struct AdventureTests {
    let f = Fixture()

    @Test("One placement is playable and a sixth placement is allowed")
    func anyPositiveSize() async throws {
        let store = try await f.makeStore()
        #expect(try await store.load().adventure(f.adventure.id)?.readiness == .ready)
        for i in 1..<7 {
            var placement = f.placement
            placement.id = UUID()
            placement.hint = "Spot \(i)"
            _ = try await store.place(placement)
        }
        let data = try await store.load()
        #expect(data.placements.count == 7)
        #expect(data.adventure(f.adventure.id)?.placementIDs.count == 7)
    }

    @Test("A group can never list a placement twice")
    func uniquePlacements() async throws {
        let store = try await f.makeStore()
        var adventure = try #require(try await store.load().adventure(f.adventure.id))
        adventure.placementIDs.append(f.placement.id)
        await #expect(throws: FamilyStoreError.adventureFull) { _ = try await store.saveAdventure(adventure) }
        #expect(try await store.load().adventure(f.adventure.id)?.placementIDs == [f.placement.id])
    }

    @Test("A new group with one treasure saves atomically")
    func singleGroup() async throws {
        let store = LocalFamilyStore(persistence: MemoryPersistence())
        _ = try await store.createFamily(parent: f.parent, child: f.child)
        let data = try await store.saveHuntSetup(f.adventure, designs: [f.design], placements: [f.placement])
        #expect(data.placements.count == 1)
        #expect(data.adventures.count == 1)
    }

    @Test("Legacy replay metadata survives encoding unchanged")
    func legacyReplayMetadata() throws {
        let record = CollectionRecord(familyID: f.parent.id, childID: f.child.id, placementID: f.placement.id,
                                      versionID: f.design.current.id, savedCopy: Fixture.originalLook,
                                      foundAt: .now, method: .dig, firstRunID: UUID(), foundAgainRunIDs: [UUID(), UUID()])
        let decoded = try JSONDecoder.family.decode(CollectionRecord.self, from: JSONEncoder.family.encode(record))
        #expect(decoded == record)
        #expect(decoded.foundAgainCount == 2)
    }
}

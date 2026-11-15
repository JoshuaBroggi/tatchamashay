import Foundation
import Testing
@testable import Tatchamashay

@Suite("All unfound treasures on the child's map")
@MainActor
struct UnfoundMapTests {
    let fixture = Fixture()

    @Test("Older adventures and out-of-order finds stay available across a restart")
    func anyOrderAcrossAdventures() async throws {
        let persistence = MemoryPersistence()
        let store = try await fixture.makeStore(persistence: persistence)
        let second = Adventure(familyID: fixture.parent.id, title: "Old story", goal: "", storyID: "missing-story")
        _ = try await store.saveAdventure(second)
        var other = fixture.placement
        other.id = UUID()
        other.adventureID = second.id
        _ = try await store.place(other)
        let family = FamilyModel(store: store, isDemo: true)
        await family.load()
        #expect(Set(family.unfoundPlacements.map(\.id)) == [fixture.placement.id, other.id])
        _ = try #require(await family.recordFind(other, method: .parentConfirmed))
        #expect(family.unfoundPlacements.map(\.id) == [fixture.placement.id])
        let reopened = FamilyModel(store: LocalFamilyStore(persistence: persistence), isDemo: true)
        await reopened.load()
        #expect(reopened.unfoundPlacements.map(\.id) == [fixture.placement.id])
        #expect(reopened.hasCollected(other))
        _ = try #require(await reopened.recordFind(fixture.placement, method: .dig))
        #expect(reopened.unfoundPlacements.isEmpty)
        #expect(reopened.chest.count == 2)
    }

    @Test("Collecting never changes whose chest receives a treasure")
    func childOwnership() async throws {
        let store = try await fixture.makeStore()
        let sibling = ChildProfile(parentID: fixture.parent.id, pirateName: "Mia")
        _ = try await store.saveChild(sibling)
        let family = FamilyModel(store: store, isDemo: true)
        await family.load()
        _ = try #require(await family.recordFind(fixture.placement, method: .parentConfirmed))
        #expect(family.chest.first?.childID == fixture.child.id)
        family.choosePlayingChild(sibling.id)
        #expect(family.unfoundPlacements.map(\.id) == [fixture.placement.id])
        #expect(family.chest.isEmpty)
        _ = try #require(await family.recordFind(fixture.placement, method: .dig))
        #expect(family.chest.first?.childID == sibling.id)
        family.choosePlayingChild(fixture.child.id)
        #expect(family.chest.count == 1)
        #expect(family.unfoundPlacements.isEmpty)
    }

    @Test("A failed find keeps its marker and retry is lifetime-idempotent")
    func failedFind() async throws {
        let persistence = FlakyPersistence()
        let store = try await fixture.makeStore(persistence: persistence)
        let family = FamilyModel(store: store, isDemo: true)
        await family.load()
        persistence.failNextWrites(1)
        #expect(await family.recordFind(fixture.placement, method: .dig) == nil)
        #expect(family.unfoundPlacements.count == 1)
        #expect(family.chest.isEmpty)
        _ = try #require(await family.recordFind(fixture.placement, method: .dig))
        _ = try #require(await family.recordFind(fixture.placement, method: .dig))
        #expect(family.unfoundPlacements.isEmpty)
        #expect(family.chest.count == 1)
        #expect(family.chest.first?.foundAgainCount == 0)
    }

    @Test("Removing a spot never removes a collected saved copy")
    func removedPlacements() async throws {
        let store = try await fixture.makeStore()
        let family = FamilyModel(store: store, isDemo: true)
        await family.load()
        _ = try #require(await family.recordFind(fixture.placement, method: .dig))
        await family.removePlacement(fixture.placement)
        #expect(family.mapPlacements.isEmpty)
        #expect(family.chest.first?.savedCopy == Fixture.originalLook)
        #expect(await family.recordFind(fixture.placement, method: .dig) == nil)
    }

    @Test("Corrupted, unreviewed and foreign placements do not appear")
    func eligibility() async throws {
        let store = try await fixture.makeStore()
        var data = try await store.load()
        var invalid = fixture.placement
        invalid.id = UUID()
        invalid.spot.latitude = 999
        data.placements.append(invalid)
        data.adventures[0].placementIDs.append(invalid.id)
        var future = fixture.placement
        future.id = UUID()
        future.reviewedAt = .now.addingTimeInterval(3_600)
        data.placements.append(future)
        data.adventures[0].placementIDs.append(future.id)
        let family = FamilyModel(store: LocalFamilyStore(persistence: MemoryPersistence(data)), isDemo: true)
        await family.load()
        #expect(family.mapPlacements.map(\.id) == [fixture.placement.id])
    }
}

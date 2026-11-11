import Foundation
import Testing
@testable import Tatchamashay

@Suite("Collecting is safe to repeat")
struct CollectionTests {
    let f = Fixture()

    @Test("Tapping Dig twice gives the treasure once")
    func doubleTap() async throws {
        let store = try await f.makeStore()
        let run = UUID()
        let (first, _) = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: run, method: .dig, at: .now)
        let (second, data) = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: run, method: .dig, at: .now)

        guard case .newTreasure = first else { Issue.record("first tap should add the treasure"); return }
        guard case .alreadyCounted = second else { Issue.record("second tap should change nothing"); return }
        #expect(data.chest(for: f.child.id).count == 1)
        #expect(data.chest(for: f.child.id)[0].foundAgainCount == 0)
    }

    @Test("Many taps at once still give one treasure")
    func simultaneousTaps() async throws {
        let store = try await f.makeStore()
        let run = UUID()
        let (child, placement) = (f.child.id, f.placement.id)
        let results = try await withThrowingTaskGroup(of: CollectResult.self) { group in
            for _ in 0..<20 {
                group.addTask {
                    try await store.recordFind(child: child, placement: placement, run: run, method: .dig, at: .now).0
                }
            }
            return try await group.reduce(into: []) { $0.append($1) }
        }
        let added = results.filter { if case .newTreasure = $0 { true } else { false } }
        #expect(added.count == 1)
        #expect(try await store.load().collections.count == 1)
    }

    @Test("Retrying after a lost save gives the treasure once")
    func retryAfterLostSave() async throws {
        let persistence = FlakyPersistence()
        let store = try await f.makeStore(persistence: persistence)
        let run = UUID()

        persistence.failNextWrites(1)
        await #expect(throws: FlakyPersistence.LostWrite.self) {
            _ = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: run, method: .dig, at: .now)
        }
        #expect(try await store.load().collections.isEmpty, "a failed save must not leave a half-recorded find")

        let (retry, _) = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: run, method: .dig, at: .now)
        let (again, data) = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: run, method: .dig, at: .now)
        guard case .newTreasure = retry else { Issue.record("retry should add the treasure"); return }
        guard case .alreadyCounted = again else { Issue.record("a further retry should change nothing"); return }
        #expect(data.collections.count == 1)
    }

    @Test("A replay earns a found-it-again sticker, not a second treasure")
    func replay() async throws {
        let store = try await f.makeStore()
        let firstRun = UUID(), replay = UUID()
        _ = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: firstRun, method: .dig, at: .now)
        let (again, _) = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: replay, method: .parentConfirmed, at: .now)
        let (repeatTap, data) = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: replay, method: .dig, at: .now)

        guard case .foundAgain = again else { Issue.record("replay should count as found again"); return }
        guard case .alreadyCounted = repeatTap else { Issue.record("a double tap on a replay changes nothing"); return }
        #expect(data.collections.count == 1)
        #expect(data.collections[0].foundAgainCount == 1)
        #expect(data.collections[0].method == .dig, "the first find is kept")
    }

    @Test("The chest survives an app restart")
    func survivesRestart() async throws {
        let url = temporaryFileURL()
        let store = try await f.makeStore(persistence: JSONFilePersistence(url: url))
        _ = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)

        let reopened = LocalFamilyStore(persistence: JSONFilePersistence(url: url))
        let chest = try await reopened.load().chest(for: f.child.id)
        #expect(chest.count == 1)
        #expect(chest.first?.savedCopy == Fixture.originalLook)
    }

    @Test("Only the family's own child can collect")
    func otherFamilyChild() async throws {
        let store = try await f.makeStore()
        let stranger = ChildProfile(parentID: UUID(), pirateName: "Stranger")
        await #expect(throws: FamilyStoreError.unknownChild) {
            _ = try await store.recordFind(child: stranger.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)
        }
    }
}

@Suite("Placement rules")
struct PlacementTests {
    let f = Fixture()

    @Test("A placement for another family is refused")
    func otherFamily() async throws {
        let store = try await f.makeStore()
        var foreign = f.placement
        foreign.id = UUID()
        foreign.familyID = UUID()
        await #expect(throws: FamilyStoreError.notInFamily) { _ = try await store.place(foreign) }
    }

    @Test("A spot must already have been reviewed")
    func unreviewed() async throws {
        let store = try await f.makeStore()
        var later = f.placement
        later.id = UUID()
        later.reviewedAt = .now.addingTimeInterval(3600)
        await #expect(throws: FamilyStoreError.unreviewedSpot) { _ = try await store.place(later) }
    }
}

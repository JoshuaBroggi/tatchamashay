import Foundation
import Testing
@testable import Tatchamashay

@Suite("Multi-treasure adventures")
struct AdventureTests {
    let f = Fixture()

    /// A store with the fixture's adventure holding `count` placements, in order.
    private func store(with count: Int) async throws -> (LocalFamilyStore, [ChestPlacement]) {
        let store = try await f.makeStore()
        var placements = [f.placement]
        for i in 1..<count {
            let design = TreasureDesign(familyID: f.parent.id, maker: .parent(f.parent.id),
                                        look: TreasureLook(model: BuiltInModel.allCases[i], color: .blue, name: "T\(i)"))
            _ = try await store.saveDesign(design)
            let placement = ChestPlacement(
                familyID: f.parent.id, adventureID: f.adventure.id, designID: design.id, versionID: design.current.id,
                spot: Geo.offset(f.spot, north: Double(i) * 20, east: 0), hint: "Spot \(i)", placedBy: f.parent.id,
                reviewedAt: Date(timeIntervalSince1970: 0)
            )
            _ = try await store.place(placement)
            placements.append(placement)
        }
        return (store, placements)
    }

    @Test("Placements keep the order they were hidden in")
    func order() async throws {
        let (store, placements) = try await store(with: 3)
        #expect(try await store.load().adventure(f.adventure.id)?.placementIDs == placements.map(\.id))
    }

    @Test("Three to five treasures make an adventure ready")
    func readiness() async throws {
        let (store, _) = try await store(with: 2)
        #expect(try await store.load().adventure(f.adventure.id)?.readiness == .needsMore(1))
        let (ready, _) = try await self.store(with: 3)
        #expect(try await ready.load().adventure(f.adventure.id)?.readiness == .ready)
    }

    @Test("A sixth treasure is refused and changes nothing")
    func atMostFive() async throws {
        let (store, placements) = try await store(with: 5)
        let design = TreasureDesign(familyID: f.parent.id, maker: .parent(f.parent.id),
                                    look: TreasureLook(model: .turtle, color: .sea, name: "Extra"))
        _ = try await store.saveDesign(design)
        let extra = ChestPlacement(familyID: f.parent.id, adventureID: f.adventure.id, designID: design.id,
                                   versionID: design.current.id, spot: f.spot, hint: "", placedBy: f.parent.id,
                                   reviewedAt: Date(timeIntervalSince1970: 0))
        await #expect(throws: FamilyStoreError.adventureFull) { _ = try await store.place(extra) }
        let data = try await store.load()
        #expect(data.adventure(f.adventure.id)?.placementIDs == placements.map(\.id))
        #expect(data.placement(extra.id) == nil)

        // Re-saving a placement already in a full adventure (e.g. a new hint) is fine.
        var edited = placements[4]
        edited.hint = "By the gate"
        _ = try await store.place(edited)
        #expect(try await store.load().placement(edited.id)?.hint == "By the gate")
    }

    @Test("Reordering keeps every placement once")
    func reorder() async throws {
        let (store, placements) = try await store(with: 3)
        var adventure = try #require(try await store.load().adventure(f.adventure.id))
        adventure.placementIDs = placements.reversed().map(\.id)
        _ = try await store.saveAdventure(adventure)
        #expect(try await store.load().adventure(f.adventure.id)?.placementIDs == placements.reversed().map(\.id))

        adventure.placementIDs = [placements[0].id, placements[0].id]
        await #expect(throws: FamilyStoreError.adventureFull) { _ = try await store.saveAdventure(adventure) }
    }

    @Test("A run walks the treasures in order, then reaches the finale")
    func progressThroughRun() async throws {
        let (store, placements) = try await store(with: 3)
        let run = UUID()
        var data = try await store.load()
        let adventure = try #require(data.adventure(f.adventure.id))

        var progress = data.progress(of: adventure, child: f.child.id, run: run)
        #expect(progress.next == placements[0].id)
        #expect(progress.nextNumber == 1)
        #expect(progress.step(afterFinding: placements[0].id) == .next(placements[1].id))

        (_, data) = try await store.recordFind(child: f.child.id, placement: placements[0].id, run: run, method: .dig, at: .now)
        (_, data) = try await store.recordFind(child: f.child.id, placement: placements[1].id, run: run, method: .parentConfirmed, at: .now)
        progress = data.progress(of: adventure, child: f.child.id, run: run)
        #expect(progress.foundCount == 2 && progress.total == 3)
        #expect(progress.next == placements[2].id && progress.nextNumber == 3)
        #expect(progress.step(afterFinding: placements[2].id) == .finale)
        #expect(!progress.isComplete)

        (_, data) = try await store.recordFind(child: f.child.id, placement: placements[2].id, run: run, method: .dig, at: .now)
        progress = data.progress(of: adventure, child: f.child.id, run: run)
        #expect(progress.isComplete)
        #expect(progress.next == nil)

        // A replay starts from the first treasure again; the chest still holds three.
        let replay = data.progress(of: adventure, child: f.child.id, run: UUID())
        #expect(replay.next == placements[0].id && replay.foundCount == 0)
        #expect(data.chest(for: f.child.id).count == 3)
    }

    @Test("A found treasure out of order still counts, and the next is the first one left")
    func outOfOrder() {
        let ids = [UUID(), UUID(), UUID()]
        let progress = HuntProgress(order: ids, foundThisRun: [ids[1], UUID()])
        #expect(progress.foundCount == 1, "finds from other adventures don't count")
        #expect(progress.next == ids[0])
        #expect(progress.step(afterFinding: ids[0]) == .next(ids[2]))
        #expect(progress.step(afterFinding: UUID()) == .notInAdventure)
        #expect(!HuntProgress(order: [], foundThisRun: []).isComplete, "an empty adventure has no finale")
    }

    @Test("Adventures saved before milestone 2 still load")
    func oldAdventuresDecode() throws {
        let old = """
        {"createdAt":0,"familyID":"\(f.parent.id)","finale":"Back to the ship!","goal":"Find it",
         "guideName":"Captain Barnacle","id":"\(UUID())","placementIDs":[],"publication":"private",
         "syncState":"waitingToSync","title":"Today's Hunt"}
        """
        let adventure = try JSONDecoder.family.decode(Adventure.self, from: Data(old.utf8))
        #expect(adventure.storyID == nil && adventure.guideID == nil)
        #expect(adventure.guideName == "Captain Barnacle")
    }
}

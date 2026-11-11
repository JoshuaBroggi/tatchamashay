import Foundation
import Testing
@testable import Tatchamashay

@Suite("The chest reveal")
struct ChestRevealTests {
    let f = Fixture()

    @Test("Goes sealed → opening → revealed → added, one step at a time")
    func steps() {
        var flow = RevealFlow()
        #expect(flow.phase == .sealed)
        let step1 = flow.finishOpening()
        #expect(!step1, "can't finish before opening")
        let step2 = flow.add()
        #expect(!step2, "can't add a sealed chest")
        let step3 = flow.open()
        #expect(step3)
        #expect(flow.phase == .opening)
        let step4 = flow.finishOpening()
        #expect(step4)
        #expect(flow.phase == .revealed)
        let step5 = flow.add()
        #expect(step5)
        #expect(flow.phase == .added)
    }

    @Test("Repeat taps never open twice or add twice")
    func repeatTaps() {
        var flow = RevealFlow()
        var opens = 0, adds = 0
        for _ in 0..<5 where flow.open() { opens += 1 }
        _ = flow.finishOpening()
        _ = flow.finishOpening()
        for _ in 0..<5 where flow.add() { adds += 1 }
        #expect(opens == 1)
        #expect(adds == 1)
        let step6 = flow.open()
        #expect(!step6, "an added chest can't open again")
    }

    @Test("Skipping only works after a whole reveal has been seen")
    func skipping() {
        var first = RevealFlow(canSkip: false)
        _ = first.open()
        let step7 = first.skip()
        #expect(!step7)
        #expect(first.phase == .opening)

        var later = RevealFlow(canSkip: true)
        _ = later.open()
        let step8 = later.skip()
        #expect(step8)
        #expect(later.phase == .revealed)
        let step9 = later.skip()
        #expect(!step9, "nothing left to skip")
        let step10 = later.finishOpening()
        #expect(!step10)
        let step11 = later.add()
        #expect(step11)
    }

    @Test("Remembers a seen reveal")
    @MainActor
    func memory() throws {
        let defaults = try #require(UserDefaults(suiteName: "reveal-\(UUID())"))
        let memory = RevealMemory(defaults: defaults)
        #expect(!memory.hasSeenReveal)
        memory.markSeen()
        #expect(memory.hasSeenReveal)
        #expect(!RevealMemory(defaults: nil).hasSeenReveal)
    }

    @Test("The treasure is out in under 6 seconds, and the calm version has no beam")
    func timing() {
        #expect(RevealTiming.full.tapToTreasure < 6)
        #expect(RevealTiming.calm.tapToTreasure < 6)
        #expect(RevealTiming.calm.beam == nil)
        #expect(RevealTiming.forMotion(reduced: true) == .calm)
        #expect(RevealTiming.forMotion(reduced: false) == .full)
    }

    @Test("Progress eases from 0 to 1 across its range")
    func progress() {
        #expect(RevealTiming.progress(-1, in: 0...1) == 0)
        #expect(RevealTiming.progress(0.5, in: 0...1) == 0.5)
        #expect(RevealTiming.progress(2, in: 0...1) == 1)
        #expect(RevealTiming.progress(1, in: 1...1) == 1)
    }

    @Test("Double Dig! plus repeat taps in the reveal give one treasure")
    @MainActor
    func noDoubleAdd() async throws {
        let model = FamilyModel(store: try await f.makeStore())
        await model.load()
        model.startNewRun()
        let first = await model.recordFind(f.placement, method: .dig)
        let second = await model.recordFind(f.placement, method: .dig)
        #expect(first?.record.id == second?.record.id)

        var flow = RevealFlow()
        var closed = 0
        for _ in 0..<3 { _ = flow.open() }
        _ = flow.finishOpening()
        for _ in 0..<3 where flow.add() { closed += 1 }
        #expect(closed == 1)
        #expect(ChestShelf(records: model.chest).treasureCount == 1)
    }
}

@Suite("My Chest")
struct ChestShelfTests {
    let f = Fixture()

    @Test("Shows the saved copy even after the design is deleted")
    @MainActor
    func savedCopyAfterDelete() async throws {
        let store = try await f.makeStore()
        _ = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)
        _ = try await store.deleteDesign(f.design.id)

        let model = FamilyModel(store: store)
        await model.load()
        let shelf = ChestShelf(records: model.chest)
        #expect(model.data.design(f.design.id) == nil)
        #expect(shelf.treasureCount == 1)
        #expect(shelf.items.first?.look == Fixture.originalLook)
        #expect(shelf.title == "1 treasure")
    }

    @Test("Counts found-again stickers from replays, never extra treasures")
    func stickers() async throws {
        let store = try await f.makeStore()
        _ = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)
        _ = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)
        let (_, data) = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: UUID(),
                                                   method: .parentConfirmed, at: .now)
        let shelf = ChestShelf(records: data.chest(for: f.child.id))
        #expect(shelf.treasureCount == 1)
        #expect(shelf.stickerCount == 2)
        #expect(shelf.items.first?.stickers == 2)
        #expect(shelf.stickerLine == "2 found-again stickers")
        #expect(ChestShelf(records: []).stickerLine == nil)
        #expect(ChestShelf(records: []).title == "0 treasures")
    }

    @Test("Newest find first")
    func order() {
        let old = record(name: "Old", at: Date(timeIntervalSince1970: 100))
        let new = record(name: "New", at: Date(timeIntervalSince1970: 200))
        #expect(ChestShelf(records: [old, new]).items.map(\.look.name) == ["New", "Old"])
    }

    private func record(name: String, at date: Date) -> CollectionRecord {
        CollectionRecord(familyID: f.parent.id, childID: f.child.id, placementID: UUID(), versionID: UUID(),
                         savedCopy: TreasureLook(model: .clam, color: .sea, name: name), foundAt: date,
                         method: .dig, firstRunID: UUID())
    }
}

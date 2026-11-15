import Foundation
import Testing
@testable import Tatchamashay

@Suite("Parents create and place beasts")
@MainActor
struct ParentCreationTests {
    let spot = Coordinate(latitude: 37.7694, longitude: -122.4862)
    let look = TreasureLook(model: .starCompass, color: .blue, sparkles: .rainbow,
                            name: "Snorty Muffin", sound: .snore)

    private func family(persistence: any FamilyPersistence = MemoryPersistence()) async -> FamilyModel {
        let model = FamilyModel(store: LocalFamilyStore(persistence: persistence), isDemo: true)
        await model.load()
        await model.createFamily(parentName: "Dad", pirateName: "Captain E")
        return model
    }

    @Test("A single parent-made treasure is immediately available")
    func singleTreasure() async throws {
        let family = await family()
        #expect(await family.hideTreasure(look, at: spot, hint: "", reviewedAt: .now))
        let design = try #require(family.parentDesigns.first)
        #expect(design.maker == .parent(try #require(family.parent).id))
        #expect(design.current.look == look)
        #expect(family.unfoundPlacements.count == 1)
        #expect(family.chest.isEmpty)
    }

    @Test("A failed placement writes neither a design nor an empty adventure")
    func failedReview() async {
        let family = await family()
        let before = family.data
        #expect(!(await family.hideTreasure(look, at: spot, hint: "", reviewedAt: .now.addingTimeInterval(3_600))))
        #expect(family.data == before)
        #expect(family.errorMessage != nil)
    }

    @Test("A failed disk write keeps all data unchanged; retry adds exactly one beast")
    func failedWrite() async throws {
        let persistence = FlakyPersistence()
        let family = await family(persistence: persistence)
        let before = family.data
        persistence.failNextWrites(1)
        #expect(!(await family.hideTreasure(look, at: spot, hint: "", reviewedAt: .now)))
        #expect(family.data == before)
        #expect(try persistence.read() == before)
        #expect(await family.hideTreasure(look, at: spot, hint: "", reviewedAt: .now))
        #expect(family.data.designs.count == 1)
        #expect(family.mapPlacements.count == 1)
        #expect(family.data.adventures.count == 1)
    }

    @Test("Editing keeps placement identity and saved chest copies")
    func editAfterCollection() async throws {
        let family = await family()
        #expect(await family.hideTreasure(look, at: spot, hint: "Tree", reviewedAt: .now))
        let placement = try #require(family.mapPlacements.first)
        _ = try #require(await family.recordFind(placement, method: .dig))
        var edited = look
        edited.name = "Sleepy Sprout"
        edited.color = .gold
        #expect(await family.hideTreasure(edited, at: spot, hint: "Gate", reviewedAt: .now, editing: placement.designID))
        let design = try #require(family.data.design(placement.designID))
        #expect(design.versions.count == 2)
        #expect(design.version(placement.versionID)?.look == look)
        #expect(family.mapPlacements.map(\.id) == [placement.id])
        #expect(family.mapPlacements.first?.versionID == design.current.id)
        #expect(family.unfoundPlacements.isEmpty)
        #expect(family.chest.first?.savedCopy == look)
    }

    @Test("Legacy child-made drafts can be managed by parents without changing provenance")
    func legacyChildDesign() async throws {
        let fixture = Fixture()
        let store = try await fixture.makeStore()
        let draft = TreasureDesign(familyID: fixture.parent.id, maker: .child(fixture.child.id), look: look)
        _ = try await store.saveDesign(draft)
        let family = FamilyModel(store: store, isDemo: true)
        await family.load()
        #expect(family.parentDesigns.contains { $0.id == draft.id })
        #expect(await family.hideTreasure(look, at: spot, hint: "", reviewedAt: .now, editing: draft.id))
        #expect(family.data.design(draft.id)?.maker == .child(fixture.child.id))
        #expect(family.mapPlacements.contains { $0.designID == draft.id })
    }

    @Test("Draft save creates no placement; editing an unknown ID cannot create a replacement")
    func draftSave() async throws {
        let family = await family()
        let draft = try #require(await family.saveParentDesign(look))
        #expect(family.mapPlacements.isEmpty)
        #expect(family.data.adventures.isEmpty)
        #expect(draft.maker == .parent(try #require(family.parent).id))
        #expect(await family.saveParentDesign(look, editing: UUID()) == nil)
        #expect(family.parentDesigns.count == 1)
    }
}

import Foundation
import RealityKit
import Testing
@testable import Tatchamashay

@Suite("Saved models from another app version")
@MainActor
struct SavedModelCompatibilityTests {
    @Test("An unavailable model keeps its exact saved ID and isn't offered for new beasts")
    func preservesUnknownID() throws {
        let model = try JSONDecoder().decode(BuiltInModel.self, from: Data(#""vine-dog""#.utf8))
        #expect(model == .unavailable("vine-dog"))
        #expect(model.rawValue == "vine-dog")
        #expect(!BuiltInModel.allCases.contains(model))
        #expect(TreasureCatalog.bundled.entry(for: model) == nil)
        #expect(try JSONEncoder().encode(model) == Data(#""vine-dog""#.utf8))
    }

    @Test("A family with an unavailable beast opens and later saves keep every ID and collected look")
    func familyStillLoadsAndSaves() async throws {
        let fixture = Fixture()
        let url = temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let store = try await fixture.makeStore(persistence: JSONFilePersistence(url: url))
        _ = try await store.recordFind(child: fixture.child.id, placement: fixture.placement.id,
                                       run: UUID(), method: .parentConfirmed, at: .now)
        // Model IDs added by another build appear in both design versions and saved chest copies.
        let oldFile = try String(contentsOf: url, encoding: .utf8)
            .replacingOccurrences(of: #""model":"crown""#, with: #""model":"vine-dog""#)
        try Data(oldFile.utf8).write(to: url, options: .atomic)

        let family = FamilyModel(store: LocalFamilyStore(persistence: JSONFilePersistence(url: url)), isDemo: true)
        await family.load()
        #expect(family.errorMessage == nil)
        #expect(family.parent?.id == fixture.parent.id)
        #expect(family.child?.id == fixture.child.id)
        #expect(family.mapPlacements.map(\.id) == [fixture.placement.id])
        #expect(family.chest.count == 1)
        let before = family.data
        #expect(before.designs.first?.current.look.model == .unavailable("vine-dog"))
        #expect(before.collections.first?.savedCopy.model == .unavailable("vine-dog"))

        await family.renameChild("Captain Pearl")
        #expect(family.errorMessage == nil)
        let reopened = try await LocalFamilyStore(persistence: JSONFilePersistence(url: url)).load()
        #expect(reopened.parent == before.parent)
        #expect(reopened.children.first?.id == fixture.child.id)
        #expect(reopened.children.first?.pirateName == "Captain Pearl")
        #expect(reopened.designs == before.designs)
        #expect(reopened.placements == before.placements)
        #expect(reopened.collections == before.collections)
        #expect(reopened.adventures == before.adventures)
    }

    @Test("An unavailable model uses a playable shape without replacing its saved look")
    func unavailableModelRendersFallback() async {
        let look = TreasureLook(model: .unavailable("vine-dog"), color: .sea, name: "Saved Beast")
        let loaded = await TreasureEntities.treasure(look)
        #expect(loaded.isFallback)
        #expect(loaded.entry == nil)
        #expect(!loaded.entity.children.isEmpty)
        #expect(look.model.rawValue == "vine-dog")
    }
}

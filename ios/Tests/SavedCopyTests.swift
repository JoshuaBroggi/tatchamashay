import Foundation
import Testing
@testable import Tatchamashay

@Suite("The chest keeps a saved copy")
struct SavedCopyTests {
    let f = Fixture()

    @Test("Editing a treasure after it was found doesn't change the chest")
    func editAfterFind() async throws {
        let url = temporaryFileURL()
        let store = try await f.makeStore(persistence: JSONFilePersistence(url: url))
        _ = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)

        var edited = f.design
        let newVersion = edited.edit(to: TreasureLook(model: .orb, color: .storm, name: "Renamed", story: "Changed."))
        let data = try await store.saveDesign(edited)

        #expect(newVersion.number == 2)
        #expect(data.design(f.design.id)?.versions.count == 2, "an edit adds a version")
        #expect(data.design(f.design.id)?.version(f.design.current.id)?.look == Fixture.originalLook,
                "old versions never change")
        let record = try #require(data.chest(for: f.child.id).first)
        #expect(record.savedCopy == Fixture.originalLook)
        #expect(record.versionID == f.design.current.id)

        let reopened = try await LocalFamilyStore(persistence: JSONFilePersistence(url: url)).load()
        #expect(reopened.chest(for: f.child.id).first?.savedCopy == Fixture.originalLook)
    }

    @Test("Deleting a treasure after it was found doesn't change the chest")
    func deleteAfterFind() async throws {
        let url = temporaryFileURL()
        let store = try await f.makeStore(persistence: JSONFilePersistence(url: url))
        _ = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)

        let data = try await store.deleteDesign(f.design.id)

        #expect(data.design(f.design.id) == nil)
        #expect(data.placements.isEmpty, "its placements go too")
        #expect(data.adventure(f.adventure.id)?.placementIDs.isEmpty == true)
        #expect(data.chest(for: f.child.id).first?.savedCopy == Fixture.originalLook)

        let reopened = try await LocalFamilyStore(persistence: JSONFilePersistence(url: url)).load()
        #expect(reopened.chest(for: f.child.id).first?.savedCopy == Fixture.originalLook)
    }

    @Test("Removing a placement after it was found doesn't change the chest")
    func removePlacementAfterFind() async throws {
        let store = try await f.makeStore()
        _ = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)
        let data = try await store.removePlacement(f.placement.id)
        #expect(data.chest(for: f.child.id).first?.savedCopy == Fixture.originalLook)
    }

    @Test("A find is recorded against the version that was placed")
    func findUsesPlacedVersion() async throws {
        let store = try await f.makeStore()
        var edited = f.design
        edited.edit(to: TreasureLook(model: .gem, color: .sea, name: "Newer"))
        _ = try await store.saveDesign(edited)

        let (result, _) = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)
        #expect(result.record.savedCopy == Fixture.originalLook, "the placement hides version 1, so that's what's found")
    }
}

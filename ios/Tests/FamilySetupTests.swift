import Foundation
import Testing
@testable import Tatchamashay

@Suite("First-launch crew setup")
@MainActor
struct FamilySetupTests {
    @Test("Both crew names and their relationship survive reopening the family file")
    func namesPersistTogether() async throws {
        let url = temporaryFileURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let family = FamilyModel(store: LocalFamilyStore(persistence: JSONFilePersistence(url: url)), isDemo: true)
        await family.load()
        await family.createFamily(parentName: "Aunt Jo", pirateName: "Captain Pearl")
        #expect(family.errorMessage == nil)
        let saved = family.data

        let reopened = FamilyModel(store: LocalFamilyStore(persistence: JSONFilePersistence(url: url)), isDemo: true)
        await reopened.load()
        #expect(reopened.data == saved)
        #expect(reopened.parent?.displayName == "Aunt Jo")
        #expect(reopened.child?.pirateName == "Captain Pearl")
        #expect(reopened.child?.parentID == reopened.parent?.id)
        #expect(reopened.isLoaded)
    }

    @Test("A failed setup save changes nothing and can be retried with the same names")
    func failedSaveCanRetry() async throws {
        let persistence = FlakyPersistence()
        let family = FamilyModel(store: LocalFamilyStore(persistence: persistence), isDemo: true)
        await family.load()
        let before = family.data
        persistence.failNextWrites(1)
        await family.createFamily(parentName: "Aunt Jo", pirateName: "Captain Pearl")
        #expect(family.errorMessage != nil)
        #expect(family.data == before)
        #expect(try persistence.read() == nil)

        await family.createFamily(parentName: "Aunt Jo", pirateName: "Captain Pearl")
        #expect(family.errorMessage == nil)
        #expect(family.parent?.displayName == "Aunt Jo")
        #expect(family.children.count == 1)
        #expect(family.child?.pirateName == "Captain Pearl")
        #expect(try persistence.read() == family.data)
        #expect(persistence.writes == 1)
    }
}

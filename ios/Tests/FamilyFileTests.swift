import Foundation
import Testing
@testable import Tatchamashay

/// The family file must survive updates, crashes and damage.
struct FamilyFileTests {
    private let folder: URL
    private var url: URL { folder.appending(path: "family.json") }
    private var file: JSONFilePersistence { JSONFilePersistence(url: url) }

    init() throws {
        folder = FileManager.default.temporaryDirectory.appending(path: "family-file-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    }

    private func family(named name: String) -> FamilyData {
        let parent = ParentAccount(displayName: name)
        var data = FamilyData()
        data.parent = parent
        data.children = [ChildProfile(parentID: parent.id, pirateName: "Captain E")]
        return data
    }

    @Test func aFileWithoutAVersionLoadsAsVersionOne() throws {
        var json = try #require(JSONSerialization.jsonObject(with: JSONEncoder.family.encode(family(named: "Old"))) as? [String: Any])
        json["schemaVersion"] = nil
        json["collections"] = nil
        try JSONSerialization.data(withJSONObject: json).write(to: url)

        let loaded = try #require(try file.read())
        #expect(loaded.schemaVersion == 1)
        #expect(loaded.parent?.displayName == "Old")
        #expect(loaded.children.count == 1)
    }

    @Test func anOlderFileIsMigratedStepByStep() throws {
        try file.write(family(named: "Before"))
        let migrations = FamilyMigrations(currentVersion: 3, steps: [
            1: { json in
                var parent = json["parent"] as? [String: Any] ?? [:]
                parent["displayName"] = "After"
                json["parent"] = parent
            },
            2: { json in json["children"] = [] },
        ])
        let loaded = try #require(try JSONFilePersistence(url: url, migrations: migrations).read())
        #expect(loaded.schemaVersion == 3)
        #expect(loaded.parent?.displayName == "After")
        #expect(loaded.children.isEmpty)
    }

    @Test func aFileFromANewerAppIsRefusedAndLeftAlone() throws {
        let newer = Data(#"{"schemaVersion": 99}"#.utf8)
        try newer.write(to: url)
        #expect(throws: FamilyFileError.newerVersion(found: 99, supported: 1)) { try file.read() }
        #expect(try Data(contentsOf: url) == newer)
        #expect(file.keptAside.isEmpty)
    }

    @Test func aDamagedFileRecoversFromTheBackup() throws {
        try file.write(family(named: "First"))
        try file.write(family(named: "Second"))
        let garbage = Data("not json".utf8)
        try garbage.write(to: url)

        let loaded = try #require(try file.read())
        #expect(loaded.parent?.displayName == "First", "the backup holds the save before the last one")
        // The damaged file is kept, and the family file is good again.
        #expect(file.keptAside.count == 1)
        #expect(try Data(contentsOf: file.keptAside[0]) == garbage)
        #expect(try file.read()?.parent?.displayName == "First")
    }

    @Test func aMissingFileRecoversFromTheBackup() throws {
        try file.write(family(named: "First"))
        try file.write(family(named: "Second"))
        try FileManager.default.removeItem(at: url)
        #expect(try file.read()?.parent?.displayName == "First")
    }

    @Test func whenBothAreDamagedTheyAreKeptAsideAndTheErrorStays() async throws {
        let garbage = Data("not json".utf8)
        try garbage.write(to: url)
        try Data("also bad".utf8).write(to: file.backupURL)

        #expect(throws: FamilyFileError.self) { try file.read() }
        let kept = file.keptAside
        #expect(kept.count == 2)
        #expect(try kept.contains { try Data(contentsOf: $0) == garbage })
        // Not a silently empty family, on this launch or the next.
        #expect(throws: FamilyFileError.damaged(keptAt: kept)) { try file.read() }
        let store = LocalFamilyStore(persistence: file)
        await #expect(throws: FamilyFileError.self) { try await store.load() }
        await #expect(throws: FamilyFileError.self) {
            let parent = ParentAccount(displayName: "New")
            _ = try await store.createFamily(parent: parent, child: ChildProfile(parentID: parent.id, pirateName: "X"))
        }

        // The grown-up can choose to start again; the damaged files are still there.
        try file.startOver()
        #expect(try file.read() == FamilyData())
        #expect(file.keptAside == kept)
    }

    @Test func aBrandNewPhoneHasNoFamilyAndNoError() throws {
        #expect(try file.read() == nil)
    }

    @Test func aFailedSaveLeavesThePreviousFileIntact() throws {
        try file.write(family(named: "Safe"))
        let before = try Data(contentsOf: url)
        // Nothing can be written into a read-only folder.
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: folder.path(percentEncoded: false))
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: folder.path(percentEncoded: false)) }

        #expect(throws: (any Error).self) { try file.write(family(named: "Lost")) }
        #expect(try Data(contentsOf: url) == before)
        #expect(try file.read()?.parent?.displayName == "Safe")
    }

    @Test func aDamagedFileNeverReplacesAGoodBackup() throws {
        try file.write(family(named: "First"))
        try file.write(family(named: "Second"))
        try Data("not json".utf8).write(to: url)
        try file.write(family(named: "Third"))
        let backup = try JSONDecoder.family.decode(FamilyData.self, from: Data(contentsOf: file.backupURL))
        #expect(backup.parent?.displayName == "First")
    }

    @Test func theFamilyFileIsIncludedInDeviceBackups() throws {
        try file.write(family(named: "First"))
        try file.write(family(named: "Second"))
        for saved in [url, file.backupURL] {
            let excluded = try saved.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup
            #expect(excluded != true)
        }
        #expect(JSONFilePersistence.defaultURL.path().contains("Application%20Support")
                || JSONFilePersistence.defaultURL.path().contains("Application Support"))
    }
}

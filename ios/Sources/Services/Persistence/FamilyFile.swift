import Foundation

/// Why the family file couldn't be opened. The app shows these; it never falls back to an empty family.
enum FamilyFileError: Error, Equatable {
    /// Neither the family file nor its backup could be read. The damaged files were kept at `keptAt`.
    case damaged(keptAt: [URL])
    /// The file was saved by a newer version of the app. It is left untouched.
    case newerVersion(found: Int, supported: Int)
}

/// Brings an older saved file up to the current format, one version at a time, before it is decoded.
struct FamilyMigrations: Sendable {
    typealias Step = @Sendable (inout [String: Any]) throws -> Void

    static let currentVersion = 1
    /// Add `[N: step]` here to turn a version N file into version N + 1, and bump `currentVersion`.
    static let standard = FamilyMigrations(currentVersion: currentVersion, steps: [:])

    let currentVersion: Int
    /// Keyed by the version a step upgrades from.
    let steps: [Int: Step]

    /// A file with no version is version 1.
    func migrate(_ raw: Data) throws -> Data {
        guard var json = try JSONSerialization.jsonObject(with: raw) as? [String: Any] else {
            throw CocoaError(.coderReadCorrupt)
        }
        var version = json["schemaVersion"] as? Int ?? 1
        guard version >= 1 else { throw CocoaError(.coderReadCorrupt) }
        guard version <= currentVersion else {
            throw FamilyFileError.newerVersion(found: version, supported: currentVersion)
        }
        let found = version
        while version < currentVersion {
            guard let step = steps[version] else { throw CocoaError(.coderReadCorrupt) }
            try step(&json)
            version += 1
        }
        if found == currentVersion, json["schemaVersion"] != nil { return raw }
        json["schemaVersion"] = version
        return try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
    }
}

/// The family file in Application Support.
///
/// - Every save is atomic, and first copies the last good file to `family.json.bak`.
/// - If the file is missing or damaged, the backup is used and put back in its place.
/// - If neither can be read, the damaged files are moved aside (never deleted) and `read` throws
///   `FamilyFileError.damaged` until `startOver()` is called.
/// - Application Support is part of the phone's iCloud and computer backups; nothing here opts out.
struct JSONFilePersistence: FamilyPersistence {
    let url: URL
    var migrations = FamilyMigrations.standard

    static var defaultURL: URL {
        URL.applicationSupportDirectory.appending(path: "Family").appending(path: "family.json")
    }

    var backupURL: URL { url.appendingPathExtension("bak") }
    private var folder: URL { url.deletingLastPathComponent() }
    private static let asideMarker = ".damaged-"

    /// Damaged files that were moved aside, oldest first.
    var keptAside: [URL] {
        let all = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        return all.filter { $0.lastPathComponent.contains(Self.asideMarker) }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    func read() throws -> FamilyData? {
        let main = attempt(url)
        if case .good(let data, _) = main { return data }
        if case .newer(let error) = main { throw error }

        let backup = attempt(backupURL)
        if case .good(let data, let raw) = backup {
            // Put the backup back as the family file; the damaged one is kept, not deleted.
            if case .damaged = main { _ = try moveAside(url) }
            try? raw.write(to: url, options: Self.writeOptions)
            return data
        }
        if case .newer(let error) = backup { throw error }

        if case .damaged = main { _ = try moveAside(url) }
        if case .damaged = backup { _ = try moveAside(backupURL) }
        let kept = keptAside
        // Nothing saved yet, and nothing ever went wrong: a new family.
        if kept.isEmpty { return nil }
        throw FamilyFileError.damaged(keptAt: kept)
    }

    func write(_ data: FamilyData) throws {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let encoded = try JSONEncoder.family.encode(data)
        // Only a file that still reads correctly becomes the backup, so a good backup is never
        // replaced by a damaged one.
        if case .good(_, let previous) = attempt(url) {
            try? previous.write(to: backupURL, options: Self.writeOptions)
        }
        try encoded.write(to: url, options: Self.writeOptions)
    }

    /// After `FamilyFileError.damaged`: begin an empty family. The damaged files stay where they are.
    func startOver() throws {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try JSONEncoder.family.encode(FamilyData()).write(to: url, options: Self.writeOptions)
    }

    #if DEBUG
    /// For tests and `-resetFamily` only: removes the family file, its backup and anything kept aside.
    func eraseEverything() {
        for file in [url, backupURL] + keptAside { try? FileManager.default.removeItem(at: file) }
    }
    #endif

    private static let writeOptions: Data.WritingOptions = [.atomic, .completeFileProtectionUntilFirstUserAuthentication]

    private enum Attempt {
        case missing
        case good(FamilyData, raw: Data)
        case damaged
        case newer(FamilyFileError)
    }

    private func attempt(_ file: URL) -> Attempt {
        guard FileManager.default.fileExists(atPath: file.path(percentEncoded: false)) else { return .missing }
        do {
            let raw = try Data(contentsOf: file)
            let data = try JSONDecoder.family.decode(FamilyData.self, from: migrations.migrate(raw))
            return .good(data, raw: raw)
        } catch let error as FamilyFileError {
            return .newer(error)
        } catch {
            return .damaged
        }
    }

    private func moveAside(_ file: URL) throws -> URL {
        let stamp = Int(Date.now.timeIntervalSince1970 * 1000)
        let aside = folder.appending(path: "\(file.lastPathComponent)\(Self.asideMarker)\(stamp)-\(UUID().uuidString.prefix(8))")
        try FileManager.default.moveItem(at: file, to: aside)
        return aside
    }
}

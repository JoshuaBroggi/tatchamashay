import CoreLocation
import Foundation
import Observation

/// Holds every treasure on the map and which ones this player has collected.
///
/// For now everything is saved on the device. The shared, everyone-sees-the-same-map version
/// replaces `load()` and `save()` with a server (for example a CloudKit public database).
@Observable
final class TreasureStore {
    /// How close, in meters, a player must be to dig up a treasure.
    static let collectRadius: CLLocationDistance = 40

    private(set) var treasures: [Treasure] = []
    private(set) var collectedIDs: Set<UUID> = []

    var collected: [Treasure] {
        treasures.filter { collectedIDs.contains($0.id) }
    }

    init() { load() }

    func isCollected(_ treasure: Treasure) -> Bool {
        collectedIDs.contains(treasure.id)
    }

    func canCollect(_ treasure: Treasure, from location: CLLocation?) -> Bool {
        guard let location, !isCollected(treasure) else { return false }
        return location.distance(from: treasure.location) <= Self.collectRadius
    }

    func collect(_ treasure: Treasure) {
        collectedIDs.insert(treasure.id)
        save()
    }

    func add(_ treasure: Treasure) {
        treasures.append(treasure)
        save()
    }

    // MARK: - Saving on device

    private struct SaveFile: Codable {
        var treasures: [Treasure]
        var collectedIDs: Set<UUID>
    }

    private var saveURL: URL {
        URL.documentsDirectory.appending(path: "treasures.json")
    }

    private func load() {
        guard let data = try? Data(contentsOf: saveURL),
              let file = try? JSONDecoder().decode(SaveFile.self, from: data) else { return }
        treasures = file.treasures
        collectedIDs = file.collectedIDs
    }

    private func save() {
        let file = SaveFile(treasures: treasures, collectedIDs: collectedIDs)
        try? JSONEncoder().encode(file).write(to: saveURL, options: .atomic)
    }

    // MARK: - Creator model files

    static var modelsDirectory: URL {
        let dir = URL.documentsDirectory.appending(path: "Models")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// Copies a USDZ file the creator picked into the app, returning the stored file name.
    static func importModel(from url: URL) throws -> String {
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        let name = "\(UUID().uuidString).usdz"
        try FileManager.default.copyItem(at: url, to: modelsDirectory.appending(path: name))
        return name
    }
}

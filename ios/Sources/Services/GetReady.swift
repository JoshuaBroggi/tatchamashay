import AVFoundation
import Foundation
import MapKit

// **Get ready** (PLAN.md, "Offline"): before leaving, check that everything the adventure needs is on
// the phone and loads, and check the map separately. Everything is bundled or saved on the device,
// so "downloading" means proving it all opens without the network.

/// One line of the Get ready list.
struct ReadyItem: Identifiable, Hashable, Sendable {
    enum Status: Hashable, Sendable {
        case checking
        case ok
        /// Fine to go, but the grown-up should know.
        case warning(String)
        /// Must be fixed before the outing.
        case problem(String)
    }

    let id: String
    let title: String
    var status: Status

    var blocksReady: Bool {
        switch status {
        case .checking, .problem: true
        case .ok, .warning: false
        }
    }
}

/// The finished list. Ready only when nothing is still checking and nothing has a problem; the map
/// can only warn, since Apple Maps can't promise offline tiles.
struct ReadyReport: Hashable, Sendable {
    var items: [ReadyItem]

    var isReady: Bool { !items.isEmpty && !items.contains(where: \.blocksReady) }
    var isChecking: Bool { items.contains { $0.status == .checking } }
    var problems: [ReadyItem] {
        items.filter { if case .problem = $0.status { true } else { false } }
    }

    /// Always shown, whatever the map check says.
    static let mapWarning = "Without signal the map may be blank. Spots, clues, Dig! and We found it still work."
}

/// What Get ready loads. The app uses the real files and maps; tests swap in their own.
@MainActor
protocol ReadyLoaders {
    /// Whether the real 3D model loads (not the drawn stand-in).
    func modelLoads(_ model: BuiltInModel) async -> Bool
    func chestLoads() async -> Bool
    func soundLoads(_ effect: SoundEffect) -> Bool
    /// Whether map tiles for the area load right now.
    func mapLoads(_ area: PlayArea) async -> Bool
}

@MainActor
struct BundledReadyLoaders: ReadyLoaders {
    var catalog: TreasureCatalog = .bundled

    func modelLoads(_ model: BuiltInModel) async -> Bool {
        let look = TreasureLook(model: model, color: model.defaultColor, name: model.displayName)
        return await !TreasureEntities.treasure(look, catalog: catalog).isFallback
    }

    func chestLoads() async -> Bool { await TreasureEntities.chest(catalog: catalog) != nil }

    func soundLoads(_ effect: SoundEffect) -> Bool {
        guard let url = catalog.soundURL(for: effect) else { return false }
        return (try? AVAudioPlayer(contentsOf: url)) != nil
    }

    func mapLoads(_ area: PlayArea) async -> Bool {
        let options = MKMapSnapshotter.Options()
        options.region = MKCoordinateRegion(center: area.center.clCoordinate,
                                            latitudinalMeters: area.radiusMeters * 2,
                                            longitudinalMeters: area.radiusMeters * 2)
        options.size = CGSize(width: 300, height: 300)
        do {
            _ = try await MKMapSnapshotter(options: options).start()
            return true
        } catch {
            return false
        }
    }
}

@MainActor
enum GetReady {
    /// The items, in the order shown, before anything is checked.
    static func items() -> [ReadyItem] {
        [
            ReadyItem(id: "spots", title: "Treasure spots", status: .checking),
            ReadyItem(id: "treasures", title: "Treasures", status: .checking),
            ReadyItem(id: "sounds", title: "Sounds", status: .checking),
            ReadyItem(id: "story", title: "The guide's words", status: .checking),
            ReadyItem(id: "map", title: "Map of the area", status: .checking),
        ]
    }

    /// Runs every check, reporting each item as it finishes.
    static func run(adventure: Adventure, data: FamilyData, library: StoryLibrary,
                    pirateName: String?, grownUp: String?, loaders: some ReadyLoaders,
                    update: (ReadyItem) -> Void) async {
        let placements = adventure.placementIDs.compactMap { data.placement($0) }

        update(ReadyItem(id: "spots", title: "Treasure spots", status: spots(adventure, placements)))

        var models: [BuiltInModel] = []
        for placement in placements {
            if let model = data.design(placement.designID)?.version(placement.versionID)?.look.model,
               !models.contains(model) { models.append(model) }
        }
        var broken: [String] = []
        if await !loaders.chestLoads() { broken.append("the chest") }
        for model in models where await !loaders.modelLoads(model) { broken.append(model.displayName) }
        update(ReadyItem(id: "treasures", title: "Treasures", status: broken.isEmpty ? .ok
            : .problem("Couldn't open \(broken.joined(separator: ", ")). Try reinstalling the app.")))

        let quiet = SoundEffect.allCases.filter { !loaders.soundLoads($0) }
        update(ReadyItem(id: "sounds", title: "Sounds", status: quiet.isEmpty ? .ok
            : .problem("Some sounds are missing. The hunt still works, just quieter.")))

        update(ReadyItem(id: "story", title: "The guide's words",
                         status: story(adventure, placements, library: library, pirateName: pirateName, grownUp: grownUp)))

        let mapStatus: ReadyItem.Status
        if let area = adventure.playArea ?? placements.first.map({ PlayArea(center: $0.spot) }) {
            mapStatus = await loaders.mapLoads(area)
                ? .warning("The map loaded. " + ReadyReport.mapWarning)
                : .warning("Couldn't load the map just now. " + ReadyReport.mapWarning)
        } else {
            mapStatus = .warning(ReadyReport.mapWarning)
        }
        update(ReadyItem(id: "map", title: "Map of the area", status: mapStatus))
    }

    static func spots(_ adventure: Adventure, _ placements: [ChestPlacement], now: Date = .now) -> ReadyItem.Status {
        if placements.count < adventure.placementIDs.count { return .problem("A treasure spot is missing. Hide it again.") }
        if case .needsMore(let n) = adventure.readiness {
            return .problem("Hide \(n) more \(n == 1 ? "treasure" : "treasures") first.")
        }
        if placements.contains(where: { $0.reviewedAt > now }) { return .problem("A spot hasn't been checked on the map.") }
        if placements.contains(where: { $0.hint.trimmed.isEmpty }) { return .warning("A treasure has no clue. You'll guide that one.") }
        return .ok
    }

    /// The guide, the story's lines, and every clue fill with no braces left over.
    static func story(_ adventure: Adventure, _ placements: [ChestPlacement], library: StoryLibrary,
                      pirateName: String?, grownUp: String?) -> ReadyItem.Status {
        let guide = adventure.guideID.flatMap(library.guide) ?? library.guides.first
        guard let guide else { return .problem("The guide's lines are missing. Try reinstalling the app.") }
        let context = StoryContext(pirateName: pirateName, grownUp: grownUp)
        for moment in [GuideMoment.greeting, .hint, .reveal, .finale]
        where guide.group(moment) != nil && context.fill(guide.group(moment)?.say ?? []).isEmpty {
            return .problem("The guide can't say its \(moment.rawValue.replacingOccurrences(of: "_", with: " ")) line. Check your pirate's name.")
        }
        if let storyID = adventure.storyID {
            guard let story = library.adventure(storyID) else {
                return .problem("This adventure's story is missing. Try reinstalling the app.")
            }
            for placement in placements {
                guard let id = placement.storyTreasureID else { continue }
                guard story.treasure(id) != nil else { return .problem("A treasure's story line is missing.") }
            }
        }
        if placements.contains(where: { $0.hint.contains("{") || $0.hint.contains("}") }) {
            return .problem("A clue isn't finished. Fill in its blank.")
        }
        return .ok
    }
}

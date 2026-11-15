import AVFoundation
import Foundation

/// Checks bundled assets automatically in parent controls. No story or network is required to play.
@MainActor
protocol AssetLoaders {
    func modelLoads(_ model: BuiltInModel) async -> Bool
    func chestLoads() async -> Bool
    func soundLoads(_ effect: SoundEffect) -> Bool
}

@MainActor
struct BundledAssetLoaders: AssetLoaders {
    var catalog: TreasureCatalog = .bundled

    func modelLoads(_ model: BuiltInModel) async -> Bool {
        let look = TreasureLook(model: model, color: model.defaultColor, name: model.displayName)
        let loaded = await TreasureEntities.treasure(look, catalog: catalog)
        return !loaded.isFallback && loaded.hasRequiredAnimation
    }

    func chestLoads() async -> Bool { await TreasureEntities.chest(catalog: catalog) != nil }

    func soundLoads(_ effect: SoundEffect) -> Bool {
        guard let url = catalog.soundURL(for: effect) else { return false }
        return (try? AVAudioPlayer(contentsOf: url)) != nil
    }
}

@MainActor
enum AssetReadiness {
    static let mapNote = "Without signal the map may be blank. Treasure spots, hints and We found it still work."

    static func check(looks: [TreasureLook], loaders: some AssetLoaders = BundledAssetLoaders()) async -> [String] {
        guard !looks.isEmpty else { return [] }
        var problems: [String] = []
        var checkedModels = Set<BuiltInModel>()
        if await !loaders.chestLoads() {
            problems.append("The chest model couldn't open. A simple reveal will still work. Try reinstalling the app to restore it.")
        }
        for look in looks where checkedModels.insert(look.model).inserted {
            if Task.isCancelled { return [] }
            if !BuiltInModel.allCases.contains(look.model) {
                problems.append("A saved beast uses a model from another version. A simple shape will appear; its saved look is kept.")
                continue
            }
            if await !loaders.modelLoads(look.model) {
                problems.append("\(look.model.displayName) couldn't open. A simple shape will appear instead. Try reinstalling the app to restore it.")
            }
        }
        var effects: Set<SoundEffect> = [.dig, .chestCreak, .revealSparkle]
        effects.formUnion(looks.map { SoundEffect($0.sound) })
        if effects.contains(where: { !loaders.soundLoads($0) }) {
            problems.append("Some sounds couldn't open. Finding treasure still works. Try reinstalling the app to restore the sounds.")
        }
        return problems
    }
}

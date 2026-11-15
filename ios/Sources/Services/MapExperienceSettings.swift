import Foundation
import Observation

/// A map presentation with a persistent 2D fallback. These preferences never change treasure or GPS rules.
@MainActor
@Observable
final class MapExperienceSettings {
    static let enabledKey = "map.characterExploration"
    static let default3DKey = "map.characterExploration.default3D"
    static let flatKey = "map.characterExploration.flat"

    var enabled: Bool { didSet { defaults?.set(enabled, forKey: Self.enabledKey) } }
    var useFlatMap: Bool { didSet { defaults?.set(useFlatMap, forKey: Self.flatKey) } }
    var uses3D: Bool { enabled && !useFlatMap }
    private let defaults: UserDefaults?

    init(defaults: UserDefaults? = .standard) {
        self.defaults = defaults
        // Apply the new 3D default once, including phones that ran the earlier opt-in release.
        // Subsequent choices to use 2D or the regular map remain persistent.
        let applyDefault = defaults?.bool(forKey: Self.default3DKey) != true
        enabled = applyDefault ? true : (defaults?.object(forKey: Self.enabledKey) as? Bool ?? true)
        useFlatMap = applyDefault ? false : (defaults?.bool(forKey: Self.flatKey) ?? false)
        if applyDefault {
            defaults?.set(true, forKey: Self.enabledKey)
            defaults?.set(false, forKey: Self.flatKey)
            defaults?.set(true, forKey: Self.default3DKey)
        }
    }
}

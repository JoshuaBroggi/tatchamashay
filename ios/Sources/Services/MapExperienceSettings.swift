import Foundation
import Observation

/// An opt-in map presentation. These preferences never change treasure or GPS rules.
@MainActor
@Observable
final class MapExperienceSettings {
    static let enabledKey = "map.characterExploration"
    static let flatKey = "map.characterExploration.flat"

    var enabled: Bool { didSet { defaults?.set(enabled, forKey: Self.enabledKey) } }
    var useFlatMap: Bool { didSet { defaults?.set(useFlatMap, forKey: Self.flatKey) } }
    var uses3D: Bool { enabled && !useFlatMap }
    private let defaults: UserDefaults?

    init(defaults: UserDefaults? = .standard) {
        self.defaults = defaults
        enabled = defaults?.bool(forKey: Self.enabledKey) ?? false
        useFlatMap = defaults?.bool(forKey: Self.flatKey) ?? false
    }
}

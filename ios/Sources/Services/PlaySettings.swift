import Foundation
import Observation
import UIKit

/// The grown-up's switches for sound, the spoken guide and motion (PLAN.md: "sound and motion can be
/// turned down"). `GuideVoice`, `SoundEffects` and `TreasureModelView` all read these.
@MainActor
@Observable
final class PlaySettings {
    var soundOn: Bool { didSet { save(soundOn, Key.sound) } }
    var spokenGuideOn: Bool { didSet { save(spokenGuideOn, Key.spokenGuide) } }

    /// Turns off idle motions and big animations. Follows the system's Reduce Motion setting until the
    /// grown-up flips it here.
    var reducedMotion: Bool {
        get { reducedMotionChoice ?? systemReduceMotion() }
        set {
            reducedMotionChoice = newValue
            save(newValue, Key.reducedMotion)
        }
    }

    /// For views: pass SwiftUI's `accessibilityReduceMotion`, which updates live when the system
    /// setting changes.
    func reducesMotion(system: Bool) -> Bool { reducedMotionChoice ?? system }

    /// Whether the grown-up has overridden the system Reduce Motion setting.
    var followsSystemMotion: Bool { reducedMotionChoice == nil }

    /// Goes back to following the system Reduce Motion setting.
    func followSystemMotion() {
        reducedMotionChoice = nil
        defaults?.removeObject(forKey: Key.reducedMotion)
    }

    private var reducedMotionChoice: Bool?
    private let defaults: UserDefaults?
    private let systemReduceMotion: @MainActor () -> Bool

    private enum Key {
        static let sound = "play.soundOn"
        static let spokenGuide = "play.spokenGuideOn"
        static let reducedMotion = "play.reducedMotion"
    }

    /// - Parameters:
    ///   - defaults: Where choices are saved. Nil keeps them in memory only (tests, Demo mode).
    ///   - systemReduceMotion: The system setting; injectable for tests.
    init(defaults: UserDefaults? = .standard,
         systemReduceMotion: @escaping @MainActor () -> Bool = { UIAccessibility.isReduceMotionEnabled }) {
        self.defaults = defaults
        self.systemReduceMotion = systemReduceMotion
        soundOn = defaults?.object(forKey: Key.sound) as? Bool ?? true
        spokenGuideOn = defaults?.object(forKey: Key.spokenGuide) as? Bool ?? true
        reducedMotionChoice = defaults?.object(forKey: Key.reducedMotion) as? Bool
    }

    private func save(_ value: Bool, _ key: String) { defaults?.set(value, forKey: key) }
}

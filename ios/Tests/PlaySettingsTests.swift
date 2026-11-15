import Foundation
import Testing
@testable import Tatchamashay

@Suite("Play settings and sound effects")
@MainActor
struct PlaySettingsTests {
    private func freshDefaults() -> UserDefaults {
        let name = "play-settings-\(UUID().uuidString)"
        return UserDefaults(suiteName: name)!
    }

    @Test("Sound starts on; motion follows the system")
    func defaults() {
        let settings = PlaySettings(defaults: freshDefaults(), systemReduceMotion: { true })
        #expect(settings.soundOn)
        #expect(settings.reducedMotion)
        #expect(settings.followsSystemMotion)
        #expect(PlaySettings(defaults: nil, systemReduceMotion: { false }).reducedMotion == false)
    }

    @Test("Choices are saved and survive a restart")
    func persists() {
        let defaults = freshDefaults()
        let settings = PlaySettings(defaults: defaults, systemReduceMotion: { false })
        settings.soundOn = false
        settings.reducedMotion = true
        let reopened = PlaySettings(defaults: defaults, systemReduceMotion: { false })
        #expect(!reopened.soundOn && reopened.reducedMotion)
        #expect(!reopened.followsSystemMotion)
        #expect(reopened.reducesMotion(system: false))

        reopened.followSystemMotion()
        #expect(!PlaySettings(defaults: defaults, systemReduceMotion: { false }).reducedMotion)
        #expect(reopened.reducesMotion(system: true))
    }

    @Test("Sound effects load from the bundle and respect the sound switch")
    func sounds() {
        let settings = PlaySettings(defaults: nil)
        #expect(BundledSoundEffects(settings: settings).available == Set(SoundEffect.allCases))
        let silent = SilentSoundEffects(settings: settings)
        silent.play(.dig)
        settings.soundOn = false
        silent.play(.chestCreak)
        #expect(silent.played == [.dig])
    }
}

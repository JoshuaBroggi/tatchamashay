import AVFoundation
import Foundation
import Testing
@testable import Tatchamashay

@Suite("Play settings, the guide's voice and sound effects")
@MainActor
struct PlaySettingsTests {
    private func freshDefaults() -> UserDefaults {
        let name = "play-settings-\(UUID().uuidString)"
        return UserDefaults(suiteName: name)!
    }

    @Test("Sound and the spoken guide start on; motion follows the system")
    func defaults() {
        let settings = PlaySettings(defaults: freshDefaults(), systemReduceMotion: { true })
        #expect(settings.soundOn)
        #expect(settings.spokenGuideOn)
        #expect(settings.reducedMotion)
        #expect(settings.followsSystemMotion)
        #expect(PlaySettings(defaults: nil, systemReduceMotion: { false }).reducedMotion == false)
    }

    @Test("Choices are saved and survive a restart")
    func persists() {
        let defaults = freshDefaults()
        let settings = PlaySettings(defaults: defaults, systemReduceMotion: { false })
        settings.soundOn = false
        settings.spokenGuideOn = false
        settings.reducedMotion = true
        let reopened = PlaySettings(defaults: defaults, systemReduceMotion: { false })
        #expect(!reopened.soundOn && !reopened.spokenGuideOn && reopened.reducedMotion)
        #expect(!reopened.followsSystemMotion)
        #expect(reopened.reducesMotion(system: false))

        reopened.followSystemMotion()
        #expect(!PlaySettings(defaults: defaults, systemReduceMotion: { false }).reducedMotion)
        #expect(reopened.reducesMotion(system: true))
    }

    @Test("The guide's voice speaks at the guide's rate and goes quiet when turned off")
    func voice() throws {
        let settings = PlaySettings(defaults: nil)
        let voice = SilentGuideVoice(settings: settings)
        let guide = try #require(StoryLibrary.bundled.guide("captain-tumblebeard"))
        voice.speak(["Ahoy!", ""], as: guide)
        #expect(voice.spoken == [.init(line: "Ahoy!", rate: 0.45)])
        settings.spokenGuideOn = false
        voice.speak("Shh", rate: 0.5)
        #expect(voice.spoken.count == 1)
    }

    @Test("tts_rate maps 0.5 to the system's normal speed")
    func rate() {
        #expect(SpeechGuideVoice.utteranceRate(0.5) == AVSpeechUtteranceDefaultSpeechRate)
        #expect(SpeechGuideVoice.utteranceRate(0) == AVSpeechUtteranceMinimumSpeechRate)
        #expect(SpeechGuideVoice.utteranceRate(1) == AVSpeechUtteranceMaximumSpeechRate)
        #expect(SpeechGuideVoice.utteranceRate(0.45) < AVSpeechUtteranceDefaultSpeechRate)
        #expect(SpeechGuideVoice.utteranceRate(7) == AVSpeechUtteranceMaximumSpeechRate)
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

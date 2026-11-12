import AVFoundation
import Foundation

/// Speaks the pirate guide's lines, unless the grown-up turned the spoken guide off in `PlaySettings`.
/// Lines come from `StoryLibrary` already filled in; `rate` is the guide's `tts_rate` (0–1, 0.5 normal).
@MainActor
protocol GuideVoice: AnyObject {
    /// Queues the lines after anything already speaking.
    func speak(_ lines: [String], rate: Double)
    /// Stops at once and drops anything queued.
    func stop()
    var isSpeaking: Bool { get }
}

extension GuideVoice {
    func speak(_ line: String, rate: Double) { speak([line], rate: rate) }

    /// Speaks at the guide's own rate.
    func speak(_ lines: [String], as guide: GuideStory) { speak(lines, rate: guide.voice.ttsRate) }
}

/// The system voice.
@MainActor
final class SpeechGuideVoice: GuideVoice {
    private let synthesizer = AVSpeechSynthesizer()
    private let settings: PlaySettings
    private let voice = AVSpeechSynthesisVoice(language: "en-US")
    private let audio: AudioSessionController
    private let finish = SpeechFinish()

    init(settings: PlaySettings, audio: AudioSessionController = .shared) {
        self.settings = settings
        self.audio = audio
        synthesizer.delegate = finish
        finish.onQuiet = { [weak self] in self?.wentQuiet() }
        audio.onSilence { [weak self] in self?.synthesizer.stopSpeaking(at: .immediate) }
    }

    var isSpeaking: Bool { synthesizer.isSpeaking }

    func speak(_ lines: [String], rate: Double) {
        // During a phone call or while the app isn't in front, the line is dropped, never queued:
        // a stale line must not play later.
        guard settings.spokenGuideOn, lines.contains(where: { !$0.isEmpty }), audio.begin(.voice) else { return }
        for line in lines where !line.isEmpty {
            let utterance = AVSpeechUtterance(string: line)
            utterance.rate = Self.utteranceRate(rate)
            utterance.voice = voice
            utterance.postUtteranceDelay = 0.25
            synthesizer.speak(utterance)
        }
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        audio.end(.voice)
    }

    /// An utterance finished or was cut off. Once the queue is empty, let the audio session rest.
    private func wentQuiet() {
        if !synthesizer.isSpeaking { audio.end(.voice) }
    }

    /// Maps a story `tts_rate` (0–1, 0.5 normal) onto the system's range, where the default is normal.
    nonisolated static func utteranceRate(_ ttsRate: Double) -> Float {
        let clamped = Float(min(max(ttsRate, 0), 1))
        let low = AVSpeechUtteranceMinimumSpeechRate, high = AVSpeechUtteranceMaximumSpeechRate
        let normal = AVSpeechUtteranceDefaultSpeechRate
        return clamped <= 0.5
            ? low + (normal - low) * clamped * 2
            : normal + (high - normal) * (clamped - 0.5) * 2
    }
}

/// Tells `SpeechGuideVoice` when the system voice stops talking.
@MainActor
private final class SpeechFinish: NSObject, AVSpeechSynthesizerDelegate {
    var onQuiet: (@MainActor () -> Void)?

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.onQuiet?() }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in self.onQuiet?() }
    }
}

/// Says nothing and remembers what it was asked to say. For tests, previews and UI tests.
@MainActor
final class SilentGuideVoice: GuideVoice {
    struct Spoken: Equatable {
        var line: String
        var rate: Double
    }

    private(set) var spoken: [Spoken] = []
    private let settings: PlaySettings?

    init(settings: PlaySettings? = nil) { self.settings = settings }

    var isSpeaking: Bool { false }

    func speak(_ lines: [String], rate: Double) {
        if settings?.spokenGuideOn == false { return }
        spoken += lines.filter { !$0.isEmpty }.map { Spoken(line: $0, rate: rate) }
    }

    func stop() {}
}

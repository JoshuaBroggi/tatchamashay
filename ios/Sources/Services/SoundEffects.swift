import AVFoundation
import Foundation

/// Plays the manifest's sound effects, unless the grown-up turned sound off in `PlaySettings`.
@MainActor
protocol SoundEffects: AnyObject {
    func play(_ effect: SoundEffect)
    func stopAll()
}

/// Sound effects from the app bundle, preloaded so the first Dig! plays without a delay.
@MainActor
final class BundledSoundEffects: SoundEffects {
    private let settings: PlaySettings
    private var players: [SoundEffect: AVAudioPlayer] = [:]
    private let audio: AudioSessionController
    private let finish = PlayerFinish()

    init(catalog: TreasureCatalog = .bundled, settings: PlaySettings, audio: AudioSessionController = .shared) {
        self.settings = settings
        self.audio = audio
        finish.onQuiet = { [weak self] in self?.wentQuiet() }
        audio.onSilence { [weak self] in self?.players.values.forEach { $0.stop() } }
        for effect in SoundEffect.allCases {
            guard let url = catalog.soundURL(for: effect),
                  let player = try? AVAudioPlayer(contentsOf: url) else { continue }
            player.delegate = finish
            player.prepareToPlay()
            players[effect] = player
        }
    }

    /// Effects with a file that loaded. A missing one plays nothing.
    var available: Set<SoundEffect> { Set(players.keys) }

    func play(_ effect: SoundEffect) {
        // During a phone call or while the app isn't in front, the effect is dropped.
        guard settings.soundOn, let player = players[effect], audio.begin(.effects) else { return }
        player.currentTime = 0
        player.play()
    }

    func stopAll() {
        players.values.forEach { $0.stop() }
        audio.end(.effects)
    }

    /// An effect finished. Once none is playing, let the audio session rest.
    private func wentQuiet() {
        if !players.values.contains(where: \.isPlaying) { audio.end(.effects) }
    }
}

/// Tells `BundledSoundEffects` when an effect finishes.
@MainActor
private final class PlayerFinish: NSObject, AVAudioPlayerDelegate {
    var onQuiet: (@MainActor () -> Void)?

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in self.onQuiet?() }
    }
}

/// Plays nothing and remembers what it was asked to play. For tests and previews.
@MainActor
final class SilentSoundEffects: SoundEffects {
    private(set) var played: [SoundEffect] = []
    private let settings: PlaySettings?

    init(settings: PlaySettings? = nil) { self.settings = settings }

    func play(_ effect: SoundEffect) {
        if settings?.soundOn == false { return }
        played.append(effect)
    }

    func stopAll() {}
}

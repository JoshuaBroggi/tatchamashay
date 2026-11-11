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

    init(catalog: TreasureCatalog = .bundled, settings: PlaySettings) {
        self.settings = settings
        for effect in SoundEffect.allCases {
            guard let url = catalog.soundURL(for: effect),
                  let player = try? AVAudioPlayer(contentsOf: url) else { continue }
            player.prepareToPlay()
            players[effect] = player
        }
    }

    /// Effects with a file that loaded. A missing one plays nothing.
    var available: Set<SoundEffect> { Set(players.keys) }

    func play(_ effect: SoundEffect) {
        guard settings.soundOn, let player = players[effect] else { return }
        AudioSessionSetup.activate()
        player.currentTime = 0
        player.play()
    }

    func stopAll() {
        players.values.forEach { $0.stop() }
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

/// One audio session for the guide and the effects: plays with the ringer switch on silent (the
/// grown-up's switches in `PlaySettings` are the volume control) and mixes with other audio.
@MainActor
enum AudioSessionSetup {
    private static var active = false

    static func activate() {
        guard !active else { return }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .spokenAudio, options: [.mixWithOthers, .duckOthers])
            try session.setActive(true)
            active = true
        } catch {
            // Sound is a bonus: without a session the hunt still plays, just quietly.
            print("Audio session unavailable: \(error)")
        }
    }
}

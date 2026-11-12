import AVFoundation
import UIKit

/// The phone's audio session, behind a protocol so tests never touch real audio.
@MainActor
protocol AudioSessionDriver: AnyObject {
    /// Sets how the app's audio behaves next to the ringer switch and other apps.
    func configure() throws
    func setActive(_ active: Bool) throws
}

/// The real `AVAudioSession`.
@MainActor
final class SystemAudioSession: AudioSessionDriver {
    func configure() throws {
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
    }

    func setActive(_ active: Bool) throws {
        try AVAudioSession.sharedInstance().setActive(active, options: active ? [] : [.notifyOthersOnDeactivation])
    }
}

/// Who is making sound.
enum AudioUser: Hashable, Sendable {
    case voice, effects
}

/// The one place that sets up the phone's audio for the guide's voice and the sound effects.
///
/// The behaviour, on purpose:
/// - **The grown-up's switches are the volume control, not the ringer switch.** The session is
///   `.playback`, so the guide and effects play even with the ringer switch on silent, but only
///   while the matching switch in `PlaySettings` is on (`GuideVoice` and `SoundEffects` check it
///   before asking for the session). With the switches off the session is never touched, so the
///   app stays silent and other apps' audio is left alone.
/// - **Other audio ducks, then comes back.** Music or a podcast gets quieter while the guide or an
///   effect plays (`.duckOthers`). When nothing is playing the session is switched off with
///   `notifyOthersOnDeactivation`, so the other app returns to full volume.
/// - **A phone call, Siri or an alarm stops everything.** Speech and effects stop at once and
///   whatever was queued is dropped. Anything asked for during the interruption is dropped too.
///   Afterwards the next new line or effect plays normally; nothing old is replayed.
/// - **Headphones or a speaker going away stops everything**, so the guide doesn't suddenly shout
///   from the phone. The next new line plays on the new output.
/// - **Leaving the app or locking the screen stops everything**, the same as an interruption, until
///   the app is in front again.
@MainActor
final class AudioSessionController {
    /// The app's controller, on the real audio session.
    static let shared = AudioSessionController(driver: SystemAudioSession(), observesSystem: true)

    private let driver: any AudioSessionDriver
    private var configured = false
    private var playing: Set<AudioUser> = []
    private var silencers: [@MainActor () -> Void] = []
    private var interrupted = false
    private var inBackground = false

    /// Whether the session is switched on right now.
    private(set) var isActive = false

    /// True during a phone call (or similar) and while the app isn't in front. Nothing may play.
    var isSuspended: Bool { interrupted || inBackground }

    /// - Parameter observesSystem: Listen for the system's interruption, output-change and
    ///   app-lifecycle notifications. Tests leave it off and call the handlers themselves.
    init(driver: any AudioSessionDriver, observesSystem: Bool = false) {
        self.driver = driver
        if observesSystem { observeSystem() }
    }

    /// Registers how to stop one source of sound at once. Called when sound has to stop.
    func onSilence(_ stop: @escaping @MainActor () -> Void) { silencers.append(stop) }

    /// Asks to make sound. False means stay silent (a call is in progress, the app isn't in front,
    /// or the session couldn't start); the caller must drop the line or effect, not queue it.
    @discardableResult
    func begin(_ user: AudioUser) -> Bool {
        guard !isSuspended else { return false }
        if !isActive {
            do {
                if !configured {
                    try driver.configure()
                    configured = true
                }
                try driver.setActive(true)
                isActive = true
            } catch {
                // Sound is a bonus: without a session the hunt still plays, just quietly.
                print("Audio session unavailable: \(error)")
                return false
            }
        }
        playing.insert(user)
        return true
    }

    /// The user has gone quiet. Once nobody is playing, the session is switched off so other apps'
    /// audio returns to full volume.
    func end(_ user: AudioUser) {
        playing.remove(user)
        if playing.isEmpty { deactivate() }
    }

    // MARK: What the system tells us

    /// A phone call, Siri or an alarm took the audio. The system has already switched the session off.
    func interruptionBegan() {
        interrupted = true
        isActive = false
        silence()
    }

    func interruptionEnded() { interrupted = false }

    /// Headphones were unplugged or a speaker disconnected.
    func outputRemoved() { silence() }

    /// The app left the screen or the screen locked.
    func enteredBackground() {
        inBackground = true
        silence()
    }

    func becameActive() { inBackground = false }

    // MARK: Private

    private func silence() {
        silencers.forEach { $0() }
        playing.removeAll()
        deactivate()
    }

    private func deactivate() {
        guard isActive else { return }
        do {
            try driver.setActive(false)
            isActive = false
        } catch {
            // Something is still finishing. The session stays on; the next quiet moment tries again.
            print("Audio session still busy: \(error)")
        }
    }

    private func observeSystem() {
        let center = NotificationCenter.default
        center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            let began = raw.flatMap(AVAudioSession.InterruptionType.init(rawValue:)) == .began
            MainActor.assumeIsolated {
                if began { self?.interruptionBegan() } else { self?.interruptionEnded() }
            }
        }
        center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
            let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
            let removed = raw.flatMap(AVAudioSession.RouteChangeReason.init(rawValue:)) == .oldDeviceUnavailable
            MainActor.assumeIsolated {
                if removed { self?.outputRemoved() }
            }
        }
        center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.enteredBackground() }
        }
        center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.becameActive() }
        }
    }
}

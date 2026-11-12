import Foundation
import Testing
@testable import Tatchamashay

/// Stands in for the phone's audio session and remembers what it was asked to do.
@MainActor
final class FakeAudioSession: AudioSessionDriver {
    struct Busy: Error {}

    private(set) var configures = 0
    private(set) var activations: [Bool] = []
    var failsToActivate = false

    func configure() throws { configures += 1 }

    func setActive(_ active: Bool) throws {
        if active, failsToActivate { throw Busy() }
        activations.append(active)
    }
}

@Suite("The phone's audio session")
@MainActor
struct AudioSessionControllerTests {
    let session = FakeAudioSession()

    @Test("The session switches on for sound and off again once everything is quiet")
    func activatesAndRests() {
        let audio = AudioSessionController(driver: session)
        #expect(audio.begin(.voice))
        #expect(audio.begin(.effects))
        #expect(session.configures == 1)
        #expect(session.activations == [true])

        audio.end(.voice)
        #expect(audio.isActive)
        audio.end(.effects)
        #expect(!audio.isActive)
        #expect(session.activations == [true, false])

        #expect(audio.begin(.effects))
        #expect(session.configures == 1)
        #expect(session.activations == [true, false, true])
    }

    @Test("With the grown-up's switches off the session is never touched")
    func switchesOffStaySilent() {
        let settings = PlaySettings(defaults: nil, systemReduceMotion: { false })
        settings.soundOn = false
        settings.spokenGuideOn = false
        let audio = AudioSessionController(driver: session)
        BundledSoundEffects(settings: settings, audio: audio).play(.dig)
        SpeechGuideVoice(settings: settings, audio: audio).speak("Ahoy!", rate: 0.5)
        #expect(session.configures == 0)
        #expect(session.activations.isEmpty)
        #expect(!audio.isActive)
    }

    @Test("A phone call stops everything, drops what is asked meanwhile, and replays nothing after")
    func interruption() {
        let audio = AudioSessionController(driver: session)
        var stops = 0
        audio.onSilence { stops += 1 }
        #expect(audio.begin(.voice))

        audio.interruptionBegan()
        #expect(stops == 1)
        #expect(!audio.isActive)
        #expect(audio.isSuspended)
        #expect(!audio.begin(.voice))
        #expect(session.activations == [true])

        audio.interruptionEnded()
        #expect(!audio.isActive)
        #expect(session.activations == [true])
        #expect(audio.begin(.voice))
        #expect(session.activations == [true, true])
    }

    @Test("Unplugging headphones stops the sound; the next line plays normally")
    func outputRemoved() {
        let audio = AudioSessionController(driver: session)
        var stops = 0
        audio.onSilence { stops += 1 }
        audio.begin(.effects)
        audio.outputRemoved()
        #expect(stops == 1)
        #expect(session.activations == [true, false])
        #expect(!audio.isSuspended)
        #expect(audio.begin(.voice))
    }

    @Test("Leaving the app stops everything until it is in front again")
    func background() {
        let audio = AudioSessionController(driver: session)
        var stops = 0
        audio.onSilence { stops += 1 }
        audio.begin(.voice)
        audio.enteredBackground()
        #expect(stops == 1)
        #expect(session.activations == [true, false])
        #expect(!audio.begin(.effects))
        audio.becameActive()
        #expect(audio.begin(.effects))
    }

    @Test("If the session can't start, the caller is told to stay silent")
    func cannotStart() {
        session.failsToActivate = true
        let audio = AudioSessionController(driver: session)
        #expect(!audio.begin(.voice))
        #expect(!audio.isActive)
    }
}

@Suite("The hunt when the app leaves the screen")
@MainActor
struct HuntLifecycleTests {
    let spot = HuntFixture.spots[0]
    let start = Date(timeIntervalSince1970: 1_000_000)

    @Test("After a long gap the old fix is rejected and Dig! is forgotten until a fresh fix")
    func staleFixAfterBackgroundGap() {
        var tracker = DigRangeTracker(target: spot)
        let atSpot = LocationFix(coordinate: spot, horizontalAccuracy: 5, timestamp: start)
        let r1 = tracker.update(with: atSpot, now: start)
        #expect(r1.showsDig)

        var pause = HuntPause()
        pause.pause(now: start.addingTimeInterval(1))
        #expect(pause.isPaused)
        let back = start.addingTimeInterval(300)

        // The freshness rule alone: the old fix no longer counts as a signal.
        #expect(!FindRules.standard.trusts(atSpot, now: back))
        let r2 = tracker.update(with: atSpot, now: back)
        #expect(r2.signal == .foggy)

        // The hunt was away longer than a fix stays fresh, so it starts over.
        let r3 = pause.resume(now: back)
        #expect(r3)
        #expect(!pause.isPaused)
        tracker = DigRangeTracker(target: spot)
        let stale = tracker.update(with: atSpot, now: back)
        #expect(!stale.showsDig)
        #expect(stale.signal == .foggy)
        #expect(stale.warmth == nil)

        // A fresh fix far away keeps Dig! hidden; a fresh one at the spot brings it back.
        let far = LocationFix(coordinate: Geo.offset(spot, north: 500, east: 0), horizontalAccuracy: 5, timestamp: back)
        let r4 = tracker.update(with: far, now: back)
        #expect(!r4.showsDig)
        let fresh = LocationFix(coordinate: spot, horizontalAccuracy: 5, timestamp: back.addingTimeInterval(1))
        let state = tracker.update(with: fresh, now: back.addingTimeInterval(1))
        #expect(state.showsDig)
        #expect(state.signal == .good)
    }

    @Test("A glance away shorter than a fix stays fresh keeps the hunt as it was")
    func shortGap() {
        var pause = HuntPause()
        pause.pause(now: start)
        pause.pause(now: start.addingTimeInterval(2))
        let r5 = pause.resume(now: start.addingTimeInterval(5))
        #expect(!r5)
        let r6 = pause.resume(now: start.addingTimeInterval(500))
        #expect(!r6)
    }

    @Test("The screen stays on during a hunt and auto-lock comes back afterwards")
    func screenAwake() {
        var calls: [Bool] = []
        let screen = ScreenAwake { calls.append($0) }
        screen.update(huntActive: false)
        #expect(calls.isEmpty)
        screen.update(huntActive: true)
        screen.update(huntActive: true)
        #expect(calls == [true])
        #expect(screen.isKeepingAwake)
        screen.update(huntActive: false)
        #expect(calls == [true, false])
    }
}

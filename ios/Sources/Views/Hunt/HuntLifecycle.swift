import Foundation
import UIKit

/// Remembers when the hunt left the screen (app in the background, screen locked), so on return it
/// starts from the GPS as it is now rather than from what it knew before.
struct HuntPause: Sendable {
    private(set) var pausedAt: Date?

    var isPaused: Bool { pausedAt != nil }

    mutating func pause(now: Date) {
        if pausedAt == nil { pausedAt = now }
    }

    /// The hunt is back. True when it was away long enough that every fix from before is too old to
    /// trust: the caller must forget its Dig! decision and wait for a fresh fix.
    mutating func resume(now: Date, rules: FindRules = .standard) -> Bool {
        guard let pausedAt else { return false }
        self.pausedAt = nil
        return now.timeIntervalSince(pausedAt) > rules.maxAge
    }
}

/// Keeps the screen on while a hunt is being played, and gives the phone its normal auto-lock back
/// afterwards.
@MainActor
final class ScreenAwake {
    private let apply: @MainActor (Bool) -> Void
    private(set) var isKeepingAwake = false

    /// - Parameter apply: Sets the phone's "don't auto-lock" switch; injectable for tests.
    init(apply: @escaping @MainActor (Bool) -> Void = { UIApplication.shared.isIdleTimerDisabled = $0 }) {
        self.apply = apply
    }

    /// Call whenever the hunt screen appears, disappears or the hunt starts or ends.
    func update(huntActive: Bool) {
        guard huntActive != isKeepingAwake else { return }
        isKeepingAwake = huntActive
        apply(huntActive)
    }
}

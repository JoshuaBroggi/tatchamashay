import Foundation

/// The chest reveal's steps: sealed → opening → revealed → added. Each step happens once, so repeat
/// taps never open twice or add twice. The find is saved before the reveal starts; "added" is the
/// child putting it in their chest, which closes the reveal.
struct RevealFlow: Equatable {
    enum Phase: Equatable, Comparable {
        case sealed, opening, revealed, added
    }

    private(set) var phase: Phase = .sealed
    /// The child has watched a whole reveal before, so this one can be skipped.
    let canSkip: Bool

    init(canSkip: Bool = false) { self.canSkip = canSkip }

    /// The child taps the sealed chest. True only for the tap that starts the opening.
    mutating func open() -> Bool { advance(from: .sealed, to: .opening) }

    /// The opening animation has finished.
    mutating func finishOpening() -> Bool { advance(from: .opening, to: .revealed) }

    /// Jumps straight to the treasure, when skipping is allowed.
    mutating func skip() -> Bool {
        guard canSkip, phase < .revealed else { return false }
        phase = .revealed
        return true
    }

    /// "Into my chest". True only the first time, so the reveal closes once.
    mutating func add() -> Bool { advance(from: .revealed, to: .added) }

    private mutating func advance(from: Phase, to: Phase) -> Bool {
        guard phase == from else { return false }
        phase = to
        return true
    }
}

/// How long each part of the opening takes, in seconds after the tap. Short enough for a
/// five-year-old: the treasure is out in well under 6 seconds.
struct RevealTiming: Equatable {
    /// The lid swings open on its hinge, the runes brighten.
    var lid: ClosedRange<Double>
    /// The light beam and sparkles. Nil in the calm version.
    var beam: ClosedRange<Double>?
    /// The treasure rises out of the chest.
    var rise: ClosedRange<Double>

    /// From the tap until the treasure is fully out and its name shows.
    var tapToTreasure: Double { max(lid.upperBound, beam?.upperBound ?? 0, rise.upperBound) }

    static let full = RevealTiming(lid: 0...1.0, beam: 0.5...2.2, rise: 1.0...2.6)
    /// Reduced motion: no rattle, no beam flash, no sparkles; the lid and treasure move gently.
    static let calm = RevealTiming(lid: 0...1.2, beam: nil, rise: 0.9...2.4)

    static func forMotion(reduced: Bool) -> RevealTiming { reduced ? .calm : .full }

    /// 0 before the range, 1 after it, eased in between.
    static func progress(_ time: Double, in range: ClosedRange<Double>) -> Float {
        let span = range.upperBound - range.lowerBound
        guard span > 0 else { return time >= range.upperBound ? 1 : 0 }
        let t = min(max((time - range.lowerBound) / span, 0), 1)
        return Float(t * t * (3 - 2 * t))
    }
}

/// Remembers whether this phone has shown a whole reveal, which makes later ones skippable.
@MainActor
struct RevealMemory {
    static let key = "chest.revealSeen"
    var defaults: UserDefaults? = .standard

    var hasSeenReveal: Bool { defaults?.bool(forKey: Self.key) ?? false }
    func markSeen() { defaults?.set(true, forKey: Self.key) }
}

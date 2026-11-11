import Foundation

/// Something that just happened in the hunt that the guide reacts to. `Views/Hunt` sets
/// `AppModel.huntMoment`; the guide overlay in `Views/Guide` speaks for it.
struct HuntMoment: Equatable, Sendable {
    var moment: GuideMoment
    /// The treasure this moment is about, 0-based in play order. For `nextTreasure` and `hint`,
    /// the treasure to look for next.
    var treasureIndex: Int
    var at: Date = .now
}

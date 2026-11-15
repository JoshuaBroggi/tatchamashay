import Foundation

// Compatibility rules for saved adventure groups. The map uses all valid placements together.

extension Adventure {
    /// Legacy adventure groups load unchanged; one treasure is enough and there is no group cap.
    static let treasureCount = 1...Int.max

    /// One reviewed placement is enough to play.
    var readiness: Readiness {
        let count = placementIDs.count
        if count < Self.treasureCount.lowerBound { return .needsMore(Self.treasureCount.lowerBound - count) }
        return .ready
    }

    var isFull: Bool { placementIDs.count >= Self.treasureCount.upperBound }

    enum Readiness: Hashable, Sendable {
        case ready
        /// An empty saved group needs a placement.
        case needsMore(Int)
    }
}

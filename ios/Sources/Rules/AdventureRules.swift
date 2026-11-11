import Foundation

// Multi-treasure adventures: how many treasures a hunt holds, and how a run moves through them
// to the finale. Pure rules, so every screen and every store agrees.

extension Adventure {
    /// A real adventure has 3–5 treasures (PLAN.md, "The first outing").
    static let treasureCount = 3...5

    /// Whether the parent has hidden enough treasures to play. Fewer than 3 still plays (milestone 1's
    /// one-treasure slice does), but parent setup should ask for more before **Get ready**.
    var readiness: Readiness {
        let count = placementIDs.count
        if count < Self.treasureCount.lowerBound { return .needsMore(Self.treasureCount.lowerBound - count) }
        return .ready
    }

    var isFull: Bool { placementIDs.count >= Self.treasureCount.upperBound }

    enum Readiness: Hashable, Sendable {
        case ready
        /// Hide this many more to reach the minimum.
        case needsMore(Int)
    }
}

/// Where one run of an adventure stands. Built from the adventure's order and the placements this
/// run has found; finding happens through `recordFind`, and this only reads the result.
struct HuntProgress: Hashable, Sendable {
    let order: [ChestPlacement.ID]
    let foundThisRun: Set<ChestPlacement.ID>

    init(order: [ChestPlacement.ID], foundThisRun: Set<ChestPlacement.ID>) {
        self.order = order
        self.foundThisRun = foundThisRun.intersection(order)
    }

    var total: Int { order.count }
    var foundCount: Int { foundThisRun.count }

    /// The treasure to look for now: the first in play order not yet found this run.
    var next: ChestPlacement.ID? { order.first { !foundThisRun.contains($0) } }

    /// 1-based position of `next`, for "Treasure 2 of 3".
    var nextNumber: Int? { next.flatMap { order.firstIndex(of: $0) }.map { $0 + 1 } }

    /// Every treasure is found: play the finale.
    var isComplete: Bool { !order.isEmpty && next == nil }

    /// What the hunt should do after a reveal of `placement`.
    func step(afterFinding placement: ChestPlacement.ID) -> Step {
        guard order.contains(placement) else { return .notInAdventure }
        let after = HuntProgress(order: order, foundThisRun: foundThisRun.union([placement]))
        if let next = after.next { return .next(next) }
        return .finale
    }

    enum Step: Hashable, Sendable {
        /// More treasure is waiting: play `next_treasure`, then the next hint.
        case next(ChestPlacement.ID)
        /// That was the last one: play the adventure's finale lines, then the guide's `finale`.
        case finale
        case notInAdventure
    }
}

extension FamilyData {
    /// The placements a run has found, by placement id.
    func foundPlacements(child: ChildProfile.ID, run: HuntRun.ID) -> Set<ChestPlacement.ID> {
        Set(collections.filter { $0.childID == child && ($0.firstRunID == run || $0.foundAgainRunIDs.contains(run)) }
            .map(\.placementID))
    }

    func progress(of adventure: Adventure, child: ChildProfile.ID, run: HuntRun.ID) -> HuntProgress {
        HuntProgress(order: adventure.placementIDs, foundThisRun: foundPlacements(child: child, run: run))
    }
}

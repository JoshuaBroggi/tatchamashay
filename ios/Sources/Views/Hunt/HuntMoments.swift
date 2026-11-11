import Foundation

/// One moment in the hunt, published on `AppModel.huntMoment` for the guide to speak or show.
/// The hunt never speaks itself; it only says what just happened.
struct HuntMomentEvent: Identifiable, Hashable, Sendable {
    var id = UUID()
    /// `.greeting` (hunt start), `.gettingClose`, `.digReady`, `.foggyGPS`, `.reveal` (found by Dig!),
    /// `.weFoundIt` (found by the grown-up), `.nextTreasure` or `.finale`.
    let moment: GuideMoment
    /// 1-based, in play order: the treasure the moment is about. For `.nextTreasure` it's the one to
    /// look for now; for `.finale` the last one found.
    let treasureNumber: Int
    /// How many treasures the adventure has.
    let total: Int
    let placementID: ChestPlacement.ID?
    let at: Date
}

/// Decides when each hunt moment fires: once per event, never again because GPS drifts.
///
/// - `.greeting`: once per run, when the hunt opens with a treasure left to find.
/// - `.gettingClose` / `.digReady`: once per treasure per run, from trusted fixes only (`DigState`
///   already applies the freshness, accuracy and hysteresis rules). Drifting out and back in again
///   doesn't repeat them. Arriving straight at Dig! range fires only `.digReady`.
/// - `.foggyGPS`: once the signal has been foggy for `foggyAfter` seconds. It fires again only after
///   the signal has stayed good for `rearmFoggyAfter` seconds, so a flickering signal says it once.
/// - `.reveal` / `.weFoundIt`: once per treasure per run, however many times the button is tapped.
/// - `.nextTreasure` / `.finale`: once per treasure per run, when its reveal closes.
struct HuntMomentTracker: Sendable {
    var foggyAfter: TimeInterval = 5
    var rearmFoggyAfter: TimeInterval = 20

    private(set) var runID: HuntRun.ID?
    private var greeted = false
    private var close: Set<ChestPlacement.ID> = []
    private var digReady: Set<ChestPlacement.ID> = []
    private var found: Set<ChestPlacement.ID> = []
    private var stepped: Set<ChestPlacement.ID> = []
    private var foggySince: Date?
    private var goodSince: Date?
    private var foggyArmed = true

    init(foggyAfter: TimeInterval = 5, rearmFoggyAfter: TimeInterval = 20) {
        self.foggyAfter = foggyAfter
        self.rearmFoggyAfter = rearmFoggyAfter
    }

    /// The hunt opened for `run`. A new run (a replay) starts every moment afresh.
    mutating func start(run: HuntRun.ID, progress: HuntProgress, now: Date) -> HuntMomentEvent? {
        if run != runID { self = HuntMomentTracker(foggyAfter: foggyAfter, rearmFoggyAfter: rearmFoggyAfter) }
        runID = run
        guard !greeted, let next = progress.next, let number = progress.nextNumber else { return nil }
        greeted = true
        return event(.greeting, number, progress, next, now)
    }

    /// A new signal reading for the next treasure. Call it on every fix and on a timer.
    mutating func observe(_ state: DigState, progress: HuntProgress, now: Date) -> [HuntMomentEvent] {
        guard let next = progress.next, let number = progress.nextNumber else { return [] }
        var events: [HuntMomentEvent] = []

        switch state.signal {
        case .foggy:
            goodSince = nil
            let since = foggySince ?? now
            foggySince = since
            if foggyArmed, now.timeIntervalSince(since) >= foggyAfter {
                foggyArmed = false
                events.append(event(.foggyGPS, number, progress, next, now))
            }
        case .good:
            foggySince = nil
            let since = goodSince ?? now
            goodSince = since
            if !foggyArmed, now.timeIntervalSince(since) >= rearmFoggyAfter { foggyArmed = true }

            if state.showsDig, !digReady.contains(next) {
                digReady.insert(next)
                close.insert(next)
                events.append(event(.digReady, number, progress, next, now))
            } else if let warmth = state.warmth, warmth >= .warm, !close.contains(next) {
                close.insert(next)
                events.append(event(.gettingClose, number, progress, next, now))
            }
        }
        return events
    }

    /// A find was saved. `progress` is from before the find.
    mutating func found(_ placement: ChestPlacement.ID, method: FindMethod,
                        progress: HuntProgress, now: Date) -> HuntMomentEvent? {
        guard let index = progress.order.firstIndex(of: placement), !found.contains(placement) else { return nil }
        found.insert(placement)
        return event(method == .dig ? .reveal : .weFoundIt, index + 1, progress, placement, now)
    }

    /// The reveal of `placement` closed. `progress` is from after the find.
    mutating func revealClosed(_ placement: ChestPlacement.ID, progress: HuntProgress, now: Date) -> HuntMomentEvent? {
        guard let index = progress.order.firstIndex(of: placement), !stepped.contains(placement) else { return nil }
        stepped.insert(placement)
        switch progress.step(afterFinding: placement) {
        case .next(let next):
            guard let number = progress.nextNumber else { return nil }
            return event(.nextTreasure, number, progress, next, now)
        case .finale:
            return event(.finale, index + 1, progress, placement, now)
        case .notInAdventure:
            return nil
        }
    }

    private func event(_ moment: GuideMoment, _ number: Int, _ progress: HuntProgress,
                       _ placement: ChestPlacement.ID, _ now: Date) -> HuntMomentEvent {
        HuntMomentEvent(moment: moment, treasureNumber: number, total: progress.total, placementID: placement, at: now)
    }
}

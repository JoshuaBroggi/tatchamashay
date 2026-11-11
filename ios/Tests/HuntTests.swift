import Foundation
import Testing
@testable import Tatchamashay

@Suite("The 3-treasure hunt")
@MainActor
struct HuntProgressTests {
    private func model() async -> FamilyModel {
        let model = FamilyModel(store: LocalFamilyStore(persistence: MemoryPersistence(HuntFixture.data())), isDemo: true)
        await model.load()
        model.startNewRun()
        return model
    }

    @Test("Each find moves to the next treasure, and the last leads to the finale")
    func walksToFinale() async throws {
        let family = await model()
        let order = family.adventurePlacements
        #expect(order.count == 3)
        #expect(family.progress.foundCount == 0)
        #expect(family.progress.nextNumber == 1)
        #expect(family.nextPlacement?.hint == "Look near the big tree")

        _ = try #require(await family.recordFind(order[0], method: .dig))
        #expect(family.progress.foundCount == 1)
        #expect(family.nextPlacement?.id == order[1].id)
        #expect(family.progress.nextNumber == 2)

        _ = try #require(await family.recordFind(order[1], method: .parentConfirmed))
        #expect(family.progress.foundCount == 2)
        #expect(family.progress.step(afterFinding: order[2].id) == .finale)

        _ = try #require(await family.recordFind(order[2], method: .dig))
        #expect(family.isRunComplete)
        #expect(family.nextPlacement == nil)
        #expect(family.chest.count == 3)
    }

    @Test("Finding the same treasure twice counts once")
    func doubleFind() async throws {
        let family = await model()
        let first = family.adventurePlacements[0]
        _ = await family.recordFind(first, method: .dig)
        _ = await family.recordFind(first, method: .dig)
        #expect(family.progress.foundCount == 1)
        #expect(family.chest.count == 1)
    }
}

@Suite("Hunt moments fire once per event")
struct HuntMomentTests {
    let ids = [UUID(), UUID(), UUID()]
    let run = UUID()
    let spot = HuntFixture.spots[0]
    let start = Date(timeIntervalSince1970: 1_000_000)

    func progress(found: Int = 0) -> HuntProgress {
        HuntProgress(order: ids, foundThisRun: Set(ids.prefix(found)))
    }

    func time(_ t: TimeInterval) -> Date { start.addingTimeInterval(t) }

    func fix(_ metersNorth: Double, at t: TimeInterval) -> LocationFix {
        LocationFix(coordinate: Geo.offset(spot, north: metersNorth, east: 0), horizontalAccuracy: 5, timestamp: time(t))
    }

    /// Feeds one fix per second (nil for no fix) through the real GPS rules and the moment tracker.
    func walk(_ meters: [Double?], from t0: TimeInterval = 0, tracker: inout HuntMomentTracker,
              dig: inout DigRangeTracker, found: Int = 0) -> [GuideMoment] {
        var moments: [GuideMoment] = []
        for (i, m) in meters.enumerated() {
            let t = t0 + Double(i)
            let state = dig.update(with: m.map { fix($0, at: t) }, now: time(t))
            moments += tracker.observe(state, progress: progress(found: found), now: time(t)).map(\.moment)
        }
        return moments
    }

    @Test("Hunt start greets once per run, and again on a replay")
    func greeting() throws {
        var tracker = HuntMomentTracker()
        let started = tracker.start(run: run, progress: progress(), now: start)
        let event = try #require(started)
        #expect(event.moment == .greeting)
        #expect(event.treasureNumber == 1)
        #expect(event.total == 3)
        #expect(tracker.start(run: run, progress: progress(), now: start) == nil)
        #expect(tracker.start(run: UUID(), progress: progress(), now: start)?.moment == .greeting)
    }

    @Test("A finished run doesn't greet")
    func finishedRun() {
        var tracker = HuntMomentTracker()
        #expect(tracker.start(run: run, progress: progress(found: 3), now: start) == nil)
    }

    @Test("Getting close fires once, however the GPS drifts in and out")
    func gettingClose() {
        var tracker = HuntMomentTracker()
        var dig = DigRangeTracker(target: spot)
        _ = tracker.start(run: run, progress: progress(), now: start)
        // Far, then warm (≤ 120 m), drifting back to cool and warm again several times.
        let moments = walk([400, 300, 110, 130, 100, 140, 90, 125, 100], tracker: &tracker, dig: &dig)
        #expect(moments == [.gettingClose])
    }

    @Test("Dig ready fires once while Dig! flickers at the edge of range")
    func digReady() {
        var tracker = HuntMomentTracker()
        var dig = DigRangeTracker(target: spot)
        _ = tracker.start(run: run, progress: progress(), now: start)
        var moments = walk([100, 38, 45, 39, 55, 35], tracker: &tracker, dig: &dig)
        #expect(moments == [.gettingClose, .digReady])
        // Walk well away until Dig! hides, then come back: still no repeat for this treasure.
        moments = walk([90, 90, 90, 90, 90, 90, 30, 30], from: 6, tracker: &tracker, dig: &dig)
        #expect(moments.isEmpty)
    }

    @Test("Arriving straight in Dig! range fires only dig ready")
    func straightToDig() {
        var tracker = HuntMomentTracker()
        var dig = DigRangeTracker(target: spot)
        #expect(walk([10, 12, 300, 10], tracker: &tracker, dig: &dig) == [.digReady])
    }

    @Test("Foggy GPS fires once per foggy spell, not on every flicker")
    func foggy() {
        var tracker = HuntMomentTracker()
        var dig = DigRangeTracker(target: spot)
        // No fix for 6 s: foggy after 5 s.
        var moments = walk(Array(repeating: nil, count: 7), tracker: &tracker, dig: &dig)
        #expect(moments == [.foggyGPS])
        // A few good seconds, then stale again (no new fix for over 10 s): no repeat.
        moments = walk([400, 400, 400] + Array(repeating: nil, count: 20), from: 7, tracker: &tracker, dig: &dig)
        #expect(moments.isEmpty)
        // Good for 20 s re-arms it; the next foggy spell is a new event.
        moments = walk(Array(repeating: 400, count: 21) + Array(repeating: nil, count: 17), from: 30,
                       tracker: &tracker, dig: &dig)
        #expect(moments == [.foggyGPS])
    }

    @Test("Each find fires once, as reveal or we found it")
    func finds() throws {
        var tracker = HuntMomentTracker()
        _ = tracker.start(run: run, progress: progress(), now: start)
        let dugEvent = tracker.found(ids[0], method: .dig, progress: progress(), now: start)
        let dug = try #require(dugEvent)
        #expect(dug.moment == .reveal)
        #expect(dug.treasureNumber == 1)
        #expect(tracker.found(ids[0], method: .dig, progress: progress(), now: start) == nil, "double tap")
        let confirmedEvent = tracker.found(ids[1], method: .parentConfirmed, progress: progress(found: 1), now: start)
        let confirmed = try #require(confirmedEvent)
        #expect(confirmed.moment == .weFoundIt)
        #expect(confirmed.treasureNumber == 2)
        #expect(tracker.found(UUID(), method: .dig, progress: progress(), now: start) == nil, "not in this adventure")
    }

    @Test("Closing a reveal moves to the next treasure, then the finale, once each")
    func nextAndFinale() throws {
        var tracker = HuntMomentTracker()
        _ = tracker.start(run: run, progress: progress(), now: start)
        let nextEvent = tracker.revealClosed(ids[0], progress: progress(found: 1), now: start)
        let next = try #require(nextEvent)
        #expect(next.moment == .nextTreasure)
        #expect(next.treasureNumber == 2)
        #expect(next.placementID == ids[1])
        #expect(tracker.revealClosed(ids[0], progress: progress(found: 1), now: start) == nil)

        _ = tracker.revealClosed(ids[1], progress: progress(found: 2), now: start)
        let finaleEvent = tracker.revealClosed(ids[2], progress: progress(found: 3), now: start)
        let finale = try #require(finaleEvent)
        #expect(finale.moment == .finale)
        #expect(finale.treasureNumber == 3)
        #expect(tracker.revealClosed(ids[2], progress: progress(found: 3), now: start) == nil)
    }

    @Test("Moments are about the next treasure only")
    func nextTreasureOnly() {
        var tracker = HuntMomentTracker()
        var dig = DigRangeTracker(target: HuntFixture.spots[1])
        _ = tracker.start(run: run, progress: progress(found: 1), now: start)
        let state = dig.update(with: LocationFix(coordinate: HuntFixture.spots[1], horizontalAccuracy: 5, timestamp: start),
                               now: start)
        let events = tracker.observe(state, progress: progress(found: 1), now: start)
        #expect(events.map(\.moment) == [.digReady])
        #expect(events.first?.treasureNumber == 2)
        #expect(events.first?.placementID == ids[1])
    }
}

@Suite("Hunt screen contrast outdoors")
struct HuntContrastTests {
    /// WCAG relative luminance contrast of two sRGB colors.
    static func ratio(_ a: UInt32, _ b: UInt32) -> Double {
        func luminance(_ hex: UInt32) -> Double {
            func channel(_ v: UInt32) -> Double {
                let c = Double(v & 0xFF) / 255
                return c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
            }
            return 0.2126 * channel(hex >> 16) + 0.7152 * channel(hex >> 8) + 0.0722 * channel(hex)
        }
        let (l1, l2) = (luminance(a), luminance(b))
        return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
    }

    // The hunt screen's text and marks over their grounds (values from `Palette`).
    @Test("Hunt text and marks are well above 7:1 for sunlight", arguments: [
        ("hint and progress on the panel", UInt32(0xF8FAEF), UInt32(0x0E1A12)),
        ("secondary text on the panel", 0xC3D5B6, 0x0E1A12),
        ("signal label on the panel", 0xD4A24C, 0x0E1A12),
        ("foggy message on the panel", 0x7FE3F0, 0x0E1A12),
        ("Dig! label on gold", 0x0E1A12, 0xD4A24C),
        ("X on parchment", 0x7A1F12, 0xEAD9AE),
        ("map title on parchment", 0x4A3418, 0xEAD9AE),
    ])
    func contrast(_ name: String, _ foreground: UInt32, _ background: UInt32) {
        #expect(Self.ratio(foreground, background) >= 7, "\(name)")
    }
}

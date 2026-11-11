import Foundation
import Testing
@testable import Tatchamashay

@Suite("Dig! and the GPS rules")
struct FindRulesTests {
    let spot = Coordinate(latitude: 37.7694, longitude: -122.4862)
    let start = Date(timeIntervalSince1970: 1_000_000)

    /// A good fix the given meters north of the spot, taken at `t` seconds after start.
    func fix(_ metersNorth: Double, at t: TimeInterval, accuracy: Double = 5) -> LocationFix {
        LocationFix(coordinate: Geo.offset(spot, north: metersNorth, east: 0),
                    horizontalAccuracy: accuracy, timestamp: start.addingTimeInterval(t))
    }

    func time(_ t: TimeInterval) -> Date { start.addingTimeInterval(t) }

    @Test("Offsets used by these tests land where expected")
    func geometry() {
        #expect(abs(Geo.distance(spot, Geo.offset(spot, north: 50, east: 0)) - 50) < 0.5)
        #expect(abs(Geo.distance(spot, Geo.offset(spot, north: 0, east: 50)) - 50) < 0.5)
    }

    @Test("Dig! appears within 40 m, not before")
    func appearsInRange() {
        var tracker = DigRangeTracker(target: spot)
        #expect(tracker.update(with: fix(100, at: 0), now: time(0)).showsDig == false)
        #expect(tracker.update(with: fix(45, at: 1), now: time(1)).showsDig == false)
        #expect(tracker.update(with: fix(38, at: 2), now: time(2)).showsDig == true)
    }

    @Test("Dig! doesn't flicker as GPS drifts around the edge")
    func noFlickerWhileDrifting() {
        var tracker = DigRangeTracker(target: spot)
        tracker.update(with: fix(30, at: 0), now: time(0))
        // Drift between 35 m and 58 m, and one brief jump to 70 m.
        let drift: [Double] = [42, 55, 38, 58, 47, 70, 52, 44, 39, 57, 49, 41]
        var shown: [Bool] = []
        for (i, d) in drift.enumerated() {
            let t = TimeInterval(i + 1)
            shown.append(tracker.update(with: fix(d, at: t), now: time(t)).showsDig)
        }
        #expect(shown.allSatisfy { $0 }, "Dig! stays up the whole time: \(shown)")
    }

    @Test("Dig! hides only after staying past 60 m for a few seconds")
    func hidesWhenClearlyOut() {
        var tracker = DigRangeTracker(target: spot)
        tracker.update(with: fix(20, at: 0), now: time(0))
        #expect(tracker.update(with: fix(80, at: 1), now: time(1)).showsDig == true)
        #expect(tracker.update(with: fix(85, at: 3), now: time(3)).showsDig == true)
        #expect(tracker.update(with: fix(90, at: 5), now: time(5)).showsDig == false)
        // Coming back shows it again straight away.
        #expect(tracker.update(with: fix(35, at: 6), now: time(6)).showsDig == true)
    }

    @Test("Going back inside 60 m resets the out-of-range clock")
    func outOfRangeClockResets() {
        var tracker = DigRangeTracker(target: spot)
        tracker.update(with: fix(20, at: 0), now: time(0))
        tracker.update(with: fix(80, at: 1), now: time(1))
        tracker.update(with: fix(50, at: 3), now: time(3))
        #expect(tracker.update(with: fix(80, at: 4), now: time(4)).showsDig == true)
        #expect(tracker.update(with: fix(80, at: 6), now: time(6)).showsDig == true)
        #expect(tracker.update(with: fix(80, at: 8), now: time(8)).showsDig == false)
    }

    @Test("A stale fix is ignored, even right on the spot")
    func staleIgnored() {
        var tracker = DigRangeTracker(target: spot)
        let state = tracker.update(with: fix(0, at: 0), now: time(11))
        #expect(state.showsDig == false)
        #expect(state.signal == .foggy)
    }

    @Test("An inaccurate fix is ignored, even right on the spot")
    func inaccurateIgnored() {
        var tracker = DigRangeTracker(target: spot)
        let state = tracker.update(with: fix(0, at: 0, accuracy: 45), now: time(0))
        #expect(state.showsDig == false)
        #expect(state.signal == .foggy)
        #expect(state.warmth == nil)
    }

    @Test("Invalid and future-dated fixes are ignored")
    func invalidIgnored() {
        var tracker = DigRangeTracker(target: spot)
        #expect(tracker.update(with: fix(0, at: 0, accuracy: -1), now: time(0)).showsDig == false)
        #expect(tracker.update(with: fix(0, at: 30), now: time(0)).showsDig == false)
        #expect(tracker.update(with: nil, now: time(0)).showsDig == false)
    }

    @Test("Bad fixes far away don't hide Dig!")
    func badFixesDontHide() {
        var tracker = DigRangeTracker(target: spot)
        tracker.update(with: fix(10, at: 0), now: time(0))
        for t in stride(from: 1.0, through: 20, by: 1) {
            tracker.update(with: fix(500, at: t, accuracy: 120), now: time(t))   // inaccurate
            tracker.update(with: fix(500, at: t - 15), now: time(t))             // stale
        }
        #expect(tracker.state(now: time(20)).showsDig == true)
    }

    @Test("The signal turns foggy once the last good fix gets old")
    func foggyWhenOld() {
        var tracker = DigRangeTracker(target: spot)
        #expect(tracker.update(with: fix(100, at: 0), now: time(0)).signal == .good)
        #expect(tracker.state(now: time(9)).signal == .good)
        #expect(tracker.state(now: time(11)).signal == .foggy)
    }

    @Test("Warmth describes closeness only")
    func warmth() {
        let rules = FindRules.standard
        #expect(Warmth(distance: 10, rules: rules) == .hot)
        #expect(Warmth(distance: 100, rules: rules) == .warm)
        #expect(Warmth(distance: 300, rules: rules) == .cool)
        #expect(Warmth(distance: 1_000, rules: rules) == .cold)
    }
}

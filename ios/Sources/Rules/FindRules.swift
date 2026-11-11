import Foundation

/// The GPS rules from PLAN.md's "Finding a treasure". The numbers are starting guesses to tune outdoors.
struct FindRules: Sendable {
    /// Dig! appears once a trusted fix is this close.
    var digRadius: Double = 40
    /// Dig! hides only after trusted fixes stay beyond this distance...
    var hideRadius: Double = 60
    /// ...for this long, so it doesn't flicker as GPS drifts.
    var hideAfter: TimeInterval = 4
    /// A fix older than this is ignored.
    var maxAge: TimeInterval = 10
    /// A fix less accurate than this (in meters) is ignored.
    var maxAccuracy: Double = 30
    /// A small allowance for fixes stamped slightly in the future.
    var clockSkew: TimeInterval = 2

    static let standard = FindRules()

    /// Whether a fix is recent and accurate enough to act on.
    func trusts(_ fix: LocationFix, now: Date) -> Bool {
        let age = now.timeIntervalSince(fix.timestamp)
        return age <= maxAge && age >= -clockSkew
            && fix.horizontalAccuracy >= 0 && fix.horizontalAccuracy <= maxAccuracy
    }
}

/// A location reading, free of CoreLocation so the rules can be tested with plain values.
struct LocationFix: Hashable, Sendable {
    var coordinate: Coordinate
    /// Radius of uncertainty in meters. Negative means invalid, as in CoreLocation.
    var horizontalAccuracy: Double
    var timestamp: Date
}

/// How the signal is doing, in words a parent can act on.
enum SignalQuality: Hashable, Sendable {
    case good
    /// No trusted fix lately: show the foggy-map message and point the parent to We found it.
    case foggy
}

/// How warm the hunt feels. Describes closeness only, never a direction.
enum Warmth: Int, Comparable, Hashable, Sendable {
    case cold, cool, warm, hot

    init(distance: Double, rules: FindRules) {
        switch distance {
        case ...rules.digRadius: self = .hot
        case ...(rules.digRadius * 3): self = .warm
        case ...(rules.digRadius * 8): self = .cool
        default: self = .cold
        }
    }

    static func < (lhs: Warmth, rhs: Warmth) -> Bool { lhs.rawValue < rhs.rawValue }
}

/// What the hunt screen shows for one treasure.
struct DigState: Hashable, Sendable {
    var showsDig: Bool
    var signal: SignalQuality
    /// From the last trusted fix, if there is one.
    var warmth: Warmth?
}

/// Decides when Dig! shows for one spot. Feed it every fix and call `state(now:)` on a timer.
///
/// Only trusted fixes (recent and accurate) move the decision. Dig! appears at `digRadius` and hides
/// only after trusted fixes stay beyond `hideRadius` for `hideAfter` seconds. Between the two radii,
/// or when the signal is bad, the last decision stands.
struct DigRangeTracker: Sendable {
    let target: Coordinate
    var rules: FindRules = .standard

    private(set) var showsDig = false
    private var lastTrusted: LocationFix?
    private var outOfRangeSince: Date?
    private var lastDistance: Double?

    init(target: Coordinate, rules: FindRules = .standard) {
        self.target = target
        self.rules = rules
    }

    @discardableResult
    mutating func update(with fix: LocationFix?, now: Date) -> DigState {
        if let fix, rules.trusts(fix, now: now) {
            let distance = Geo.distance(fix.coordinate, target)
            lastTrusted = fix
            lastDistance = distance
            if distance <= rules.digRadius {
                showsDig = true
                outOfRangeSince = nil
            } else if distance > rules.hideRadius {
                let since = outOfRangeSince ?? fix.timestamp
                outOfRangeSince = since
                if showsDig, now.timeIntervalSince(since) >= rules.hideAfter {
                    showsDig = false
                }
            } else {
                outOfRangeSince = nil
            }
        }
        return state(now: now)
    }

    func state(now: Date) -> DigState {
        let fresh = lastTrusted.map { rules.trusts($0, now: now) } ?? false
        return DigState(
            showsDig: showsDig,
            signal: fresh ? .good : .foggy,
            warmth: lastDistance.map { Warmth(distance: $0, rules: rules) }
        )
    }
}

enum Geo {
    /// Great-circle distance in meters.
    static func distance(_ a: Coordinate, _ b: Coordinate) -> Double {
        let r = 6_371_000.0
        let lat1 = a.latitude * .pi / 180, lat2 = b.latitude * .pi / 180
        let dLat = lat2 - lat1
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let h = sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        return 2 * r * asin(min(1, sqrt(h)))
    }

    /// A coordinate moved by the given meters north and east. Used by tests and Demo mode.
    static func offset(_ c: Coordinate, north: Double, east: Double) -> Coordinate {
        let dLat = north / 111_320
        let dLon = east / (111_320 * cos(c.latitude * .pi / 180))
        return Coordinate(latitude: c.latitude + dLat, longitude: c.longitude + dLon)
    }
}

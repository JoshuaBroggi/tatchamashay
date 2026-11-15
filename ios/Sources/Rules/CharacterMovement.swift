import Foundation

/// Presentation only. DigRangeTracker always receives the original, unsmoothed fixes.
struct CharacterMovement {
    private(set) var coordinate: Coordinate?
    private(set) var heading: Double = 0
    private(set) var isWalking = false
    private(set) var isUncertain = true
    private var anchor: LocationFix?
    private var lastSample: Date?
    private var lastMovement: Date?
    private var movingSamples = 0

    mutating func update(_ fix: LocationFix?, now: Date) {
        guard let fix, FindRules.standard.trusts(fix, now: now),
              fix.coordinate.latitude.isFinite, fix.coordinate.longitude.isFinite,
              (-90...90).contains(fix.coordinate.latitude), (-180...180).contains(fix.coordinate.longitude) else {
            isWalking = false
            isUncertain = true
            movingSamples = 0
            anchor = nil
            return
        }
        isUncertain = false
        if let lastMovement, now.timeIntervalSince(lastMovement) > 3 { isWalking = false; movingSamples = 0 }
        if let lastSample, fix.timestamp <= lastSample { return }
        lastSample = fix.timestamp
        guard let previous = anchor else {
            coordinate = fix.coordinate
            anchor = fix
            return
        }
        let elapsed = fix.timestamp.timeIntervalSince(previous.timestamp)
        let distance = Geo.distance(previous.coordinate, fix.coordinate)
        // Accumulate small steps against an anchor, rather than treating each GPS wobble as a step.
        let threshold = max(2.5, min(8, max(previous.horizontalAccuracy, fix.horizontalAccuracy) * 0.35))
        guard distance >= threshold else { return }
        coordinate = fix.coordinate
        anchor = fix
        // Never animate a path across missing fixes or a GPS teleport.
        guard elapsed > 0, elapsed <= 10, distance <= 35, distance / elapsed <= 4.5 else {
            movingSamples = 0
            isWalking = false
            return
        }
        heading = Self.bearing(from: previous.coordinate, to: fix.coordinate)
        movingSamples += 1
        lastMovement = now
        isWalking = movingSamples >= 2
    }

    private static func bearing(from a: Coordinate, to b: Coordinate) -> Double {
        let aLat = a.latitude * .pi / 180
        let bLat = b.latitude * .pi / 180
        let longitude = (b.longitude - a.longitude) * .pi / 180
        let y = sin(longitude) * cos(bLat)
        let x = cos(aLat) * sin(bLat) - sin(aLat) * cos(bLat) * cos(longitude)
        return (atan2(y, x) * 180 / .pi + 360).truncatingRemainder(dividingBy: 360)
    }
}

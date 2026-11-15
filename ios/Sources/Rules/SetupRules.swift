import Foundation

// Parent spot review rules, shared by the editor and its tests.

/// When the map is detailed enough to choose something on it.
enum MapReview {
    /// A chest's spot: zoomed in until paths, roads and water show (camera distance in meters).
    static let spotDistance: Double = 1_200
    /// The play area: close enough to recognise the neighborhood.
    static let areaDistance: Double = 6_000
    /// Where spot review starts, so the parent zooms in from the play area.
    static let spotStartDistance: Double = 2_500

    static func isDetailedForSpot(cameraDistance: Double) -> Bool { cameraDistance <= spotDistance }
    static func isDetailedForArea(cameraDistance: Double) -> Bool { cameraDistance <= areaDistance }

    /// A spot can be confirmed only on a detailed map, with a center, after the parent ticks the check.
    static func canConfirmSpot(cameraDistance: Double, center: Coordinate?, checked: Bool) -> Bool {
        center != nil && checked && isDetailedForSpot(cameraDistance: cameraDistance)
    }
}

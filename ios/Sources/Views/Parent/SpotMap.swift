import MapKit
import SwiftUI

/// A detailed map with a crosshair in the middle, for choosing a play area or a chest's spot.
/// Reports the map's center and how far the camera is, so the screen can apply `MapReview`.
struct SpotMap: View {
    @Binding var camera: MapCameraPosition
    @Binding var center: Coordinate?
    @Binding var cameraDistance: Double
    var satellite = false
    /// Chests already placed, shown as X's.
    var marks: [Coordinate] = []
    /// The crosshair: an ✕ for a spot, a ring for a play area.
    var crosshair = Crosshair.spot

    enum Crosshair { case spot, area }

    var body: some View {
        ZStack {
            Map(position: $camera) {
                UserAnnotation()
                ForEach(Array(marks.enumerated()), id: \.offset) { _, mark in
                    Annotation("", coordinate: mark.clCoordinate) { XMark(found: false, isNext: false) }
                }
            }
            .mapStyle(satellite
                      ? .hybrid(elevation: .flat, pointsOfInterest: .all)
                      : .standard(elevation: .flat, pointsOfInterest: .all))
            .environment(\.colorScheme, .light)
            .mapControls {
                MapUserLocationButton()
                MapCompass()
                MapScaleView()
            }
            .onMapCameraChange(frequency: .continuous) { context in
                center = Coordinate(context.camera.centerCoordinate)
                cameraDistance = context.camera.distance
            }

            switch crosshair {
            case .spot:
                Text("✕")
                    .font(Typeface.mapScript(44))
                    .foregroundStyle(Palette.mapRed)
                    .shadow(color: .white, radius: 2)
                    .allowsHitTesting(false)
            case .area:
                Circle()
                    .stroke(Palette.mapRed, style: StrokeStyle(lineWidth: 3, dash: [8, 6]))
                    .frame(width: 180, height: 180)
                    .shadow(color: .white, radius: 2)
                    .allowsHitTesting(false)
            }
        }
    }
}

extension MapCameraPosition {
    /// Looking straight down at `coordinate` from `distance` meters.
    static func looking(at coordinate: Coordinate, distance: Double) -> MapCameraPosition {
        .camera(MapCamera(centerCoordinate: coordinate.clCoordinate, distance: distance))
    }
}

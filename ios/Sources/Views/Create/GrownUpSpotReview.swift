import MapKit
import SwiftUI

/// The grown-up confirms where the child's treasure goes, under the same rules as the parent's own
/// `ReviewSpotView` (`Views/Parent`): a detailed map zoomed in to `MapReview.spotDistance`,
/// a crosshair, and the grown-up's confirmation that they checked the spot.
///
/// `ReviewSpotView` saves a new parent-made treasure into the newest adventure, so it can't hide an
/// invention the child already saved. This keeps its look and rules and hands the confirmed spot to
/// `onConfirm`, which saves the placement and says whether it worked.
struct GrownUpSpotReview: View {
    let look: TreasureLook
    /// The story's `parent_prompt`.
    var prompt: String?
    /// The story's `parent_hint_template`, e.g. "Look near the {blank}."
    var hintTemplate: String?
    let onConfirm: (Coordinate, String, Date) async -> Bool

    @Environment(LocationService.self) private var location

    @State private var camera: MapCameraPosition = .userLocation(fallback: .automatic)
    @State private var center: Coordinate?
    @State private var cameraDistance: Double = .infinity
    @State private var satellite = false
    @State private var checked = false
    @State private var blank = ""
    @State private var saving = false

    private var isDetailed: Bool { MapReview.isDetailedForSpot(cameraDistance: cameraDistance) }
    private var canConfirm: Bool { isDetailed && checked && center != nil && !saving }

    /// The clue the hunt shows: the template with the grown-up's words, or their words alone.
    private var hint: String {
        let words = blank.trimmed
        guard !words.isEmpty else { return "" }
        return hintTemplate.flatMap { StoryContext(blank: words).fill($0) } ?? words
    }

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Map(position: $camera) {
                    UserAnnotation()
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

                Text("✕")
                    .font(Typeface.mapScript(44))
                    .foregroundStyle(Palette.mapRed)
                    .shadow(color: .white, radius: 2)
                    .allowsHitTesting(false)
            }
            .onAppear(perform: startNearPhone)

            Form {
                Section {
                    Text(prompt ?? "Check the spot on the map and confirm it.")
                        .font(Typeface.body(13))
                        .foregroundStyle(Palette.textSecondary)
                    Picker("Map", selection: $satellite) {
                        Text("Map").tag(false)
                        Text("Satellite").tag(true)
                    }
                    .pickerStyle(.segmented)
                    if !isDetailed {
                        Label("Zoom in until you can see paths, roads and water.", systemImage: "plus.magnifyingglass")
                            .foregroundStyle(Palette.gold)
                    }
                    HStack(spacing: 6) {
                        Text("Look near the").foregroundStyle(Palette.textSecondary)
                        TextField("back step", text: $blank)
                            .accessibilityIdentifier("spotBlank")
                    }
                    Toggle("I've checked this spot. It's safe, away from roads and water, in a place I know.",
                           isOn: $checked)
                        .accessibilityIdentifier("spotChecked")
                }
                Section {
                    Button(saving ? "Hiding…" : "Hide \(look.name) here") { confirm() }
                        .disabled(!canConfirm)
                        .accessibilityIdentifier("hideHere")
                }
            }
            .scrollContentBackground(.hidden)
            .frame(height: 360)
        }
    }

    /// Starts over the phone's last position, still zoomed out, so the grown-up zooms in to the spot.
    /// Without a fix the map follows the phone's location as soon as it has one.
    private func startNearPhone() {
        guard let fix = location.latestFix else { return }
        camera = .camera(MapCamera(centerCoordinate: fix.coordinate.clCoordinate, distance: 2_500))
    }

    private func confirm() {
        guard let center, canConfirm else { return }
        saving = true
        Task {
            _ = await onConfirm(center, hint, .now)
            saving = false
        }
    }
}

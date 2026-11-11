import MapKit
import SwiftUI

/// The parent picks a built-in treasure, then puts it on a spot they've checked on a detailed map.
struct HideTreasureFlow: View {
    @Environment(\.dismiss) private var dismiss
    @State private var look = TreasureLook(model: .gem, color: BuiltInModel.gem.defaultColor, name: "Sea Gem")

    var body: some View {
        NavigationStack {
            ChooseTreasureView(look: $look)
                .navigationTitle("Hide a treasure")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        NavigationLink("Next") { ReviewSpotView(look: look) { dismiss() } }
                            .disabled(look.name.trimmed.isEmpty)
                            .accessibilityIdentifier("chooseSpot")
                    }
                }
        }
    }
}

private struct ChooseTreasureView: View {
    @Binding var look: TreasureLook

    var body: some View {
        Form {
            Section {
                TreasureModelView(look: look)
                    .frame(height: 200)
                    .listRowInsets(EdgeInsets())
                    .background(Palette.ground0)
            }
            Section("Treasure") {
                Picker("Treasure", selection: Binding(get: { look.model }, set: { model in
                    if look.name == look.model.displayName { look.name = model.displayName }
                    look.model = model
                    look.color = model.defaultColor
                })) {
                    ForEach(BuiltInModel.allCases) { Label($0.displayName, systemImage: $0.symbol).tag($0) }
                }
                Picker("Color", selection: $look.color) {
                    ForEach(TreasureColor.allCases) { Text($0.displayName).tag($0) }
                }
                Picker("Sparkles", selection: $look.sparkles) {
                    ForEach(Sparkles.allCases) { Text($0.rawValue.capitalized).tag($0) }
                }
                .pickerStyle(.segmented)
            }
            Section("Name and story") {
                TextField("Funny name", text: $look.name)
                TextField("A short story (optional)", text: $look.story, axis: .vertical)
                    .lineLimit(2...4)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Palette.ground1.ignoresSafeArea())
    }
}

/// A detailed map with a crosshair. Saving needs the map zoomed in far enough to see paths and
/// roads, and the parent's confirmation that they checked the spot.
struct ReviewSpotView: View {
    let look: TreasureLook
    let onDone: () -> Void

    @Environment(FamilyModel.self) private var family

    /// Zoomed in at least this far (camera distance in meters) before a spot can be chosen.
    static let detailedDistance: Double = 1_200

    @State private var camera: MapCameraPosition = .userLocation(fallback: .automatic)
    @State private var center: Coordinate?
    @State private var cameraDistance: Double = .infinity
    @State private var satellite = false
    @State private var checked = false
    @State private var hint = ""
    @State private var saving = false

    private var isDetailed: Bool { cameraDistance <= Self.detailedDistance }

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Map(position: $camera) {
                    UserAnnotation()
                    ForEach(family.adventurePlacements) { placement in
                        Annotation("", coordinate: placement.spot.clCoordinate) { XMark(found: false, isNext: false) }
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

                Text("✕")
                    .font(Typeface.mapScript(44))
                    .foregroundStyle(Palette.mapRed)
                    .shadow(color: .white, radius: 2)
                    .allowsHitTesting(false)
            }

            Form {
                Section {
                    Picker("Map", selection: $satellite) {
                        Text("Map").tag(false)
                        Text("Satellite").tag(true)
                    }
                    .pickerStyle(.segmented)
                    if !isDetailed {
                        Label("Zoom in until you can see paths, roads and water.", systemImage: "plus.magnifyingglass")
                            .foregroundStyle(Palette.gold)
                    }
                    TextField("Clue: describe the place (\"by the big tree\")", text: $hint)
                    Toggle("I've checked this spot. It's safe, away from roads and water, in a place I know.",
                           isOn: $checked)
                        .accessibilityIdentifier("spotChecked")
                }
                Section {
                    Button(saving ? "Hiding…" : "Hide it here") { save() }
                        .disabled(!isDetailed || !checked || center == nil || saving)
                        .accessibilityIdentifier("hideHere")
                }
            }
            .scrollContentBackground(.hidden)
            .frame(height: 340)
        }
        .background(Palette.ground1.ignoresSafeArea())
        .navigationTitle("Pick the spot")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func save() {
        guard let center, isDetailed, checked else { return }
        saving = true
        Task {
            await family.hideTreasure(look, at: center, hint: hint.trimmed, reviewedAt: .now)
            saving = false
            if family.errorMessage == nil { onDone() }
        }
    }
}

import MapKit
import SwiftUI

/// One parent-owned editor, followed by a reviewed spot. No records change before the final save.
struct HideTreasureFlow: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FamilyModel.self) private var family
    let editing: TreasureDesign?
    @State private var look: TreasureLook
    @State private var confirmingCancel = false
    @State private var review = SpotReviewDraft()

    init(editing: TreasureDesign? = nil) {
        self.editing = editing
        _look = State(initialValue: editing?.current.look ?? Self.defaultLook)
    }

    private static var defaultLook: TreasureLook {
        TreasureLook(model: .crown, color: BuiltInModel.crown.defaultColor, name: BuiltInModel.crown.displayName)
    }

    private var hasChanges: Bool { look != (editing?.current.look ?? Self.defaultLook) || review.hasChanges }

    var body: some View {
        NavigationStack {
            ChooseTreasureView(look: $look)
                .navigationTitle(editing == nil ? "Create a beast" : "Edit beast")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            if hasChanges { confirmingCancel = true } else { dismiss() }
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        NavigationLink("Next") {
                            ReviewSpotView(look: look, editing: editing?.id, draft: $review) {
                                dismiss()
                            }
                        }
                        .disabled(look.name.trimmed.isEmpty)
                        .accessibilityIdentifier("chooseSpot")
                    }
                }
                .confirmationDialog("Discard your changes?", isPresented: $confirmingCancel, titleVisibility: .visible) {
                    Button("Discard changes", role: .destructive) { dismiss() }
                    Button("Keep editing", role: .cancel) {}
                }
        }
        .interactiveDismissDisabled(hasChanges)
        .onAppear {
            review.prepare(existing: family.mapPlacements.first { $0.designID == editing?.id })
        }
    }
}

private struct ChooseTreasureView: View {
    @Environment(AppModel.self) private var app
    @Binding var look: TreasureLook

    var body: some View {
        Form {
            Section {
                TreasureModelView(look: look)
                    .frame(height: 180)
                    .listRowInsets(EdgeInsets())
                    .background(Palette.ground0)
            }
            Section("Appearance") {
                Picker("Beast", selection: Binding(get: { look.model }, set: { model in
                    if look.name == look.model.displayName { look.name = model.displayName }
                    look.model = model
                    look.color = model.defaultColor
                })) {
                    ForEach(BuiltInModel.allCases) { Label($0.displayName, systemImage: $0.symbol).tag($0) }
                }
                .accessibilityIdentifier("beastModel")
                Picker("Color", selection: $look.color) {
                    ForEach(TreasureColor.allCases) { Text($0.displayName).tag($0) }
                }
                .accessibilityIdentifier("beastColor")
                Picker("Sparkles", selection: $look.sparkles) {
                    ForEach(Sparkles.allCases) { Text($0.rawValue.capitalized).tag($0) }
                }
                .accessibilityIdentifier("beastSparkles")
            }
            Section("Name and sound") {
                TextField("Funny name", text: $look.name)
                    .accessibilityIdentifier("beastName")
                    .submitLabel(.done)
                Picker("Sound", selection: $look.sound) {
                    ForEach(TreasureSound.allCases) { Text($0.rawValue.capitalized).tag($0) }
                }
                .accessibilityIdentifier("beastSound")
                Button { app.sounds.play(SoundEffect(look.sound)) } label: {
                    Label("Play sound", systemImage: "speaker.wave.2")
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Palette.ground1.ignoresSafeArea())
        .onChange(of: look.sound) { app.sounds.play(SoundEffect(look.sound)) }
    }
}

/// Kept by the editor so returning to appearance never loses a chosen spot or its hint.
struct SpotReviewDraft {
    var camera: MapCameraPosition = .userLocation(fallback: .automatic)
    var center: Coordinate? {
        didSet { if originalCenter == nil { originalCenter = center } }
    }
    var cameraDistance: Double = .infinity
    var satellite = false
    var checked = false
    var hint = ""
    var reviewedCenter: Coordinate?
    private var prepared = false
    private var originalHint = ""
    private var originalCenter: Coordinate?
    var hasChanges: Bool {
        if hint != originalHint || checked || reviewedCenter != nil { return true }
        guard let center, let originalCenter else { return false }
        return Geo.distance(center, originalCenter) > 1
    }

    mutating func prepare(existing: ChestPlacement?) {
        guard !prepared else { return }
        prepared = true
        if let existing {
            camera = .looking(at: existing.spot, distance: MapReview.spotDistance)
            originalCenter = existing.spot
            hint = existing.hint
            originalHint = existing.hint
        }
    }

    /// User-driven and user-location camera positions describe a mode, not a restorable viewpoint.
    /// Freeze the actual reviewed viewpoint before resizing the map or recreating its view.
    mutating func pinCamera() {
        guard let center, cameraDistance.isFinite else { return }
        camera = .looking(at: center, distance: cameraDistance)
    }
}

/// The parent reviews the detailed map and confirms the chosen spot, including after moving it.
struct ReviewSpotView: View {
    let look: TreasureLook
    let editing: TreasureDesign.ID?
    @Binding var draft: SpotReviewDraft
    let onDone: () -> Void

    @Environment(FamilyModel.self) private var family
    @State private var saving = false

    private var canSave: Bool {
        MapReview.canConfirmSpot(cameraDistance: draft.cameraDistance, center: draft.center, checked: draft.checked) && !saving
    }

    var body: some View {
        VStack(spacing: 0) {
            SpotMap(camera: $draft.camera, center: $draft.center, cameraDistance: $draft.cameraDistance, satellite: draft.satellite,
                    marks: family.mapPlacements.map(\.spot))
                .frame(minHeight: 160)
            Form {
                Section {
                    Picker("Map", selection: $draft.satellite) {
                        Text("Map").tag(false)
                        Text("Satellite").tag(true)
                    }
                    .pickerStyle(.segmented)
                    if !MapReview.isDetailedForSpot(cameraDistance: draft.cameraDistance) {
                        Label("Zoom in until you can see paths, roads and water.", systemImage: "plus.magnifyingglass")
                            .foregroundStyle(Palette.gold)
                    }
                    TextField("Location hint (optional)", text: $draft.hint)
                        .accessibilityIdentifier("spotHint")
                        .submitLabel(.done)
                    Toggle("I've checked this spot. It's safe, away from roads and water, in a place I know.",
                           isOn: $draft.checked)
                        .accessibilityIdentifier("spotChecked")
                        .onChange(of: draft.checked) {
                            if draft.checked {
                                draft.reviewedCenter = draft.center
                                draft.pinCamera()
                            }
                        }
                }
                Section {
                    Button(saving ? "Saving…" : "Save on map") { save() }
                        .disabled(!canSave)
                        .accessibilityIdentifier("hideHere")
                    if let message = family.errorMessage {
                        Text(message).foregroundStyle(Palette.gold).accessibilityIdentifier("placementError")
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .frame(height: 340)
        }
        .background(Palette.ground1.ignoresSafeArea())
        .navigationTitle("Choose its spot")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(saving)
        .interactiveDismissDisabled()
        .onDisappear { draft.pinCamera() }
        .onChange(of: draft.center) {
            if let center = draft.center, let reviewedCenter = draft.reviewedCenter,
               Geo.distance(center, reviewedCenter) > 1 { draft.checked = false }
        }
        .onChange(of: draft.cameraDistance) {
            if !MapReview.isDetailedForSpot(cameraDistance: draft.cameraDistance) { draft.checked = false }
        }
    }

    private func save() {
        guard let center = draft.center, canSave else { return }
        saving = true
        Task {
            let success = await family.hideTreasure(look, at: center, hint: draft.hint.trimmed, reviewedAt: .now, editing: editing)
            saving = false
            if success { onDone() }
        }
    }
}

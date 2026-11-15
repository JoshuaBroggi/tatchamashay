import SwiftUI

/// Parent tools sit behind the parental gate. Opening them never changes who's collecting.
struct ParentView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var app
    @Environment(FamilyModel.self) private var family
    @Environment(LocationService.self) private var location

    @State private var editor: BeastEditorTarget?
    @State private var removing: ChestPlacement?
    @State private var assetProblems: [String] = []

    private var assetVersions: [TreasureVersion] {
        family.parentDesigns.map(\.current) + family.mapPlacements.compactMap {
            family.design(for: $0)?.version($0.versionID)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if !app.isDemo {
                    Section {
                        Button { editor = BeastEditorTarget(design: nil) } label: {
                            Label("Create a beast", systemImage: "wand.and.stars")
                        }
                        .accessibilityIdentifier("hideTreasure")
                    } footer: {
                        Text("Make something for your pirate to find. Invite them to help choose its look whenever you like.")
                    }
                }

                Section("On the map") {
                    if family.mapPlacements.isEmpty {
                        Text("Nothing placed yet.").foregroundStyle(Palette.textSecondary)
                    }
                    ForEach(family.mapPlacements) { placement in
                        HiddenRow(placement: placement,
                                  look: family.design(for: placement)?.version(placement.versionID)?.look,
                                  found: family.hasCollected(placement))
                            .swipeActions {
                                Button("Remove", role: .destructive) { removing = placement }
                            }
                    }
                }

                if !app.isDemo {
                    Section("Beasts") {
                        ForEach(family.parentDesigns) { design in
                            Button { editor = BeastEditorTarget(design: design) } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: design.current.look.model.symbol)
                                        .foregroundStyle(Color(design.current.look.primaryPaintColor))
                                        .frame(width: 28)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(design.current.look.name).foregroundStyle(Palette.textPrimary)
                                        Text(family.mapPlacements.contains { $0.designID == design.id }
                                             ? "Edit look and spot" : "Choose a spot")
                                            .font(Typeface.body(12)).foregroundStyle(Palette.textSecondary)
                                    }
                                    Spacer()
                                    Image(systemName: "pencil").foregroundStyle(Palette.gold)
                                }
                            }
                            .accessibilityIdentifier("editBeast-\(design.id.uuidString)")
                        }
                    }
                    Section {
                        NavigationLink { GrownUpSettingsView() } label: {
                            Label("Settings and pirates", systemImage: "gearshape")
                        }
                        .accessibilityIdentifier("grownUpSettings")
                    }
                }

                Section("Before you go") {
                    ForEach(assetProblems, id: \.self) { problem in
                        Label(problem, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(Palette.gold)
                    }
                    Text("Treasure models and sounds stay on this phone. Without signal, Apple Maps may be blank; check the area before you leave.")
                        .font(Typeface.body(13)).foregroundStyle(Palette.textSecondary)
                }

                Section {
                    Toggle("Demo mode", isOn: Binding(
                        get: { app.isDemo },
                        set: { on in
                            if on {
                                let center = location.latestFix?.coordinate
                                    ?? family.mapPlacements.first?.spot
                                    ?? Coordinate(latitude: 37.7694, longitude: -122.4862)
                                Task { await app.startDemo(around: center) }
                            } else {
                                app.endDemo()
                            }
                        }
                    ))
                } header: {
                    Text("Testing")
                } footer: {
                    Text("Demo mode uses a separate pretend family. Its treasures never reach your pirate's real chest.")
                }

                if let message = family.errorMessage {
                    Section { Text(message).foregroundStyle(Palette.gold) }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Palette.ground1.ignoresSafeArea())
            .navigationTitle("Parents")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.accessibilityIdentifier("parentDone")
                }
            }
            .sheet(item: $editor) { target in HideTreasureFlow(editing: target.design) }
            .task(id: assetVersions.map(\.id)) {
                let problems = await AssetReadiness.check(looks: assetVersions.map(\.look))
                if !Task.isCancelled { assetProblems = problems }
            }
            .confirmationDialog("Remove this treasure from the map?", isPresented: Binding(
                get: { removing != nil }, set: { if !$0 { removing = nil } }
            ), titleVisibility: .visible) {
                Button("Remove", role: .destructive) {
                    if let removing { Task { await family.removePlacement(removing) } }
                }
            } message: {
                Text("Collected treasures stay in your pirate's chest.")
            }
        }
    }
}

private struct BeastEditorTarget: Identifiable {
    let id = UUID()
    let design: TreasureDesign?
}

private struct HiddenRow: View {
    let placement: ChestPlacement
    let look: TreasureLook?
    let found: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: look?.model.symbol ?? "questionmark")
                .font(.title2)
                .foregroundStyle(look.map { Color($0.primaryPaintColor) } ?? Palette.textMuted)
                .frame(width: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(look?.name ?? "Treasure").font(Typeface.body(16, weight: .semibold))
                Text(found ? "In your pirate's chest" : "Ready to find")
                    .font(Typeface.body(13)).foregroundStyle(Palette.textSecondary)
                if !placement.hint.isEmpty {
                    Text(placement.hint).font(Typeface.body(13)).foregroundStyle(Palette.textSecondary)
                }
            }
        }
    }
}

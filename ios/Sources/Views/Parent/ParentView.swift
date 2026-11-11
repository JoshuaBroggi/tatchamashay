import SwiftUI

/// The grown-ups' area: what's hidden, hide a new treasure, the child's pirate name, and Demo mode.
struct ParentView: View {
    @Environment(AppModel.self) private var app
    @Environment(FamilyModel.self) private var family
    @Environment(LocationService.self) private var location

    @State private var hiding = false
    @State private var pirateName = ""
    @State private var removing: ChestPlacement?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if family.adventurePlacements.isEmpty {
                        Text("Nothing hidden yet.").foregroundStyle(Palette.textSecondary)
                    }
                    ForEach(family.adventurePlacements) { placement in
                        HiddenRow(placement: placement, look: family.design(for: placement)?.current.look)
                            .swipeActions {
                                Button("Remove", role: .destructive) { removing = placement }
                            }
                    }
                    if !app.isDemo {
                        Button {
                            hiding = true
                        } label: {
                            Label("Hide a treasure", systemImage: "mappin.and.ellipse")
                        }
                        .accessibilityIdentifier("hideTreasure")
                    }
                } header: {
                    Text(family.adventure?.title ?? "Today's Hunt")
                } footer: {
                    Text("Only you place treasure, on a spot you've checked on the map. Removing one never takes it out of a chest.")
                }

                if !app.isDemo, let child = family.child {
                    Section("Your pirate") {
                        TextField("Pirate name", text: $pirateName)
                            .onAppear { pirateName = child.pirateName }
                            .onSubmit { Task { await family.renameChild(pirateName.trimmed) } }
                    }
                }

                Section {
                    Toggle("Demo mode", isOn: Binding(
                        get: { app.isDemo },
                        set: { on in
                            if on {
                                let center = location.latestFix?.coordinate
                                    ?? family.adventurePlacements.first?.spot
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
                    Text("Demo mode scatters pretend treasure around you and adds a Sail here button. It uses a separate pretend family, so nothing it does reaches your real hunt or your pirate's chest.")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Palette.ground1.ignoresSafeArea())
            .navigationTitle("Grown-ups")
            .sheet(isPresented: $hiding) { HideTreasureFlow() }
            .confirmationDialog("Remove this treasure from the hunt?", isPresented: Binding(
                get: { removing != nil }, set: { if !$0 { removing = nil } }
            ), titleVisibility: .visible) {
                Button("Remove", role: .destructive) {
                    if let removing { Task { await family.removePlacement(removing) } }
                }
            } message: {
                Text("If your pirate already found it, it stays in their chest.")
            }
        }
    }
}

private struct HiddenRow: View {
    let placement: ChestPlacement
    let look: TreasureLook?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: look?.model.symbol ?? "questionmark")
                .font(.title2)
                .foregroundStyle(look.map { Color($0.color) } ?? Palette.textMuted)
                .frame(width: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(look?.name ?? "Treasure").font(Typeface.body(16, weight: .semibold))
                Text(placement.hint.isEmpty ? "No clue" : "Clue: \(placement.hint)")
                    .font(Typeface.body(13))
                    .foregroundStyle(Palette.textSecondary)
                Text("Spot checked \(placement.reviewedAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(Typeface.body(11))
                    .foregroundStyle(Palette.textMuted)
            }
        }
    }
}

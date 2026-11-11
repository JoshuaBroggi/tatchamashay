import SwiftUI

/// The grown-ups' area: today's hunt, setting up a new one, Get ready, settings, and Demo mode.
struct ParentView: View {
    @Environment(AppModel.self) private var app
    @Environment(FamilyModel.self) private var family
    @Environment(LocationService.self) private var location

    @State private var hiding = false
    @State private var settingUp = false
    @State private var gettingReady: Adventure.ID?
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
                        .disabled(family.adventure?.isFull ?? false)
                        .accessibilityIdentifier("hideTreasure")
                    }
                } header: {
                    Text(family.adventure?.title ?? "Today's Hunt")
                } footer: {
                    Text(huntFooter)
                }

                if !app.isDemo {
                    Section {
                        Button {
                            settingUp = true
                        } label: {
                            Label("Set up a new hunt", systemImage: "map")
                        }
                        .accessibilityIdentifier("setupHunt")
                        Button {
                            gettingReady = family.adventure?.id
                        } label: {
                            Label("Get ready to go", systemImage: "checkmark.seal")
                        }
                        .disabled(family.adventure == nil)
                        .accessibilityIdentifier("getReady")
                        NavigationLink {
                            GrownUpSettingsView()
                        } label: {
                            Label("Settings and pirates", systemImage: "gearshape")
                        }
                        .accessibilityIdentifier("grownUpSettings")
                    } footer: {
                        Text("A new hunt takes about 5 minutes: pick a place, pick a story, hide 3 to 5 chests.")
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
            .sheet(isPresented: $settingUp) { SetupHuntFlow() }
            .sheet(item: Binding(get: { gettingReady.map(ReadyTarget.init) }, set: { gettingReady = $0?.id })) { target in
                NavigationStack { GetReadyView(adventureID: target.id) { gettingReady = nil } }
            }
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

private struct ReadyTarget: Identifiable {
    let id: Adventure.ID
}

extension ParentView {
    fileprivate var huntFooter: String {
        let rule = "Only you place treasure, on a spot you've checked on the map. Removing one never takes it out of a chest."
        guard let adventure = family.adventure, !app.isDemo else { return rule }
        switch adventure.readiness {
        case .ready: return rule
        case .needsMore(let n): return "Hide \(n) more for a full hunt. " + rule
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

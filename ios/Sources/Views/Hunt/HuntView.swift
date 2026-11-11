import MapKit
import SwiftUI

/// The child's treasure map: real streets with a parchment tint, the X, a warm/cold signal, Dig! when
/// close, and the parent's We found it. No direction arrows; the parent guides.
struct HuntView: View {
    @Environment(AppModel.self) private var app
    @Environment(FamilyModel.self) private var family
    @Environment(LocationService.self) private var location

    @State private var camera: MapCameraPosition = .automatic
    @State private var tracker: DigRangeTracker?
    @State private var dig = DigState(showsDig: false, signal: .foggy, warmth: nil)
    @State private var reveal: Reveal?
    @State private var saving = false
    @State private var confirmingFound = false

    var body: some View {
        ZStack(alignment: .top) {
            map
            header
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { bottomPanel }
        .background(Palette.ground1)
        .onAppear {
            family.startRunIfNeeded()
            frameNextSpot()
        }
        .task {
            while !Task.isCancelled {
                tick()
                try? await Task.sleep(for: .seconds(1))
            }
        }
        .onChange(of: location.latestFix) { tick() }
        .onChange(of: family.nextPlacement?.id) {
            tracker = nil
            tick()
            frameNextSpot()
        }
        .fullScreenCover(item: $reveal) { reveal in
            ChestOpeningView(look: reveal.record.savedCopy, foundAgain: reveal.foundAgain,
                             hiddenBy: family.parent?.displayName) {
                self.reveal = nil
            }
        }
        .confirmationDialog("Grown-ups: are you at the treasure spot together?",
                            isPresented: $confirmingFound, titleVisibility: .visible) {
            Button("Yes, we found it") { find(method: .parentConfirmed) }
            Button("Not yet", role: .cancel) {}
        }
    }

    // MARK: Map

    private var map: some View {
        Map(position: $camera, interactionModes: [.pan, .zoom]) {
            if let fix = app.isDemo ? app.demoFix : nil {
                Annotation("You", coordinate: fix.coordinate.clCoordinate) {
                    Image(systemName: "sailboat.fill")
                        .font(.title2)
                        .foregroundStyle(Palette.mapInk)
                        .padding(6)
                        .background(Palette.parchment, in: Circle())
                }
            } else {
                UserAnnotation()
            }

            ForEach(family.adventurePlacements) { placement in
                Annotation("", coordinate: placement.spot.clCoordinate, anchor: .center) {
                    XMark(found: family.isFoundThisRun(placement), isNext: placement.id == family.nextPlacement?.id)
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll, showsTraffic: false))
        // Light map tiles keep streets and water readable outdoors, whatever the phone's appearance.
        .environment(\.colorScheme, .light)
        // A light parchment tint. Streets, water and buildings stay readable.
        .colorMultiply(Color(hex: 0xF6EBD0))
        .overlay {
            Rectangle()
                .strokeBorder(
                    LinearGradient(colors: [Palette.parchmentEdge, Palette.mapInk], startPoint: .top, endPoint: .bottom),
                    lineWidth: 4
                )
                .allowsHitTesting(false)
        }
        .mapControls {
            MapUserLocationButton()
            MapCompass()
            MapScaleView()
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Overline(text: "Treasure Map")
                Text(family.adventure?.title ?? "No hunt yet")
                    .font(Typeface.mapScript(22))
                    .foregroundStyle(Palette.textPrimary)
            }
            Spacer()
            if let child = family.child {
                Text(child.pirateName)
                    .font(Typeface.body(13))
                    .foregroundStyle(Palette.textSecondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Palette.panel)
    }

    // MARK: Bottom panel

    @ViewBuilder
    private var bottomPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            if family.adventurePlacements.isEmpty {
                Text("No treasure is hidden yet.")
                    .font(Typeface.headline(28))
                Text("Grown-ups: hide one from the Grown-ups tab.")
                    .font(Typeface.body(14))
                    .foregroundStyle(Palette.textSecondary)
            } else if family.isRunComplete {
                finale
            } else if let next = family.nextPlacement {
                hunting(next)
            }
            if let error = family.errorMessage {
                Text(error).font(Typeface.body(13)).foregroundStyle(Palette.invented)
            }
        }
        .foregroundStyle(Palette.textPrimary)
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.ground1)
    }

    @ViewBuilder
    private func hunting(_ next: ChestPlacement) -> some View {
        if !next.hint.isEmpty {
            (Text("Clue: ") + Text("“\(next.hint)”").foregroundStyle(Palette.textSecondary))
                .font(Typeface.body(15))
        }

        if dig.signal == .foggy {
            VStack(alignment: .leading, spacing: 4) {
                Text("The map's a bit foggy here, matey!")
                    .font(Typeface.body(15, weight: .semibold))
                    .foregroundStyle(Palette.rune)
                Text(location.isDenied
                     ? "Location is off. Grown-ups: tap We found it when you reach the spot."
                     : "Grown-ups: tap We found it when you reach the spot.")
                    .font(Typeface.body(13))
                    .foregroundStyle(Palette.textSecondary)
            }
        } else {
            WarmthBar(warmth: dig.warmth)
        }

        HStack(spacing: 10) {
            Button("We found it") { confirmingFound = true }
                .buttonStyle(OutlineButtonStyle())
                .disabled(saving)
            if dig.showsDig {
                Button("Dig!") { find(method: .dig) }
                    .buttonStyle(GoldButtonStyle(fontSize: 26))
                    .disabled(saving)
                    .transition(.scale.combined(with: .opacity))
                    .accessibilityIdentifier("dig")
            }
        }
        .animation(.spring(duration: 0.3), value: dig.showsDig)

        if app.isDemo {
            Button("Sail here (demo only)") { app.sail(to: next.spot) }
                .buttonStyle(OutlineButtonStyle(height: 40))
        }

        Text("Stay on paths · play with a grown-up nearby")
            .font(Typeface.body(11))
            .foregroundStyle(Palette.textMuted)
            .frame(maxWidth: .infinity)
    }

    private var finale: some View {
        VStack(alignment: .leading, spacing: 10) {
            Overline(text: family.adventure?.goal ?? "Hunt complete")
            Text(family.adventure?.finale ?? "Back to the ship!")
                .font(Typeface.headline(40))
                .textCase(.uppercase)
            Text("Every treasure is safe in \(family.child?.pirateName ?? "your")'s chest.")
                .font(Typeface.body(14))
                .foregroundStyle(Palette.textSecondary)
            Button("Play again") { family.startNewRun() }
                .buttonStyle(OutlineButtonStyle())
        }
    }

    // MARK: Logic

    /// Opens the map at street level around the next X, so roads and paths nearby are visible.
    private func frameNextSpot() {
        guard let next = family.nextPlacement else { return }
        camera = .camera(MapCamera(centerCoordinate: next.spot.clCoordinate, distance: 700))
    }

    private func tick() {
        guard let next = family.nextPlacement else { return }
        if tracker?.target != next.spot { tracker = DigRangeTracker(target: next.spot) }
        let now = Date.now
        let fix = app.isDemo ? app.demoFix.map { LocationFix(coordinate: $0.coordinate, horizontalAccuracy: 5, timestamp: now) }
                                ?? location.currentFix(now: now)
                             : location.currentFix(now: now)
        if let state = tracker?.update(with: fix, now: now), state != dig { dig = state }
    }

    private func find(method: FindMethod) {
        guard let next = family.nextPlacement, !saving else { return }
        saving = true
        Task {
            if let result = await family.recordFind(next, method: method) {
                reveal = Reveal(result)
            }
            saving = false
        }
    }
}

/// What the chest reveal shows after a find.
struct Reveal: Identifiable {
    let record: CollectionRecord
    let foundAgain: Bool
    var id: String { "\(record.id)-\(record.foundAgainCount)" }

    init(_ result: CollectResult) {
        record = result.record
        if case .foundAgain = result { foundAgain = true } else { foundAgain = false }
    }
}

/// The red X that marks the spot.
struct XMark: View {
    let found: Bool
    let isNext: Bool

    var body: some View {
        if found {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 26))
                .foregroundStyle(Palette.mapInk.opacity(0.7))
        } else {
            Text("✕")
                .font(Typeface.mapScript(isNext ? 48 : 34))
                .foregroundStyle(Palette.mapRed)
                .shadow(color: Palette.parchment, radius: 2)
                .accessibilityLabel("Treasure spot")
        }
    }
}

/// Cold to hot, filled by how close the last good fix was. Never points anywhere.
struct WarmthBar: View {
    let warmth: Warmth?

    private var label: String {
        switch warmth {
        case .hot: "Hot! Dig nearby!"
        case .warm: "Warm"
        case .cool: "Getting warmer…"
        case .cold, nil: "Cold"
        }
    }

    private var fill: Double {
        switch warmth {
        case .hot: 1
        case .warm: 0.7
        case .cool: 0.4
        case .cold, nil: 0.12
        }
    }

    var body: some View {
        HStack(spacing: 8) {
            Text("SIGNAL")
                .font(Typeface.label())
                .tracking(2)
                .foregroundStyle(Palette.textSecondary)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle().fill(Palette.borderQuiet)
                    Rectangle()
                        .fill(LinearGradient(colors: [Color(hex: 0x5DA3C8), Palette.rune, Palette.gold],
                                             startPoint: .leading, endPoint: .trailing))
                        .frame(width: geo.size.width * fill)
                }
            }
            .frame(height: 8)
            Text(label)
                .font(Typeface.label())
                .foregroundStyle(Palette.gold)
                .fixedSize()
        }
        .animation(.easeInOut, value: fill)
    }
}

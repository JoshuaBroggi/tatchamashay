import MapKit
import SwiftUI

/// The child's treasure map: real streets inside a parchment frame, only the next X, a dashed trail
/// through the spots already found, the parent's place hint, a warm/cold signal, a big Dig! when
/// close, and the parent's We found it. No direction arrows; the parent guides.
///
/// The hunt doesn't speak. It publishes each moment on `AppModel.huntMoment` for the guide.
struct HuntView: View {
    @Environment(AppModel.self) private var app
    @Environment(FamilyModel.self) private var family
    @Environment(LocationService.self) private var location

    @State private var camera: MapCameraPosition = .automatic
    @State private var tracker: DigRangeTracker?
    @State private var dig = DigState(showsDig: false, signal: .foggy, warmth: nil)
    @State private var moments = HuntMomentTracker()
    @State private var momentLog: [GuideMoment] = []
    @State private var reveal: Reveal?
    @State private var saving = false
    @State private var confirmingFound = false

    var body: some View {
        VStack(spacing: 0) {
            header
            PirateMapFrame(title: family.adventure?.title) { map }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { bottomPanel }
        .background(Palette.ground1)
        .onAppear {
            family.startRunIfNeeded()
            startMoments()
            frameNextSpot()
        }
        .task {
            while !Task.isCancelled {
                tick()
                try? await Task.sleep(for: .seconds(1))
            }
        }
        .onChange(of: location.latestFix) { tick() }
        .onChange(of: app.demoFix) { tick() }
        .onChange(of: family.currentRun?.id) { startMoments() }
        .onChange(of: family.nextPlacement?.id) {
            tracker = nil
            dig = DigState(showsDig: false, signal: dig.signal, warmth: nil)
            tick()
            frameNextSpot()
        }
        .fullScreenCover(item: $reveal) { reveal in
            ChestOpeningView(look: reveal.record.savedCopy, foundAgain: reveal.foundAgain,
                             hiddenBy: family.parent?.displayName) {
                self.reveal = nil
                publish(moments.revealClosed(reveal.record.placementID, progress: family.progress, now: .now))
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

            // The trail joins the spots already found, in play order (the order they were found).
            // It never reaches toward the next X.
            if foundSpots.count > 1 {
                MapPolyline(coordinates: foundSpots.map(\.spot.clCoordinate))
                    .stroke(Palette.mapRed, style: StrokeStyle(lineWidth: 4, lineCap: .round, dash: [9, 9]))
            }
            ForEach(foundSpots) { placement in
                Annotation("", coordinate: placement.spot.clCoordinate, anchor: .center) {
                    FoundMark()
                }
                .annotationTitles(.hidden)
            }
            // Only the next X shows; the rest stay a surprise.
            if let next = family.nextPlacement {
                Annotation("", coordinate: next.spot.clCoordinate, anchor: .center) {
                    XMark()
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll, showsTraffic: false))
        // Light map tiles keep streets and water readable outdoors, whatever the phone's appearance.
        .environment(\.colorScheme, .light)
        // A light parchment tint. Streets, water and buildings stay readable.
        .colorMultiply(Color(hex: 0xF6EBD0))
        .mapControls {
            MapUserLocationButton()
            MapScaleView()
        }
    }

    private var foundSpots: [ChestPlacement] {
        family.adventurePlacements.filter { family.isFoundThisRun($0) }
    }

    private var header: some View {
        HStack(alignment: .center) {
            Overline(text: "Treasure Map")
            Spacer()
            if !family.adventurePlacements.isEmpty {
                let progress = family.progress
                HStack(spacing: 10) {
                    ProgressPips(found: progress.foundCount, total: progress.total)
                    Text("\(progress.foundCount) of \(progress.total) found")
                        .font(Typeface.body(18, weight: .semibold))
                        .foregroundStyle(Palette.textPrimary)
                        .accessibilityIdentifier("huntProgress")
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Palette.ground1)
        .overlay(alignment: .topLeading) { momentProbe }
    }

    /// Debug builds: the moments published so far, for the UI test. Invisible.
    @ViewBuilder
    private var momentProbe: some View {
        #if DEBUG
        Color.clear
            .frame(width: 1, height: 1)
            .accessibilityElement()
            .accessibilityIdentifier("huntMoments")
            .accessibilityValue(momentLog.map(\.rawValue).joined(separator: ","))
        #endif
    }

    // MARK: Bottom panel

    @ViewBuilder
    private var bottomPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            if family.adventurePlacements.isEmpty {
                Text("No treasure is hidden yet.")
                    .font(Typeface.headline(28))
                Text("Grown-ups: hide one from the Grown-ups tab.")
                    .font(Typeface.body(16))
                    .foregroundStyle(Palette.textSecondary)
            } else if family.isRunComplete {
                finale
            } else if let next = family.nextPlacement {
                hunting(next)
            }
            if let error = family.errorMessage {
                Text(error).font(Typeface.body(15)).foregroundStyle(Palette.invented)
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
            VStack(alignment: .leading, spacing: 4) {
                Overline(text: "Clue · treasure \(family.progress.nextNumber ?? 1)")
                Text(next.hint)
                    .font(Typeface.body(22, weight: .semibold))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("huntHint")
            }
        }

        if dig.signal == .foggy {
            VStack(alignment: .leading, spacing: 4) {
                Text("The map's a bit foggy here, matey!")
                    .font(Typeface.body(19, weight: .semibold))
                    .foregroundStyle(Palette.rune)
                Text(location.isDenied
                     ? "Location is off. Grown-ups: tap We found it when you reach the spot."
                     : "Grown-ups: tap We found it when you reach the spot.")
                    .font(Typeface.body(15))
                    .foregroundStyle(Palette.textSecondary)
            }
        } else {
            WarmthBar(warmth: dig.warmth)
        }

        if dig.showsDig {
            Button("Dig!") { find(method: .dig) }
                .buttonStyle(GoldButtonStyle(height: 96, fontSize: 44))
                .disabled(saving)
                .transition(.scale.combined(with: .opacity))
                .accessibilityIdentifier("dig")
        }

        // Always there, always works: a reward never depends on GPS.
        Button("We found it") { confirmingFound = true }
            .buttonStyle(OutlineButtonStyle(height: 56))
            .disabled(saving)
            .accessibilityIdentifier("weFoundIt")

        if app.isDemo {
            Button("Sail here (demo only)") { app.sail(to: next.spot) }
                .buttonStyle(OutlineButtonStyle(height: 40))
        }

        Text("Stay on paths · play with a grown-up nearby")
            .font(Typeface.body(13))
            .foregroundStyle(Palette.textSecondary)
            .frame(maxWidth: .infinity)
    }

    private var finale: some View {
        VStack(alignment: .leading, spacing: 10) {
            Overline(text: family.adventure?.goal ?? "Hunt complete")
            Text(family.adventure?.finale ?? "Back to the ship!")
                .font(Typeface.headline(44))
                .textCase(.uppercase)
                .accessibilityIdentifier("huntFinale")
            Text("Every treasure is safe in \(family.child?.pirateName ?? "your")'s chest.")
                .font(Typeface.body(16))
                .foregroundStyle(Palette.textSecondary)
            Button("Play again") { family.startNewRun() }
                .buttonStyle(OutlineButtonStyle())
        }
    }

    // MARK: Logic

    /// Opens the map at street level around the next X, so roads and paths nearby are visible.
    /// At the finale, shows the whole trail instead.
    private func frameNextSpot() {
        if let next = family.nextPlacement {
            camera = .camera(MapCamera(centerCoordinate: next.spot.clCoordinate, distance: 700))
        } else if family.isRunComplete, !foundSpots.isEmpty {
            let rect = foundSpots
                .map { MKMapRect(origin: MKMapPoint($0.spot.clCoordinate), size: MKMapSize(width: 1, height: 1)) }
                .reduce(MKMapRect.null) { $0.union($1) }
            let pad = max(rect.width, rect.height) * 0.35 + 300
            camera = .rect(rect.insetBy(dx: -pad, dy: -pad))
        }
    }

    private func startMoments() {
        guard let run = family.currentRun else { return }
        publish(moments.start(run: run.id, progress: family.progress, now: .now))
    }

    private func tick() {
        guard let next = family.nextPlacement else { return }
        if tracker?.target != next.spot { tracker = DigRangeTracker(target: next.spot) }
        let now = Date.now
        let fix = app.isDemo ? app.demoFix.map { LocationFix(coordinate: $0.coordinate, horizontalAccuracy: 5, timestamp: now) }
                                ?? location.currentFix(now: now)
                             : location.currentFix(now: now)
        guard let state = tracker?.update(with: fix, now: now) else { return }
        if state != dig {
            withAnimation(.spring(duration: 0.3)) { dig = state }
        }
        for event in moments.observe(state, progress: family.progress, now: now) { publish(event) }
    }

    private func find(method: FindMethod) {
        guard let next = family.nextPlacement, !saving else { return }
        if method == .dig { app.sounds.play(.dig) }
        saving = true
        let before = family.progress
        Task {
            if let result = await family.recordFind(next, method: method) {
                publish(moments.found(next.id, method: method, progress: before, now: .now))
                reveal = Reveal(result)
            }
            saving = false
        }
    }

    private func publish(_ event: HuntMomentEvent?) {
        guard let event else { return }
        app.huntMoment = event
        momentLog.append(event.moment)
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

/// The parchment edge around the real map: burnt edges and a written title. The map inside is only
/// lightly tinted, so streets, paths, water and buildings stay readable.
struct PirateMapFrame<Content: View>: View {
    let title: String?
    @ViewBuilder let content: Content

    var body: some View {
        content
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay {
                // Darkens only the outer edge, like old paper, never the middle of the map.
                RoundedRectangle(cornerRadius: 6)
                    .strokeBorder(Palette.parchmentEdge.opacity(0.55), lineWidth: 14)
                    .blur(radius: 6)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .allowsHitTesting(false)
            }
            .overlay(alignment: .topLeading) {
                if let title {
                    Text(title)
                        .font(Typeface.mapScript(22))
                        .foregroundStyle(Palette.mapInk)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Palette.parchment.opacity(0.92), in: RoundedRectangle(cornerRadius: 4))
                        .padding(10)
                        .allowsHitTesting(false)
                }
            }
            .padding(8)
            .background(
                RadialGradient(colors: [Palette.parchment, Palette.parchmentMid, Palette.parchmentEdge],
                               center: .center, startRadius: 40, endRadius: 420)
            )
            .overlay(RoundedRectangle(cornerRadius: 2).stroke(Palette.mapInk, lineWidth: 2))
            .padding(.horizontal, 8)
            .padding(.bottom, 4)
    }
}

/// The red X that marks a spot, with a parchment halo so it reads on any street. The hunt shows
/// only the next one; parent setup shows every hidden spot.
struct XMark: View {
    var found = false
    var isNext = true

    var body: some View {
        if found {
            FoundMark()
        } else {
            Text("✕")
                .font(Typeface.mapScript(isNext ? 52 : 34))
                .foregroundStyle(Palette.mapRed)
                .shadow(color: Palette.parchment, radius: 0, x: 1.5, y: 1.5)
                .shadow(color: Palette.parchment, radius: 3)
                .accessibilityLabel("Treasure spot")
        }
    }
}

/// A spot already found this run.
struct FoundMark: View {
    var body: some View {
        Image(systemName: "checkmark.seal.fill")
            .font(.system(size: 28))
            .foregroundStyle(Palette.mapInk)
            .background(Palette.parchment, in: Circle())
            .accessibilityLabel("Treasure found here")
    }
}

/// One dot per treasure, filled for each found.
struct ProgressPips: View {
    let found: Int
    let total: Int

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<total, id: \.self) { i in
                Circle()
                    .fill(i < found ? Palette.gold : Color.clear)
                    .overlay(Circle().stroke(Palette.gold, lineWidth: 2))
                    .frame(width: 12, height: 12)
            }
        }
        .accessibilityHidden(true)
    }
}

/// Cold to hot, filled by how close the last trusted fix was. Never points anywhere.
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
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("SIGNAL")
                    .font(Typeface.label(13))
                    .tracking(2)
                    .foregroundStyle(Palette.textSecondary)
                Spacer()
                Text(label)
                    .font(Typeface.body(20, weight: .semibold))
                    .foregroundStyle(Palette.gold)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle().fill(Palette.borderQuiet)
                    Rectangle()
                        .fill(LinearGradient(colors: [Color(hex: 0x5DA3C8), Palette.rune, Palette.gold],
                                             startPoint: .leading, endPoint: .trailing))
                        .frame(width: geo.size.width * fill)
                }
            }
            .frame(height: 14)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Signal")
        .accessibilityValue(label)
        .accessibilityIdentifier("warmth")
        .animation(.easeInOut, value: fill)
    }
}

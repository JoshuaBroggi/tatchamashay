import MapKit
import SwiftUI

/// Every treasure the child has yet to collect, with a freely chosen target. Finding a treasure
/// saves it before the reveal; stories and adventure order never gate exploration.
struct HuntView: View {
    @Environment(AppModel.self) private var app
    @Environment(FamilyModel.self) private var family
    @Environment(LocationService.self) private var location
    @Environment(MapExperienceSettings.self) private var mapExperience
    @Environment(PlaySettings.self) private var playSettings
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.scenePhase) private var scenePhase

    @State private var camera: MapCameraPosition = .automatic
    @State private var framedMap = false
    @State private var selectedID: ChestPlacement.ID?
    @State private var choosing = false
    @State private var mapExpanded = false
    @State private var tracker: DigRangeTracker?
    @State private var dig = DigState(showsDig: false, signal: .foggy, warmth: nil)
    @State private var distance: Double?
    @State private var reveal: Reveal?
    @State private var saving = false
    @State private var confirmingFound = false
    @State private var pause = HuntPause()
    @State private var screenAwake = ScreenAwake()
    @State private var showingMapSettings = false
    @State private var movement = CharacterMovement()
    @State private var currentMapCamera: MapCamera?
    @State private var regularCamera: MapCameraPosition?
    @State private var mapVisible = false
    @State private var followingCharacter = false
    @State private var pendingTransformation: CharacterChange?
    @State private var transformation: CharacterChange?

    private var calm: Bool { playSettings.reducesMotion(system: systemReduceMotion) }

    private var selected: ChestPlacement? {
        family.unfoundPlacements.first { $0.id == selectedID }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            PirateMapFrame(title: nil) {
                // Keep one live MapKit view so covered annotations cannot remain accessible.
                if mapExpanded { Palette.parchment } else { map }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { bottomPanel }
        .background(Palette.ground1)
        .onAppear {
            mapVisible = true; frameMapIfNeeded(); tick(); keepScreenAwake()
            if regularCamera == nil { adjustMapMode() }
        }
        .onDisappear { mapVisible = false; screenAwake.update(huntActive: false) }
        .onChange(of: scenePhase) { phaseChanged() }
        .task {
            while !Task.isCancelled {
                tick()
                try? await Task.sleep(for: .seconds(1))
            }
        }
        .onChange(of: location.latestFix) { tick() }
        .onChange(of: app.demoFix) { tick() }
        .onChange(of: selectedID) { resetTarget() }
        .onChange(of: family.child?.id) {
            movement = CharacterMovement()
            pendingTransformation = nil
            transformation = nil
            reveal = nil
            selectedID = nil
            framedMap = false
            resetTarget()
            frameMapIfNeeded()
        }
        .onChange(of: family.unfoundPlacements.map(\.id)) {
            keepScreenAwake()
            if selected == nil { selectedID = nil; resetTarget() }
            frameMapIfNeeded()
        }
        .sheet(isPresented: $choosing) { treasureChooser }
        .onChange(of: mapExperience.enabled) { movement = CharacterMovement(); tick(); adjustMapMode() }
        .onChange(of: mapExperience.useFlatMap) { adjustMapMode() }
        .sheet(isPresented: $showingMapSettings) { MapSettingsView() }
        .fullScreenCover(isPresented: $mapExpanded) { expandedMap }
        .fullScreenCover(item: $reveal, onDismiss: finishReveal) { reveal in
            ChestOpeningView(look: reveal.record.savedCopy, foundAgain: reveal.foundAgain,
                             hiddenBy: family.parent?.displayName) {
                self.reveal = nil
            }
        }
        .fullScreenCover(item: $transformation) { change in
            CharacterTransformationView(previous: change.previous, character: change.character) {
                transformation = nil
            }
        }
        .confirmationDialog("Grown-ups: are you at the treasure spot together?",
                            isPresented: $confirmingFound, titleVisibility: .visible) {
            Button("Yes, we found it") { find(method: .parentConfirmed) }
            Button("Not yet", role: .cancel) {}
        }
    }

    private var map: some View {
        Map(position: $camera, interactionModes: mapExperience.uses3D ? [.pan, .zoom, .rotate] : [.pan, .zoom]) {
            if mapExperience.enabled, let coordinate = movement.coordinate {
                Annotation("You", coordinate: coordinate.clCoordinate, anchor: .bottom) { characterMarker }
                    .annotationTitles(.hidden)
            } else if let fix = app.isDemo ? app.demoFix : nil {
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
            ForEach(family.unfoundPlacements) { placement in
                Annotation("", coordinate: placement.spot.clCoordinate, anchor: .center) {
                    Button { select(placement) } label: {
                        XMark(isNext: selectedID == placement.id)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .disabled(saving)
                    .accessibilityLabel("Find \(name(of: placement))")
                    .accessibilityIdentifier("treasureMarker-\(placement.id)")
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(elevation: mapExperience.uses3D ? .realistic : .flat,
                            pointsOfInterest: .excludingAll, showsTraffic: false))
        .onMapCameraChange { context in
            currentMapCamera = context.camera
            if camera.positionedByUser { followingCharacter = false }
        }
        // The parchment tint keeps roads, paths, water and buildings readable.
        .environment(\.colorScheme, .light)
        .colorMultiply(mapExperience.enabled ? .white : Color(hex: 0xF6EBD0))
        .mapControls {
            MapUserLocationButton()
            MapScaleView()
        }
        .overlay(alignment: .bottomLeading) {
            if mapExperience.enabled {
                HStack(spacing: 6) {
                    Image(systemName: mapExperience.uses3D ? "view.3d" : "map")
                    Text(mapExperience.uses3D ? "3D exploration" : "2D exploration")
                    if movement.isUncertain { Text("· Location uncertain") }
                }
                .font(.caption.weight(.semibold))
                .accessibilityElement(children: .combine)
                .padding(8)
                .foregroundStyle(Palette.mapInk)
                .background(Palette.parchment, in: Capsule())
                .padding(10)
                .accessibilityIdentifier("characterMapMode")
                .allowsHitTesting(false)
            }
        }
        .overlay(alignment: .topLeading) {
            if mapExperience.enabled, let coordinate = movement.coordinate {
                Button {
                    followingCharacter = true
                    followCharacter(at: coordinate)
                } label: {
                    Image(systemName: followingCharacter ? "location.fill" : "location")
                        .frame(width: 44, height: 44)
                        .background(Palette.parchment, in: Circle())
                }
                .foregroundStyle(Palette.mapInk)
                .padding(10)
                .padding(.top, mapExpanded ? 54 : 0)
                .accessibilityLabel("Follow character")
                .accessibilityIdentifier("followCharacter")
            }
        }
    }

    private var characterMarker: some View {
        VStack(spacing: 0) {
            if let character = family.activeCharacter, (mapVisible || mapExpanded), reveal == nil, transformation == nil {
                WalkingCharacterView(look: character.savedCopy, walking: movement.isWalking,
                                     heading: movement.heading - (currentMapCamera?.heading ?? 0), calm: calm)
                    .frame(width: 82, height: 92)
            } else {
                Image(systemName: "figure.walk.circle.fill")
                    .font(.system(size: 42))
                    .foregroundStyle(Palette.gold)
            }
            Ellipse().fill(Palette.mapInk.opacity(0.25)).frame(width: 28, height: 5)
        }
        .opacity(movement.isUncertain ? 0.5 : 1)
        .allowsHitTesting(false)
        .accessibilityLabel(family.activeCharacter.map { "Playing as \($0.savedCopy.name)" } ?? "Your explorer")
    }

    private var header: some View {
        HStack {
            Overline(text: "Treasure Map")
            Spacer()
            Button { showingMapSettings = true } label: {
                Image(systemName: "slider.horizontal.3").frame(width: 44, height: 44)
            }
            .foregroundStyle(Palette.gold)
            .accessibilityLabel("Map settings")
            .accessibilityIdentifier("mapSettings")
            .disabled(saving)
            if !family.mapPlacements.isEmpty {
                Text("\(family.mapPlacements.count - family.unfoundPlacements.count) of \(family.mapPlacements.count) found")
                    .font(Typeface.body(18, weight: .semibold))
                    .foregroundStyle(Palette.textPrimary)
                    .accessibilityIdentifier("huntProgress")
            }
            Button { mapExpanded = true } label: {
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .frame(width: 44, height: 44)
            }
            .foregroundStyle(Palette.gold)
            .accessibilityLabel("Expand map to full screen")
            .accessibilityIdentifier("expandMap")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private var expandedMap: some View {
        ZStack {
            map.ignoresSafeArea()
            VStack(alignment: .leading) {
                Button { mapExpanded = false } label: {
                    Label("Done", systemImage: "arrow.down.right.and.arrow.up.left")
                        .padding(.horizontal, 16)
                        .frame(minHeight: 44)
                        .background(Palette.parchment, in: Capsule())
                }
                .accessibilityLabel("Close full-screen map")
                .accessibilityIdentifier("closeFullScreenMap")
                Spacer()
                if !family.unfoundPlacements.isEmpty {
                    HStack {
                        Spacer()
                        Button { frameAllTreasures() } label: {
                            Label("Show all treasures", systemImage: "viewfinder")
                                .padding(.horizontal, 16)
                                .frame(minHeight: 44)
                                .background(Palette.parchment, in: Capsule())
                        }
                        .accessibilityIdentifier("showAllTreasures")
                    }
                }
            }
            .font(Typeface.body(17, weight: .semibold))
            .foregroundStyle(Palette.mapInk)
            .buttonStyle(.plain)
            .padding(16)
        }
        .preferredColorScheme(.light)
    }

    private var bottomPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            if family.mapPlacements.isEmpty {
                Text("No treasure is hidden yet.").font(Typeface.headline(28))
                Text("Ask a grown-up to add a beast from Parents.")
                    .font(Typeface.body(16)).foregroundStyle(Palette.textSecondary)
            } else if family.unfoundPlacements.isEmpty {
                Text("You found them all!")
                    .font(Typeface.headline(32))
                    .accessibilityIdentifier("huntComplete")
                Button("My Chest") { app.selectedTab = .chest }
                    .buttonStyle(GoldButtonStyle())
                    .accessibilityIdentifier("showMyChest")
            } else {
                Button { choosing = true } label: {
                    Label(selected == nil ? "Choose a treasure" : "Choose another treasure", systemImage: "map")
                }
                .buttonStyle(OutlineButtonStyle(height: 44))
                .disabled(saving)
                .accessibilityIdentifier("chooseTreasure")
                if let selected {
                    hunting(selected)
                } else {
                    Text("Tap any X to explore.")
                        .font(Typeface.body(20, weight: .semibold))
                    Text("\(family.unfoundPlacements.count) treasures waiting")
                        .font(Typeface.body(15)).foregroundStyle(Palette.textSecondary)
                }
            }
            if let error = family.errorMessage {
                Text(error).font(Typeface.body(15)).foregroundStyle(Palette.invented)
                    .accessibilityIdentifier("huntError")
            }
        }
        .foregroundStyle(Palette.textPrimary)
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.ground1)
    }

    @ViewBuilder
    private func hunting(_ placement: ChestPlacement) -> some View {
        HStack {
            Text(name(of: placement))
                .font(Typeface.headline(26))
                .accessibilityIdentifier("selectedTreasure")
            Spacer()
            if let distance {
                Text("\(Int(distance.rounded())) m away")
                    .font(Typeface.body(15)).foregroundStyle(Palette.textSecondary)
                    .accessibilityIdentifier("treasureDistance")
            }
        }
        if !placement.hint.isEmpty {
            Text(placement.hint)
                .font(Typeface.body(20, weight: .semibold))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("huntHint")
        }
        if dig.signal == .foggy {
            Text("The map's a bit foggy here, matey!")
                .font(Typeface.body(17, weight: .semibold)).foregroundStyle(Palette.rune)
            Text(location.isDenied
                 ? "Location is off. Grown-ups: tap We found it at the spot."
                 : "Grown-ups: tap We found it at the spot.")
                .font(Typeface.body(14)).foregroundStyle(Palette.textSecondary)
        } else {
            WarmthBar(warmth: dig.warmth)
        }
        if dig.showsDig && dig.signal == .good {
            Button("Dig!") { find(method: .dig) }
                .buttonStyle(GoldButtonStyle(height: 72, fontSize: 36))
                .disabled(saving)
                .accessibilityIdentifier("dig")
        }
        Button("We found it") { confirmingFound = true }
            .buttonStyle(OutlineButtonStyle(height: 48))
            .disabled(saving)
            .accessibilityIdentifier("weFoundIt")
        if app.isDemo {
            Button("Sail here (demo only)") { app.sail(to: placement.spot) }
                .buttonStyle(OutlineButtonStyle(height: 40))
        }
        Text("Stay on paths · play with a grown-up nearby")
            .font(Typeface.body(12)).foregroundStyle(Palette.textSecondary)
            .frame(maxWidth: .infinity)
    }

    /// A list makes even treasures at exactly the same coordinate individually reachable.
    private var treasureChooser: some View {
        NavigationStack {
            List(family.unfoundPlacements) { placement in
                Button { select(placement); choosing = false } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(Palette.gold)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(name(of: placement)).font(Typeface.body(18, weight: .semibold))
                            if !placement.hint.isEmpty {
                                Text(placement.hint).font(Typeface.body(14)).foregroundStyle(Palette.textSecondary)
                            }
                        }
                        Spacer()
                        if selectedID == placement.id { Image(systemName: "checkmark") }
                    }
                    .foregroundStyle(Palette.textPrimary)
                    .padding(.vertical, 6)
                }
                .accessibilityLabel("Choose \(name(of: placement))")
                .accessibilityIdentifier("chooseTreasure-\(placement.id)")
                .listRowBackground(Palette.ground2)
            }
            .scrollContentBackground(.hidden)
            .background(Palette.ground1)
            .navigationTitle("Choose a treasure")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { choosing = false } }
            }
        }
        .tint(Palette.gold)
    }

    private func name(of placement: ChestPlacement) -> String {
        family.design(for: placement)?.version(placement.versionID)?.look.name ?? "Treasure"
    }

    private func select(_ placement: ChestPlacement) {
        guard !saving else { return }
        selectedID = placement.id
    }

    private func resetTarget() {
        tracker = selected.map { DigRangeTracker(target: $0.spot) }
        dig = DigState(showsDig: false, signal: .foggy, warmth: nil)
        distance = nil
        confirmingFound = false
        tick()
    }

    /// Fit every remaining treasure once; selecting or walking never overrides the child's pan/zoom.
    private func frameMapIfNeeded() {
        guard !framedMap else { return }
        frameAllTreasures()
    }

    private func frameAllTreasures() {
        guard !family.unfoundPlacements.isEmpty else { return }
        let rect = family.unfoundPlacements
            .map { MKMapRect(origin: MKMapPoint($0.spot.clCoordinate), size: MKMapSize(width: 1, height: 1)) }
            .reduce(MKMapRect.null) { $0.union($1) }
        let pad = max(rect.width, rect.height) * 0.25 + 300
        camera = .rect(rect.insetBy(dx: -pad, dy: -pad))
        framedMap = true
    }

    /// The screen stays on while there is a treasure left to find and the hunt is in front.
    private func keepScreenAwake() {
        screenAwake.update(huntActive: scenePhase == .active && !family.unfoundPlacements.isEmpty)
    }

    /// Away from the screen (another app, the lock screen): stop the voice and sounds and stop
    /// judging GPS. Back again: if the hunt was away longer than a fix stays fresh, forget the old
    /// Dig! decision and wait for a new fix.
    private func phaseChanged() {
        if scenePhase == .active {
            if pause.resume(now: .now) {
                tracker = nil
                dig = DigState(showsDig: false, signal: .foggy, warmth: nil)
            }
            tick()
        } else {
            pause.pause(now: .now)
            if scenePhase == .background {
                app.sounds.stopAll()
            }
        }
        keepScreenAwake()
    }

    private func tick() {
        guard !pause.isPaused else { return }
        let now = Date.now
        let fix = app.isDemo ? app.demoFix.map {
            LocationFix(coordinate: $0.coordinate, horizontalAccuracy: 5, timestamp: now)
        } ?? location.currentFix(now: now) : location.currentFix(now: now)
        if mapExperience.enabled {
            var next = movement
            next.update(fix, now: now)
            let moved = next.coordinate != movement.coordinate
            if !calm, next.isWalking, let old = movement.coordinate, let new = next.coordinate,
               Geo.distance(old, new) < 20 {
                withAnimation(.linear(duration: 0.7)) { movement = next }
            } else {
                movement = next
            }
            if followingCharacter, moved, let coordinate = next.coordinate { followCharacter(at: coordinate) }
        }
        guard let selected else { return }
        if tracker?.target != selected.spot { tracker = DigRangeTracker(target: selected.spot) }
        guard let state = tracker?.update(with: fix, now: now) else { return }
        dig = state
        distance = fix.flatMap { FindRules.standard.trusts($0, now: now) ? Geo.distance($0.coordinate, selected.spot) : nil }
    }

    private func find(method: FindMethod) {
        guard let selected, !saving else { return }
        tick()
        guard method != .dig || (dig.showsDig && dig.signal == .good) else { return }
        if method == .dig { app.sounds.play(.dig) }
        saving = true
        let equipCharacter = mapExperience.enabled
        let previous = family.activeCharacter?.savedCopy
        Task {
            if let result = await family.recordFind(selected, method: method, equipCharacter: equipCharacter),
               result.record.childID == family.child?.id {
                if equipCharacter, case .newTreasure = result {
                    pendingTransformation = CharacterChange(childID: result.record.childID,
                                                            previous: previous, character: result.record.savedCopy)
                }
                reveal = Reveal(result)
                selectedID = nil
            }
            saving = false
        }
    }

    private func finishReveal() {
        defer { pendingTransformation = nil }
        guard mapExperience.enabled, let pendingTransformation,
              pendingTransformation.childID == family.child?.id else { return }
        transformation = pendingTransformation
    }

    private func adjustMapMode() {
        guard mapExperience.enabled else {
            followingCharacter = false
            if let regularCamera { camera = regularCamera; self.regularCamera = nil }
            return
        }
        if regularCamera == nil { regularCamera = camera }
        let center = currentMapCamera?.centerCoordinate
            ?? movement.coordinate?.clCoordinate
            ?? family.unfoundPlacements.first?.spot.clCoordinate
        guard let center else { return }
        camera = .camera(MapCamera(centerCoordinate: center,
                                   distance: min(max(currentMapCamera?.distance ?? 700, 250), 2_000),
                                   heading: currentMapCamera?.heading ?? 0,
                                   pitch: mapExperience.uses3D ? 55 : 0))
    }

    private func followCharacter(at coordinate: Coordinate) {
        camera = .camera(MapCamera(centerCoordinate: coordinate.clCoordinate,
                                   distance: min(max(currentMapCamera?.distance ?? 500, 250), 1_200),
                                   heading: currentMapCamera?.heading ?? 0,
                                   pitch: mapExperience.uses3D ? 55 : 0))
    }
}

/// What the chest reveal shows after a successfully saved find.
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

/// Every unfound treasure has an X; the selected one is larger.
struct XMark: View {
    var isNext = true

    var body: some View {
        Text("✕")
            .font(Typeface.mapScript(isNext ? 52 : 34))
            .foregroundStyle(Palette.mapRed)
            .shadow(color: Palette.parchment, radius: 0, x: 1.5, y: 1.5)
            .shadow(color: Palette.parchment, radius: 3)
            .accessibilityLabel("Treasure spot")
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

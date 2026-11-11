import MapKit
import SwiftUI

struct MapScreen: View {
    @Environment(TreasureStore.self) private var store
    @Environment(LocationService.self) private var location

    @AppStorage("mapTheme") private var theme: MapTheme = .pirate
    @State private var camera: MapCameraPosition = .userLocation(fallback: .automatic)
    @State private var selectedID: UUID?
    @State private var opening: Treasure?

    private var selected: Treasure? {
        store.treasures.first { $0.id == selectedID }
    }

    var body: some View {
        ZStack {
            map
            vignette
            VStack {
                header
                Spacer()
                if let selected {
                    TreasureCard(treasure: selected) { opening = selected }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 8)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .animation(.spring(duration: 0.35), value: selectedID)
        .fullScreenCover(item: $opening) { treasure in
            ChestOpeningView(treasure: treasure) {
                store.collect(treasure)
                opening = nil
            }
        }
    }

    private var map: some View {
        Map(position: $camera, selection: $selectedID) {
            if let override = location.testOverride {
                Annotation("You", coordinate: override.coordinate) {
                    Image(systemName: "sailboat.fill")
                        .font(.title2)
                        .foregroundStyle(Palette.ink)
                        .padding(6)
                        .background(Palette.parchment, in: Circle())
                }
            } else {
                UserAnnotation()
            }

            ForEach(store.treasures) { treasure in
                Annotation(treasure.title, coordinate: treasure.coordinate, anchor: .center) {
                    TreasurePin(
                        rarity: treasure.rarity,
                        collected: store.isCollected(treasure),
                        inRange: store.canCollect(treasure, from: location.location),
                        selected: treasure.id == selectedID
                    )
                }
                .annotationTitles(.hidden)
                .tag(treasure.id)
            }

            if let selected {
                MapCircle(center: selected.coordinate, radius: TreasureStore.collectRadius)
                    .foregroundStyle(Palette.blood.opacity(0.12))
                    .stroke(Palette.blood.opacity(0.6), style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
            }
        }
        .mapStyle(theme.mapStyle)
        .mapControls {
            MapUserLocationButton()
            MapCompass()
        }
        .colorMultiply(theme.tint)
    }

    private var vignette: some View {
        RadialGradient(colors: [.clear, .clear, theme.vignette], center: .center, startRadius: 120, endRadius: 520)
            .ignoresSafeArea()
            .allowsHitTesting(false)
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 0) {
                Text("Tatchamashay")
                    .font(.pirate(26, weight: .black))
                Text("\(store.treasures.count - store.collected.count) treasures left to find")
                    .font(.pirate(13, weight: .regular))
            }
            Spacer()
            Menu {
                Picker("Map look", selection: $theme) {
                    ForEach(MapTheme.allCases) { Text($0.name).tag($0) }
                }
            } label: {
                Image(systemName: "paintpalette.fill")
                    .font(.title3)
                    .padding(10)
                    .background(Palette.parchment, in: Circle())
                    .overlay(Circle().stroke(Palette.ink, lineWidth: 1.5))
            }
        }
        .foregroundStyle(Palette.ink)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(ParchmentBackground().clipShape(RoundedRectangle(cornerRadius: 14)).shadow(radius: 4))
        .padding(.horizontal, 12)
    }
}

/// The red X that marks the spot.
struct TreasurePin: View {
    let rarity: Rarity
    let collected: Bool
    let inRange: Bool
    let selected: Bool

    @State private var pulse = false

    var body: some View {
        if collected {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 20))
                .foregroundStyle(Palette.ink.opacity(0.5))
        } else {
            ZStack {
                Circle()
                    .fill(rarity.color.opacity(inRange ? 0.55 : 0.3))
                    .frame(width: 44, height: 44)
                    .scaleEffect(pulse ? 1.25 : 0.9)
                ForEach([45.0, -45.0], id: \.self) { angle in
                    Capsule()
                        .fill(Palette.blood)
                        .frame(width: 7, height: 30)
                        .rotationEffect(.degrees(angle))
                }
            }
            .scaleEffect(selected ? 1.3 : 1)
            .shadow(color: .black.opacity(0.35), radius: 2, y: 1)
            .onAppear {
                withAnimation(.easeInOut(duration: inRange ? 0.6 : 1.4).repeatForever()) { pulse = true }
            }
        }
    }
}

/// Bottom card for the treasure the player tapped.
struct TreasureCard: View {
    @Environment(TreasureStore.self) private var store
    @Environment(LocationService.self) private var location

    let treasure: Treasure
    let onDig: () -> Void

    private var distance: CLLocationDistance? {
        location.location?.distance(from: treasure.location)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(store.isCollected(treasure) ? treasure.title : "Unknown treasure")
                    .font(.pirate(20))
                Spacer()
                Text(treasure.rarity.label)
                    .font(.pirate(12))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(treasure.rarity.color.opacity(0.25), in: Capsule())
            }
            Text("Hidden by \(treasure.creatorName)")
                .font(.pirate(13, weight: .regular))

            if store.isCollected(treasure) {
                Label("Already in your chest", systemImage: "checkmark.seal.fill")
                    .font(.pirate(15))
            } else if store.canCollect(treasure, from: location.location) {
                Button(action: onDig) {
                    Label("Dig it up!", systemImage: "hammer.fill")
                        .font(.pirate(18))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Palette.blood, in: RoundedRectangle(cornerRadius: 10))
                        .foregroundStyle(Palette.parchment)
                }
            } else {
                Text(distanceText)
                    .font(.pirate(15, weight: .semibold))
                Button {
                    // Testing aid until we're out walking: jump the player to just beside the treasure.
                    location.testOverride = CLLocation(latitude: treasure.latitude + 0.00008, longitude: treasure.longitude)
                } label: {
                    Label("Sail here (testing)", systemImage: "sailboat")
                        .font(.pirate(14))
                }
                .buttonStyle(.bordered)
            }
        }
        .foregroundStyle(Palette.ink)
        .padding(16)
        .background(ParchmentBackground().clipShape(RoundedRectangle(cornerRadius: 16)).shadow(radius: 6))
    }

    private var distanceText: String {
        guard let distance else { return "Waiting for your position…" }
        let away = Measurement(value: distance, unit: UnitLength.meters)
            .formatted(.measurement(width: .abbreviated, usage: .road))
        return "\(away) away — get within \(Int(TreasureStore.collectRadius)) m to dig"
    }
}

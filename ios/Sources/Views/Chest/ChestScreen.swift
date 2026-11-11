import RealityKit
import SwiftUI

/// What My Chest shows, built only from the saved copies in the child's collection records, so a
/// later edit or delete of a design never changes it. Newest find first.
struct ChestShelf: Equatable {
    struct Item: Identifiable, Equatable {
        let record: CollectionRecord
        var id: CollectionRecord.ID { record.id }
        var look: TreasureLook { record.savedCopy }
        /// "Found it again" stickers from replays.
        var stickers: Int { record.foundAgainCount }
    }

    let items: [Item]

    init(records: [CollectionRecord]) {
        items = records.sorted { $0.foundAt > $1.foundAt }.map(Item.init)
    }

    var treasureCount: Int { items.count }
    var stickerCount: Int { items.reduce(0) { $0 + $1.stickers } }

    var title: String { treasureCount == 1 ? "1 treasure" : "\(treasureCount) treasures" }
    var stickerLine: String? {
        switch stickerCount {
        case 0: nil
        case 1: "1 found-again sticker"
        default: "\(stickerCount) found-again stickers"
        }
    }
}

/// The child's chest, after the mockups' Vault screen without rarity glows or filters.
struct ChestScreen: View {
    @Environment(FamilyModel.self) private var family

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 3)

    var body: some View {
        let shelf = ChestShelf(records: family.chest)
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header(shelf)
                    if shelf.items.isEmpty {
                        Text("Your chest is empty. Follow the X on the map to find your first treasure!")
                            .font(Typeface.body(15))
                            .foregroundStyle(Palette.textSecondary)
                            .padding(.top, 40)
                    } else {
                        LazyVGrid(columns: columns, spacing: 10) {
                            ForEach(shelf.items) { item in
                                NavigationLink(value: item.record) { ChestTile(item: item) }
                                    .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 20)
            }
            .foregroundStyle(Palette.textPrimary)
            .background(Palette.ground1.ignoresSafeArea())
            .navigationDestination(for: CollectionRecord.self) { ChestDetailView(record: $0) }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private func header(_ shelf: ChestShelf) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Overline(text: "My Chest")
            Text(shelf.title).font(Typeface.headline(40))
            if let child = family.child {
                Text("\(child.pirateName)'s treasures")
                    .font(Typeface.body(13))
                    .foregroundStyle(Palette.textSecondary)
            }
            if let stickers = shelf.stickerLine {
                Label(stickers, systemImage: "star.circle.fill")
                    .font(Typeface.label(13))
                    .foregroundStyle(Palette.rune)
                    .padding(.top, 2)
                    .accessibilityIdentifier("stickerCount")
            }
        }
    }
}

struct ChestTile: View {
    let item: ChestShelf.Item
    var catalog: TreasureCatalog = .bundled

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            ZStack(alignment: .topTrailing) {
                RadialGradient(colors: [Color(item.look.color).opacity(0.5), .clear],
                               center: .center, startRadius: 0, endRadius: 45)
                thumbnail.frame(maxWidth: .infinity, maxHeight: .infinity)
                if item.stickers > 0 {
                    StickerBadge(count: item.stickers)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            Text(item.look.name)
                .font(Typeface.body(11, weight: .semibold))
                .lineLimit(2)
        }
        .padding(8)
        .frame(height: 118)
        .background(Palette.ground2)
        .overlay(Rectangle().stroke(Palette.borderQuiet, lineWidth: 1))
    }

    /// The model's thumbnail over a glow in the child's color; the model's symbol if there isn't one.
    @ViewBuilder
    private var thumbnail: some View {
        if let url = catalog.thumbnailURL(for: item.look.model), let image = UIImage(contentsOfFile: url.path) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .padding(4)
                .accessibilityHidden(true)
        } else {
            Image(systemName: item.look.model.symbol)
                .font(.system(size: 32))
                .foregroundStyle(Color(item.look.color))
        }
    }
}

/// A "found it again" star with the number of replays.
struct StickerBadge: View {
    let count: Int

    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: "star.fill")
            Text("\(count)")
        }
        .font(Typeface.label(10))
        .foregroundStyle(Palette.ground0)
        .padding(.horizontal, 5)
        .frame(height: 18)
        .background(Palette.rune)
        .accessibilityLabel(count == 1 ? "1 found-again sticker" : "\(count) found-again stickers")
    }
}

struct ChestDetailView: View {
    let record: CollectionRecord

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                SpinnableTreasure(look: record.savedCopy)
                    .frame(height: 320)
                    .background(Palette.ground0)
                    .overlay(Rectangle().stroke(Palette.borderQuiet, lineWidth: 1))
                Text("Spin it with your finger")
                    .font(Typeface.body(12))
                    .foregroundStyle(Palette.textMuted)
                Text(record.savedCopy.name)
                    .font(Typeface.headline(36))
                    .textCase(.uppercase)
                if !record.savedCopy.story.isEmpty {
                    Text(record.savedCopy.story)
                        .font(Typeface.body(16))
                        .foregroundStyle(Palette.textSecondary)
                }
                Text("Found \(record.foundAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(Typeface.body(13))
                    .foregroundStyle(Palette.textMuted)
                if record.foundAgainCount > 0 {
                    Label("Found again \(record.foundAgainCount) more \(record.foundAgainCount == 1 ? "time" : "times")",
                          systemImage: "star.circle.fill")
                        .font(Typeface.label(13))
                        .foregroundStyle(Palette.rune)
                }
            }
            .multilineTextAlignment(.center)
            .padding(16)
        }
        .foregroundStyle(Palette.textPrimary)
        .background(Palette.ground1.ignoresSafeArea())
    }
}

/// A treasure the child turns with a finger: drag sideways to spin it, and it keeps turning a little
/// after letting go. Shows the saved copy's model, color and sparkles.
struct SpinnableTreasure: View {
    let look: TreasureLook
    var catalog: TreasureCatalog = .bundled

    @Environment(PlaySettings.self) private var settings: PlaySettings?
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion

    @State private var spinner = Spinner()
    @State private var lastDrag: CGFloat = 0
    @State private var shown = "loading"
    /// Off while another tab is showing, so a hidden 3D view never competes with the chest reveal.
    @State private var onScreen = false

    var body: some View {
        ZStack {
            if onScreen { stage }
        }
        .onAppear { onScreen = true }
        .onDisappear { onScreen = false }
        .accessibilityElement()
        .accessibilityLabel(look.name)
        .accessibilityValue(shown)
        .accessibilityHint("Drag sideways to spin it")
        .accessibilityIdentifier("spinTreasure")
    }

    private var stage: some View {
        RealityView { content in
            content.camera = .virtual
            let loaded = await TreasureEntities.treasure(look, catalog: catalog)
            let pivot = Entity()
            Self.fit(loaded.entity, size: 0.4)
            pivot.addChild(loaded.entity)
            content.add(pivot)
            shown = loaded.isFallback ? "drawn" : "usdz"

            let camera = PerspectiveCamera()
            camera.camera.fieldOfViewInDegrees = 40
            camera.look(at: .zero, from: [0, 0.1, 0.85], relativeTo: nil)
            content.add(camera)
            let sun = DirectionalLight()
            sun.light.intensity = 4_000
            sun.look(at: .zero, from: [0.5, 1, 1], relativeTo: nil)
            content.add(sun)
            let fill = PointLight()
            fill.light.intensity = 30_000
            fill.position = [-0.5, 0.2, 0.6]
            content.add(fill)

            let spinner = spinner
            spinner.coast = !(settings?.reducesMotion(system: systemReduceMotion) ?? systemReduceMotion)
            spinner.subscription = content.subscribe(to: SceneEvents.Update.self) { event in
                spinner.step(event.deltaTime)
                pivot.orientation = simd_quatf(angle: spinner.angle, axis: [0, 1, 0])
            }
        }
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { drag in
                    spinner.drag(by: Float(drag.translation.width - lastDrag) * 0.012)
                    lastDrag = drag.translation.width
                }
                .onEnded { drag in
                    spinner.release(velocity: Float(drag.velocity.width) * 0.012)
                    lastDrag = 0
                }
        )
    }

    /// The spin angle, with a little coasting after the finger lifts.
    @MainActor
    final class Spinner {
        var angle: Float = 0
        var velocity: Float = 0
        var coast = true
        var subscription: EventSubscription?

        func drag(by radians: Float) {
            angle += radians
            velocity = 0
        }

        func release(velocity: Float) { self.velocity = coast ? max(min(velocity, 12), -12) : 0 }

        func step(_ delta: TimeInterval) {
            guard velocity != 0 else { return }
            angle += velocity * Float(delta)
            velocity *= pow(0.05, Float(delta))
            if abs(velocity) < 0.05 { velocity = 0 }
        }
    }

    private static func fit(_ entity: Entity, size: Float) {
        let bounds = entity.visualBounds(relativeTo: nil)
        let largest = max(bounds.extents.x, bounds.extents.y, bounds.extents.z)
        guard largest > 0 else { return }
        let scale = size / largest
        entity.scale *= scale
        entity.position -= bounds.center * scale
    }
}

import SwiftUI

/// Full-screen moment when a player digs up a treasure: the chest rattles, bursts open, and the treasure rises out.
struct ChestOpeningView: View {
    let treasure: Treasure
    let onDone: () -> Void

    private enum Stage { case closed, opening, revealed }
    @State private var stage: Stage = .closed
    @State private var rattle = false
    @State private var raysTurn = false

    var body: some View {
        ZStack {
            Palette.ink.ignoresSafeArea()
            RadialGradient(colors: [treasure.rarity.color.opacity(stage == .closed ? 0.2 : 0.8), .clear],
                           center: .center, startRadius: 10, endRadius: 400)
                .ignoresSafeArea()

            if stage != .closed {
                LightRays(color: treasure.rarity.color)
                    .rotationEffect(.degrees(raysTurn ? 360 : 0))
                    .opacity(0.6)
                    .ignoresSafeArea()
            }

            VStack(spacing: 24) {
                Text(stage == .revealed ? treasure.title : "You found something!")
                    .font(.pirate(30, weight: .black))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Palette.parchment)
                    .contentTransition(.opacity)

                ZStack {
                    if stage == .revealed {
                        TreasureModelView(model: treasure.model)
                            .frame(height: 320)
                            .transition(.scale(scale: 0.2).combined(with: .offset(y: 120)))
                    } else {
                        TreasureChest(open: stage == .opening)
                            .frame(width: 220, height: 180)
                            .rotationEffect(.degrees(rattle ? 4 : -4))
                    }
                }
                .frame(height: 320)

                if stage == .revealed {
                    VStack(spacing: 8) {
                        Text("\(treasure.rarity.label) · hidden by \(treasure.creatorName)")
                            .font(.pirate(15, weight: .semibold))
                            .foregroundStyle(treasure.rarity.color)
                        Text(treasure.story)
                            .font(.pirate(16, weight: .regular))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(Palette.parchment.opacity(0.9))
                    }
                    Button(action: onDone) {
                        Text("Add to my chest")
                            .font(.pirate(18))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Palette.gold, in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(Palette.ink)
                    }
                } else {
                    Text(stage == .closed ? "Tap the chest to open it" : " ")
                        .font(.pirate(16, weight: .regular))
                        .foregroundStyle(Palette.parchment.opacity(0.8))
                }
            }
            .padding(24)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: open)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.12).repeatForever()) { rattle = true }
        }
        .sensoryFeedback(.impact(weight: .heavy), trigger: stage)
    }

    private func open() {
        guard stage == .closed else { return }
        withAnimation(.default) { rattle = false }
        withAnimation(.spring(duration: 0.6, bounce: 0.4)) { stage = .opening }
        withAnimation(.linear(duration: 20).repeatForever(autoreverses: false)) { raysTurn = true }
        Task {
            try? await Task.sleep(for: .milliseconds(800))
            withAnimation(.spring(duration: 0.8, bounce: 0.35)) { stage = .revealed }
        }
    }
}

/// A wooden chest drawn in code. Its lid swings open on the back hinge.
struct TreasureChest: View {
    var open: Bool

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack(alignment: .bottom) {
                // Base
                ZStack {
                    RoundedRectangle(cornerRadius: 8).fill(Palette.wood)
                    VStack(spacing: h * 0.12) {
                        ForEach(0..<3, id: \.self) { _ in Rectangle().fill(.black.opacity(0.15)).frame(height: 2) }
                    }
                    HStack { band; Spacer(); band }.padding(.horizontal, w * 0.12)
                    RoundedRectangle(cornerRadius: 4).fill(Palette.gold)
                        .frame(width: w * 0.14, height: h * 0.2)
                        .overlay(Circle().fill(Palette.ink).frame(width: 8))
                        .offset(y: -h * 0.12)
                }
                .frame(height: h * 0.55)

                // Lid
                ZStack {
                    UnevenRoundedRectangle(topLeadingRadius: w * 0.4, topTrailingRadius: w * 0.4)
                        .fill(Palette.wood.mix(with: .black, by: 0.1))
                    HStack { band; Spacer(); band }.padding(.horizontal, w * 0.12)
                }
                .frame(height: h * 0.45)
                .rotation3DEffect(.degrees(open ? -115 : 0), axis: (1, 0, 0), anchor: .bottom, perspective: 0.4)
                .offset(y: -h * 0.55)
            }
            .shadow(color: .black.opacity(0.5), radius: 10, y: 8)
        }
    }

    private var band: some View {
        Rectangle().fill(Palette.gold).frame(width: 12)
    }
}

struct LightRays: View {
    let color: Color

    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let radius = max(size.width, size.height)
            for i in 0..<16 {
                let a = Double(i) / 16 * 2 * .pi
                var ray = Path()
                ray.move(to: center)
                ray.addLine(to: CGPoint(x: center.x + cos(a - 0.08) * radius, y: center.y + sin(a - 0.08) * radius))
                ray.addLine(to: CGPoint(x: center.x + cos(a + 0.08) * radius, y: center.y + sin(a + 0.08) * radius))
                ray.closeSubpath()
                context.fill(ray, with: .color(color.opacity(0.35)))
            }
        }
    }
}

// MARK: - Collection

/// Every treasure the player has dug up.
struct ChestScreen: View {
    @Environment(TreasureStore.self) private var store

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                if store.collected.isEmpty {
                    ContentUnavailableView {
                        Label("Your chest is empty", systemImage: "shippingbox")
                    } description: {
                        Text("Follow the X's on the map and dig up your first treasure.")
                    }
                    .font(.pirate(16, weight: .regular))
                    .padding(.top, 80)
                } else {
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(store.collected) { treasure in
                            NavigationLink(value: treasure) { TreasureTile(treasure: treasure) }
                                .buttonStyle(.plain)
                        }
                    }
                    .padding(16)
                }
            }
            .foregroundStyle(Palette.ink)
            .background(ParchmentBackground().ignoresSafeArea())
            .navigationTitle("My Chest (\(store.collected.count))")
            .navigationDestination(for: Treasure.self) { TreasureDetailView(treasure: $0) }
        }
    }
}

struct TreasureTile: View {
    let treasure: Treasure

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: symbol)
                .font(.system(size: 44))
                .foregroundStyle(treasure.rarity.color)
                .frame(height: 70)
            Text(treasure.title)
                .font(.pirate(14))
                .multilineTextAlignment(.center)
                .lineLimit(2)
            Text(treasure.rarity.label)
                .font(.pirate(11, weight: .regular))
        }
        .frame(maxWidth: .infinity, minHeight: 150)
        .padding(10)
        .background(Palette.parchmentDark.opacity(0.35), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(treasure.rarity.color, lineWidth: 2))
    }

    private var symbol: String {
        if case .builtIn(let model) = treasure.model { model.symbol } else { "cube.transparent.fill" }
    }
}

struct TreasureDetailView: View {
    let treasure: Treasure

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                TreasureModelView(model: treasure.model)
                    .frame(height: 340)
                    .background(Palette.ink, in: RoundedRectangle(cornerRadius: 16))
                Text(treasure.title).font(.pirate(26, weight: .black))
                Text("\(treasure.rarity.label) · hidden by \(treasure.creatorName)")
                    .font(.pirate(14, weight: .semibold))
                    .foregroundStyle(treasure.rarity.color)
                Text(treasure.story)
                    .font(.pirate(17, weight: .regular))
                    .multilineTextAlignment(.center)
                Text("Drag to turn it around")
                    .font(.pirate(12, weight: .regular))
                    .opacity(0.6)
            }
            .padding(16)
        }
        .foregroundStyle(Palette.ink)
        .background(ParchmentBackground().ignoresSafeArea())
    }
}

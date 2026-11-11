import SwiftUI

/// The chest reveal, after the mockups' Chest 1–3 and Magic Reveal frames: a sealed chest, the runes
/// ignite as the lid lifts, then the treasure rises inside a rune circle.
/// The find is already saved before this appears, so closing it early never loses the treasure.
struct ChestOpeningView: View {
    let look: TreasureLook
    let foundAgain: Bool
    let hiddenBy: String?
    let onDone: () -> Void

    private enum Stage { case sealed, igniting, revealed }
    @State private var stage: Stage = .sealed
    @State private var rattle = false
    @State private var glow = 0.0
    @State private var runesTurn = false

    var body: some View {
        ZStack {
            background
            VStack(spacing: 0) {
                Overline(text: overline, color: stage == .igniting ? Palette.rune : Palette.gold)
                    .shadow(color: .black, radius: 6)
                    .padding(.top, 40)
                Spacer()
                centerpiece
                Spacer()
                caption
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .foregroundStyle(Palette.textPrimary)
        .contentShape(Rectangle())
        .onTapGesture { if stage == .sealed { open() } }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.14).repeatForever()) { rattle = true }
        }
        .sensoryFeedback(.impact(weight: .heavy), trigger: stage)
    }

    private var overline: String {
        switch stage {
        case .sealed: "You struck wood!"
        case .igniting: "The runes ignite…"
        case .revealed: foundAgain ? "Found it again!" : "New treasure"
        }
    }

    private var background: some View {
        ZStack {
            RadialGradient(colors: [Color(hex: 0x1F4A4A), Palette.ground1, Palette.ground0],
                           center: .init(x: 0.5, y: 0.42), startRadius: 0, endRadius: 520)
            RadialGradient(colors: [Palette.gold.opacity(0.55 * glow), .clear],
                           center: .init(x: 0.5, y: 0.45), startRadius: 0, endRadius: 260)
            LinearGradient(colors: [.clear, Palette.ground0.opacity(0.92)], startPoint: .center, endPoint: .bottom)
        }
        .ignoresSafeArea()
    }

    @ViewBuilder
    private var centerpiece: some View {
        ZStack {
            if stage == .revealed {
                RuneCircle()
                    .rotationEffect(.degrees(runesTurn ? 360 : 0))
                    .frame(width: 320, height: 320)
                TreasureModelView(look: look)
                    .frame(width: 300, height: 300)
                    .transition(.scale(scale: 0.2).combined(with: .offset(y: 140)))
            } else {
                IronChest(open: stage == .igniting, runeGlow: glow)
                    .frame(width: 240, height: 200)
                    .rotationEffect(.degrees(stage == .sealed && rattle ? 3 : -3))
            }
        }
        .frame(height: 340)
    }

    @ViewBuilder
    private var caption: some View {
        VStack(spacing: 10) {
            switch stage {
            case .sealed:
                Text("A sealed chest").font(Typeface.headline(40))
                Text("Faint runes flicker on the front. Something inside is waiting.")
                    .font(Typeface.body(14)).foregroundStyle(Palette.textSecondary)
                Button("Tap to open", action: open)
                    .buttonStyle(GoldButtonStyle())
                    .accessibilityIdentifier("openChest")
                    .padding(.top, 6)
            case .igniting:
                Text("Hold steady…").font(Typeface.headline(40))
                Text("Light spills from the seam. The runes burn brighter as the lid rises.")
                    .font(Typeface.body(14)).foregroundStyle(Palette.textSecondary)
                ZStack(alignment: .leading) {
                    Rectangle().fill(Palette.borderQuiet)
                    Rectangle().fill(Palette.rune).frame(width: 200 * glow).shadow(color: Palette.rune, radius: 6)
                }
                .frame(width: 200, height: 6)
            case .revealed:
                Text(look.name)
                    .font(Typeface.headline(48))
                    .textCase(.uppercase)
                    .minimumScaleFactor(0.5)
                    .lineLimit(2)
                if !look.story.isEmpty {
                    Text(look.story).font(Typeface.body(14)).foregroundStyle(Palette.textSecondary)
                }
                if let hiddenBy {
                    Text("Hidden by \(hiddenBy)").font(Typeface.body(13)).foregroundStyle(Palette.textMuted)
                }
                if foundAgain {
                    Label("Found-it-again sticker", systemImage: "star.circle.fill")
                        .font(Typeface.label(13))
                        .foregroundStyle(Palette.rune)
                }
                Button(foundAgain ? "Back to the map" : "Into my chest", action: onDone)
                    .buttonStyle(GoldButtonStyle())
                    .padding(.top, 8)
                    .accessibilityIdentifier("revealDone")
            }
        }
        .multilineTextAlignment(.center)
    }

    private func open() {
        guard stage == .sealed else { return }
        rattle = false
        withAnimation(.spring(duration: 0.6, bounce: 0.3)) { stage = .igniting }
        withAnimation(.easeIn(duration: 1.2)) { glow = 1 }
        Task {
            try? await Task.sleep(for: .milliseconds(1300))
            withAnimation(.spring(duration: 0.9, bounce: 0.35)) { stage = .revealed }
            withAnimation(.linear(duration: 30).repeatForever(autoreverses: false)) { runesTurn = true }
        }
    }
}

/// An iron-banded wooden chest drawn in code, with runes on the front. The lid swings on its back hinge.
struct IronChest: View {
    var open: Bool
    var runeGlow: Double

    private let wood = Color(hex: 0x5A3A1E)
    private let iron = Color(hex: 0x3A3F3C)

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack(alignment: .bottom) {
                // Base
                ZStack {
                    Rectangle().fill(wood)
                    VStack(spacing: h * 0.12) {
                        ForEach(0..<3, id: \.self) { _ in Rectangle().fill(.black.opacity(0.2)).frame(height: 2) }
                    }
                    HStack { band; Spacer(); band }.padding(.horizontal, w * 0.12)
                    Text("ᚠ ᚱ ᚷ")
                        .font(.system(size: h * 0.1, weight: .semibold))
                        .foregroundStyle(Palette.rune.opacity(0.35 + 0.65 * runeGlow))
                        .shadow(color: Palette.rune, radius: 4 + 10 * runeGlow)
                        .offset(y: h * 0.12)
                    Rectangle().fill(Palette.gold)
                        .frame(width: w * 0.12, height: h * 0.16)
                        .overlay(Circle().fill(Palette.ground0).frame(width: 7))
                        .offset(y: -h * 0.14)
                }
                .frame(height: h * 0.55)
                .overlay(Rectangle().stroke(iron, lineWidth: 3))

                // Light from the seam
                Ellipse()
                    .fill(RadialGradient(colors: [Palette.gold.opacity(runeGlow), .clear], center: .center,
                                         startRadius: 0, endRadius: w * 0.5))
                    .frame(width: w * 1.1, height: h * 0.5)
                    .offset(y: -h * 0.55)
                    .blendMode(.screen)

                // Lid
                ZStack {
                    UnevenRoundedRectangle(topLeadingRadius: w * 0.3, topTrailingRadius: w * 0.3)
                        .fill(wood.mix(with: .black, by: 0.15))
                    HStack { band; Spacer(); band }.padding(.horizontal, w * 0.12)
                }
                .frame(height: h * 0.4)
                .rotation3DEffect(.degrees(open ? -70 : 0), axis: (1, 0, 0), anchor: .bottom, perspective: 0.4)
                .offset(y: -h * 0.55)
            }
            .shadow(color: .black.opacity(0.6), radius: 12, y: 10)
        }
    }

    private var band: some View {
        Rectangle().fill(iron).frame(width: 12)
    }
}

/// The glowing rune circle the treasure rises inside.
struct RuneCircle: View {
    private let glyphs = Array("ᚠᚢᚦᚨᚱᚲᚷᚹ")

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            ZStack {
                Circle()
                    .stroke(Palette.rune.opacity(0.8), lineWidth: 2)
                    .shadow(color: Palette.rune.opacity(0.6), radius: 20)
                Circle()
                    .stroke(Palette.rune.opacity(0.7), style: StrokeStyle(lineWidth: 1, dash: [5, 5]))
                    .padding(size * 0.125)
                ForEach(glyphs.indices, id: \.self) { i in
                    let angle = Double(i) / Double(glyphs.count) * 2 * .pi
                    Text(String(glyphs[i]))
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Palette.rune)
                        .shadow(color: Palette.rune, radius: 6)
                        .offset(x: cos(angle) * size * 0.5, y: sin(angle) * size * 0.5)
                }
            }
            .frame(width: size, height: size)
        }
    }
}

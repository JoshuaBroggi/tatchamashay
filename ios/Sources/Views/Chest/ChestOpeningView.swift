import RealityKit
import SwiftUI

/// The chest reveal, after the mockups' Chest 1–4 and Magic Reveal frames, with our own treasures and
/// no rarity: the chest rattles, the child taps, the lid opens with glowing runes, light and sparkles
/// rise, and the treasure floats out with its funny name, who hid it and its story.
/// The find is already saved before this appears, so closing it early never loses the treasure.
/// While it shows, `AppModel.isRevealing` is true so the guide stays quiet.
struct ChestOpeningView: View {
    let look: TreasureLook
    let foundAgain: Bool
    let hiddenBy: String?
    var memory = RevealMemory()
    let onDone: () -> Void

    @Environment(AppModel.self) private var app: AppModel?
    @Environment(PlaySettings.self) private var settings: PlaySettings?
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion

    @State private var flow = RevealFlow()
    @State private var scene: ChestRevealScene?
    @State private var glow = 0.0

    var body: some View {
        ZStack {
            background
            VStack(spacing: 0) {
                Overline(text: overline, color: flow.phase == .opening ? Palette.rune : Palette.gold)
                    .shadow(color: .black, radius: 6)
                    .padding(.top, 24)
                stage
                caption
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .foregroundStyle(Palette.textPrimary)
        .contentShape(Rectangle())
        .onTapGesture { open() }
        .onAppear {
            let calm = settings?.reducesMotion(system: systemReduceMotion) ?? systemReduceMotion
            if scene == nil { scene = ChestRevealScene(look: look, calm: calm) }
            flow = RevealFlow(canSkip: memory.hasSeenReveal)
            app?.isRevealing = true
        }
        .onDisappear { app?.isRevealing = false }
        .onChange(of: scene?.isRising) { _, rising in
            if rising == true { app?.sounds.play(.revealSparkle) }
        }
        .onChange(of: scene?.hasRevealed) { _, revealed in
            if revealed == true { finishOpening() }
        }
        .sensoryFeedback(trigger: flow.phase) { _, phase in
            switch phase {
            case .opening: .impact(weight: .heavy, intensity: isCalm ? 0.6 : 1)
            case .revealed: .success
            default: nil
            }
        }
    }

    private var isCalm: Bool { scene?.calm ?? true }

    private var overline: String {
        switch flow.phase {
        case .sealed: "You struck wood!"
        case .opening: "The runes ignite…"
        case .revealed, .added: foundAgain ? "Found it again!" : "New treasure!"
        }
    }

    private var background: some View {
        ZStack {
            RadialGradient(colors: [Color(hex: 0x1F4A4A), Palette.ground1, Palette.ground0],
                           center: .init(x: 0.5, y: 0.42), startRadius: 0, endRadius: 520)
            RadialGradient(colors: [Palette.gold.opacity(0.5 * glow), .clear],
                           center: .init(x: 0.5, y: 0.4), startRadius: 0, endRadius: 280)
            LinearGradient(colors: [.clear, Palette.ground0.opacity(0.92)], startPoint: .center, endPoint: .bottom)
        }
        .ignoresSafeArea()
    }

    @ViewBuilder
    private var stage: some View {
        ZStack {
            if flow.phase >= .revealed {
                RuneCircle()
                    .frame(width: 300, height: 300)
                    .opacity(0.7)
                    .transition(.opacity)
            }
            if let scene {
                RealityView { content in
                    await scene.make(&content)
                }
                .accessibilityElement()
                .accessibilityLabel(look.name)
                .accessibilityValue(scene.treasureShown)
                .accessibilityIdentifier("treasureModel")
            }
        }
        .frame(maxWidth: .infinity, minHeight: 280, maxHeight: 420)
    }

    @ViewBuilder
    private var caption: some View {
        VStack(spacing: 8) {
            switch flow.phase {
            case .sealed:
                Text("A sealed chest").font(Typeface.headline(38))
                Text("Something inside is wiggling!")
                    .font(Typeface.body(15)).foregroundStyle(Palette.textSecondary)
                Button("Tap to open", action: open)
                    .buttonStyle(GoldButtonStyle())
                    .accessibilityIdentifier("openChest")
                    .padding(.top, 6)
            case .opening:
                Text("Hold steady…").font(Typeface.headline(38))
                Text("The lid is lifting!")
                    .font(Typeface.body(15)).foregroundStyle(Palette.textSecondary)
                if flow.canSkip {
                    Button("Skip") { skip() }
                        .buttonStyle(OutlineButtonStyle())
                        .accessibilityIdentifier("skipReveal")
                        .padding(.top, 6)
                }
            case .revealed, .added:
                revealedCaption
            }
        }
        .multilineTextAlignment(.center)
    }

    @ViewBuilder
    private var revealedCaption: some View {
        Text(look.name)
            .font(Typeface.headline(44))
            .textCase(.uppercase)
            .minimumScaleFactor(0.5)
            .lineLimit(2)
        if let hiddenBy {
            Text("Hidden by \(hiddenBy)").font(Typeface.label(13)).foregroundStyle(Palette.gold)
        }
        if !look.story.isEmpty {
            Text(look.story)
                .font(Typeface.body(15))
                .foregroundStyle(Palette.textSecondary)
                .lineLimit(4)
        }
        if foundAgain {
            Label("Found-it-again sticker!", systemImage: "star.circle.fill")
                .font(Typeface.label(14))
                .foregroundStyle(Palette.rune)
        }
        Button(foundAgain ? "Back to the map" : "Into my chest", action: add)
            .buttonStyle(GoldButtonStyle())
            .padding(.top, 6)
            .accessibilityIdentifier("revealDone")
    }

    // MARK: Steps

    private func open() {
        guard flow.open() else { return }
        app?.sounds.play(.chestCreak)
        scene?.open()
        withAnimation(.easeIn(duration: isCalm ? 1.6 : 1.0)) { glow = 1 }
    }

    private func skip() {
        guard flow.skip() else { return }
        scene?.skip()
        celebrate()
    }

    /// The scene has the treasure fully out.
    private func finishOpening() {
        if flow.finishOpening() { celebrate() }
    }

    private func celebrate() {
        memory.markSeen()
        withAnimation(isCalm ? .easeInOut(duration: 0.4) : .spring(duration: 0.5, bounce: 0.3)) { glow = 0.7 }
    }

    private func add() {
        guard flow.add() else { return }
        app?.isRevealing = false
        onDone()
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

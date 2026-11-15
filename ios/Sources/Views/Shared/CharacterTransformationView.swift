import SwiftUI

struct CharacterChange: Identifiable {
    let id = UUID()
    let childID: ChildProfile.ID
    let previous: TreasureLook?
    let character: TreasureLook
}

/// A presentation of an already committed character choice. Closing it never changes saved state.
struct CharacterTransformationView: View {
    let previous: TreasureLook?
    let character: TreasureLook
    let onDone: () -> Void
    @Environment(AppModel.self) private var app
    @Environment(PlaySettings.self) private var settings
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @State private var started = Date.now
    @State private var finished = false

    private var calm: Bool { settings.reducesMotion(system: systemReduceMotion) }

    var body: some View {
        VStack(spacing: 20) {
            Text("Becoming your character")
                .font(Typeface.headline(30))
            TimelineView(.animation(minimumInterval: 1.0 / 30, paused: finished || calm)) { context in
                let elapsed = context.date.timeIntervalSince(started)
                let progress = min(max(elapsed / 1.4, 0), 1)
                ZStack {
                    if progress >= 0.5 || calm {
                        WalkingCharacterView(look: character, calm: calm)
                    } else if let previous {
                        WalkingCharacterView(look: previous)
                    } else {
                        Image(systemName: "figure.walk")
                            .font(.system(size: 110))
                            .foregroundStyle(Palette.gold)
                    }
                    if !calm && progress < 1 {
                        flame(progress: progress)
                    }
                }
                .frame(height: 280)
                .accessibilityHidden(true)
            }
            Text("You're now \(character.name)!")
                .font(Typeface.headline(32))
                .multilineTextAlignment(.center)
                .accessibilityIdentifier("transformationName")
            Button("Back to map", action: onDone)
                .buttonStyle(GoldButtonStyle())
                .accessibilityIdentifier("transformationDone")
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(Palette.textPrimary)
        .background(Palette.ground1.ignoresSafeArea())
        .task {
            started = .now
            if !calm { app.sounds.play(.revealSparkle) }
            try? await Task.sleep(for: .milliseconds(1_400))
            guard !Task.isCancelled else { return }
            finished = true
            UIAccessibility.post(notification: .announcement, argument: "You're now \(character.name)")
        }
    }

    private func flame(progress: Double) -> some View {
        let strength = sin(progress * .pi)
        return ZStack(alignment: .bottom) {
            ForEach(0..<7) { index in
                Image(systemName: "flame.fill")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(LinearGradient(colors: [.yellow, .orange, .red.opacity(0.8)],
                                                     startPoint: .bottom, endPoint: .top))
                    .frame(width: 70 + CGFloat(index % 3) * 25, height: 240 * strength)
                    .offset(x: CGFloat(index - 3) * 26, y: -CGFloat(progress * 45))
                    .opacity(strength)
            }
        }
        .frame(height: 280, alignment: .bottom)
        .allowsHitTesting(false)
    }
}

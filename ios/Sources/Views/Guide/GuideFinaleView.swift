import SwiftUI

/// The end of the hunt: the story's finale lines with a fanfare and falling treasure confetti, the
/// treasures found, and one clear way out, "Back to the ship!", which says goodbye and returns to the
/// map.
struct GuideFinaleView: View {
    let director: GuideDirector
    /// The story's closing line, such as "Back to the ship!"
    let closing: String
    let found: [BuiltInModel]
    let still: Bool

    var body: some View {
        ZStack {
            Palette.ground0.opacity(0.94).ignoresSafeArea()
            if !still { Confetti().allowsHitTesting(false) }
            VStack(spacing: 16) {
                Overline(text: "You did it!")
                Button { director.repeatLast() } label: {
                    CaptainTumblebeardView(height: 210, talking: director.isTalking, excited: true, still: still)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("guide")
                .accessibilityHint("Says that again")

                if let line = director.bubble {
                    SpeechBubble(text: line, size: 18).padding(.leading, 10)
                }

                HStack(spacing: 10) {
                    ForEach(Array(found.enumerated()), id: \.offset) { _, model in
                        TreasureThumbnail(model: model, size: 72)
                            .background(Circle().fill(Palette.gold.opacity(0.18)))
                    }
                }

                Spacer(minLength: 0)
                Button(closing) { director.finishFinale() }
                    .buttonStyle(GoldButtonStyle(height: 64, fontSize: 28))
                    .accessibilityIdentifier("backToShip")
            }
            .padding(16)
            .padding(.top, 24)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("guideFinale")
    }
}

/// Gold coins, stars and shells drifting down. Only shown when motion is allowed.
private struct Confetti: View {
    private struct Piece {
        let x: Double
        let speed: Double
        let delay: Double
        let spin: Double
        let symbol: String
        let color: Color
    }

    private let pieces: [Piece] = (0..<36).map { i in
        let symbols = ["star.fill", "circle.fill", "sparkle", "seal.fill"]
        let colors = [Palette.gold, Palette.rune, Palette.invented, Palette.parchment]
        let n = Double(i)
        return Piece(x: (n * 0.618).truncatingRemainder(dividingBy: 1), speed: 0.12 + (n * 0.37).truncatingRemainder(dividingBy: 0.1),
                     delay: (n * 0.29).truncatingRemainder(dividingBy: 1), spin: n.truncatingRemainder(dividingBy: 2) == 0 ? 1 : -1,
                     symbol: symbols[i % symbols.count], color: colors[(i / 2) % colors.count])
    }

    @State private var start = Date.now

    var body: some View {
        GeometryReader { geo in
            TimelineView(.animation) { timeline in
                let t = timeline.date.timeIntervalSince(start)
                ZStack {
                    ForEach(Array(pieces.enumerated()), id: \.offset) { _, piece in
                        let fall = (t * piece.speed + piece.delay).truncatingRemainder(dividingBy: 1)
                        Image(systemName: piece.symbol)
                            .font(.system(size: 16))
                            .foregroundStyle(piece.color)
                            .rotationEffect(.degrees(t * 90 * piece.spin))
                            .position(x: geo.size.width * piece.x + sin(t * 2 + piece.delay * 6) * 14,
                                      y: -20 + (geo.size.height + 40) * fall)
                    }
                }
            }
        }
        .ignoresSafeArea()
    }
}

import SwiftUI

/// The start of a hunt: the captain greets the child by pirate name and says the goal. A row of
/// mystery treasures shows how many there are to find, so the goal makes sense without reading.
/// Covers the map's top half only; the hunt's buttons stay free below.
struct AdventureOpeningView: View {
    let director: GuideDirector
    let treasureCount: Int
    let still: Bool

    var body: some View {
        VStack(spacing: 12) {
            Button { director.repeatLast() } label: {
                CaptainTumblebeardView(height: 116, talking: director.isTalking, excited: true, still: still)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("guide")
            .accessibilityHint("Says that again")

            if let line = director.bubble {
                SpeechBubble(text: line, size: 16)
                    .padding(.leading, 10)
            }

            HStack(spacing: 12) {
                ForEach(0..<treasureCount, id: \.self) { _ in
                    Text("?")
                        .font(Typeface.headline(30))
                        .foregroundStyle(Palette.ground1)
                        .frame(width: 42, height: 42)
                        .background(Circle().fill(Palette.gold))
                        .overlay(Circle().stroke(Palette.parchment, lineWidth: 2))
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(treasureCount) treasures to find")

            Button("Let's go!") { director.finishOpening() }
                .buttonStyle(GoldButtonStyle(height: 48, fontSize: 24))
                .accessibilityIdentifier("letsGo")
        }
        .padding(16)
        .padding(.top, 50)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(colors: [Palette.ground0.opacity(0.95), Palette.ground0.opacity(0.8)],
                           startPoint: .top, endPoint: .bottom)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("adventureOpening")
    }
}

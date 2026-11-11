import SwiftUI
import UIKit

/// The pirate guide over the treasure map: the opening (greeting and goal), a small captain in the
/// corner who reacts to `AppModel.huntMoment`, and the finale. Sits on top of `HuntView` from
/// `RootView`, so the hunt screen doesn't need to know about it. Only the guide itself takes taps;
/// the map and the hunt's buttons stay usable underneath.
struct GuideLayer: View {
    @Environment(AppModel.self) private var app
    @Environment(FamilyModel.self) private var family
    @Environment(PlaySettings.self) private var settings
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion

    @State private var director: GuideDirector?

    var body: some View {
        ZStack(alignment: .topLeading) {
            if let director {
                switch director.phase {
                case .idle:
                    EmptyView()
                case .opening:
                    AdventureOpeningView(director: director, treasureCount: family.adventurePlacements.count,
                                         still: still)
                        .transition(.opacity)
                case .finale:
                    GuideFinaleView(director: director, closing: closingLine, found: foundModels, still: still)
                        .transition(.opacity)
                case .hunting, .holdingForReveal, .ended:
                    cornerGuide(director)
                }
            }
            #if DEBUG
            if GuideRehearsal.isOn, let director { GuideTestDriver(director: director) }
            #endif
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .animation(still ? nil : .easeInOut(duration: 0.3), value: director?.phase)
        .task {
            #if DEBUG
            if GuideRehearsal.isOn, !app.isDemo {
                app.startDemo(with: await GuideRehearsal.family(stories: app.stories))
                return
            }
            #endif
            let director = GuideDirector(voice: app.voice, sounds: app.sounds)
            self.director = director
            sync()
            while !Task.isCancelled {
                director.tick()
                try? await Task.sleep(for: .milliseconds(250))
            }
        }
        .onChange(of: family.currentRun?.id) { sync() }
        .onChange(of: family.adventurePlacements) { sync() }
        .onChange(of: app.huntMoment) { _, moment in
            if let moment { director?.handle(moment) }
        }
    }

    private var still: Bool { settings.reducesMotion(system: systemReduceMotion) }

    /// "Back to the ship!": the story's last finale line, or the adventure's own closing line.
    private var closingLine: String {
        let story = family.adventure?.storyID.flatMap { app.stories.adventure($0) }
        return story?.finale.last ?? family.adventure?.finale ?? "Back to the ship!"
    }

    private var foundModels: [BuiltInModel] {
        family.adventurePlacements.compactMap { family.design(for: $0)?.current.look.model }
    }

    /// Follows the current run: a fresh one opens with the greeting and goal.
    private func sync() {
        guard let director else { return }
        guard let run = family.currentRun,
              let script = GuideScript(adventure: family.adventure, placements: family.adventurePlacements,
                                       child: family.child, parent: family.parent, library: app.stories)
        else {
            director.reset()
            return
        }
        let progress = family.progress
        director.begin(run: run.id, script: script, foundCount: progress.foundCount, isComplete: progress.isComplete)
    }

    private func cornerGuide(_ director: GuideDirector) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Button { director.repeatLast() } label: {
                CaptainTumblebeardView(height: 92, talking: director.isTalking,
                                       excited: director.mood?.isExciting ?? false, still: still)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("guide")
            .accessibilityHint("Says that again")
            if director.phase != .holdingForReveal, let line = director.bubble {
                SpeechBubble(text: line)
                    .frame(maxWidth: 230, alignment: .leading)
                    .transition(.scale(scale: 0.8, anchor: .leading).combined(with: .opacity))
            }
        }
        .padding(.top, 66)
        .padding(.leading, 10)
        .animation(still ? nil : .spring(duration: 0.3), value: director.bubble)
    }
}

extension GuideMoment {
    /// Moments where the captain bounces and Nib dances.
    var isExciting: Bool { [.gettingClose, .digReady, .reveal, .finale, .greeting].contains(self) }
}

extension GuideScript {
    /// The script for a family's adventure, or nil if there's nothing to hunt yet.
    init?(adventure: Adventure?, placements: [ChestPlacement], child: ChildProfile?, parent: ParentAccount?,
          library: StoryLibrary) {
        guard let adventure, !placements.isEmpty else { return nil }
        let story = adventure.storyID.flatMap { library.adventure($0) }
        guard let guide = adventure.guideID.flatMap({ library.guide($0) })
                ?? story.flatMap({ library.guide(for: $0) })
                ?? library.guides.first
        else { return nil }
        self.init(guide: guide, story: story,
                  context: StoryContext(pirateName: child?.pirateName, grownUp: parent?.displayName),
                  goal: adventure.goal, closing: adventure.finale,
                  hints: placements.map(\.hint), storyTreasureIDs: placements.map(\.storyTreasureID))
    }
}

// MARK: - Pieces

/// The guide's words on parchment, with a tail pointing at the captain. Big and short, for a grown-up
/// to read along; the child hears it.
struct SpeechBubble: View {
    let text: String
    var size: CGFloat = 17

    var body: some View {
        Text(text)
            .font(Typeface.body(size, weight: .semibold))
            .foregroundStyle(Palette.mapInk)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(BubbleShape().fill(Palette.parchment))
            .overlay(BubbleShape().stroke(Palette.parchmentEdge, lineWidth: 2))
            .shadow(color: .black.opacity(0.3), radius: 4, y: 2)
            .accessibilityElement()
            .accessibilityLabel(text)
            .accessibilityIdentifier("guide.bubble")
    }
}

/// A rounded rectangle with a small tail on the left, near the top.
struct BubbleShape: Shape {
    func path(in rect: CGRect) -> Path {
        let body = rect.insetBy(dx: 0, dy: 0)
        var path = Path(roundedRect: body, cornerRadius: 14)
        path.move(to: CGPoint(x: body.minX + 1, y: body.minY + 18))
        path.addLine(to: CGPoint(x: body.minX - 10, y: body.minY + 26))
        path.addLine(to: CGPoint(x: body.minX + 1, y: body.minY + 34))
        path.closeSubpath()
        return path
    }
}

/// A built-in treasure's picture, from the catalog's thumbnails.
struct TreasureThumbnail: View {
    let model: BuiltInModel
    var size: CGFloat = 64

    var body: some View {
        Group {
            if let url = TreasureCatalog.bundled.thumbnailURL(for: model),
               let image = UIImage(contentsOfFile: url.path(percentEncoded: false)) {
                Image(uiImage: image).resizable().scaledToFit()
            } else {
                Image(systemName: "sparkles").font(.system(size: size * 0.5)).foregroundStyle(Palette.gold)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel(model.displayName)
    }
}

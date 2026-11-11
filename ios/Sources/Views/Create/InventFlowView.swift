import SwiftUI

/// The child invents a treasure and hides it for the grown-up, one big choice per screen, with the
/// captain saying each prompt out loud (`hide-for-parent.md`). The grown-up types the story and
/// confirms the spot.
struct InventFlowView: View {
    @Environment(AppModel.self) private var app
    @Environment(FamilyModel.self) private var family
    @Environment(\.dismiss) private var dismiss

    @State private var flow: InventFlow
    @State private var saving = false

    init(editing design: TreasureDesign? = nil) {
        let limit = StoryLibrary.bundled.hideFlow?.step(InventStep.story.rawValue)?.storyMaxCharacters ?? 280
        _flow = State(initialValue: design.map { InventFlow(editing: $0, storyLimit: limit) } ?? InventFlow(storyLimit: limit))
    }

    private var story: HideFlowStory? { app.stories.hideFlow }
    private var grownUp: String { family.parent?.displayName ?? "your grown-up" }
    private var pirateName: String { family.child?.pirateName ?? "matey" }

    private var context: StoryContext {
        StoryContext(pirateName: pirateName, grownUp: grownUp, object: flow.model?.spokenName,
                     color: flow.color?.spokenName, name: flow.name.isEmpty ? nil : flow.name)
    }

    var body: some View {
        VStack(spacing: 0) {
            TopBar(flow: flow, onClose: close, onSayAgain: sayPrompt)
            Group {
                switch flow.step {
                case .start: StartScreen(pirateName: pirateName, grownUp: grownUp, editing: flow.editing != nil)
                case .object: ObjectScreen(flow: $flow, onPick: say)
                case .color: ColorScreen(flow: $flow, onPick: say)
                case .sparkles: SparklesScreen(flow: $flow, onPick: say)
                case .name: NameScreen(flow: $flow, onPick: say)
                case .sound: SoundScreen(flow: $flow)
                case .story: StoryScreen(flow: $flow)
                case .hide: HideScreen(flow: flow, grownUp: grownUp, saving: saving, onHide: saveAndHandOff)
                case .handoff: HandoffScreen(grownUp: grownUp)
                case .confirmSpot: confirmSpot
                case .done: DoneScreen(flow: flow, lines: story?.prompt(for: .done, context: context) ?? [])
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .id(flow.step)
            .transition(.opacity)
            if flow.step != .confirmSpot { // the map needs the room; the X still closes
                BottomBar(flow: $flow, onDone: close)
            }
        }
        .background((flow.step.isGrownUps ? Palette.ground2 : Palette.ground1).ignoresSafeArea())
        .animation(.easeInOut(duration: 0.2), value: flow.step)
        .onChange(of: flow.step, initial: true) { sayPrompt() }
        .onDisappear { app.voice.stop() }
        .alert("Couldn't save", isPresented: Binding(
            get: { family.errorMessage != nil && !saving }, set: { if !$0 { family.errorMessage = nil } }
        )) {
            Button("OK") { family.errorMessage = nil }
        } message: {
            Text(family.errorMessage ?? "")
        }
    }

    @ViewBuilder private var confirmSpot: some View {
        if let saved = flow.saved {
            GrownUpSpotReview(look: saved.look, prompt: story?.step(InventStep.confirmSpot.rawValue)?.parentPrompt,
                              hintTemplate: story?.step(InventStep.confirmSpot.rawValue)?.parentHintTemplate) { spot, hint, reviewedAt in
                let hidden = await family.hideForGrownUp(design: saved.designID, version: saved.versionID, at: spot,
                                                         hint: hint, reviewedAt: reviewedAt, guideID: story?.guide)
                if hidden {
                    flow.didHide()
                    if let line = story?.reply(for: .confirmSpot, context: context) { say(line) }
                }
                return hidden
            }
        }
    }

    // MARK: Actions

    private func saveAndHandOff() {
        guard let look = flow.look else { return }
        guard flow.needsSave else { flow.next(); return }
        saving = true
        Task {
            let design = await family.saveInvention(look, editing: flow.designToSave)
            saving = false
            if let design { flow.didSave(design: design.id, version: design.current.id, look: look) }
        }
    }

    private func close() {
        app.voice.stop()
        dismiss()
    }

    private func sayPrompt() {
        app.voice.stop()
        say(story?.prompt(for: flow.step, context: context) ?? [])
    }

    private func say(_ line: String) { say([line]) }

    private func say(_ lines: [String]) {
        guard !lines.isEmpty else { return }
        if let guide = story?.guide.flatMap(app.stories.guide) {
            app.voice.speak(lines, as: guide)
        } else {
            app.voice.speak(lines, rate: 0.45)
        }
    }
}

// MARK: - Frame

private struct TopBar: View {
    let flow: InventFlow
    let onClose: () -> Void
    let onSayAgain: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onClose) {
                Image(systemName: "xmark").font(.title2.weight(.bold)).frame(width: 52, height: 52)
            }
            .accessibilityLabel("Close")
            .accessibilityIdentifier("inventClose")
            Spacer()
            HStack(spacing: 6) {
                ForEach(InventFlow.choiceSteps, id: \.self) { step in
                    Rectangle()
                        .fill(dotColor(step))
                        .frame(width: 14, height: 6)
                }
            }
            .accessibilityHidden(true)
            Spacer()
            Button(action: onSayAgain) {
                Image(systemName: "speaker.wave.2.fill").font(.title2).frame(width: 52, height: 52)
            }
            .accessibilityLabel("Say it again")
        }
        .foregroundStyle(Palette.textPrimary)
        .padding(.horizontal, 8)
    }

    private func dotColor(_ step: InventStep) -> Color {
        let all = InventStep.allCases
        guard let mine = all.firstIndex(of: step), let now = all.firstIndex(of: flow.step) else { return Palette.borderQuiet }
        return mine < now ? Palette.invented : mine == now ? Palette.gold : Palette.borderQuiet
    }
}

/// Back and a big Next arrow. The arrow is a picture, so a child who can't read knows it.
private struct BottomBar: View {
    @Binding var flow: InventFlow
    let onDone: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            if flow.canGoBack {
                Button { flow.back() } label: {
                    Image(systemName: "arrow.left").font(.title.weight(.bold))
                }
                .buttonStyle(OutlineButtonStyle(height: 72))
                .frame(width: 96)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("inventBack")
            }
            switch flow.step {
            case .hide, .confirmSpot:
                EmptyView() // these screens have their own big button
            case .done:
                Button("All done", action: onDone)
                    .buttonStyle(GoldButtonStyle(height: 72))
                    .accessibilityIdentifier("inventDone")
            case .story:
                Button { flow.next() } label: {
                    Text(flow.story.trimmed.isEmpty ? "Skip" : "Next")
                }
                .buttonStyle(GoldButtonStyle(height: 72))
                .accessibilityIdentifier("inventNext")
            default:
                Button { flow.next() } label: {
                    Image(systemName: flow.step == .handoff ? "hand.raised.fill" : "arrow.right")
                        .font(.largeTitle.weight(.heavy))
                }
                .buttonStyle(GoldButtonStyle(height: 72))
                .disabled(!flow.canContinue)
                .opacity(flow.canContinue ? 1 : 0.35)
                .accessibilityLabel(flow.step == .handoff ? "I'm the grown-up" : "Next")
                .accessibilityIdentifier("inventNext")
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }
}

/// The captain's prompt in big type, for the grown-up reading along. The child hears it.
private struct Prompt: View {
    let text: String
    var color: Color = Palette.textPrimary

    var body: some View {
        Text(text)
            .font(Typeface.headline(34))
            .multilineTextAlignment(.center)
            .foregroundStyle(color)
            .padding(.horizontal, 16)
            .minimumScaleFactor(0.7)
    }
}

/// A big tappable picture with a gold frame when chosen.
private struct PictureTile<Content: View>: View {
    let label: String
    let selected: Bool
    var height: CGFloat = 104
    let action: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        Button(action: action) {
            content()
                .frame(maxWidth: .infinity, minHeight: height, maxHeight: height)
                .background(selected ? Palette.ground3 : Palette.ground2)
                .overlay(Rectangle().stroke(selected ? Palette.gold : Palette.borderQuiet, lineWidth: selected ? 4 : 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

// MARK: - Child screens

private struct StartScreen: View {
    let pirateName: String
    let grownUp: String
    let editing: Bool

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Overline(text: "Treasure maker", color: Palette.invented)
            Image(systemName: "sparkles")
                .font(.system(size: 110))
                .foregroundStyle(Palette.invented)
            Prompt(text: editing ? "Let's make it new, \(pirateName)!" : "Let's make a treasure, \(pirateName)!")
            Text("Then we hide it for \(grownUp).")
                .font(Typeface.body(18))
                .foregroundStyle(Palette.textSecondary)
            Spacer()
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("inventStart")
    }
}

private struct ObjectScreen: View {
    @Binding var flow: InventFlow
    let onPick: (String) -> Void
    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(spacing: 12) {
            Prompt(text: "What is your treasure?")
            ScrollView {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                    ForEach(BuiltInModel.allCases) { model in
                        PictureTile(label: model.spokenName, selected: flow.model == model, height: 112) {
                            flow.model = model
                            let reply = app.stories.hideFlow?.reply(for: .object, context: StoryContext(object: model.spokenName))
                            onPick(reply ?? model.displayName)
                        } content: {
                            InventThumbnail(model: model)
                        }
                        .accessibilityIdentifier("object-\(model.rawValue)")
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }
}

/// The catalog's picture of a treasure, in its own color.
struct InventThumbnail: View {
    let model: BuiltInModel
    @Environment(AppModel.self) private var app

    var body: some View {
        if let url = app.catalog.colorThumbnailURL(for: model), let image = UIImage(contentsOfFile: url.path(percentEncoded: false)) {
            Image(uiImage: image).resizable().scaledToFit().padding(6)
        } else {
            Image(systemName: model.symbol).font(.system(size: 44)).foregroundStyle(Color(model.defaultColor))
        }
    }
}

/// The live, tinted 3D treasure on the color and sparkles screens.
private struct Preview: View {
    let flow: InventFlow

    var body: some View {
        TreasureModelView(look: flow.previewLook)
            .frame(height: 230)
            .frame(maxWidth: .infinity)
            .background(Palette.ground0)
            .overlay(Rectangle().stroke(Palette.borderQuiet, lineWidth: 1))
            .padding(.horizontal, 16)
    }
}

private struct ColorScreen: View {
    @Binding var flow: InventFlow
    let onPick: (String) -> Void
    @Environment(AppModel.self) private var app

    /// The eight colors the story offers, in its order.
    private var colors: [TreasureColor] {
        let ids = app.stories.hideFlow?.step(InventStep.color.rawValue)?.options.map(\.id) ?? []
        let listed = ids.compactMap(TreasureColor.init(rawValue:))
        return listed.isEmpty ? [.red, .orange, .yellow, .green, .blue, .purple, .pink, .gold] : listed
    }

    var body: some View {
        VStack(spacing: 14) {
            Prompt(text: "What color is it?")
            Preview(flow: flow)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 4), spacing: 10) {
                ForEach(colors) { color in
                    PictureTile(label: color.displayName, selected: flow.color == color, height: 76) {
                        flow.color = color
                        onPick(app.stories.hideFlow?.optionLine(color.rawValue, in: .color) ?? "\(color.displayName)!")
                    } content: {
                        Circle().fill(Color(color)).padding(10)
                    }
                    .accessibilityIdentifier("color-\(color.rawValue)")
                }
            }
            .padding(.horizontal, 16)
            Spacer(minLength: 0)
        }
    }
}

private struct SparklesScreen: View {
    @Binding var flow: InventFlow
    let onPick: (String) -> Void
    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(spacing: 14) {
            Prompt(text: "Does it sparkle?")
            Preview(flow: flow)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 2), spacing: 10) {
                ForEach(Sparkles.allCases) { sparkles in
                    PictureTile(label: sparkles.rawValue, selected: flow.sparkles == sparkles, height: 84) {
                        flow.sparkles = sparkles
                        onPick(app.stories.hideFlow?.optionLine(sparkles.rawValue, in: .sparkles) ?? sparkles.rawValue)
                    } content: {
                        SparklesPicture(sparkles: sparkles)
                    }
                    .accessibilityIdentifier("sparkles-\(sparkles.rawValue)")
                }
            }
            .padding(.horizontal, 16)
            Spacer(minLength: 0)
        }
    }
}

private struct SparklesPicture: View {
    let sparkles: Sparkles

    var body: some View {
        switch sparkles {
        case .none:
            Image(systemName: "circle").font(.system(size: 40)).foregroundStyle(Palette.textMuted)
        case .some:
            Image(systemName: "sparkle").font(.system(size: 40)).foregroundStyle(Palette.textPrimary)
        case .lots:
            Image(systemName: "sparkles").font(.system(size: 52)).foregroundStyle(Palette.gold)
        case .rainbow:
            Image(systemName: "sparkles").font(.system(size: 52))
                .foregroundStyle(LinearGradient(colors: [.red, .orange, .yellow, .green, .blue, .purple],
                                                startPoint: .leading, endPoint: .trailing))
        }
    }
}

private struct NameScreen: View {
    @Binding var flow: InventFlow
    let onPick: (String) -> Void
    @Environment(AppModel.self) private var app
    @State private var typing = false

    private var step: HideFlowStory.Step? { app.stories.hideFlow?.step(InventStep.name.rawValue) }
    private var firstWords: [String] { step?.nameFirst ?? [] }
    private var secondWords: [String] { step?.nameSecond ?? [] }

    var body: some View {
        VStack(spacing: 12) {
            Prompt(text: "Now a funny name!")
            Text(flow.name.isEmpty ? " " : flow.name)
                .font(Typeface.headline(40))
                .foregroundStyle(Palette.invented)
                .accessibilityIdentifier("inventName")
            if typing {
                TextField("Grown-up: type a name", text: $flow.typedName)
                    .font(Typeface.body(18))
                    .padding(.horizontal, 12)
                    .frame(height: 52)
                    .background(Palette.ground2)
                    .overlay(Rectangle().stroke(Palette.borderStrong, lineWidth: 1))
                    .foregroundStyle(Palette.textPrimary)
                    .padding(.horizontal, 16)
                    .accessibilityIdentifier("typedName")
            } else {
                let first = flow.wantsFirstWord
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 4), spacing: 10) {
                    ForEach(first ? firstWords : secondWords, id: \.self) { word in
                        PictureTile(label: word, selected: (first ? flow.nameFirst : flow.nameSecond) == word, height: 88) {
                            flow.tapWord(word)
                            onPick(word)
                            if !first, let reply = app.stories.hideFlow?.reply(for: .name, context: StoryContext(name: flow.name)) {
                                onPick(reply)
                            }
                        } content: {
                            VStack(spacing: 4) {
                                Image(systemName: WordPicture.symbol(for: word)).font(.system(size: 30))
                                    .foregroundStyle(Palette.gold)
                                Text(word).font(Typeface.body(13, weight: .semibold))
                                    .foregroundStyle(Palette.textPrimary)
                                    .minimumScaleFactor(0.7)
                            }
                        }
                        .accessibilityIdentifier("word-\(word)")
                    }
                }
                .padding(.horizontal, 16)
            }
            HStack(spacing: 10) {
                Button {
                    var random = SystemRandomNumberGenerator()
                    flow.mixName(first: firstWords, second: secondWords, using: &random)
                    typing = false
                    onPick(flow.name)
                } label: {
                    Label("Mix it up", systemImage: "shuffle")
                }
                .buttonStyle(OutlineButtonStyle(height: 60))
                .accessibilityIdentifier("mixName")
                Button {
                    flow.clearName()
                    typing = false
                } label: {
                    Image(systemName: "arrow.counterclockwise").font(.title2.weight(.bold))
                }
                .buttonStyle(OutlineButtonStyle(height: 60))
                .frame(width: 64)
                .accessibilityLabel("Start the name over")
                .accessibilityIdentifier("clearName")
                Button {
                    typing.toggle()
                    if !typing { flow.typedName = "" }
                } label: {
                    Label(typing ? "Word tiles" : "Grown-up types", systemImage: typing ? "square.grid.2x2" : "keyboard")
                }
                .buttonStyle(OutlineButtonStyle(height: 60))
                .accessibilityIdentifier("typeName")
            }
            .padding(.horizontal, 16)
            Spacer(minLength: 0)
        }
    }
}

/// A picture for each name word, so the tiles work without reading.
enum WordPicture {
    static func symbol(for word: String) -> String {
        switch word {
        case "Captain": "sailboat.fill"
        case "Wiggly": "scribble.variable"
        case "Giggly": "face.smiling.inverse"
        case "Snorty": "wind"
        case "Bumpy": "mountain.2.fill"
        case "Sleepy": "moon.zzz.fill"
        case "Bouncy": "basketball.fill"
        case "Squishy": "drop.fill"
        case "Noodle": "fork.knife"
        case "Pickle": "leaf.fill"
        case "Muffin": "birthday.cake.fill"
        case "Socks": "tshirt.fill"
        case "Sprout": "camera.macro"
        case "Puddle": "cloud.rain.fill"
        case "Button": "circle.circle.fill"
        case "Biscuit": "square.grid.3x3.fill"
        default: "star.fill"
        }
    }
}

private struct SoundScreen: View {
    @Binding var flow: InventFlow
    @Environment(AppModel.self) private var app

    private var options: [(sound: TreasureSound, say: String)] {
        let listed = app.stories.hideFlow?.step(InventStep.sound.rawValue)?.options ?? []
        let mapped = listed.compactMap { option in TreasureSound(rawValue: option.id).map { ($0, option.say) } }
        return mapped.isEmpty ? TreasureSound.allCases.map { ($0, $0.rawValue.capitalized) } : mapped
    }

    var body: some View {
        VStack(spacing: 14) {
            Prompt(text: "What sound does it make?")
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 2), spacing: 10) {
                ForEach(options, id: \.sound) { option in
                    PictureTile(label: option.say, selected: flow.sound == option.sound, height: 96) {
                        flow.sound = option.sound
                        app.sounds.play(SoundEffect(option.sound))
                    } content: {
                        VStack(spacing: 6) {
                            Image(systemName: Self.symbol(option.sound)).font(.system(size: 36))
                                .foregroundStyle(Palette.rune)
                            Text(option.say).font(Typeface.headline(20)).foregroundStyle(Palette.textPrimary)
                        }
                    }
                    .accessibilityIdentifier("sound-\(option.sound.rawValue)")
                }
            }
            .padding(.horizontal, 16)
            Spacer(minLength: 0)
        }
    }

    static func symbol(_ sound: TreasureSound) -> String {
        switch sound {
        case .boing: "arrow.up.and.down.circle.fill"
        case .toot: "megaphone.fill"
        case .giggle: "face.smiling.inverse"
        case .splash: "drop.fill"
        case .ding: "bell.fill"
        case .snore: "moon.zzz.fill"
        case .chime: "bell.and.waves.left.and.right.fill"
        case .fanfare: "music.note"
        }
    }
}

// MARK: - Grown-up screens

private struct StoryScreen: View {
    @Binding var flow: InventFlow
    @Environment(AppModel.self) private var app
    @FocusState private var focused: Bool

    private var step: HideFlowStory.Step? { app.stories.hideFlow?.step(InventStep.story.rawValue) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Overline(text: "For the grown-up", color: Palette.rune)
                Text("Its story")
                    .font(Typeface.headline(34))
                    .foregroundStyle(Palette.textPrimary)
                Text(step?.parentPrompt ?? "Ask your child about their treasure and type what they say.")
                    .font(Typeface.body(15))
                    .foregroundStyle(Palette.textSecondary)
                ForEach(step?.parentQuestions ?? [], id: \.self) { question in
                    Label(question, systemImage: "questionmark.bubble")
                        .font(Typeface.body(14))
                        .foregroundStyle(Palette.textSecondary)
                }
                TextField("In their words…", text: Binding(get: { flow.story }, set: { flow.setStory($0) }), axis: .vertical)
                    .lineLimit(4...8)
                    .font(Typeface.body(16))
                    .focused($focused)
                    .padding(12)
                    .background(Palette.ground1)
                    .overlay(Rectangle().stroke(Palette.borderStrong, lineWidth: 1))
                    .foregroundStyle(Palette.textPrimary)
                    .accessibilityIdentifier("inventStory")
                Text("\(flow.story.count) / \(flow.storyLimit) · You can skip this.")
                    .font(Typeface.body(12))
                    .foregroundStyle(Palette.textMuted)
            }
            .padding(16)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}

private struct HideScreen: View {
    let flow: InventFlow
    let grownUp: String
    let saving: Bool
    let onHide: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            if let look = flow.look {
                TreasureModelView(look: look)
                    .frame(height: 260)
                    .frame(maxWidth: .infinity)
                    .background(Palette.ground0)
                    .overlay(Rectangle().stroke(Palette.invented, lineWidth: 1))
                    .padding(.horizontal, 16)
                Text(look.name)
                    .font(Typeface.headline(38))
                    .foregroundStyle(Palette.invented)
            }
            Prompt(text: "Now, where should we hide it?")
            Spacer(minLength: 0)
            Button(action: onHide) {
                Label(saving ? "Saving…" : "Hide it for \(grownUp)", systemImage: "eye.slash.fill")
            }
            .buttonStyle(GoldButtonStyle(height: 80, fontSize: 26))
            .disabled(saving || flow.look == nil)
            .padding(.horizontal, 16)
            .accessibilityIdentifier("hideForGrownUp")
        }
    }
}

/// Pass the phone: from here the grown-up drives.
private struct HandoffScreen: View {
    let grownUp: String

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "hand.point.right.fill")
                .font(.system(size: 100))
                .foregroundStyle(Palette.rune)
            Overline(text: "Grown-up's turn", color: Palette.rune)
            Prompt(text: "Give the phone to \(grownUp)!")
            Text("Walk together to a hiding spot. Then you check it on the map and confirm it. Nothing is hidden until you do.")
                .font(Typeface.body(16))
                .multilineTextAlignment(.center)
                .foregroundStyle(Palette.textSecondary)
                .padding(.horizontal, 24)
            Spacer()
        }
        .accessibilityIdentifier("grownUpsTurn")
    }
}

private struct DoneScreen: View {
    let flow: InventFlow
    let lines: [String]

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "shippingbox.fill")
                .font(.system(size: 100))
                .foregroundStyle(Palette.gold)
            Prompt(text: "Shh! It's hidden. Don't tell!", color: Palette.invented)
            ForEach(lines, id: \.self) { line in
                Text(line).font(Typeface.body(18)).foregroundStyle(Palette.textSecondary)
            }
            Spacer()
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 16)
        .accessibilityIdentifier("inventHidden")
    }
}

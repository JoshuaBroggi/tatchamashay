import MapKit
import SwiftUI

/// Setting up a new hunt, in plain steps: where you're playing, what your pirate calls you, which
/// adventure, then each chest's treasure, clue and spot. Nothing is saved until **Save the hunt**,
/// which leads straight to **Get ready**.
struct SetupHuntFlow: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FamilyModel.self) private var family

    @State private var setup = SetupState()

    var body: some View {
        @Bindable var setup = setup
        NavigationStack(path: $setup.path) {
            PlayAreaStep { chosen in
                setup.area = chosen
                setup.path.append(.grownUp)
            }
            .navigationTitle("Where are you playing?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .navigationDestination(for: SetupStep.self) { step in
                switch step {
                case .grownUp:
                    GrownUpStep { setup.path.append(.story) }
                case .story:
                    StoryStep { story in
                        setup.draft = story.map { HuntDraft(story: $0, area: setup.area) } ?? HuntDraft.blank(area: setup.area)
                        setup.path.append(.chests)
                    }
                case .chests:
                    ChestListStep(draft: $setup.draft, onOpen: { setup.path.append(.chest($0)) }) { adventureID in
                        setup.savedAdventureID = adventureID
                        setup.path.append(.getReady)
                    }
                case .chest(let id):
                    if let index = setup.draft.chests.firstIndex(where: { $0.id == id }) {
                        ChestStep(chest: $setup.draft.chests[index], number: index + 1, isStory: setup.draft.storyID != nil,
                                  onPickSpot: { setup.path.append(.spot(id)) }, onDone: { setup.path.removeLast() })
                    }
                case .spot(let id):
                    if let index = setup.draft.chests.firstIndex(where: { $0.id == id }) {
                        ChestSpotStep(chest: $setup.draft.chests[index], area: setup.area,
                                      others: setup.draft.chests.filter { $0.id != id }.compactMap(\.spot)) {
                            setup.path.removeLast()
                        }
                    }
                case .getReady:
                    if let savedAdventureID = setup.savedAdventureID {
                        GetReadyView(adventureID: savedAdventureID) { dismiss() }
                            .navigationBarBackButtonHidden()
                    }
                }
            }
        }
    }
}

/// The flow's state, shared by reference so every step's screen sees the latest draft.
@MainActor
@Observable
final class SetupState {
    var path: [SetupStep] = []
    var area: PlayArea?
    var draft = HuntDraft.blank(area: nil)
    var savedAdventureID: Adventure.ID?
}

enum SetupStep: Hashable {
    case grownUp, story, chests
    case chest(HuntDraft.Chest.ID)
    case spot(HuntDraft.Chest.ID)
    case getReady
}

// MARK: - 1. Where are you playing?

/// A detailed map: the parent moves the ring onto a place they know.
private struct PlayAreaStep: View {
    let onChoose: (PlayArea) -> Void

    @State private var camera: MapCameraPosition = .userLocation(fallback: .automatic)
    @State private var center: Coordinate?
    @State private var cameraDistance: Double = .infinity
    @State private var name = ""

    private var isDetailed: Bool { MapReview.isDetailedForArea(cameraDistance: cameraDistance) }

    var body: some View {
        VStack(spacing: 0) {
            SpotMap(camera: $camera, center: $center, cameraDistance: $cameraDistance, crosshair: .area)

            VStack(alignment: .leading, spacing: 12) {
                Text("Pick a place you know well, like your backyard or a park. Put it inside the ring.")
                    .font(Typeface.body(15))
                    .foregroundStyle(Palette.textSecondary)
                if !isDetailed {
                    Label("Zoom in to your park or backyard.", systemImage: "plus.magnifyingglass")
                        .font(Typeface.body(14))
                        .foregroundStyle(Palette.gold)
                }
                SetupField(prompt: "What do you call it? (\"Our backyard\")", text: $name)
                    .accessibilityIdentifier("placeName")
                Button("Play here") {
                    guard let center else { return }
                    let radius = min(800, max(100, cameraDistance * 0.25))
                    onChoose(PlayArea(center: center, radiusMeters: radius, name: name.trimmed))
                }
                .buttonStyle(GoldButtonStyle())
                .disabled(!isDetailed || center == nil)
                .opacity(isDetailed ? 1 : 0.5)
                .accessibilityIdentifier("playHere")
            }
            .padding(16)
        }
        .background(Palette.ground1.ignoresSafeArea())
    }
}

// MARK: - 2. What does your pirate call you?

private struct GrownUpStep: View {
    let onNext: () -> Void

    @Environment(FamilyModel.self) private var family
    @State private var name = ""

    static let suggestions = ["Dad", "Mom", "Grandma", "Grandpa"]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("What does your pirate call you?")
                .font(Typeface.headline(32))
                .foregroundStyle(Palette.textPrimary)
            Text("The guide says it out loud: \"Stay with \(name.trimmed.isEmpty ? "Dad" : name.trimmed)!\"")
                .font(Typeface.body(15))
                .foregroundStyle(Palette.textSecondary)
            HStack {
                ForEach(Self.suggestions, id: \.self) { word in
                    Button(word) { name = word }
                        .buttonStyle(ChipStyle(selected: name == word))
                        .accessibilityIdentifier("call-\(word)")
                }
            }
            SetupField(prompt: "Or type a name", text: $name)
                .accessibilityIdentifier("grownUpName")
            Spacer()
            Button("Next") {
                Task {
                    await family.setGrownUpName(name.trimmed)
                    onNext()
                }
            }
            .buttonStyle(GoldButtonStyle())
            .disabled(name.trimmed.isEmpty)
            .opacity(name.trimmed.isEmpty ? 0.5 : 1)
            .accessibilityIdentifier("grownUpNext")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.ground1.ignoresSafeArea())
        .navigationTitle("You")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { if name.isEmpty { name = family.parent?.childCallsMe ?? "" } }
    }
}

// MARK: - 3. Which adventure?

private struct StoryStep: View {
    /// Nil means a hunt the parent makes up.
    let onChoose: (AdventureStory?) -> Void

    @Environment(AppModel.self) private var app

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                ForEach(app.stories.adventures) { story in
                    Button { onChoose(story) } label: { StoryCard(story: story) }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("story-\(story.id)")
                }
                Button { onChoose(nil) } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Make my own hunt", systemImage: "pencil")
                            .font(Typeface.body(18, weight: .semibold))
                            .foregroundStyle(Palette.textPrimary)
                        Text("Choose 3 to 5 treasures and write your own clues.")
                            .font(Typeface.body(14))
                            .foregroundStyle(Palette.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .overlay(Rectangle().stroke(Palette.borderStrong, style: StrokeStyle(lineWidth: 1, dash: [6, 4])))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("blankHunt")
            }
            .padding(16)
        }
        .background(Palette.ground1.ignoresSafeArea())
        .navigationTitle("Pick an adventure")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct StoryCard: View {
    let story: AdventureStory

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(story.title)
                .font(Typeface.headline(24))
                .foregroundStyle(Palette.textPrimary)
            Text("\u{201C}\(story.goal)\u{201D}")
                .font(Typeface.body(15))
                .foregroundStyle(Palette.textSecondary)
            HStack(spacing: 12) {
                Label("\(story.treasures.count) treasures", systemImage: "shippingbox.fill")
                if let minutes = story.minutes { Label("About \(minutes) min", systemImage: "clock") }
                if !story.fits.isEmpty {
                    Label(story.fits.map { $0.replacingOccurrences(of: "_", with: " ") }.joined(separator: ", "),
                          systemImage: "tree.fill")
                }
            }
            .font(Typeface.body(12))
            .foregroundStyle(Palette.gold)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Palette.ground2)
        .overlay(Rectangle().stroke(Palette.borderQuiet, lineWidth: 1))
    }
}

// MARK: - 4. The chests

private struct ChestListStep: View {
    @Binding var draft: HuntDraft
    let onOpen: (HuntDraft.Chest.ID) -> Void
    let onSaved: (Adventure.ID) -> Void

    @Environment(FamilyModel.self) private var family
    @State private var saving = false

    var body: some View {
        List {
            Section {
                if draft.storyID == nil {
                    TextField("Name your hunt (\"Backyard Treasure\")", text: $draft.title)
                        .accessibilityIdentifier("huntTitle")
                    TextField("The goal (\"Find the lost treasure!\")", text: $draft.goal)
                } else {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(draft.title).font(Typeface.body(17, weight: .semibold))
                        Text(draft.goal).font(Typeface.body(14)).foregroundStyle(Palette.textSecondary)
                    }
                }
                if let area = draft.playArea, !area.name.isEmpty {
                    Label(area.name, systemImage: "mappin.circle").foregroundStyle(Palette.textSecondary)
                }
            }

            Section {
                ForEach(Array(draft.chests.enumerated()), id: \.element.id) { index, chest in
                    Button { onOpen(chest.id) } label: { ChestRow(chest: chest, number: index + 1) }
                        .accessibilityIdentifier("chest-\(index + 1)")
                }
                .onDelete(perform: draft.canRemoveChest ? { draft.chests.remove(atOffsets: $0) } : nil)
                if draft.storyID == nil && draft.canAddChest {
                    Button { draft.addChest() } label: { Label("Add a chest", systemImage: "plus.circle.fill") }
                        .accessibilityIdentifier("addChest")
                }
            } header: {
                Text("Chests, in the order you'll find them")
            } footer: {
                Text(draft.whatsLeft ?? "All set! Save it, then check everything's ready.")
            }

            Section {
                Button(saving ? "Saving…" : "Save the hunt") { save() }
                    .disabled(!draft.canSave || saving)
                    .accessibilityIdentifier("saveHunt")
                if let error = family.errorMessage {
                    Text(error).foregroundStyle(Palette.mapRed)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Palette.ground1.ignoresSafeArea())
        .navigationTitle("Hide the chests")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func save() {
        guard let parent = family.parent, let (adventure, designs, placements) = draft.records(family: parent) else { return }
        saving = true
        Task {
            let saved = await family.saveHuntSetup(adventure, designs: designs, placements: placements)
            saving = false
            if saved { onSaved(adventure.id) }
        }
    }
}

private struct ChestRow: View {
    let chest: HuntDraft.Chest
    let number: Int

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                if let model = chest.model, let image = Thumbnail.image(for: model) {
                    Image(uiImage: image).resizable().scaledToFit()
                } else {
                    Text("\(number)").font(Typeface.headline(22)).foregroundStyle(Palette.gold)
                }
            }
            .frame(width: 44, height: 44)
            .background(Palette.ground2)

            VStack(alignment: .leading, spacing: 3) {
                Text(chest.name.trimmed.isEmpty ? "Chest \(number)" : chest.name)
                    .font(Typeface.body(16, weight: .semibold))
                    .foregroundStyle(Palette.textPrimary)
                Text(chest.hint ?? "Clue not written yet")
                    .font(Typeface.body(13))
                    .foregroundStyle(Palette.textSecondary)
                HStack(spacing: 10) {
                    done("Treasure", chest.model != nil)
                    done("Clue", chest.hint != nil)
                    done("Spot", chest.hasSpot)
                }
                .font(Typeface.body(11))
            }
            Spacer()
            Image(systemName: chest.isComplete ? "checkmark.circle.fill" : "chevron.right")
                .foregroundStyle(chest.isComplete ? Palette.gold : Palette.textMuted)
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(chest.isComplete ? "done" : "not done")
    }

    private func done(_ label: String, _ isDone: Bool) -> some View {
        Label(label, systemImage: isDone ? "checkmark" : "circle")
            .foregroundStyle(isDone ? Palette.gold : Palette.textMuted)
    }
}

// MARK: - 5. One chest: treasure and clue

private struct ChestStep: View {
    @Binding var chest: HuntDraft.Chest
    let number: Int
    let isStory: Bool
    let onPickSpot: () -> Void
    let onDone: () -> Void

    var body: some View {
        Form {
            Section {
                Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                    ForEach(Array(stride(from: 0, to: BuiltInModel.allCases.count, by: 3)), id: \.self) { start in
                        GridRow {
                            ForEach(BuiltInModel.allCases[start..<min(start + 3, BuiltInModel.allCases.count)]) { model in
                                ModelTile(model: model, selected: chest.model == model)
                                    .onTapGesture { choose(model) }
                                    .accessibilityAddTraits(.isButton)
                                    .accessibilityIdentifier("model-\(model.rawValue)")
                            }
                        }
                    }
                }
                .padding(.vertical, 6)
            } header: {
                Text("Which treasure is in the chest?")
            }

            Section("Its name") {
                TextField("Treasure name", text: $chest.name)
                    .accessibilityIdentifier("chestName")
            }

            Section {
                if let template = chest.hintTemplate {
                    Text(template.replacingOccurrences(of: "{blank}", with: "_____"))
                        .font(Typeface.body(17, weight: .semibold))
                    TextField(chest.blankAsks.map { "Fill the blank: \($0)" } ?? "Fill the blank", text: $chest.clueWords)
                        .accessibilityIdentifier("clueBlank")
                    if !chest.blankIdeas.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(chest.blankIdeas, id: \.self) { idea in
                                    Button(idea) { chest.clueWords = idea }
                                        .buttonStyle(ChipStyle(selected: chest.clueWords == idea))
                                }
                            }
                        }
                    }
                } else {
                    TextField("Describe the place (\"by the big tree\")", text: $chest.clueWords)
                        .accessibilityIdentifier("clueBlank")
                }
                if let hint = chest.hint {
                    Label("The guide says: \u{201C}\(hint)\u{201D}", systemImage: "speaker.wave.2.fill")
                        .font(Typeface.body(14))
                        .foregroundStyle(Palette.gold)
                }
            } header: {
                Text("The clue")
            } footer: {
                Text("Name something your pirate will see there. Never a direction like \"go left\".")
            }

            Section {
                Button(action: onPickSpot) {
                    Label(chest.hasSpot ? "Spot checked. Move it" : "Pick the spot on the map",
                          systemImage: chest.hasSpot ? "checkmark.circle.fill" : "mappin.and.ellipse")
                }
                .accessibilityIdentifier("pickSpot")
            }

            Section {
                Button("Done", action: onDone)
                    .disabled(!chest.isComplete)
                    .accessibilityIdentifier("chestDone")
            }
        }
        .scrollContentBackground(.hidden)
        .background(Palette.ground1.ignoresSafeArea())
        .navigationTitle("Chest \(number)")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func choose(_ model: BuiltInModel) {
        // A name the parent hasn't changed follows the treasure.
        if !isStory && (chest.name.trimmed.isEmpty || chest.name == chest.model?.displayName) {
            chest.name = model.displayName
        }
        chest.model = model
    }
}

private struct ModelTile: View {
    let model: BuiltInModel
    let selected: Bool

    var body: some View {
        VStack(spacing: 4) {
            Group {
                if let image = Thumbnail.image(for: model) {
                    Image(uiImage: image).resizable().scaledToFit()
                } else {
                    Image(systemName: model.symbol).font(.largeTitle).foregroundStyle(Color(model.defaultColor))
                }
            }
            .frame(height: 70)
            Text(model.displayName)
                .font(Typeface.body(11, weight: .semibold))
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .foregroundStyle(Palette.textPrimary)
        }
        .padding(6)
        .frame(maxWidth: .infinity, minHeight: 110)
        .background(selected ? Palette.ground3 : Palette.ground2)
        .overlay(Rectangle().stroke(selected ? Palette.gold : Palette.borderQuiet, lineWidth: selected ? 3 : 1))
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

// MARK: - 6. One chest: the spot

/// The same review as milestone 1: zoom in to a detailed map and confirm the spot is safe.
private struct ChestSpotStep: View {
    @Binding var chest: HuntDraft.Chest
    let area: PlayArea?
    let others: [Coordinate]
    let onDone: () -> Void

    @State private var camera: MapCameraPosition = .userLocation(fallback: .automatic)
    @State private var center: Coordinate?
    @State private var cameraDistance: Double = .infinity
    @State private var satellite = false
    @State private var checked = false

    private var isDetailed: Bool { MapReview.isDetailedForSpot(cameraDistance: cameraDistance) }

    var body: some View {
        VStack(spacing: 0) {
            SpotMap(camera: $camera, center: $center, cameraDistance: $cameraDistance, satellite: satellite, marks: others)

            Form {
                Section {
                    Picker("Map", selection: $satellite) {
                        Text("Map").tag(false)
                        Text("Satellite").tag(true)
                    }
                    .pickerStyle(.segmented)
                    if !isDetailed {
                        Label("Zoom in until you can see paths, roads and water.", systemImage: "plus.magnifyingglass")
                            .foregroundStyle(Palette.gold)
                    }
                    Toggle("I've checked this spot. It's safe, away from roads and water, in a place I know.",
                           isOn: $checked)
                        .accessibilityIdentifier("spotChecked")
                }
                Section {
                    Button("Hide it here") {
                        guard let center, MapReview.canConfirmSpot(cameraDistance: cameraDistance, center: center,
                                                                   checked: checked) else { return }
                        chest.spot = center
                        chest.reviewedAt = .now
                        onDone()
                    }
                    .disabled(!MapReview.canConfirmSpot(cameraDistance: cameraDistance, center: center, checked: checked))
                    .accessibilityIdentifier("hideHere")
                }
            }
            .scrollContentBackground(.hidden)
            .frame(height: 280)
        }
        .background(Palette.ground1.ignoresSafeArea())
        .navigationTitle("Pick the spot")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if let spot = chest.spot {
                camera = .looking(at: spot, distance: MapReview.spotStartDistance)
            } else if let area {
                camera = .looking(at: area.center, distance: MapReview.spotStartDistance)
            }
        }
    }
}

// MARK: - Small pieces

/// A built-in treasure's thumbnail from the catalog, loaded once.
@MainActor
enum Thumbnail {
    private static var cache: [BuiltInModel: UIImage] = [:]

    static func image(for model: BuiltInModel, catalog: TreasureCatalog = .bundled) -> UIImage? {
        if let cached = cache[model] { return cached }
        guard let url = catalog.thumbnailURL(for: model), let image = UIImage(contentsOfFile: url.path(percentEncoded: false))
        else { return nil }
        cache[model] = image
        return image
    }
}

struct ChipStyle: ButtonStyle {
    var selected = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Typeface.body(14, weight: .semibold))
            .padding(.horizontal, 12)
            .frame(minHeight: 36)
            .background(selected ? Palette.gold : Palette.ground2)
            .foregroundStyle(selected ? Palette.ground1 : Palette.textPrimary)
            .overlay(Rectangle().stroke(Palette.borderStrong, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

struct SetupField: View {
    let prompt: String
    @Binding var text: String

    var body: some View {
        TextField("", text: $text, prompt: Text(prompt).foregroundStyle(Palette.textMuted))
            .font(Typeface.body(16))
            .padding(.horizontal, 12)
            .frame(height: 48)
            .background(Palette.ground2)
            .overlay(Rectangle().stroke(Palette.borderStrong, lineWidth: 1))
            .foregroundStyle(Palette.textPrimary)
    }
}

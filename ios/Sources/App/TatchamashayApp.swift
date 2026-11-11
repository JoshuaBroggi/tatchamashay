import SwiftUI

@main
struct TatchamashayApp: App {
    @State private var app = AppModel()
    @State private var location = LocationService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .environment(app.settings)
                .environment(location)
                .task {
                    location.start()
                    await app.real.load()
                }
                .preferredColorScheme(.dark)
        }
    }
}

/// Holds the real family and, while Demo mode is on, a separate demo family.
@MainActor
@Observable
final class AppModel {
    let real: FamilyModel
    private(set) var demo: FamilyModel?

    /// The grown-up's sound, voice and motion switches, shared by every screen.
    let settings: PlaySettings
    let sounds: any SoundEffects
    let voice: any GuideVoice
    let catalog = TreasureCatalog.bundled
    let stories = StoryLibrary.bundled

    /// The hunt's latest guide moment; the guide overlay speaks for it. Set by `Views/Hunt`.
    var huntMoment: HuntMoment?

    init() {
        #if DEBUG
        // UI tests start from an empty family.
        if ProcessInfo.processInfo.arguments.contains("-resetFamily") {
            try? FileManager.default.removeItem(at: JSONFilePersistence.defaultURL)
            UserDefaults.standard.removeObject(forKey: "currentHuntRun")
        }
        // UI tests of the hunt start from a ready 3-treasure adventure.
        if ProcessInfo.processInfo.arguments.contains("-huntFixture") {
            HuntFixture.install(at: JSONFilePersistence.defaultURL)
        }
        #endif
        let store = LocalFamilyStore(persistence: JSONFilePersistence(url: JSONFilePersistence.defaultURL))
        real = FamilyModel(store: store)
        let settings = PlaySettings()
        self.settings = settings
        #if DEBUG
        // UI tests run quietly.
        if ProcessInfo.processInfo.arguments.contains("-silent") {
            sounds = SilentSoundEffects(settings: settings)
            voice = SilentGuideVoice(settings: settings)
            return
        }
        #endif
        sounds = BundledSoundEffects(catalog: .bundled, settings: settings)
        voice = SpeechGuideVoice(settings: settings)
    }

    /// The family the screens show: the demo one while Demo mode is on, otherwise the real one.
    var family: FamilyModel { demo ?? real }
    var isDemo: Bool { demo != nil }

    func startDemo(around center: Coordinate) async {
        demo = await DemoFamily.make(around: center)
    }

    #if DEBUG
    /// UI tests and screenshots: plays a ready-made family as Demo mode.
    func startDemo(with family: FamilyModel) {
        demo = family
    }
    #endif

    func endDemo() {
        demo = nil
        demoFix = nil
    }

    /// The latest hunt moment (hunt start, getting close, foggy GPS, a find, next treasure, finale),
    /// set by the hunt screen once per event. The guide watches it to speak and show its lines; the
    /// hunt itself never speaks. `HuntMomentTracker` documents when each moment fires.
    var huntMoment: HuntMomentEvent?

    /// Demo mode only: a pretend position, so testing doesn't need a walk.
    private(set) var demoFix: LocationFix?

    func sail(to spot: Coordinate) {
        guard isDemo else { return }
        demoFix = LocationFix(coordinate: Geo.offset(spot, north: 8, east: 0), horizontalAccuracy: 5, timestamp: .now)
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        Group {
            if !app.real.isLoaded {
                Palette.ground1.ignoresSafeArea()
            } else if app.real.parent == nil {
                WelcomeView()
            } else {
                VStack(spacing: 0) {
                    if app.isDemo { DemoBanner() }
                    TabView {
                        Tab("Map", systemImage: "map.fill") { HuntView().overlay { GuideLayer() } }
                        Tab("My Chest", systemImage: "shippingbox.fill") { ChestScreen() }
                        Tab("Grown-ups", systemImage: "person.2.fill") { ParentView() }
                    }
                    .tint(Palette.gold)
                }
                .environment(app.family)
                // Rebuilds every screen when switching between the real and demo families.
                .id(app.isDemo)
            }
        }
        .background(Palette.ground1)
    }
}

/// First launch: the parent sets up the family on this phone.
struct WelcomeView: View {
    @Environment(AppModel.self) private var app
    @State private var parentName = ""
    @State private var pirateName = ""
    @State private var saving = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Overline(text: "Tatchamashay")
            Text("Ahoy! Let's set up your crew")
                .font(Typeface.headline(40))
                .foregroundStyle(Palette.textPrimary)
            Text("For grown-ups. Everything stays on this phone. Your pirate has no account and no public name.")
                .font(Typeface.body(14))
                .foregroundStyle(Palette.textSecondary)

            field("Your name", text: $parentName, prompt: "Mom, Dad, Grandpa…")
            field("Your pirate's name", text: $pirateName, prompt: "Captain Emmanuel")

            Spacer()
            Button("Start the adventure") {
                saving = true
                Task {
                    await app.real.createFamily(
                        parentName: parentName.trimmed,
                        pirateName: pirateName.trimmed
                    )
                    saving = false
                }
            }
            .buttonStyle(GoldButtonStyle())
            .accessibilityIdentifier("startAdventure")
            .disabled(parentName.trimmed.isEmpty || pirateName.trimmed.isEmpty || saving)
            .opacity(parentName.trimmed.isEmpty || pirateName.trimmed.isEmpty ? 0.5 : 1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 24)
        .background(Palette.ground1.ignoresSafeArea())
    }

    private func field(_ label: String, text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(Typeface.label()).foregroundStyle(Palette.textSecondary)
            TextField("", text: text, prompt: Text(prompt).foregroundStyle(Palette.textMuted))
                .font(Typeface.body(16))
                .padding(.horizontal, 12)
                .frame(height: 48)
                .background(Palette.ground2)
                .overlay(Rectangle().stroke(Palette.borderStrong, lineWidth: 1))
                .foregroundStyle(Palette.textPrimary)
        }
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

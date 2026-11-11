#if DEBUG
import SwiftUI

/// Debug builds only, with the `-guideRehearsal` launch argument: plays "The Three Moon Pebbles" as a
/// Demo-mode family and shows buttons that feed hunt moments to the guide, so UI tests and
/// screenshots can run the guide without walking anywhere.
@MainActor
enum GuideRehearsal {
    static var isOn: Bool { ProcessInfo.processInfo.arguments.contains("-guideRehearsal") }

    static let storyID = "moon-pebbles"
    /// About 4 km from the spots the other UI tests stand on, so a simulator left at one of them
    /// doesn't put a rehearsal treasure in Dig! range.
    static let center = Coordinate(latitude: 37.8050, longitude: -122.4500)

    /// Emmanuel and Dad with the starter adventure hidden on three made-up spots. In-memory only,
    /// shown under the Demo banner.
    static func family(stories: StoryLibrary) async -> FamilyModel {
        let parent = ParentAccount(displayName: "Dad")
        let child = ChildProfile(parentID: parent.id, pirateName: "Emmanuel")
        var data = FamilyData(parent: parent, children: [child])
        let story = stories.adventure(storyID)
        var adventure = Adventure(familyID: parent.id, title: story?.title ?? "Rehearsal",
                                  goal: story?.goal ?? "Find the lost treasure!",
                                  finale: story?.finale.last ?? "Back to the ship!",
                                  guideID: story?.guide, storyID: story?.id)
        for (i, treasure) in (story?.treasures ?? []).enumerated() {
            let model = treasure.model ?? .clam
            let design = TreasureDesign(familyID: parent.id, maker: .parent(parent.id),
                                        look: TreasureLook(model: model, color: model.defaultColor, name: treasure.name))
            let placement = ChestPlacement(
                familyID: parent.id, adventureID: adventure.id, designID: design.id, versionID: design.current.id,
                spot: Geo.offset(center, north: Double(i) * 40, east: 30),
                hint: treasure.hint(blank: treasure.blankIdeas.first ?? "big tree") ?? "",
                placedBy: parent.id, reviewedAt: .distantPast, storyTreasureID: treasure.id
            )
            data.designs.append(design)
            data.placements.append(placement)
            adventure.placementIDs.append(placement.id)
        }
        data.adventures = [adventure]
        let model = FamilyModel(store: LocalFamilyStore(persistence: MemoryPersistence(data)), isDemo: true)
        await model.load()
        model.startNewRun()
        return model
    }
}

/// Buttons that set `AppModel.huntMoment` the way the hunt screen does.
struct GuideTestDriver: View {
    let director: GuideDirector
    @Environment(AppModel.self) private var app
    @Environment(FamilyModel.self) private var family
    @State private var index = 0

    private let moments: [(GuideMoment, String)] = [
        (.gettingClose, "Close"), (.digReady, "Dig"), (.foggyGPS, "Fog"), (.weFoundIt, "Found"),
        (.reveal, "Reveal"), (.nextTreasure, "Next"), (.finale, "Finale"),
    ]

    var body: some View {
        VStack(spacing: 4) {
            ForEach(moments, id: \.0) { moment, label in
                Button(label) {
                    if moment == .nextTreasure { index += 1 }
                    app.huntMoment = HuntMomentEvent(moment: moment, treasureNumber: index + 1,
                                                     total: family.adventurePlacements.count,
                                                     placementID: nil, at: .now)
                }
                .font(.caption2.monospaced())
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(Palette.invented.opacity(0.85), in: Capsule())
                .foregroundStyle(Palette.ground1)
                .accessibilityIdentifier("drive.\(moment.rawValue)")
            }
        }
        .padding(.trailing, 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
    }
}
#endif

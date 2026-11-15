#if DEBUG
import Foundation

/// UI tests: three treasures split between old and new saved groups. Both must appear together.
enum HuntFixture {
    static let spots = [
        Coordinate(latitude: 37.7694, longitude: -122.4862),
        Coordinate(latitude: 37.7716, longitude: -122.4862),
        Coordinate(latitude: 37.7694, longitude: -122.4834),
    ]
    static let hints = ["Look near the big tree", "By the little bridge", "Under the picnic table"]

    static func data() -> FamilyData {
        let parent = ParentAccount(displayName: "Dad")
        let child = ChildProfile(parentID: parent.id, pirateName: "Captain Emmanuel")
        var data = FamilyData(parent: parent, children: [child])
        var older = Adventure(familyID: parent.id, title: "Old hunt", goal: "Legacy goal",
                              storyID: "removed-story", createdAt: Date(timeIntervalSince1970: 1))
        var newer = Adventure(familyID: parent.id, title: "New hunt", goal: "Legacy goal",
                              createdAt: Date(timeIntervalSince1970: 2))
        for (i, model) in [BuiltInModel.starCompass, .crown, .parrot].enumerated() {
            let design = TreasureDesign(
                familyID: parent.id, maker: .parent(parent.id),
                look: TreasureLook(model: model, color: model.defaultColor, name: model.displayName)
            )
            let spot = ProcessInfo.processInfo.arguments.contains("-overlappingFixture") && i == 1 ? spots[0] : spots[i]
            let placement = ChestPlacement(
                familyID: parent.id, adventureID: i < 2 ? older.id : newer.id,
                designID: design.id, versionID: design.current.id,
                spot: spot, hint: hints[i], placedBy: parent.id, reviewedAt: Date(timeIntervalSince1970: 0)
            )
            data.designs.append(design)
            data.placements.append(placement)
            if i < 2 { older.placementIDs.append(placement.id) }
            else { newer.placementIDs.append(placement.id) }
        }
        data.adventures = [older, newer]
        return data
    }

    static func install(at url: URL) {
        try? JSONFilePersistence(url: url).write(data())
        UserDefaults.standard.removeObject(forKey: "currentHuntRun")
        UserDefaults.standard.removeObject(forKey: "playingChild")
    }
}
#endif

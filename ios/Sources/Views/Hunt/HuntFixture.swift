#if DEBUG
import Foundation

/// UI tests only (`-huntFixture`): a real family with a 3-treasure adventure in Golden Gate Park, so
/// the hunt can be walked with simulated locations without going through parent setup.
enum HuntFixture {
    /// Play order. About 245 m apart, so finding one leaves the next well out of Dig! range.
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
        var adventure = Adventure(familyID: parent.id, title: "The Lost Compass",
                                  goal: "Find the three lost pieces of the compass!")
        for (i, model) in [BuiltInModel.starCompass, .crown, .parrot].enumerated() {
            let design = TreasureDesign(
                familyID: parent.id, maker: .parent(parent.id),
                look: TreasureLook(model: model, color: model.defaultColor, name: model.displayName, story: "Test treasure.")
            )
            let placement = ChestPlacement(
                familyID: parent.id, adventureID: adventure.id, designID: design.id, versionID: design.current.id,
                spot: spots[i], hint: hints[i], placedBy: parent.id, reviewedAt: Date(timeIntervalSince1970: 0)
            )
            data.designs.append(design)
            data.placements.append(placement)
            adventure.placementIDs.append(placement.id)
        }
        data.adventures = [adventure]
        return data
    }

    /// Replaces the family file with the fixture and forgets any run in progress.
    static func install(at url: URL) {
        try? JSONFilePersistence(url: url).write(data())
        UserDefaults.standard.removeObject(forKey: "currentHuntRun")
    }
}
#endif

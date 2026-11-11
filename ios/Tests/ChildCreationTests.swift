import Foundation
import Testing
@testable import Tatchamashay

@Suite("A child's invention, hidden for the grown-up")
@MainActor
struct ChildCreationTests {
    let spot = Coordinate(latitude: 37.7694, longitude: -122.4862)
    let look = TreasureLook(model: .starCompass, color: .blue, sparkles: .rainbow, name: "Snorty Muffin",
                            sound: .snore, story: "It fell off the moon.")

    /// A family with a parent and a child, and nothing hidden.
    func makeFamily(persistence: any FamilyPersistence = MemoryPersistence()) async -> FamilyModel {
        let model = FamilyModel(store: LocalFamilyStore(persistence: persistence))
        await model.load()
        await model.createFamily(parentName: "Dad", pirateName: "Captain E")
        return model
    }

    @Test("Saving an invention makes a child-made design at version 1, and nothing is hidden")
    func newDesign() async throws {
        let family = await makeFamily()
        let child = try #require(family.child)
        let design = try #require(await family.saveInvention(look))

        #expect(design.maker == .child(child.id))
        #expect(design.versions.count == 1 && design.current.number == 1)
        #expect(design.current.look == look)
        #expect(family.inventions.map(\.id) == [design.id])
        #expect(family.data.placements.isEmpty, "saving an invention never places it")
        #expect(family.data.adventures.isEmpty)
    }

    @Test("Making a new version keeps the old one unchanged")
    func newVersion() async throws {
        let family = await makeFamily()
        let first = try #require(await family.saveInvention(look))
        var changed = look
        changed.color = .gold
        changed.name = "Snorty Biscuit"
        let edited = try #require(await family.saveInvention(changed, editing: first.id))

        #expect(edited.id == first.id)
        #expect(edited.versions.map(\.number) == [1, 2])
        #expect(edited.version(first.current.id)?.look == look, "old versions never change")
        #expect(edited.current.look == changed)
        #expect(family.inventions.count == 1, "an edit is not a second treasure")
    }

    @Test("Nothing is hidden until the grown-up confirms a reviewed spot")
    func confirmationRequired() async throws {
        let family = await makeFamily()
        let design = try #require(await family.saveInvention(look))

        let future = await family.hideForGrownUp(design: design.id, version: design.current.id, at: spot,
                                                 hint: "Look near the back step.", reviewedAt: .now.addingTimeInterval(3_600))
        #expect(!future, "a spot can't be reviewed in the future")
        #expect(family.data.placements.isEmpty)
        #expect(family.data.adventures.isEmpty, "a failed placement leaves no empty adventure behind")

        let hidden = await family.hideForGrownUp(design: design.id, version: design.current.id, at: spot,
                                                 hint: "Look near the back step.", reviewedAt: .now, guideID: "captain-tumblebeard")
        #expect(hidden)
        let adventure = try #require(family.adventure)
        let placement = try #require(family.adventurePlacements.first)
        #expect(adventure.placementIDs == [placement.id], "a one-treasure adventure")
        #expect(family.hiddenBy(adventure)?.pirateName == "Captain E")
        #expect(adventure.guideID == "captain-tumblebeard")
        #expect(placement.designID == design.id && placement.versionID == design.current.id)
        #expect(placement.placedBy == family.parent?.id, "the grown-up places it")
        #expect(placement.hint == "Look near the back step.")
    }

    @Test("Hiding an unknown version saves nothing")
    func unknownVersion() async throws {
        let family = await makeFamily()
        let design = try #require(await family.saveInvention(look))
        let hidden = await family.hideForGrownUp(design: design.id, version: UUID(), at: spot, hint: "", reviewedAt: .now)
        #expect(!hidden)
        #expect(family.data.adventures.isEmpty && family.data.placements.isEmpty)
    }

    @Test("An adventure can't name a child outside the family as its hider")
    func hiddenByMustBeInFamily() throws {
        let parent = ParentAccount(displayName: "Dad")
        var data = FamilyData()
        try data.createFamily(parent: parent, child: ChildProfile(parentID: parent.id, pirateName: "E"))
        let stranger = Adventure(familyID: parent.id, title: "?", goal: "?", hiddenBy: UUID())
        #expect(throws: FamilyStoreError.unknownChild) { try data.saveAdventure(stranger) }
    }

    @Test("The grown-up finds it; a new version later never changes the found copy")
    func findThenEdit() async throws {
        let url = temporaryFileURL()
        let family = await makeFamily(persistence: JSONFilePersistence(url: url))
        let design = try #require(await family.saveInvention(look))
        _ = await family.hideForGrownUp(design: design.id, version: design.current.id, at: spot, hint: "", reviewedAt: .now)
        let placement = try #require(family.nextPlacement)

        let result = try #require(await family.recordFind(placement, method: .parentConfirmed))
        #expect(result.record.savedCopy == look)
        #expect(family.isRunComplete, "one treasure, then the finale")

        var changed = look
        changed.model = .turtle
        changed.name = "Sleepy Sprout"
        let edited = try #require(await family.saveInvention(changed, editing: design.id))
        #expect(edited.current.number == 2)
        #expect(family.chest.first?.savedCopy == look, "the found copy keeps the look it had")
        #expect(family.data.placement(placement.id)?.versionID == design.current.id, "the hidden spot keeps version 1")

        let reopened = try await LocalFamilyStore(persistence: JSONFilePersistence(url: url)).load()
        #expect(reopened.collections.first?.savedCopy == look)
        #expect(reopened.design(design.id)?.versions.count == 2)
        #expect(reopened.adventures.first?.hiddenBy == family.child?.id)
    }

    @Test("Adventures saved before hiddenBy existed still load")
    func oldAdventuresDecode() throws {
        let old = Adventure(familyID: UUID(), title: "Old", goal: "Find it")
        var json = try #require(try JSONSerialization.jsonObject(with: JSONEncoder.family.encode(old)) as? [String: Any])
        json.removeValue(forKey: "hiddenBy")
        let decoded = try JSONDecoder.family.decode(Adventure.self, from: JSONSerialization.data(withJSONObject: json))
        #expect(decoded.hiddenBy == nil && decoded.title == "Old")
    }
}

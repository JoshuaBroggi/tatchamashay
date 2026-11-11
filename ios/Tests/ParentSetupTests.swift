import Foundation
import Testing
@testable import Tatchamashay

@Suite("Parent setup: drafts, saving a hunt, the grown-up's name and pirate profiles")
struct ParentSetupTests {
    let f = Fixture()
    let area = PlayArea(center: Coordinate(latitude: 37.7694, longitude: -122.4862), name: "The park")

    private var moonPebbles: AdventureStory {
        get throws { try #require(StoryLibrary.bundled.adventure("moon-pebbles")) }
    }

    /// A draft from the starter story with every chest finished.
    private func finishedDraft() throws -> HuntDraft {
        var draft = try HuntDraft(story: moonPebbles, area: area)
        for i in draft.chests.indices {
            draft.chests[i].model = draft.chests[i].model ?? .clam
            draft.chests[i].clueWords = ["big tree", "red", "swing high"][i]
            draft.chests[i].spot = Geo.offset(area.center, north: Double(i) * 30, east: 0)
            draft.chests[i].reviewedAt = Date(timeIntervalSince1970: 0)
        }
        return draft
    }

    /// A store with a parent and child but no adventure yet.
    private func emptyFamilyStore() async throws -> LocalFamilyStore {
        let store = LocalFamilyStore(persistence: MemoryPersistence())
        _ = try await store.createFamily(parent: f.parent, child: f.child)
        return store
    }

    // MARK: Map review

    @Test("A spot needs a detailed map, a center and the parent's check")
    func spotReview() {
        let center = Coordinate(latitude: 0, longitude: 0)
        #expect(MapReview.canConfirmSpot(cameraDistance: 800, center: center, checked: true))
        #expect(!MapReview.canConfirmSpot(cameraDistance: 800, center: center, checked: false))
        #expect(!MapReview.canConfirmSpot(cameraDistance: 800, center: nil, checked: true))
        #expect(!MapReview.canConfirmSpot(cameraDistance: 5_000, center: center, checked: true))
        #expect(MapReview.isDetailedForArea(cameraDistance: 5_000))
        #expect(!MapReview.isDetailedForArea(cameraDistance: 50_000))
        #expect(!MapReview.isDetailedForSpot(cameraDistance: MapReview.spotStartDistance),
                "spot review starts zoomed out, so the parent zooms in")
    }

    // MARK: Drafts

    @Test("A starter adventure makes one chest per treasure, in story order, with its hint")
    func draftFromStory() throws {
        let story = try moonPebbles
        let draft = HuntDraft(story: story, area: area)
        #expect(draft.chests.map(\.storyTreasureID) == story.treasures.map(\.id))
        #expect(draft.chests.map(\.name) == story.treasures.map(\.name))
        #expect(draft.storyID == story.id)
        #expect(draft.guideID == story.guide)
        #expect(draft.goal == story.goal)
        #expect(draft.chests.allSatisfy { !$0.isComplete })
        #expect(!draft.canSave)
        #expect(!draft.canRemoveChest, "a story's chests stay in the story")
    }

    @Test("The parent's words fill the hint's blank; an empty blank isn't a clue")
    func hintFilling() throws {
        var chest = try HuntDraft(story: moonPebbles, area: area).chests[0]
        #expect(chest.hint == nil)
        #expect(chest.missing == (chest.model == nil ? [.treasure, .clue, .spot] : [.clue, .spot]))
        chest.clueWords = "   "
        #expect(chest.hint == nil)
        chest.clueWords = "big tree"
        #expect(chest.hint == "Look near the big tree.")

        var own = HuntDraft.Chest(name: "Crown", model: .crown)
        own.clueWords = "By the gate"
        #expect(own.hint == "By the gate", "with no template the parent writes the whole clue")
    }

    @Test("A story treasure's model field is used when present")
    func storyModelDefault() throws {
        struct WithModel { let id = "x"; let model: BuiltInModel? = .potion }
        struct WithID { let model: String? = "clam" }
        #expect(HuntDraft.storyModelFromMirror(WithModel()) == .potion)
        #expect(HuntDraft.storyModelFromMirror(WithID()) == .clam)
        struct Without { let id = "x" }
        #expect(HuntDraft.storyModelFromMirror(Without()) == nil)
    }

    @Test("A blank hunt needs a name and 3 to 5 finished chests")
    func blankHunt() {
        var draft = HuntDraft.blank(area: area)
        #expect(draft.whatsLeft == "Give your hunt a name.")
        draft.title = "Backyard"
        #expect(draft.whatsLeft == "Add 3 more chests.")
        for _ in 0..<6 { draft.addChest() }
        #expect(draft.chests.count == 5, "never more than five")
        #expect(!draft.canAddChest)
        #expect(draft.whatsLeft == "Finish 5 more chests.")
        for i in draft.chests.indices {
            draft.chests[i].model = .crown
            draft.chests[i].name = "Crown \(i)"
            draft.chests[i].clueWords = "Spot \(i)"
            draft.chests[i].spot = area.center
            draft.chests[i].reviewedAt = .now
        }
        #expect(draft.canSave)
        #expect(draft.whatsLeft == nil)
        draft.chests[2].name = " "
        #expect(!draft.canSave, "every treasure needs a name")
    }

    @Test("Records keep play order, story links, the blank and the review time")
    func records() throws {
        let draft = try finishedDraft()
        let (adventure, designs, placements) = try #require(draft.records(family: f.parent))
        #expect(adventure.placementIDs == placements.map(\.id))
        #expect(adventure.storyID == "moon-pebbles")
        #expect(adventure.playArea == area)
        #expect(placements.map(\.storyTreasureID) == draft.chests.map(\.storyTreasureID))
        #expect(placements[0].hint == "Look near the big tree.")
        #expect(placements[0].hintBlank == "big tree")
        #expect(placements.allSatisfy { $0.reviewedAt == Date(timeIntervalSince1970: 0) })
        #expect(zip(designs, placements).allSatisfy { $0.id == $1.designID && $0.current.id == $1.versionID })
        #expect(designs[0].current.look.name == draft.chests[0].name)
    }

    // MARK: Saving

    @Test("A finished draft saves as the newest adventure")
    func saveHunt() async throws {
        let store = try await emptyFamilyStore()
        let (adventure, designs, placements) = try #require(try finishedDraft().records(family: f.parent))
        let data = try await store.saveHuntSetup(adventure, designs: designs, placements: placements)
        #expect(data.adventure(adventure.id)?.placementIDs == placements.map(\.id))
        #expect(data.adventure(adventure.id)?.readiness == .ready)
        #expect(data.placements.count == 3)
    }

    @Test("A hunt with too few chests, or an unreviewed spot, saves nothing")
    func saveIsAllOrNothing() async throws {
        let store = try await emptyFamilyStore()
        let (adventure, designs, placements) = try #require(try finishedDraft().records(family: f.parent))

        var short = adventure
        short.placementIDs = Array(placements.prefix(2).map(\.id))
        await #expect(throws: FamilyStoreError.notEnoughTreasure) {
            _ = try await store.saveHuntSetup(short, designs: designs, placements: Array(placements.prefix(2)))
        }

        var future = placements
        future[2].reviewedAt = .now.addingTimeInterval(3_600)
        await #expect(throws: FamilyStoreError.unreviewedSpot) {
            _ = try await store.saveHuntSetup(adventure, designs: designs, placements: future)
        }
        let data = try await store.load()
        #expect(data.adventures.isEmpty)
        #expect(data.designs.isEmpty)
        #expect(data.placements.isEmpty)
    }

    @Test("Saving the same hunt twice is refused")
    func saveOnce() async throws {
        let store = try await emptyFamilyStore()
        let (adventure, designs, placements) = try #require(try finishedDraft().records(family: f.parent))
        _ = try await store.saveHuntSetup(adventure, designs: designs, placements: placements)
        await #expect(throws: FamilyStoreError.adventureAlreadySaved) {
            _ = try await store.saveHuntSetup(adventure, designs: designs, placements: placements)
        }
        #expect(try await store.load().placements.count == 3)
    }

    // MARK: The grown-up and pirates

    @Test("What the child calls the grown-up fills {grown_up}, falling back to their name")
    func grownUpName() async throws {
        let store = try await emptyFamilyStore()
        #expect(try await store.load().parent?.grownUpName == "Parent")
        var parent = f.parent
        parent.childCallsMe = "Papa"
        let data = try await store.saveParent(parent)
        #expect(data.parent?.grownUpName == "Papa")
        #expect(StoryContext(grownUp: data.parent?.grownUpName).fill("Stay with {grown_up}!") == "Stay with Papa!")
        parent.childCallsMe = "  "
        #expect(parent.grownUpName == "Parent")

        let stranger = ParentAccount(displayName: "Someone else")
        await #expect(throws: FamilyStoreError.notInFamily) { _ = try await store.saveParent(stranger) }
    }

    @Test("Records saved before childCallsMe, playArea and hintBlank still load")
    func oldRecordsDecode() throws {
        let old = #"{"id":"6C5F4B0A-8C2E-4F4A-9E43-2B7B7C7E2A11","displayName":"Dad","createdAt":0}"#
        let parent = try JSONDecoder().decode(ParentAccount.self, from: Data(old.utf8))
        #expect(parent.childCallsMe == nil)
        #expect(parent.grownUpName == "Dad")
        let encoded = try JSONEncoder.family.encode(f.adventure)
        var json = try #require(try JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        json["playArea"] = nil
        let adventure = try JSONDecoder().decode(Adventure.self, from: JSONSerialization.data(withJSONObject: json))
        #expect(adventure.playArea == nil)
    }

    @Test("A second pirate can be added; removing one empties only their chest; the last one stays")
    func pirates() async throws {
        let store = try await f.makeStore()
        let sibling = ChildProfile(parentID: f.parent.id, pirateName: "Captain Mia")
        _ = try await store.saveChild(sibling)
        _ = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)
        _ = try await store.recordFind(child: sibling.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)

        let data = try await store.removeChild(sibling.id)
        #expect(data.children.map(\.id) == [f.child.id])
        #expect(data.chest(for: f.child.id).count == 1, "the other pirate's chest is untouched")
        #expect(data.chest(for: sibling.id).isEmpty)
        #expect(data.placement(f.placement.id) != nil)

        await #expect(throws: FamilyStoreError.lastChild) { _ = try await store.removeChild(f.child.id) }
        await #expect(throws: FamilyStoreError.unknownChild) { _ = try await store.removeChild(UUID()) }
    }

    @Test("The playing pirate is the one picked, or the first")
    @MainActor
    func playingChild() async throws {
        let store = try await f.makeStore()
        let sibling = ChildProfile(parentID: f.parent.id, pirateName: "Captain Mia")
        _ = try await store.saveChild(sibling)
        let model = FamilyModel(store: store, isDemo: true)
        await model.load()
        #expect(model.child?.id == f.child.id)
        model.choosePlayingChild(sibling.id)
        #expect(model.child?.id == sibling.id)
        await model.removeChild(sibling)
        #expect(model.child?.id == f.child.id)
        #expect(model.playingChildID == nil)
    }
}

@Suite("Get ready")
@MainActor
struct GetReadyTests {
    let f = Fixture()

    struct FakeLoaders: ReadyLoaders {
        var brokenModels: Set<BuiltInModel> = []
        var chest = true
        var sounds = true
        var map = true
        func modelLoads(_ model: BuiltInModel) async -> Bool { !brokenModels.contains(model) }
        func chestLoads() async -> Bool { chest }
        func soundLoads(_ effect: SoundEffect) -> Bool { sounds }
        func mapLoads(_ area: PlayArea) async -> Bool { map }
    }

    /// The fixture family with three treasures in its adventure.
    private func readyFamily(hints: [String] = ["By the tree", "By the gate", "By the slide"]) -> (Adventure, FamilyData) {
        var data = FamilyData(parent: f.parent, children: [f.child])
        var adventure = f.adventure
        adventure.playArea = PlayArea(center: f.spot)
        for (i, hint) in hints.enumerated() {
            let model = [BuiltInModel.crown, .clam, .potion][i % 3]
            let design = TreasureDesign(familyID: f.parent.id, maker: .parent(f.parent.id),
                                        look: TreasureLook(model: model, color: model.defaultColor, name: "T\(i)"))
            let placement = ChestPlacement(familyID: f.parent.id, adventureID: adventure.id, designID: design.id,
                                           versionID: design.current.id, spot: f.spot, hint: hint,
                                           placedBy: f.parent.id, reviewedAt: Date(timeIntervalSince1970: 0))
            data.designs.append(design)
            data.placements.append(placement)
            adventure.placementIDs.append(placement.id)
        }
        data.adventures = [adventure]
        return (adventure, data)
    }

    private func report(_ adventure: Adventure, _ data: FamilyData, loaders: FakeLoaders = FakeLoaders(),
                        pirateName: String? = "Captain E") async -> ReadyReport {
        var report = ReadyReport(items: GetReady.items())
        await GetReady.run(adventure: adventure, data: data, library: .bundled, pirateName: pirateName,
                           grownUp: "Dad", loaders: loaders) { item in
            if let i = report.items.firstIndex(where: { $0.id == item.id }) { report.items[i] = item }
        }
        return report
    }

    @Test("Everything loading means Ready, with the map's no-signal warning still shown")
    func ready() async {
        let (adventure, data) = readyFamily()
        let report = await report(adventure, data)
        #expect(report.isReady)
        #expect(!report.isChecking)
        let map = report.items.first { $0.id == "map" }
        #expect(map?.status == .warning("The map loaded. " + ReadyReport.mapWarning))
    }

    @Test("A blank map only warns; it never blocks Ready")
    func mapOnlyWarns() async {
        let (adventure, data) = readyFamily()
        let report = await report(adventure, data, loaders: FakeLoaders(map: false))
        #expect(report.isReady)
        #expect(report.items.first { $0.id == "map" }?.status
                == .warning("Couldn't load the map just now. " + ReadyReport.mapWarning))
    }

    @Test("A model, the chest or a sound that won't open is a problem")
    func brokenFiles() async {
        let (adventure, data) = readyFamily()
        let model = await report(adventure, data, loaders: FakeLoaders(brokenModels: [.potion]))
        #expect(!model.isReady)
        #expect(model.problems.map(\.id) == ["treasures"])
        let chest = await report(adventure, data, loaders: FakeLoaders(chest: false))
        #expect(chest.problems.map(\.id) == ["treasures"])
        let sound = await report(adventure, data, loaders: FakeLoaders(sounds: false))
        #expect(sound.problems.map(\.id) == ["sounds"])
    }

    @Test("Too few treasures, or an unfinished clue, isn't ready")
    func spotsAndClues() async {
        let (few, fewData) = readyFamily(hints: ["A", "B"])
        #expect(await report(few, fewData).problems.map(\.id) == ["spots"])
        let (open, openData) = readyFamily(hints: ["A", "Look near the {blank}.", "C"])
        #expect(await report(open, openData).problems.map(\.id) == ["story"])
    }

    @Test("A starter adventure's story and treasures must all be in the library")
    func storyLines() async {
        var (adventure, data) = readyFamily()
        adventure.storyID = "moon-pebbles"
        adventure.guideID = "captain-tumblebeard"
        let story = StoryLibrary.bundled.adventure("moon-pebbles")
        for (i, id) in adventure.placementIDs.enumerated() {
            if let p = data.placements.firstIndex(where: { $0.id == id }) {
                data.placements[p].storyTreasureID = story?.treasures[i].id
            }
        }
        #expect(await report(adventure, data).isReady)

        data.placements[0].storyTreasureID = "no-such-treasure"
        #expect(await report(adventure, data).problems.map(\.id) == ["story"])
        adventure.storyID = "no-such-story"
        #expect(await report(adventure, data).problems.map(\.id) == ["story"])
    }

    @Test("The real bundled files all load")
    func bundledFilesLoad() async {
        let loaders = BundledReadyLoaders()
        for effect in SoundEffect.allCases { #expect(loaders.soundLoads(effect), "\(effect)") }
        #expect(await loaders.chestLoads())
        #expect(await loaders.modelLoads(.crown))
    }
}

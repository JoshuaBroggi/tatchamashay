import Foundation
import Observation

/// The app's view of one family's records, kept current after every write.
@MainActor
@Observable
final class FamilyModel {
    let isDemo: Bool
    private(set) var data = FamilyData()
    private(set) var isLoaded = false
    var errorMessage: String?

    /// The run in progress for the current adventure. A new run is a replay.
    private(set) var currentRun: HuntRun?

    private let store: any FamilyStore
    private let runDefaultsKey: String?
    private let playingDefaultsKey: String?

    /// The child profile playing now, when the family has more than one. Nil means the first.
    private(set) var playingChildID: ChildProfile.ID?

    init(store: any FamilyStore, isDemo: Bool = false) {
        self.store = store
        self.isDemo = isDemo
        runDefaultsKey = isDemo ? nil : "currentHuntRun"
        playingDefaultsKey = isDemo ? nil : "playingChild"
        if let playingDefaultsKey, let saved = UserDefaults.standard.string(forKey: playingDefaultsKey) {
            playingChildID = UUID(uuidString: saved)
        }
    }

    var parent: ParentAccount? { data.parent }
    /// The child playing: the one the grown-up picked, or the first profile.
    var child: ChildProfile? {
        playingChildID.flatMap { data.child($0) } ?? data.children.first
    }
    var children: [ChildProfile] { data.children }
    /// What the child calls the grown-up, for the guide's `{grown_up}`.
    var grownUpName: String? { parent?.grownUpName }
    /// Milestone 1 plays the newest adventure.
    var adventure: Adventure? { data.adventures.max { $0.createdAt < $1.createdAt } }

    var adventurePlacements: [ChestPlacement] {
        adventure?.placementIDs.compactMap { data.placement($0) } ?? []
    }

    var chest: [CollectionRecord] {
        child.map { data.chest(for: $0.id) } ?? []
    }

    func load() async {
        do {
            data = try await store.load()
            currentRun = restoredRun()
            isLoaded = true
        } catch {
            errorMessage = "Couldn't open the treasure log."
            isLoaded = true
        }
    }

    // MARK: Setup

    func createFamily(parentName: String, pirateName: String) async {
        let parent = ParentAccount(displayName: parentName)
        let child = ChildProfile(parentID: parent.id, pirateName: pirateName)
        await write { try await $0.createFamily(parent: parent, child: child) }
    }

    func renameChild(_ pirateName: String) async {
        guard var child else { return }
        child.pirateName = pirateName
        await write { try await $0.saveChild(child) }
    }

    /// Sets what the child calls the grown-up. Empty goes back to the grown-up's own name.
    func setGrownUpName(_ name: String) async {
        guard var parent else { return }
        parent.childCallsMe = name.isEmpty ? nil : name
        await write { try await $0.saveParent(parent) }
    }

    func addChild(pirateName: String, avatar: PirateAvatar = .parrot) async {
        guard let parent else { return }
        await write { try await $0.saveChild(ChildProfile(parentID: parent.id, pirateName: pirateName, avatar: avatar)) }
    }

    func saveChild(_ child: ChildProfile) async {
        await write { try await $0.saveChild(child) }
    }

    /// Removes a profile and its chest. The last profile stays.
    func removeChild(_ child: ChildProfile) async {
        await write { try await $0.removeChild(child.id) }
        if playingChildID == child.id { choosePlayingChild(nil) }
    }

    /// Picks who plays. A different child starts their own run.
    func choosePlayingChild(_ id: ChildProfile.ID?) {
        playingChildID = id
        guard let playingDefaultsKey else { return }
        if let id { UserDefaults.standard.set(id.uuidString, forKey: playingDefaultsKey) }
        else { UserDefaults.standard.removeObject(forKey: playingDefaultsKey) }
    }

    // MARK: Parent: setting up a hunt

    /// Saves a new hunt in one go; it becomes the adventure the hunt plays. Returns whether it saved.
    @discardableResult
    func saveHuntSetup(_ adventure: Adventure, designs: [TreasureDesign], placements: [ChestPlacement]) async -> Bool {
        await write { try await $0.saveHuntSetup(adventure, designs: designs, placements: placements) }
        return errorMessage == nil && data.adventure(adventure.id) != nil
    }

    // MARK: Parent: hiding treasure

    /// Hides one built-in treasure on a spot the parent reviewed on the map.
    func hideTreasure(_ look: TreasureLook, at spot: Coordinate, hint: String, reviewedAt: Date) async {
        guard let parent else { return }
        var adventure = self.adventure ?? Adventure(
            familyID: parent.id, title: "Today's Hunt", goal: "Find the lost treasure!"
        )
        if data.adventure(adventure.id) == nil {
            await write { try await $0.saveAdventure(adventure) }
            adventure = data.adventure(adventure.id) ?? adventure
        }
        let design = TreasureDesign(familyID: parent.id, maker: .parent(parent.id), look: look)
        let placement = ChestPlacement(
            familyID: parent.id, adventureID: adventure.id, designID: design.id,
            versionID: design.current.id, spot: spot, hint: hint, placedBy: parent.id, reviewedAt: reviewedAt
        )
        await write { try await $0.saveDesign(design) }
        await write { try await $0.place(placement) }
    }

    func removePlacement(_ placement: ChestPlacement) async {
        await write { try await $0.removePlacement(placement.id) }
    }

    func design(for placement: ChestPlacement) -> TreasureDesign? { data.design(placement.designID) }

    // MARK: The hunt

    func startRunIfNeeded() {
        guard let adventure, let child else { return }
        if let currentRun, currentRun.adventureID == adventure.id, currentRun.childID == child.id { return }
        startNewRun()
    }

    /// Replays the adventure. Treasures already in the chest earn a "found it again" sticker instead.
    func startNewRun() {
        guard let adventure, let child else { return }
        let run = HuntRun(adventureID: adventure.id, childID: child.id)
        currentRun = run
        if let runDefaultsKey, let encoded = try? JSONEncoder().encode(run) {
            UserDefaults.standard.set(encoded, forKey: runDefaultsKey)
        }
    }

    func isFoundThisRun(_ placement: ChestPlacement) -> Bool {
        guard let child, let run = currentRun,
              let record = data.collection(.init(childID: child.id, placementID: placement.id)) else { return false }
        return record.firstRunID == run.id || record.foundAgainRunIDs.contains(run.id)
    }

    /// Where this run stands: found so far, the next treasure, and whether it's time for the finale.
    var progress: HuntProgress {
        guard let adventure, let child, let run = currentRun else {
            return HuntProgress(order: adventurePlacements.map(\.id), foundThisRun: [])
        }
        return data.progress(of: adventure, child: child.id, run: run.id)
    }

    /// The next treasure to look for in this run.
    var nextPlacement: ChestPlacement? {
        progress.next.flatMap { data.placement($0) }
    }

    var isRunComplete: Bool { progress.isComplete }

    /// Puts the treasure in the child's chest. Safe to call any number of times for the same run.
    func recordFind(_ placement: ChestPlacement, method: FindMethod) async -> CollectResult? {
        startRunIfNeeded()
        guard let child, let run = currentRun else { return nil }
        do {
            let (result, updated) = try await store.recordFind(
                child: child.id, placement: placement.id, run: run.id, method: method, at: .now
            )
            data = updated
            errorMessage = nil
            return result
        } catch {
            errorMessage = "Couldn't save that find. Tap again to retry."
            return nil
        }
    }

    // MARK: Helpers

    private func write(_ change: (any FamilyStore) async throws -> FamilyData) async {
        do {
            data = try await change(store)
            errorMessage = nil
        } catch {
            errorMessage = "Couldn't save. Please try again."
        }
    }

    private func restoredRun() -> HuntRun? {
        guard let runDefaultsKey, let saved = UserDefaults.standard.data(forKey: runDefaultsKey) else { return nil }
        return try? JSONDecoder().decode(HuntRun.self, from: saved)
    }
}

/// Demo mode: a separate, in-memory family with treasures scattered automatically around the phone.
/// Nothing here touches the real family file or the child's chest.
@MainActor
enum DemoFamily {
    static func make(around center: Coordinate) async -> FamilyModel {
        let parent = ParentAccount(displayName: "Demo Grown-up")
        let child = ChildProfile(parentID: parent.id, pirateName: "Demo Pirate")
        var data = FamilyData(parent: parent, children: [child])
        var adventure = Adventure(familyID: parent.id, title: "Demo Hunt", goal: "Testing only")
        let offsets: [(Double, Double)] = [(60, 20), (-40, 90), (120, -70)]
        for (i, model) in BuiltInModel.allCases.prefix(offsets.count).enumerated() {
            let design = TreasureDesign(
                familyID: parent.id, maker: .parent(parent.id),
                look: TreasureLook(model: model, color: model.defaultColor, name: model.displayName, story: "A demo treasure.")
            )
            let placement = ChestPlacement(
                familyID: parent.id, adventureID: adventure.id, designID: design.id, versionID: design.current.id,
                spot: Geo.offset(center, north: offsets[i].0, east: offsets[i].1),
                hint: "Demo spot \(i + 1)", placedBy: parent.id, reviewedAt: .distantPast
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

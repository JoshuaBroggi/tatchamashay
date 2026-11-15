import Foundation
import Observation

/// The app's view of one family's records, kept current after every successful write.
@MainActor
@Observable
final class FamilyModel {
    let isDemo: Bool
    private(set) var data = FamilyData()
    private(set) var isLoaded = false
    var errorMessage: String?

    private let store: any FamilyStore
    private let playingDefaultsKey: String?
    private(set) var playingChildID: ChildProfile.ID?

    init(store: any FamilyStore, isDemo: Bool = false) {
        self.store = store
        self.isDemo = isDemo
        playingDefaultsKey = isDemo ? nil : "playingChild"
        if let playingDefaultsKey, let saved = UserDefaults.standard.string(forKey: playingDefaultsKey) {
            playingChildID = UUID(uuidString: saved)
        }
    }

    var parent: ParentAccount? { data.parent }
    /// A parent can select a child profile in settings. Parents never become players.
    var child: ChildProfile? { playingChildID.flatMap { data.child($0) } ?? data.children.first }
    var children: [ChildProfile] { data.children }
    var grownUpName: String? { parent?.grownUpName }

    /// Every valid saved placement across all old adventure groups. No story or order unlocks it.
    var mapPlacements: [ChestPlacement] {
        guard let parent else { return [] }
        return data.placements.filter { placement in
            guard placement.familyID == parent.id, placement.placedBy == parent.id,
                  placement.reviewedAt <= Date.now,
                  placement.spot.latitude.isFinite, placement.spot.longitude.isFinite,
                  (-90...90).contains(placement.spot.latitude), (-180...180).contains(placement.spot.longitude),
                  let adventure = data.adventure(placement.adventureID), adventure.familyID == parent.id,
                  adventure.placementIDs.contains(placement.id),
                  let design = data.design(placement.designID), design.familyID == parent.id,
                  design.deletedAt == nil, let version = design.version(placement.versionID),
                  version.designID == design.id else { return false }
            return true
        }
    }

    var unfoundPlacements: [ChestPlacement] { mapPlacements.filter { !hasCollected($0) } }
    var parentDesigns: [TreasureDesign] {
        data.designs.filter { $0.familyID == parent?.id && $0.deletedAt == nil }
            .sorted { $0.current.createdAt > $1.current.createdAt }
    }
    var chest: [CollectionRecord] { child.map { data.chest(for: $0.id) } ?? [] }

    var activeCharacter: CollectionRecord? {
        guard let child, let id = child.activeCollectionID, let parent else { return nil }
        return chest.first { $0.id == id && $0.familyID == parent.id }
    }

    @discardableResult
    func selectCharacter(_ record: CollectionRecord) async -> Bool {
        guard let child, let parent, record.childID == child.id, record.familyID == parent.id else { return false }
        if activeCharacter?.id == record.id { return true }
        return await tryWrite { try await $0.selectCharacter(child: child.id, collection: record.id) }
    }

    func hasCollected(_ placement: ChestPlacement) -> Bool {
        guard let child else { return false }
        return data.collection(.init(childID: child.id, placementID: placement.id)) != nil
    }

    func design(for placement: ChestPlacement) -> TreasureDesign? { data.design(placement.designID) }

    func load() async {
        do {
            data = try await store.load()
            errorMessage = nil
        } catch {
            errorMessage = "Couldn't open the treasure log."
        }
        isLoaded = true
    }

    // MARK: Parent settings

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

    func setGrownUpName(_ name: String) async {
        guard var parent else { return }
        parent.childCallsMe = name.isEmpty ? nil : name
        await write { try await $0.saveParent(parent) }
    }

    func addChild(pirateName: String, avatar: PirateAvatar = .parrot) async {
        guard let parent else { return }
        await write { try await $0.saveChild(ChildProfile(parentID: parent.id, pirateName: pirateName, avatar: avatar)) }
    }

    func saveChild(_ child: ChildProfile) async { await write { try await $0.saveChild(child) } }

    func removeChild(_ child: ChildProfile) async {
        guard await tryWrite({ try await $0.removeChild(child.id) }) else { return }
        if playingChildID == child.id { choosePlayingChild(nil) }
    }

    func choosePlayingChild(_ id: ChildProfile.ID?) {
        if let id, data.child(id) == nil { return }
        playingChildID = id
        guard let playingDefaultsKey else { return }
        if let id { UserDefaults.standard.set(id.uuidString, forKey: playingDefaultsKey) }
        else { UserDefaults.standard.removeObject(forKey: playingDefaultsKey) }
    }

    // MARK: Parent creation

    /// New designs are parent-made; edits preserve legacy child provenance and saved chest copies.
    func saveParentDesign(_ look: TreasureLook, editing designID: TreasureDesign.ID? = nil) async -> TreasureDesign? {
        guard let design = parentDesign(look, editing: designID) else { return nil }
        guard await tryWrite({ try await $0.saveDesign(design) }) else { return nil }
        return data.design(design.id)
    }

    /// Creates or edits a beast and places it in one atomic write. An edited placed design keeps
    /// its placement ID, so a child's already-collected treasure never becomes unfound again.
    @discardableResult
    func hideTreasure(_ look: TreasureLook, at spot: Coordinate, hint: String, reviewedAt: Date,
                      editing designID: TreasureDesign.ID? = nil) async -> Bool {
        guard let parent, let design = parentDesign(look, editing: designID) else { return false }
        let existing = mapPlacements.first { $0.designID == design.id }
        let adventure = existing.flatMap { data.adventure($0.adventureID) }
            ?? Adventure(familyID: parent.id, title: "Treasures", goal: "")
        var placement = existing ?? ChestPlacement(
            familyID: parent.id, adventureID: adventure.id, designID: design.id,
            versionID: design.current.id, spot: spot, hint: hint, placedBy: parent.id, reviewedAt: reviewedAt
        )
        placement.versionID = design.current.id
        placement.spot = spot
        placement.hint = hint.trimmingCharacters(in: .whitespacesAndNewlines)
        placement.reviewedAt = reviewedAt
        placement.syncState = .waitingToSync
        return await tryWrite { try await $0.saveParentTreasure(design, adventure: adventure, placement: placement) }
    }

    func removePlacement(_ placement: ChestPlacement) async {
        await write { try await $0.removePlacement(placement.id) }
    }

    private func parentDesign(_ look: TreasureLook, editing designID: TreasureDesign.ID?) -> TreasureDesign? {
        guard let parent, !look.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Give your beast a name."
            return nil
        }
        if let designID {
            guard var design = data.design(designID), design.familyID == parent.id, design.deletedAt == nil else {
                errorMessage = "Couldn't find that beast."
                return nil
            }
            if design.current.look != look { design.edit(to: look) }
            return design
        }
        return TreasureDesign(familyID: parent.id, maker: .parent(parent.id), look: look)
    }

    // MARK: Collection

    /// Collects any selected placement, including one from an older adventure. Finds remain counted
    /// across restarts and legacy run IDs. A failed write changes neither the map nor the chest.
    func recordFind(_ placement: ChestPlacement, method: FindMethod, equipCharacter: Bool = false) async -> CollectResult? {
        guard let child, mapPlacements.contains(where: { $0.id == placement.id }) else {
            errorMessage = "That treasure is no longer available."
            return nil
        }
        do {
            let result: CollectResult
            let updated: FamilyData
            if equipCharacter {
                (result, updated) = try await store.recordCharacterFind(
                    child: child.id, placement: placement.id, run: UUID(), method: method, at: .now)
            } else {
                (result, updated) = try await store.recordFind(
                    child: child.id, placement: placement.id, run: UUID(), method: method, at: .now)
            }
            data = updated
            errorMessage = nil
            return result
        } catch {
            errorMessage = "Couldn't save that find. Tap again to retry."
            return nil
        }
    }

    private func write(_ change: (any FamilyStore) async throws -> FamilyData) async {
        do {
            data = try await change(store)
            errorMessage = nil
        } catch {
            errorMessage = "Couldn't save. Please try again."
        }
    }

    private func tryWrite(_ change: (any FamilyStore) async throws -> FamilyData) async -> Bool {
        await write(change)
        return errorMessage == nil
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
        return model
    }
}

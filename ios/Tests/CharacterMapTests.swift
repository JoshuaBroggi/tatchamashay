import Foundation
import RealityKit
import Testing
@testable import Tatchamashay

@Suite("Optional character map")
struct CharacterMapTests {
    @Test("Older child profiles decode without an active character")
    func legacyProfile() throws {
        let child = Fixture().child
        var json = try #require(JSONSerialization.jsonObject(with: JSONEncoder.family.encode(child)) as? [String: Any])
        json.removeValue(forKey: "activeCollectionID")
        let restored = try JSONDecoder.family.decode(ChildProfile.self, from: JSONSerialization.data(withJSONObject: json))
        #expect(restored.id == child.id)
        #expect(restored.activeCollectionID == nil)
    }

    @MainActor
    @Test("The existing map stays default and both optional choices survive relaunch")
    func preferences() {
        let name = "character-map-\(UUID())"
        let defaults = UserDefaults(suiteName: name)!
        defer { defaults.removePersistentDomain(forName: name) }
        let settings = MapExperienceSettings(defaults: defaults)
        #expect(!settings.enabled && !settings.uses3D)
        settings.enabled = true
        #expect(settings.uses3D)
        settings.useFlatMap = true
        let reopened = MapExperienceSettings(defaults: defaults)
        #expect(reopened.enabled && reopened.useFlatMap && !reopened.uses3D)
        reopened.enabled = false
        #expect(!MapExperienceSettings(defaults: defaults).enabled)
        #expect(!MapExperienceSettings(defaults: nil).enabled)
    }

    @Test("Regular finds do not change the optional character")
    func regularFind() async throws {
        let f = Fixture()
        let store = try await f.makeStore()
        let (_, saved) = try await store.recordFind(child: f.child.id, placement: f.placement.id,
                                                   run: UUID(), method: .parentConfirmed, at: .now)
        #expect(saved.collections.count == 1)
        #expect(saved.child(f.child.id)?.activeCollectionID == nil)
    }

    @Test("Find and character change commit together and survive reload")
    func atomicFind() async throws {
        let f = Fixture()
        let persistence = MemoryPersistence()
        let store = try await f.makeStore(persistence: persistence)
        let (result, data) = try await store.recordCharacterFind(child: f.child.id, placement: f.placement.id,
                                                               run: UUID(), method: .parentConfirmed, at: .now)
        #expect(data.child(f.child.id)?.activeCollectionID == result.record.id)
        let reopened = try await LocalFamilyStore(persistence: persistence).load()
        #expect(reopened.child(f.child.id)?.activeCollectionID == result.record.id)
        #expect(reopened.collections.first?.savedCopy == f.design.current.look)
    }

    @Test("A failed find saves neither collection nor character")
    func failedFind() async throws {
        let f = Fixture()
        let persistence = FlakyPersistence()
        let store = try await f.makeStore(persistence: persistence)
        let original = try await store.load()
        persistence.failNextWrites(1)
        await #expect(throws: FlakyPersistence.LostWrite.self) {
            try await store.recordCharacterFind(child: f.child.id, placement: f.placement.id,
                                                run: UUID(), method: .parentConfirmed, at: .now)
        }
        #expect(try await store.load() == original)
        #expect(try persistence.read() == original)
    }

    @Test("Repeated finds never overwrite a later selection")
    func retryKeepsSelection() async throws {
        let f = Fixture()
        let persistence = MemoryPersistence()
        let store = try await f.makeStore(persistence: persistence)
        let (result, initial) = try await store.recordCharacterFind(child: f.child.id, placement: f.placement.id,
                                                                  run: UUID(), method: .dig, at: .now)
        var data = initial
        var older = result.record
        older.id = UUID()
        older.placementID = UUID()
        older.savedCopy.name = "Earlier discovery"
        data.collections.append(older)
        try data.selectCharacter(child: f.child.id, collection: older.id)
        let reopened = LocalFamilyStore(persistence: MemoryPersistence(data))
        let (retried, saved) = try await reopened.recordCharacterFind(child: f.child.id, placement: f.placement.id,
                                                                     run: UUID(), method: .dig, at: .now)
        #expect(retried == .alreadyCounted(result.record))
        #expect(saved.child(f.child.id)?.activeCollectionID == older.id)
        #expect(saved.collections.count == 2)
    }

    @Test("Selection validates ownership and failed writes keep the previous character")
    func selectionOwnershipAndFailure() async throws {
        let f = Fixture()
        let persistence = FlakyPersistence()
        let store = try await f.makeStore(persistence: persistence)
        let (result, initial) = try await store.recordFind(child: f.child.id, placement: f.placement.id,
                                                         run: UUID(), method: .dig, at: .now)
        let sibling = ChildProfile(parentID: f.parent.id, pirateName: "Sibling")
        _ = try await store.saveChild(sibling)
        await #expect(throws: FamilyStoreError.notInFamily) {
            try await store.selectCharacter(child: sibling.id, collection: result.record.id)
        }
        await #expect(throws: FamilyStoreError.unknownTreasure) {
            try await store.selectCharacter(child: f.child.id, collection: UUID())
        }
        persistence.failNextWrites(1)
        await #expect(throws: FlakyPersistence.LostWrite.self) {
            try await store.selectCharacter(child: f.child.id, collection: result.record.id)
        }
        #expect(try await store.load().child(f.child.id)?.activeCollectionID == nil)
        var foreign = initial
        foreign.collections[0].familyID = UUID()
        #expect(throws: FamilyStoreError.notInFamily) {
            try foreign.selectCharacter(child: f.child.id, collection: result.record.id)
        }
    }

    @MainActor
    @Test("Deleted parent designs keep the selected saved appearance")
    func deletedDesign() async throws {
        let f = Fixture()
        let store = try await f.makeStore()
        let family = FamilyModel(store: store, isDemo: true)
        await family.load()
        let result = try #require(await family.recordFind(f.placement, method: .dig, equipCharacter: true))
        _ = try await store.deleteDesign(f.design.id)
        await family.load()
        #expect(family.activeCharacter?.savedCopy == result.record.savedCopy)
        #expect(family.unfoundPlacements.isEmpty)
    }

    @Test("Ordinary profile edits preserve the selected character, including a stale reference")
    func profileEdits() async throws {
        let f = Fixture()
        let store = try await f.makeStore()
        let (result, _) = try await store.recordCharacterFind(child: f.child.id, placement: f.placement.id,
                                                             run: UUID(), method: .dig, at: .now)
        var edited = f.child // A profile sheet opened before the find has no character reference.
        edited.pirateName = "Captain Pearl"
        let saved = try await store.saveChild(edited)
        #expect(saved.child(f.child.id)?.activeCollectionID == result.record.id)
        var stale = saved
        stale.children[0].activeCollectionID = UUID()
        let recoveredStore = LocalFamilyStore(persistence: MemoryPersistence(stale))
        let renamed = try await recoveredStore.saveChild(edited)
        #expect(renamed.child(f.child.id)?.pirateName == "Captain Pearl")
        #expect(renamed.collections == saved.collections)
        let selected = try await recoveredStore.selectCharacter(child: f.child.id, collection: result.record.id)
        #expect(selected.child(f.child.id)?.activeCollectionID == result.record.id)
    }

    @MainActor
    @Test("Existing articulated assets have a working gait and reset cleanly")
    func articulatedMovement() async throws {
        let look = TreasureLook(model: .turtle, color: .sea, name: "Walker")
        let loaded = await TreasureEntities.treasure(look)
        let flipper = try #require(loaded.entity.findEntity(named: "FlipperFrontLeft"))
        let original = flipper.transform
        let player = CharacterWalkPlayer(root: loaded.entity, entry: loaded.entry)
        #expect(player.partCount == 4)
        player.update(0.15)
        #expect(flipper.transform != original)
        player.reset()
        #expect(flipper.transform == original)
    }

    @MainActor
    @Test("Requested skeletal characters move real joints without changing their idle resources")
    func skeletalMovement() async throws {
        for model in [BuiltInModel.vineDog, .demogorgon, .demodog] {
            let loaded = await TreasureEntities.treasure(TreasureLook(model: model, color: .green, name: "Walker"))
            #expect(!loaded.isFallback)
            #expect(loaded.entry?.provenance?.sourceCommit == "2b397b3cad58d17722b5bd907433863b4881c9df")
            #expect(loaded.hasRequiredAnimation)
            let player = CharacterWalkPlayer(root: loaded.entity, entry: loaded.entry)
            #expect(player.partCount >= (model == .vineDog ? 6 : 4))
            var rigs: [ModelEntity] = []
            TreasureEntities.visit(loaded.entity) { entity in
                if let model = entity as? ModelEntity, !model.jointTransforms.isEmpty { rigs.append(model) }
            }
            #expect(!rigs.isEmpty)
            let original = rigs.map(\.jointTransforms)
            player.update(0.15)
            #expect(rigs.map(\.jointTransforms) != original)
            player.reset()
            #expect(rigs.map(\.jointTransforms) == original)
        }
    }
}

@Suite("Character location presentation")
struct CharacterMovementTests {
    private let origin = Coordinate(latitude: 37.7694, longitude: -122.4862)
    private let start = Date(timeIntervalSince1970: 1_000)

    private func fix(_ metres: Double, _ seconds: Double, accuracy: Double = 5) -> LocationFix {
        LocationFix(coordinate: Geo.offset(origin, north: metres, east: 0), horizontalAccuracy: accuracy,
                    timestamp: start.addingTimeInterval(seconds))
    }

    @Test("GPS wobble does not start walking")
    func stationary() {
        var movement = CharacterMovement()
        for second in 0..<8 {
            let sample = fix(second.isMultiple(of: 2) ? 0 : 1, Double(second))
            movement.update(sample, now: sample.timestamp)
        }
        #expect(!movement.isWalking && !movement.isUncertain)
        #expect(movement.coordinate == origin)
    }

    @Test("Sustained walking starts a gait and stopping ends it without a new fix")
    func walkingAndStopping() {
        var movement = CharacterMovement()
        for second in [0.0, 2, 4] {
            let sample = fix(second * 1.5, second)
            movement.update(sample, now: sample.timestamp)
        }
        #expect(movement.isWalking)
        #expect(movement.heading < 1 || movement.heading > 359)
        movement.update(fix(6, 4), now: start.addingTimeInterval(8))
        #expect(!movement.isWalking)
        #expect(!movement.isUncertain)
    }

    @Test("Bad fixes and large jumps do not animate invented travel")
    func badFixes() {
        var movement = CharacterMovement()
        movement.update(fix(0, 0), now: start)
        movement.update(fix(200, 2), now: start.addingTimeInterval(2))
        #expect(!movement.isWalking)
        let lastKnown = movement.coordinate
        movement.update(fix(210, 3, accuracy: 100), now: start.addingTimeInterval(3))
        #expect(movement.isUncertain && !movement.isWalking)
        #expect(movement.coordinate == lastKnown)
        movement.update(fix(0, 0), now: start.addingTimeInterval(20))
        #expect(movement.isUncertain)
        movement.update(nil, now: start.addingTimeInterval(20))
        #expect(movement.coordinate == lastKnown)
    }

    @Test("Late location samples never pull the character backwards")
    func outOfOrderFix() {
        var movement = CharacterMovement()
        for second in [0.0, 2, 4] {
            let sample = fix(second * 1.5, second)
            movement.update(sample, now: sample.timestamp)
        }
        let position = movement.coordinate
        movement.update(fix(1, 3), now: start.addingTimeInterval(4))
        #expect(movement.coordinate == position)
        #expect(movement.isWalking)
    }
}

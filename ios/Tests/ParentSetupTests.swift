import Foundation
import Testing
@testable import Tatchamashay

@Suite("Parent spot review and child settings")
struct ParentSetupTests {
    let f = Fixture()

    @Test("A spot needs a detailed map, a center and the parent's check")
    func spotReview() {
        let center = Coordinate(latitude: 0, longitude: 0)
        #expect(MapReview.canConfirmSpot(cameraDistance: 800, center: center, checked: true))
        #expect(!MapReview.canConfirmSpot(cameraDistance: 800, center: center, checked: false))
        #expect(!MapReview.canConfirmSpot(cameraDistance: 800, center: nil, checked: true))
        #expect(!MapReview.canConfirmSpot(cameraDistance: 5_000, center: center, checked: true))
        #expect(MapReview.isDetailedForArea(cameraDistance: 5_000))
        #expect(!MapReview.isDetailedForArea(cameraDistance: 50_000))
        #expect(!MapReview.isDetailedForSpot(cameraDistance: MapReview.spotStartDistance))
    }

    @Test("Parent details remain family-owned")
    func parentDetails() async throws {
        let store = try await f.makeStore()
        var parent = f.parent
        parent.childCallsMe = "Papa"
        #expect(try await store.saveParent(parent).parent?.grownUpName == "Papa")
        let stranger = ParentAccount(displayName: "Someone else")
        await #expect(throws: FamilyStoreError.notInFamily) { _ = try await store.saveParent(stranger) }
    }

    @Test("Records saved before optional story and family fields still load")
    func oldRecordsDecode() throws {
        let old = #"{"id":"6C5F4B0A-8C2E-4F4A-9E43-2B7B7C7E2A11","displayName":"Dad","createdAt":0}"#
        let parent = try JSONDecoder().decode(ParentAccount.self, from: Data(old.utf8))
        #expect(parent.childCallsMe == nil)
        #expect(parent.grownUpName == "Dad")
        let oldAdventure = """
        {"createdAt":0,"familyID":"\(f.parent.id)","finale":"Back to the ship!","goal":"Find it",
         "guideName":"Captain Barnacle","id":"\(UUID())","placementIDs":[],"publication":"private",
         "syncState":"waitingToSync","title":"Today's Hunt"}
        """
        let adventure = try JSONDecoder.family.decode(Adventure.self, from: Data(oldAdventure.utf8))
        #expect(adventure.storyID == nil && adventure.guideID == nil && adventure.hiddenBy == nil)
        #expect(adventure.playArea == nil)
    }

    @Test("Removing one pirate empties only their chest; the last profile stays")
    func pirates() async throws {
        let store = try await f.makeStore()
        let sibling = ChildProfile(parentID: f.parent.id, pirateName: "Captain Mia")
        _ = try await store.saveChild(sibling)
        _ = try await store.recordFind(child: f.child.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)
        _ = try await store.recordFind(child: sibling.id, placement: f.placement.id, run: UUID(), method: .dig, at: .now)
        let data = try await store.removeChild(sibling.id)
        #expect(data.children.map(\.id) == [f.child.id])
        #expect(data.chest(for: f.child.id).count == 1)
        #expect(data.chest(for: sibling.id).isEmpty)
        #expect(data.placement(f.placement.id) != nil)
        await #expect(throws: FamilyStoreError.lastChild) { _ = try await store.removeChild(f.child.id) }
        await #expect(throws: FamilyStoreError.unknownChild) { _ = try await store.removeChild(UUID()) }
    }

    @Test("Settings select a child profile; removing it restores the remaining child")
    @MainActor
    func playingChild() async throws {
        let store = try await f.makeStore()
        let sibling = ChildProfile(parentID: f.parent.id, pirateName: "Captain Mia")
        _ = try await store.saveChild(sibling)
        let model = FamilyModel(store: store, isDemo: true)
        await model.load()
        model.choosePlayingChild(sibling.id)
        #expect(model.child?.id == sibling.id)
        model.choosePlayingChild(UUID())
        #expect(model.child?.id == sibling.id, "unknown profiles cannot become the player")
        await model.removeChild(sibling)
        #expect(model.child?.id == f.child.id)
        #expect(model.playingChildID == nil)
    }
}

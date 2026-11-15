import Foundation
import Testing
@testable import Tatchamashay

@Suite("Legacy saved model compatibility")
struct LegacyVineDogTests {
    @Test("An earlier phone model retains its identity through a save")
    func savedModelRoundTrip() throws {
        let data = Data(#"{"model":"vine-dog","color":"purple","sparkles":"none","name":"Legacy beast","sound":"splash","story":""}"#.utf8)
        let look = try JSONDecoder().decode(TreasureLook.self, from: data)
        #expect(look.model == .vineDog)
        let encoded = try JSONEncoder().encode(look)
        let restored = try JSONDecoder().decode(TreasureLook.self, from: encoded)
        #expect(restored == look)
        #expect(restored.model.rawValue == "vine-dog")
        #expect(BuiltInModel.allCases.contains(.vineDog))
        #expect(TreasureCatalog.bundled.entry(for: .vineDog) != nil)
    }
}

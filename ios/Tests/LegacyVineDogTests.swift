import Foundation
import RealityKit
import UIKit
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
    }

    @Test("The restored Vine dog loads its original mesh, saved color and skeletal idle")
    @MainActor
    func originalModelLoads() async throws {
        let catalog = try TreasureCatalog.load(from: .main)
        let look = TreasureLook(model: .vineDog, color: .purple, name: "Vine dog")
        let loaded = await TreasureEntities.treasure(look, catalog: catalog)
        #expect(!loaded.isFallback)
        let entry = try #require(loaded.entry)
        #expect(entry.file == "Models/VineDog.usdz")
        #expect(entry.provenance?.sourceCommit == "2b397b3cad58d17722b5bd907433863b4881c9df")
        #expect(entry.idleMotion == .skeletal)
        #expect(loaded.hasRequiredAnimation)
        _ = try #require(TreasureEntities.skeletalClip(in: loaded.entity))
        #expect(loaded.entity.findEntity(named: "VineDogBody") != nil)
        var bodyColors: [UIColor] = []
        TreasureEntities.visit(loaded.entity) { entity in
            for material in entity.components[ModelComponent.self]?.materials ?? [] {
                if let pbr = material as? PhysicallyBasedMaterial, pbr.name == entry.tintMaterial {
                    bodyColors.append(pbr.baseColor.tint)
                }
            }
        }
        #expect(!bodyColors.isEmpty)
        let expected = TreasureColor.purple.rgb
        for color in bodyColors {
            var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
            color.getRed(&r, green: &g, blue: &b, alpha: &a)
            #expect(abs(r - expected.red) < 0.01 && abs(g - expected.green) < 0.01 && abs(b - expected.blue) < 0.01)
        }
        let idle = try #require(loaded.idleMotion())
        #expect(idle.motion == .skeletal)
        idle.update(time: 1)
        idle.reset()
    }
}

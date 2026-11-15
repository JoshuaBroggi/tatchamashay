import Foundation
import RealityKit
import Testing
import UIKit
@testable import Tatchamashay

@Suite("Restored flower creatures")
@MainActor
struct RestoredBeastTests {
    @Test("Requested creatures are selectable, decode saved IDs, and keep their source history",
          arguments: [BuiltInModel.demogorgon, .demodog, .vineDog])
    func catalog(model: BuiltInModel) throws {
        #expect(BuiltInModel.allCases.contains(model))
        let saved = try JSONEncoder().encode(model)
        #expect(try JSONDecoder().decode(BuiltInModel.self, from: saved) == model)
        let entry = try #require(TreasureCatalog.bundled.entry(for: model))
        #expect(entry.displayName == model.displayName)
        #expect(entry.idleMotion == .skeletal)
        #expect(entry.skeletalAnimation?.sourceClip == "Idle")
        #expect(entry.provenance?.sourceCommit == "2b397b3cad58d17722b5bd907433863b4881c9df")
        let url = try #require(TreasureCatalog.bundled.modelURL(for: entry))
        #expect(try #require(url.resourceValues(forKeys: [.fileSizeKey]).fileSize) < 2_000_000)
        let region = try #require(TreasureCatalog.bundled.paintRegions(for: model).first)
        #expect(region.materialName == entry.tintMaterial)
    }

    @Test("Skinned bodies load with an idle and repaint in place without changing another copy",
          arguments: [BuiltInModel.demogorgon, .demodog, .vineDog])
    func repaints(model: BuiltInModel) async throws {
        let redLook = TreasureLook(model: model, color: .red, name: "Red")
        let red = await TreasureEntities.treasure(redLook)
        #expect(!red.isFallback && red.hasRequiredAnimation)
        let clip = try #require(TreasureEntities.skeletalClip(in: red.entity))
        #expect(clip.animation.definition.duration > 0)
        try expectColor(PaintColor(.red), in: red)

        let another = await TreasureEntities.treasure(redLook)
        var paintedLook = redLook
        var paint = TreasurePaint(color: .blue)
        paint.texture = .metallic
        paintedLook.paint = paint
        red.entity.scale *= 1.5
        let transform = red.entity.transform
        TreasureEntities.applyAppearance(paintedLook, to: red)
        #expect(red.entity.transform == transform)
        #expect(red.hasRequiredAnimation)
        try expectColor(PaintColor(.blue), in: red)
        try expectColor(PaintColor(.red), in: another)
        for material in bodyMaterials(in: red) {
            #expect(material.metallic.scale == 0.85)
            #expect(material.roughness.scale == 0.2)
        }
    }

    private func bodyMaterials(in loaded: LoadedTreasure) -> [PhysicallyBasedMaterial] {
        var materials: [PhysicallyBasedMaterial] = []
        TreasureEntities.visit(loaded.entity) { entity in
            materials += (entity.components[ModelComponent.self]?.materials ?? []).compactMap {
                guard $0.name == loaded.entry?.tintMaterial else { return nil }
                return $0 as? PhysicallyBasedMaterial
            }
        }
        return materials
    }

    private func expectColor(_ expected: PaintColor, in loaded: LoadedTreasure) throws {
        let materials = bodyMaterials(in: loaded)
        #expect(!materials.isEmpty)
        let expected = expected.rgb
        for material in materials {
            var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
            #expect(material.baseColor.tint.getRed(&red, green: &green, blue: &blue, alpha: &alpha))
            #expect(abs(red - expected.red) < 0.01 && abs(green - expected.green) < 0.01 && abs(blue - expected.blue) < 0.01)
        }
    }
}

import Foundation
import RealityKit
import Testing
import UIKit
@testable import Tatchamashay

@Suite("Multi-color treasure painting")
struct TreasurePaintTests {
    @Test("Legacy looks decode without paint and retain their exact color")
    func legacyLook() throws {
        let old = #"{"model":"turtle","color":"sea","sparkles":"some","name":"Old friend","sound":"chime","story":""}"#
        let look = try JSONDecoder().decode(TreasureLook.self, from: Data(old.utf8))
        #expect(look.paint == nil)
        #expect(look.color == .sea)
        #expect(look.primaryPaintColor == PaintColor(.sea))
    }

    @Test("The expanded color rows contain every named color exactly once")
    func paletteRows() {
        let colors = TreasureColor.paletteRows.flatMap(\.colors)
        #expect(colors.count > 40)
        #expect(Set(colors).count == colors.count)
        #expect(Set(colors) == Set(TreasureColor.allCases))
    }

    @Test("Reducing color count remaps all areas to valid paint pots")
    func resizePalette() {
        var paint = TreasurePaint(color: .cobalt)
        paint.setColorCount(3)
        paint.assign(2, to: "legs")
        paint.setColor(PaintColor(hex: 0xABCDEF), at: 1)
        paint.setColorCount(2)
        #expect(paint.colorIndex(for: "legs") == 1)
        #expect(paint.color(for: "legs").hex == 0xABCDEF)
        paint.setColorCount(1)
        #expect(paint.color(for: "legs") == PaintColor(.cobalt))
        paint.assign(5, to: "legs")
        #expect(paint.colorIndex(for: "legs") == 0)
        paint.setColorCount(99)
        #expect(paint.colors.count == 3)
    }

    @Test("Custom colors, area placement and texture survive serialization")
    func roundTrip() throws {
        var look = TreasureLook(model: .spider, color: .chestnut, name: "Silky")
        var paint = TreasurePaint(color: .cobalt)
        paint.setColorCount(3)
        paint.setColor(PaintColor(hex: 0xAABBCC), at: 2)
        paint.assign(2, to: "legs")
        paint.assign(1, to: "head")
        paint.texture = .speckles
        look.paint = paint
        #expect(try JSONDecoder().decode(TreasureLook.self, from: JSONEncoder().encode(look)) == look)
        let bad = #"{"colors":[{"hex":16777216}],"assignments":{},"texture":"natural"}"#
        #expect(throws: DecodingError.self) { try JSONDecoder().decode(TreasurePaint.self, from: Data(bad.utf8)) }
        let badPlacement = #"{"colors":[{"hex":0}],"assignments":{"head":2},"texture":"natural"}"#
        #expect(throws: DecodingError.self) { try JSONDecoder().decode(TreasurePaint.self, from: Data(badPlacement.utf8)) }
    }

    @Test("Every paint area names existing meshes and areas never overlap")
    @MainActor
    func regionCoverage() async throws {
        for model in BuiltInModel.allCases {
            let loaded = await TreasureEntities.treasure(TreasureLook(model: model, color: model.defaultColor, name: "x"))
            let regions = TreasureCatalog.bundled.paintRegions(for: model)
            #expect((1...3).contains(regions.count), "\(model)")
            let names = regions.flatMap(\.parts)
            #expect(Set(names).count == names.count, "\(model) has overlapping paint areas")
            for name in names { #expect(loaded.entity.findEntity(named: name) != nil, "\(model): \(name)") }
            for region in regions {
                if let materialName = region.materialName {
                    var hasMaterial = false
                    TreasureEntities.visit(loaded.entity) { entity in
                        if entity.components[ModelComponent.self]?.materials.contains(where: { $0.name == materialName }) == true {
                            hasMaterial = true
                        }
                    }
                    #expect(hasMaterial, "\(model): \(region.name) must reach a rendered material")
                }
            }
        }
    }

    @Test("Repainting preserves the entity, position, scale and rotation, and resets finishes")
    @MainActor
    func paintInPlace() async throws {
        var look = TreasureLook(model: .spider, color: .chestnut, name: "Silky")
        let loaded = await TreasureEntities.treasure(look)
        let entity = loaded.entity
        let head = try #require(entity.findEntity(named: "Head"))
        let original = try #require(head.components[ModelComponent.self]?.materials.first as? PhysicallyBasedMaterial)
        entity.position = [0.2, 0.3, 0.4]
        entity.scale = [2, 2, 2]
        entity.orientation = simd_quatf(angle: 1.2, axis: [0, 1, 0])
        let transform = entity.transform
        var paint = TreasurePaint(color: .cobalt)
        paint.setColorCount(3)
        paint.assign(1, to: "head")
        paint.assign(2, to: "legs")
        paint.texture = .stripes
        look.paint = paint
        TreasureEntities.applyAppearance(look, to: loaded)
        #expect(loaded.entity === entity)
        #expect(entity.transform == transform)
        for region in TreasureCatalog.bundled.paintRegions(for: .spider) {
            let part = try #require(entity.findEntity(named: region.parts[0]))
            let material = try #require(part.components[ModelComponent.self]?.materials.first as? PhysicallyBasedMaterial)
            let c = paint.color(for: region.id).rgb
            let space = try #require(CGColorSpace(name: CGColorSpace.sRGB))
            let components = try #require(material.baseColor.tint.cgColor.converted(to: space, intent: .defaultIntent, options: nil)?.components)
            #expect(abs(components[0] - c.red) < 0.01)
            #expect(abs(components[1] - c.green) < 0.01)
            #expect(abs(components[2] - c.blue) < 0.01)
            #expect(material.baseColor.texture != nil)
        }
        look.paint?.texture = .metallic
        TreasureEntities.applyAppearance(look, to: loaded)
        let metal = try #require(head.components[ModelComponent.self]?.materials.first as? PhysicallyBasedMaterial)
        #expect(metal.metallic.scale == 0.85)
        look.paint = nil
        TreasureEntities.applyAppearance(look, to: loaded)
        let reset = try #require(head.components[ModelComponent.self]?.materials.first as? PhysicallyBasedMaterial)
        #expect(reset.roughness.scale == original.roughness.scale)
        #expect(reset.metallic.scale == original.metallic.scale)
        #expect(reset.baseColor.texture == nil)
        #expect(entity.transform == transform)
    }

    @Test("A collected painted look remains frozen after edits and a disk reload")
    func paintedSavedCopy() async throws {
        let f = Fixture()
        let url = temporaryFileURL()
        let store = try await f.makeStore(persistence: JSONFilePersistence(url: url))
        var design = f.design
        var look = design.current.look
        var paint = TreasurePaint(color: .cobalt)
        paint.setColorCount(3)
        paint.assign(2, to: "points")
        paint.texture = .velvet
        look.paint = paint
        let version = design.edit(to: look)
        _ = try await store.saveDesign(design)
        var placement = f.placement
        placement.versionID = version.id
        _ = try await store.place(placement)
        _ = try await store.recordFind(child: f.child.id, placement: placement.id, run: UUID(), method: .dig, at: .now)
        look.paint?.setColor(PaintColor(.ruby), at: 0)
        design.edit(to: look)
        _ = try await store.saveDesign(design)
        let reloaded = try await LocalFamilyStore(persistence: JSONFilePersistence(url: url)).load()
        let saved = try #require(reloaded.chest(for: f.child.id).first?.savedCopy.paint)
        #expect(saved == paint)
    }
}

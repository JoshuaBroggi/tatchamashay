import Foundation
import RealityKit
import Testing
import UIKit
@testable import Tatchamashay

@Suite("The treasure catalog")
struct TreasureCatalogTests {
    let catalog = try! TreasureCatalog.load(from: .main)

    @Test("Every built-in treasure is in the manifest, with the same name")
    func matchesBuiltInModels() {
        #expect(catalog.treasures.map(\.id).sorted() == BuiltInModel.allCases.map(\.rawValue).sorted())
        for model in BuiltInModel.allCases {
            #expect(catalog.entry(for: model)?.displayName == model.displayName)
        }
    }

    @Test("Every model, thumbnail and sound file is in the app bundle")
    func filesAreBundled() {
        for entry in catalog.treasures + [catalog.chest] {
            #expect(catalog.modelURL(for: entry) != nil, "\(entry.file)")
            #expect(catalog.url(for: entry.thumbnail) != nil, "\(entry.thumbnail ?? "")")
        }
        for effect in SoundEffect.allCases {
            #expect(catalog.soundURL(for: effect) != nil, "\(effect)")
        }
    }

    @Test("Manifest fields decode into types")
    func decodesFields() throws {
        let parrot = try #require(catalog.entry(for: .parrot))
        #expect(parrot.idleMotion == .flap)
        #expect(parrot.tintableParts.contains("WingLeftFeathers"))
        #expect(parrot.movingParts.first?.degrees == -35)
        #expect(parrot.defaultColor == HexColor("#3CC46B"))
        #expect(catalog.entry(for: .dragonEgg)?.idleMotionPart == "Egg")
        #expect(catalog.chest.namedParts?.lid == "Lid")
        #expect(catalog.chest.movingParts.first?.openDegrees == -110)
    }

    @Test("Looks saved with milestone 1 ids still open")
    func migratesOldIDs() throws {
        let old = #"{"model":"gem","color":"sea","sparkles":"some","name":"Sea Gem","sound":"chime","story":""}"#
        let look = try JSONDecoder().decode(TreasureLook.self, from: Data(old.utf8))
        #expect(look.model == .clam)
        #expect(BuiltInModel(savedID: "orb") == .starCompass)
        #expect(BuiltInModel(savedID: "crown") == .crown)
        #expect(BuiltInModel(savedID: "doubloon") == .doubloon)
        #expect(BuiltInModel(savedID: "potion") == .potion)
        #expect(BuiltInModel(savedID: "spaceship") == nil)
        let encoded = try JSONEncoder().encode(look)
        #expect(String(decoding: encoded, as: UTF8.self).contains(#""model":"clam""#))
    }

    @Test("A missing manifest is an error, not a crash")
    func missingManifest() {
        #expect(throws: TreasureCatalog.LoadError.missingManifest) {
            _ = try TreasureCatalog.load(from: Bundle(for: BundleToken.self))
        }
    }

    @Test("Every model loads, and its tint and moving parts are where the manifest says")
    @MainActor
    func modelsLoadWithTheirParts() async throws {
        for model in BuiltInModel.allCases {
            let loaded = await TreasureEntities.treasure(TreasureLook(model: model, color: .blue, name: "x"), catalog: catalog)
            #expect(!loaded.isFallback, "\(model) should load from its USDZ")
            let entry = try #require(loaded.entry)
            for part in entry.tintableParts {
                #expect(loaded.entity.findEntity(named: part) != nil, "\(model) is missing \(part)")
            }
            if entry.idleMotion == .flap {
                #expect(loaded.idleMotion()?.flappingPartCount == entry.movingParts.count, "\(model) flaps")
            }
            if let part = entry.idleMotionPart {
                #expect(loaded.entity.findEntity(named: part) != nil, "\(model) is missing \(part)")
            }
        }
    }

    @Test("Tinting sets the chosen color on the tintable parts")
    @MainActor
    func tints() async throws {
        let loaded = await TreasureEntities.treasure(TreasureLook(model: .potion, color: .red, name: "x"), catalog: catalog)
        let liquid = try #require(loaded.entity.findEntity(named: "Liquid"))
        var colors: [UIColor] = []
        TreasureEntities.visit(liquid) { entity in
            for material in entity.components[ModelComponent.self]?.materials ?? [] {
                if let pbr = material as? PhysicallyBasedMaterial { colors.append(pbr.baseColor.tint) }
            }
        }
        #expect(!colors.isEmpty)
        let (r, g, b) = TreasureColor.red.rgb
        for color in colors {
            var cr: CGFloat = 0, cg: CGFloat = 0, cb: CGFloat = 0, a: CGFloat = 0
            color.getRed(&cr, green: &cg, blue: &cb, alpha: &a)
            #expect(abs(cr - r) < 0.01 && abs(cg - g) < 0.01 && abs(cb - b) < 0.01)
        }
    }

    @Test("A file that won't load falls back to a drawn treasure")
    @MainActor
    func fallsBack() async {
        let broken = TreasureCatalog(treasures: catalog.treasures, chest: catalog.chest, sounds: [],
                                     baseURL: URL(fileURLWithPath: "/nowhere"))
        let loaded = await TreasureEntities.treasure(TreasureLook(model: .crown, color: .gold, name: "x"), catalog: broken)
        #expect(loaded.isFallback)
        #expect(loaded.idleMotion() == nil)
        #expect(await TreasureEntities.chest(catalog: broken) == nil)
    }

    @Test("The chest's lid is its own entity and opens on its hinge")
    @MainActor
    func chestLid() async throws {
        let chest = try #require(await TreasureEntities.chest(catalog: catalog))
        let lid = try #require(chest.lid)
        #expect(chest.base != nil && chest.innerGlow != nil)
        #expect(chest.runes.count == 2)
        let shut = lid.orientation
        chest.setLidOpen(1)
        let angle = lid.orientation.angle - shut.angle
        #expect(abs(abs(angle) - 110 * .pi / 180) < 0.01)
        chest.setLidOpen(0)
        #expect(simd_distance(lid.orientation.vector, shut.vector) < 0.0001)
    }

    @Test("Idle motion moves the model and resets to rest")
    @MainActor
    func idleMotion() async throws {
        let loaded = await TreasureEntities.treasure(TreasureLook(model: .crown, color: .gold, name: "x"), catalog: catalog)
        let player = try #require(loaded.idleMotion())
        let rest = loaded.entity.transform
        player.update(time: 1)
        #expect(loaded.entity.transform != rest, "spin turns the crown")
        player.reset()
        #expect(loaded.entity.transform == rest)
    }
}

private final class BundleToken {}

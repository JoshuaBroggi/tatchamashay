import RealityKit
import UIKit

/// Loads the manifest's USDZ models as RealityKit entities: treasures tinted with the child's color,
/// and the chest with its lid as its own entity. Each file loads once; later calls get a clone.
/// If a file is missing or fails to load, a treasure falls back to a shape drawn in code.
@MainActor
enum TreasureEntities {
    private static var prototypes: [URL: Entity] = [:]

    /// A treasure in the look's model and color. Never fails: a load error gives a drawn stand-in.
    static func treasure(_ look: TreasureLook, catalog: TreasureCatalog = .bundled) async -> LoadedTreasure {
        if let entry = catalog.entry(for: look.model), let url = catalog.modelURL(for: entry),
           let entity = await load(url) {
            tint(entity, parts: entry.tintableParts, color: look.color)
            return LoadedTreasure(entity: entity, entry: entry, isFallback: false)
        }
        return LoadedTreasure(entity: FallbackTreasure.make(look.model, color: look.color), entry: nil, isFallback: true)
    }

    /// The treasure chest, or nil if its file can't load.
    static func chest(catalog: TreasureCatalog = .bundled) async -> ChestEntity? {
        guard let url = catalog.modelURL(for: catalog.chest), let entity = await load(url) else { return nil }
        return ChestEntity(root: entity, entry: catalog.chest)
    }

    /// Sets the base color of every material on the named parts and the meshes inside them.
    static func tint(_ root: Entity, parts: [String], color: TreasureColor) {
        let c = color.rgb
        let uiColor = UIColor(red: c.red, green: c.green, blue: c.blue, alpha: 1)
        for name in parts {
            guard let part = root.findEntity(named: name) else { continue }
            visit(part) { entity in
                guard var model = entity.components[ModelComponent.self] else { return }
                model.materials = model.materials.map { material in
                    var pbr = material as? PhysicallyBasedMaterial ?? PhysicallyBasedMaterial()
                    pbr.baseColor = .init(tint: uiColor)
                    return pbr
                }
                entity.components.set(model)
            }
        }
    }

    private static func load(_ url: URL) async -> Entity? {
        if let prototype = prototypes[url] { return prototype.clone(recursive: true) }
        do {
            let entity = try await Entity(contentsOf: url)
            prototypes[url] = entity
            return entity.clone(recursive: true)
        } catch {
            print("Couldn't load \(url.lastPathComponent): \(error)")
            return nil
        }
    }

    static func visit(_ entity: Entity, _ body: (Entity) -> Void) {
        body(entity)
        for child in entity.children { visit(child, body) }
    }
}

/// A loaded treasure. `entry` is nil for a drawn stand-in, which has no idle motion.
@MainActor
struct LoadedTreasure {
    let entity: Entity
    let entry: TreasureCatalog.Entry?
    let isFallback: Bool

    /// The manifest's idle motion for this treasure, ready to drive each frame.
    func idleMotion() -> IdleMotionPlayer? {
        entry.map { IdleMotionPlayer(root: entity, entry: $0) }
    }
}

/// Plays a treasure's `idleMotion` in code: the USDZ files carry no animation.
/// Create it after placing the entity, since it remembers each moving part's resting pose.
@MainActor
final class IdleMotionPlayer {
    private struct Target {
        let entity: Entity
        let rest: Transform
        let axis: SIMD3<Float>
        let degrees: Float
    }

    let motion: IdleMotion
    private let body: Target?
    private let flaps: [Target]

    init(root: Entity, entry: TreasureCatalog.Entry) {
        motion = entry.idleMotion
        let target = entry.idleMotionPart.flatMap { root.findEntity(named: $0) } ?? root
        body = Target(entity: target, rest: target.transform, axis: [0, 0, 1], degrees: 8)
        flaps = entry.idleMotion == .flap ? entry.movingParts.compactMap { part in
            guard part.motion == .flap, let entity = root.findEntity(named: part.part), part.axis.count == 3 else { return nil }
            return Target(entity: entity, rest: entity.transform,
                          axis: simd_normalize(SIMD3(part.axis[0], part.axis[1], part.axis[2])), degrees: part.degrees ?? 20)
        } : []
    }

    /// Number of flapping parts found, for tests.
    var flappingPartCount: Int { flaps.count }

    /// Poses the model for a moment `time` seconds into the motion.
    func update(time: TimeInterval) {
        guard let body else { return }
        let t = Float(time)
        var pose = body.rest
        switch motion {
        case .spin:
            pose.rotation = simd_quatf(angle: t * 2 * .pi / 5, axis: [0, 1, 0]) * body.rest.rotation
        case .bob:
            pose.translation.y += sin(t * .pi) * Self.bobHeight(for: body.entity)
        case .wiggle:
            pose.rotation = body.rest.rotation * simd_quatf(angle: sin(t * 2 * .pi / 1.2) * body.degrees * .pi / 180,
                                                            axis: body.axis)
        case .flap:
            pose.translation.y += sin(t * .pi) * Self.bobHeight(for: body.entity) * 0.5
            for flap in flaps {
                var wing = flap.rest
                wing.rotation = flap.rest.rotation * simd_quatf(angle: sin(t * 2 * .pi * 3) * flap.degrees * .pi / 180,
                                                                axis: flap.axis)
                flap.entity.transform = wing
            }
        case .none:
            break
        }
        body.entity.transform = pose
    }

    /// Back to the resting pose, e.g. when motion is turned off.
    func reset() {
        body.map { $0.entity.transform = $0.rest }
        flaps.forEach { $0.entity.transform = $0.rest }
    }

    /// About 2 cm in the model's own size, whatever it was scaled to.
    private static func bobHeight(for entity: Entity) -> Float { 0.02 * entity.scale.y }
}

/// The treasure chest, with the parts the reveal animates.
@MainActor
final class ChestEntity {
    let root: Entity
    /// Rotates on the back hinge.
    let lid: Entity?
    let base: Entity?
    /// A warm emissive plane inside, hidden while the lid is shut.
    let innerGlow: Entity?
    /// Emissive cyan runes on the base and lid.
    let runes: [Entity]
    /// The lid angle when fully open (−110°).
    let openDegrees: Float
    let lidAxis: SIMD3<Float>
    private let lidRest: simd_quatf?

    init(root: Entity, entry: TreasureCatalog.Entry) {
        self.root = root
        let parts = entry.namedParts
        lid = parts.flatMap { root.findEntity(named: $0.lid) }
        base = parts.flatMap { root.findEntity(named: $0.base) }
        innerGlow = parts.flatMap { root.findEntity(named: $0.innerGlow) }
        runes = parts?.runes.compactMap { root.findEntity(named: $0) } ?? []
        let hinge = entry.movingParts.first { $0.motion == .hinge && $0.part == parts?.lid }
        openDegrees = hinge?.openDegrees ?? -110
        lidAxis = hinge.flatMap { $0.axis.count == 3 ? SIMD3($0.axis[0], $0.axis[1], $0.axis[2]) : nil } ?? [1, 0, 0]
        lidRest = lid?.orientation
    }

    /// 0 is shut, 1 is fully open.
    func setLidOpen(_ fraction: Float) {
        guard let lid, let lidRest else { return }
        let angle = openDegrees * min(max(fraction, 0), 1) * .pi / 180
        lid.orientation = lidRest * simd_quatf(angle: angle, axis: lidAxis)
    }

    /// Fades the runes, 0 to 1.
    func setRuneGlow(_ amount: Float) {
        for rune in runes { rune.components.set(OpacityComponent(opacity: min(max(amount, 0), 1))) }
    }
}

/// Simple shapes drawn in code, used when a model file can't load.
@MainActor
enum FallbackTreasure {
    static func make(_ model: BuiltInModel, color: TreasureColor) -> Entity {
        let root = Entity()
        let c = color.rgb
        let chosen = UIColor(red: c.red, green: c.green, blue: c.blue, alpha: 1)
        switch model {
        case .doubloon:
            let coin = ModelEntity(mesh: .generateCylinder(height: 0.025, radius: 0.15),
                                   materials: [material(chosen, metallic: 0.8, glow: 0.15)])
            coin.orientation = simd_quatf(angle: .pi / 2, axis: [1, 0, 0])
            root.addChild(coin)

        case .crown:
            let gold = material(chosen, metallic: 0.8, glow: 0.15)
            root.addChild(ModelEntity(mesh: .generateCylinder(height: 0.08, radius: 0.13), materials: [gold]))
            for i in 0..<6 {
                let angle = Float(i) / 6 * 2 * .pi
                let spike = ModelEntity(mesh: .generateCone(height: 0.09, radius: 0.035), materials: [gold])
                spike.position = [cos(angle) * 0.11, 0.085, sin(angle) * 0.11]
                root.addChild(spike)
            }

        case .potion:
            root.addChild(ModelEntity(mesh: .generateSphere(radius: 0.11), materials: [material(chosen, metallic: 0, glow: 0.7)]))
            let neck = ModelEntity(mesh: .generateCylinder(height: 0.09, radius: 0.035),
                                   materials: [material(UIColor(red: 0.8, green: 0.9, blue: 0.95, alpha: 1), metallic: 0.2, glow: 0.1)])
            neck.position.y = 0.13
            root.addChild(neck)

        default:
            let glass = material(chosen, metallic: 0.1, glow: 0.6)
            let top = ModelEntity(mesh: .generateCone(height: 0.12, radius: 0.12), materials: [glass])
            top.position.y = 0.06
            let bottom = ModelEntity(mesh: .generateCone(height: 0.22, radius: 0.12), materials: [glass])
            bottom.orientation = simd_quatf(angle: .pi, axis: [1, 0, 0])
            bottom.position.y = -0.11
            root.addChild(top)
            root.addChild(bottom)
        }
        return root
    }

    static func material(_ color: UIColor, metallic: Float, glow: Float) -> PhysicallyBasedMaterial {
        var material = PhysicallyBasedMaterial()
        material.baseColor = .init(tint: color)
        material.metallic = .init(floatLiteral: metallic)
        material.roughness = 0.3
        material.emissiveColor = .init(color: color)
        material.emissiveIntensity = glow
        return material
    }
}

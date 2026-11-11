import RealityKit
import SwiftUI

/// Shows a treasure's 3D model, slowly spinning and bobbing, and plays any animations a creator's file contains.
struct TreasureModelView: View {
    let model: TreasureModel

    @State private var spinner = Spinner()

    var body: some View {
        RealityView { content in
            content.camera = .virtual

            let pivot = Entity()
            let treasure = await Self.makeEntity(for: model)
            Self.fit(treasure, size: 0.4)
            pivot.addChild(treasure)
            content.add(pivot)

            let camera = PerspectiveCamera()
            camera.camera.fieldOfViewInDegrees = 40
            camera.look(at: .zero, from: [0, 0.08, 0.85], relativeTo: nil)
            content.add(camera)

            let sun = DirectionalLight()
            sun.light.intensity = 4_000
            sun.look(at: .zero, from: [0.5, 1, 1], relativeTo: nil)
            content.add(sun)

            let fill = PointLight()
            fill.light.intensity = 30_000
            fill.position = [-0.5, 0.2, 0.6]
            content.add(fill)

            spinner.subscription = content.subscribe(to: SceneEvents.Update.self) { event in
                spinner.time += event.deltaTime
                pivot.orientation = simd_quatf(angle: Float(spinner.time) * 0.9, axis: [0, 1, 0])
                pivot.position.y = Float(sin(spinner.time * 2)) * 0.02
            }
        }
        .realityViewCameraControls(.orbit)
    }

    /// Keeps the per-frame update alive for as long as the view is on screen.
    final class Spinner {
        var time: TimeInterval = 0
        var subscription: EventSubscription?
    }

    /// Scales and centers any model so it fits in a cube of the given size.
    private static func fit(_ entity: Entity, size: Float) {
        let bounds = entity.visualBounds(relativeTo: nil)
        let largest = max(bounds.extents.x, bounds.extents.y, bounds.extents.z)
        guard largest > 0 else { return }
        let scale = size / largest
        entity.scale *= scale
        entity.position -= bounds.center * scale
    }

    @MainActor
    static func makeEntity(for model: TreasureModel) async -> Entity {
        switch model {
        case .builtIn(let builtIn):
            return builtInEntity(builtIn)
        case .usdz(let fileName):
            let url = TreasureStore.modelsDirectory.appending(path: fileName)
            guard let entity = try? await Entity(contentsOf: url) else {
                return builtInEntity(.orb)
            }
            for animation in entity.availableAnimations {
                entity.playAnimation(animation.repeat())
            }
            return entity
        }
    }

    // MARK: - Built-in treasures

    @MainActor
    private static func builtInEntity(_ model: BuiltInModel) -> Entity {
        let root = Entity()
        switch model {
        case .gem:
            let glass = material(UIColor(red: 0.2, green: 0.85, blue: 0.95, alpha: 1), metallic: 0.1, glow: 0.6)
            let top = ModelEntity(mesh: .generateCone(height: 0.12, radius: 0.12), materials: [glass])
            top.position.y = 0.06
            let bottom = ModelEntity(mesh: .generateCone(height: 0.22, radius: 0.12), materials: [glass])
            bottom.orientation = simd_quatf(angle: .pi, axis: [1, 0, 0])
            bottom.position.y = -0.11
            root.addChild(top)
            root.addChild(bottom)

        case .doubloon:
            let gold = material(UIColor(red: 1, green: 0.78, blue: 0.2, alpha: 1), metallic: 0.8, glow: 0.15)
            let coin = ModelEntity(mesh: .generateCylinder(height: 0.025, radius: 0.15), materials: [gold])
            coin.orientation = simd_quatf(angle: .pi / 2, axis: [1, 0, 0])
            let stamp = ModelEntity(mesh: .generateBox(width: 0.07, height: 0.07, depth: 0.04, cornerRadius: 0.01),
                                    materials: [material(UIColor(red: 0.8, green: 0.55, blue: 0.1, alpha: 1), metallic: 0.8, glow: 0.1)])
            stamp.orientation = simd_quatf(angle: .pi / 4, axis: [0, 0, 1])
            root.addChild(coin)
            root.addChild(stamp)

        case .crown:
            let gold = material(UIColor(red: 1, green: 0.8, blue: 0.25, alpha: 1), metallic: 0.8, glow: 0.15)
            let ruby = material(UIColor(red: 0.9, green: 0.1, blue: 0.15, alpha: 1), metallic: 0.1, glow: 0.5)
            let band = ModelEntity(mesh: .generateCylinder(height: 0.08, radius: 0.13), materials: [gold])
            root.addChild(band)
            for i in 0..<6 {
                let angle = Float(i) / 6 * 2 * .pi
                let spike = ModelEntity(mesh: .generateCone(height: 0.09, radius: 0.035), materials: [gold])
                spike.position = [cos(angle) * 0.11, 0.085, sin(angle) * 0.11]
                let jewel = ModelEntity(mesh: .generateSphere(radius: 0.018), materials: [ruby])
                jewel.position = [cos(angle) * 0.11, 0.135, sin(angle) * 0.11]
                root.addChild(spike)
                root.addChild(jewel)
            }

        case .potion:
            let liquid = material(UIColor(red: 0.95, green: 0.3, blue: 0.7, alpha: 1), metallic: 0, glow: 0.7)
            let glass = material(UIColor(red: 0.8, green: 0.9, blue: 0.95, alpha: 1), metallic: 0.2, glow: 0.1)
            let cork = material(UIColor(red: 0.55, green: 0.35, blue: 0.18, alpha: 1), metallic: 0, glow: 0)
            let bulb = ModelEntity(mesh: .generateSphere(radius: 0.11), materials: [liquid])
            let neck = ModelEntity(mesh: .generateCylinder(height: 0.09, radius: 0.035), materials: [glass])
            neck.position.y = 0.13
            let stopper = ModelEntity(mesh: .generateCylinder(height: 0.04, radius: 0.04), materials: [cork])
            stopper.position.y = 0.19
            root.addChild(bulb)
            root.addChild(neck)
            root.addChild(stopper)

        case .orb:
            let storm = material(UIColor(red: 0.45, green: 0.3, blue: 0.95, alpha: 1), metallic: 0.2, glow: 0.8)
            let spark = material(UIColor(red: 0.9, green: 0.95, blue: 1, alpha: 1), metallic: 0, glow: 1)
            root.addChild(ModelEntity(mesh: .generateSphere(radius: 0.12), materials: [storm]))
            for i in 0..<3 {
                let angle = Float(i) / 3 * 2 * .pi
                let moon = ModelEntity(mesh: .generateSphere(radius: 0.025), materials: [spark])
                moon.position = [cos(angle) * 0.19, sin(angle * 2) * 0.05, sin(angle) * 0.19]
                root.addChild(moon)
            }
        }
        return root
    }

    @MainActor
    private static func material(_ color: UIColor, metallic: Float, glow: Float) -> PhysicallyBasedMaterial {
        var material = PhysicallyBasedMaterial()
        material.baseColor = .init(tint: color)
        material.metallic = .init(floatLiteral: metallic)
        material.roughness = 0.3
        material.emissiveColor = .init(color: color)
        material.emissiveIntensity = glow
        return material
    }
}

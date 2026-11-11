import RealityKit
import SwiftUI

/// Shows a built-in treasure in 3D: the manifest's USDZ model in the chosen color, with its sparkles,
/// playing its idle motion unless motion is turned down. Falls back to a drawn shape if the file
/// can't load.
struct TreasureModelView: View {
    let look: TreasureLook
    var catalog: TreasureCatalog = .bundled

    @Environment(PlaySettings.self) private var settings: PlaySettings?
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion

    var body: some View {
        let still = settings?.reducesMotion(system: systemReduceMotion) ?? systemReduceMotion
        // Rebuild the scene only when something visible changes, not while the name is typed.
        TreasureStage(look: look, catalog: catalog, still: still)
            .id(StageKey(model: look.model, color: look.color, sparkles: look.sparkles, still: still))
    }

    private struct StageKey: Hashable {
        var model: BuiltInModel
        var color: TreasureColor
        var sparkles: Sparkles
        var still: Bool
    }
}

private struct TreasureStage: View {
    let look: TreasureLook
    let catalog: TreasureCatalog
    let still: Bool

    @State private var clock = FrameClock()
    /// "usdz" once the real model is showing, "drawn" for the stand-in. UI tests read it.
    @State private var shown = "loading"

    var body: some View {
        RealityView { content in
            content.camera = .virtual

            let pivot = Entity()
            let loaded = await TreasureEntities.treasure(look, catalog: catalog)
            let treasure = loaded.entity
            Self.fit(treasure, size: 0.4)
            pivot.addChild(treasure)
            Self.addSparkles(look.sparkles, to: pivot)
            content.add(pivot)
            shown = loaded.isFallback ? "drawn" : "usdz"

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

            guard !still else { return }
            let idle = loaded.idleMotion()
            let clock = clock
            clock.subscription = content.subscribe(to: SceneEvents.Update.self) { event in
                clock.time += event.deltaTime
                if let idle {
                    idle.update(time: clock.time)
                } else {
                    // The drawn stand-in has no manifest motion: a slow turn.
                    pivot.orientation = simd_quatf(angle: Float(clock.time) * 0.9, axis: [0, 1, 0])
                }
            }
        }
        .realityViewCameraControls(.orbit)
        .accessibilityElement()
        .accessibilityLabel(look.name)
        .accessibilityValue(shown)
        .accessibilityIdentifier("treasureModel")
    }

    /// Keeps the per-frame update alive for as long as the view is on screen.
    final class FrameClock {
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

    private static func addSparkles(_ sparkles: Sparkles, to root: Entity) {
        let count = switch sparkles {
        case .none: 0
        case .some: 6
        case .lots, .rainbow: 14
        }
        for i in 0..<count {
            let color = sparkles == .rainbow
                ? UIColor(hue: CGFloat(i) / CGFloat(count), saturation: 0.7, brightness: 1, alpha: 1)
                : UIColor(red: 1, green: 0.97, blue: 0.85, alpha: 1)
            let angle = Float(i) / Float(max(count, 1)) * 2 * .pi
            let dot = ModelEntity(mesh: .generateSphere(radius: 0.008),
                                  materials: [FallbackTreasure.material(color, metallic: 0, glow: 1)])
            dot.position = [cos(angle) * 0.24, sin(angle * 3) * 0.08, sin(angle) * 0.24]
            root.addChild(dot)
        }
    }
}

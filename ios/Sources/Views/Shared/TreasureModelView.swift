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
        // Only a different model or motion setting needs a new scene. Paint updates in place.
        TreasureStage(look: look, catalog: catalog, still: still)
            .id(StageKey(model: look.model, still: still))
    }

    private struct StageKey: Hashable {
        var model: BuiltInModel
        var still: Bool
    }
}

private struct TreasureStage: View {
    let look: TreasureLook
    let catalog: TreasureCatalog
    let still: Bool

    @State private var clock = FrameClock()
    @State private var cameraPose = CameraPose()
    @State private var dragOrigin: SIMD2<Float>?
    @State private var zoomOrigin: Float?
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
            clock.loaded = loaded
            clock.pivot = pivot
            Self.updateAppearance(look, catalog: catalog, clock: clock)
            content.add(pivot)
            shown = loaded.isFallback ? "drawn" : "usdz"

            let camera = PerspectiveCamera()
            camera.camera.fieldOfViewInDegrees = 40
            clock.camera = camera
            Self.updateCamera(cameraPose, clock: clock)
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
            clock.subscription = content.subscribe(to: SceneEvents.Update.self) { [weak clock] event in
                guard let clock else { return }
                clock.time += event.deltaTime
                if let idle {
                    idle.update(time: clock.time)
                } else {
                    // The drawn stand-in has no manifest motion: a slow turn.
                    pivot.orientation = simd_quatf(angle: Float(clock.time) * 0.9, axis: [0, 1, 0])
                }
            }
        } update: { _ in
            Self.updateAppearance(look, catalog: catalog, clock: clock)
            Self.updateCamera(cameraPose, clock: clock)
        }
        // Own the camera pose instead of letting automatic orbit controls refit the content
        // when RealityKit receives new material components.
        .gesture(DragGesture(minimumDistance: 4)
            .onChanged { value in
                if dragOrigin == nil { dragOrigin = [cameraPose.yaw, cameraPose.pitch] }
                guard let dragOrigin else { return }
                cameraPose.yaw = dragOrigin.x - Float(value.translation.width) * 0.008
                cameraPose.pitch = min(max(dragOrigin.y + Float(value.translation.height) * 0.008, -1.2), 1.2)
            }
            .onEnded { _ in dragOrigin = nil })
        .simultaneousGesture(MagnifyGesture()
            .onChanged { value in
                if zoomOrigin == nil { zoomOrigin = cameraPose.distance }
                cameraPose.distance = min(max((zoomOrigin ?? 0.85) / Float(value.magnification), 0.25), 2.5)
            }
            .onEnded { _ in zoomOrigin = nil })
        .accessibilityElement()
        .accessibilityLabel(look.name)
        .accessibilityValue(shown)
        .accessibilityHint("Pinch to zoom. Drag to turn.")
        .accessibilityAction(named: "Zoom in") { cameraPose.distance = max(0.25, cameraPose.distance * 0.8) }
        .accessibilityAction(named: "Zoom out") { cameraPose.distance = min(2.5, cameraPose.distance * 1.25) }
        .accessibilityAction(named: "Turn left") { cameraPose.yaw -= .pi / 6 }
        .accessibilityAction(named: "Turn right") { cameraPose.yaw += .pi / 6 }
        .accessibilityIdentifier("treasureModel")
    }

    /// Keeps the per-frame update alive for as long as the view is on screen.
    final class FrameClock {
        var time: TimeInterval = 0
        var subscription: EventSubscription?
        var loaded: LoadedTreasure?
        var pivot: Entity?
        var sparkles: Entity?
        var appearance: AppearanceKey?
        var camera: PerspectiveCamera?
    }

    struct CameraPose {
        var yaw: Float = 0
        var pitch: Float = atan2(0.08, 0.85)
        var distance: Float = sqrt(0.85 * 0.85 + 0.08 * 0.08)
    }

    private static func updateCamera(_ pose: CameraPose, clock: FrameClock) {
        let horizontal = cos(pose.pitch) * pose.distance
        clock.camera?.look(at: .zero,
                           from: [sin(pose.yaw) * horizontal, sin(pose.pitch) * pose.distance, cos(pose.yaw) * horizontal],
                           relativeTo: nil)
    }

    struct AppearanceKey: Equatable {
        let color: TreasureColor
        let paint: TreasurePaint?
        let sparkles: Sparkles
    }

    private static func updateAppearance(_ look: TreasureLook, catalog: TreasureCatalog, clock: FrameClock) {
        let key = AppearanceKey(color: look.color, paint: look.paint, sparkles: look.sparkles)
        guard key != clock.appearance, let loaded = clock.loaded, let pivot = clock.pivot else { return }
        TreasureEntities.applyAppearance(look, to: loaded, catalog: catalog)
        if clock.appearance?.sparkles != look.sparkles {
            clock.sparkles?.removeFromParent()
            let sparkles = Entity()
            Self.addSparkles(look.sparkles, to: sparkles)
            pivot.addChild(sparkles)
            clock.sparkles = sparkles
        }
        clock.appearance = key
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

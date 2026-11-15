import RealityKit
import SwiftUI

/// One small 3D viewport for the active character, using the same saved look as My Chest.
struct WalkingCharacterView: View {
    let look: TreasureLook
    var walking = false
    var heading: Double = 0
    var calm = false

    @Environment(\.scenePhase) private var scenePhase
    @State private var visible = false

    var body: some View {
        ZStack {
            if visible {
                CharacterStage(look: look, walking: walking, heading: heading, calm: calm || scenePhase != .active)
                    .id(look)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear { visible = true }
        .onDisappear { visible = false }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(look.name)
        .accessibilityValue(walking && !calm ? "Walking" : "Standing")
        .accessibilityIdentifier("walkingCharacter")
    }
}

private struct CharacterStage: View {
    let look: TreasureLook
    let walking: Bool
    let heading: Double
    let calm: Bool
    @State private var scene = CharacterScene()

    var body: some View {
        RealityView { content in
            content.camera = .virtual
            let loaded = await TreasureEntities.treasure(look)
            let entity = loaded.entity
            let bounds = entity.visualBounds(relativeTo: nil)
            let largest = max(bounds.extents.x, bounds.extents.y, bounds.extents.z)
            let scale: Float = largest > 0 ? 0.42 / largest : 1
            entity.scale *= scale
            entity.position -= bounds.center * scale
            scene.pivot.addChild(entity)
            content.add(scene.pivot)
            scene.idle = loaded.idleMotion()
            scene.walk = CharacterWalkPlayer(root: entity, entry: loaded.entry)
            if look.sparkles != .none {
                let count = look.sparkles == .some ? 6 : 12
                for index in 0..<count {
                    let dot = ModelEntity(mesh: .generateSphere(radius: 0.005),
                                          materials: [UnlitMaterial(color: .init(white: 1, alpha: 1))])
                    let angle = Float(index) * .pi * 2 / Float(count)
                    dot.position = [cos(angle) * 0.22, sin(angle * 3) * 0.08, sin(angle) * 0.22]
                    scene.pivot.addChild(dot)
                }
            }
            scene.walking = walking
            scene.calm = calm
            scene.heading = heading

            let camera = PerspectiveCamera()
            camera.camera.fieldOfViewInDegrees = 38
            camera.look(at: .zero, from: [0, 0.18, 0.88], relativeTo: nil)
            content.add(camera)
            let light = DirectionalLight()
            light.light.intensity = 4_000
            light.look(at: .zero, from: [0.5, 1, 1], relativeTo: nil)
            content.add(light)
            let fill = PointLight()
            fill.light.intensity = 25_000
            fill.position = [-0.5, 0.3, 0.6]
            content.add(fill)
            let scene = scene
            scene.subscription = content.subscribe(to: SceneEvents.Update.self) { [weak scene] event in
                scene?.update(event.deltaTime)
            }
        } update: { _ in
            scene.walking = walking
            scene.heading = heading
            scene.calm = calm
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .allowsHitTesting(false)
    }
}

@MainActor
private final class CharacterScene {
    let pivot = Entity()
    var idle: IdleMotionPlayer?
    var walk: CharacterWalkPlayer?
    var subscription: EventSubscription?
    var walking = false
    var calm = false
    var heading: Double = 0
    var time: Double = 0
    private var previousState: Int?

    func update(_ delta: Double) {
        time += min(delta, 0.1)
        let state = calm ? 0 : (walking ? 1 : 2)
        if previousState != state {
            idle?.reset()
            walk?.reset()
            previousState = state
        }
        pivot.position = .zero
        pivot.orientation = simd_quatf(angle: Float((180 - heading) * .pi / 180), axis: [0, 1, 0])
        guard !calm else { return }
        if walking {
            walk?.update(time)
            pivot.position.y = Float(abs(sin(time * .pi * 3))) * 0.012
        } else {
            idle?.update(time: time)
        }
    }
}

/// Manifest-driven movement, kept separate from the existing collection preview's idle player.
@MainActor
final class CharacterWalkPlayer {
    private struct Part {
        let entity: Entity
        let rest: Transform
        let axis: SIMD3<Float>
        let amplitude: Float
        let phase: Float
    }
    private let parts: [Part]
    private struct Joint {
        let index: Int
        let axis: SIMD3<Float>
        let amplitude: Float
        let phase: Float
    }
    private struct Skeleton {
        let entity: ModelEntity
        let rest: [Transform]
        let joints: [Joint]
    }
    private let skeletons: [Skeleton]
    var partCount: Int { parts.count + skeletons.reduce(0) { $0 + $1.joints.count } }

    init(root: Entity, entry: TreasureCatalog.Entry?) {
        if let locomotion = entry?.locomotion {
            parts = locomotion.parts.compactMap { part in
                guard part.axis.count == 3, part.axis.allSatisfy(\.isFinite),
                      let entity = root.findEntity(named: part.name) else { return nil }
                let axis = SIMD3<Float>(part.axis[0], part.axis[1], part.axis[2])
                guard simd_length_squared(axis) > 0 else { return nil }
                return Part(entity: entity, rest: entity.transform, axis: simd_normalize(axis),
                            amplitude: part.degrees * .pi / 180, phase: part.phase)
            }
        } else {
            parts = (entry?.movingParts ?? []).enumerated().compactMap { index, part in
                guard part.motion == .flap, part.axis.count == 3,
                      let entity = root.findEntity(named: part.part) else { return nil }
                let axis = SIMD3<Float>(part.axis[0], part.axis[1], part.axis[2])
                guard simd_length_squared(axis) > 0 else { return nil }
                return Part(entity: entity, rest: entity.transform, axis: simd_normalize(axis),
                            amplitude: (part.degrees ?? 25) * .pi / 180, phase: Float(index % 2) * .pi)
            }
        }
        var rigs: [Skeleton] = []
        if let joints = entry?.locomotion?.joints {
            TreasureEntities.visit(root) { entity in
                guard let model = entity as? ModelEntity, !model.jointTransforms.isEmpty else { return }
                let targets: [Joint] = joints.compactMap { joint in
                    guard joint.axis.count == 3, joint.axis.allSatisfy(\.isFinite),
                          let index = model.jointNames.firstIndex(where: { $0.split(separator: "/").last.map(String.init) == joint.name }),
                          index < model.jointTransforms.count else { return nil }
                    let axis = SIMD3<Float>(joint.axis[0], joint.axis[1], joint.axis[2])
                    guard simd_length_squared(axis) > 0 else { return nil }
                    return Joint(index: index, axis: simd_normalize(axis),
                                 amplitude: joint.degrees * .pi / 180, phase: joint.phase)
                }
                if !targets.isEmpty { rigs.append(Skeleton(entity: model, rest: model.jointTransforms, joints: targets)) }
            }
        }
        skeletons = rigs
    }

    func update(_ time: Double) {
        for skeleton in skeletons {
            var transforms = skeleton.rest
            for joint in skeleton.joints {
                transforms[joint.index].rotation = skeleton.rest[joint.index].rotation * simd_quatf(
                    angle: sin(Float(time) * .pi * 3 + joint.phase) * joint.amplitude, axis: joint.axis)
            }
            skeleton.entity.jointTransforms = transforms
        }
        for part in parts {
            var pose = part.rest
            pose.rotation = part.rest.rotation * simd_quatf(
                angle: sin(Float(time) * .pi * 3 + part.phase) * part.amplitude, axis: part.axis)
            part.entity.transform = pose
        }
    }

    func reset() {
        for part in parts { part.entity.transform = part.rest }
        for skeleton in skeletons { skeleton.entity.jointTransforms = skeleton.rest }
    }
}

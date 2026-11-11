import Observation
import RealityKit
import SwiftUI

/// The 3D chest reveal: the manifest's chest rattles, the lid swings open on its hinge with the runes
/// glowing, a light beam and sparkles rise, then the child's treasure floats up out of the chest.
/// The treasure loads while the chest rattles; if the tap comes first, the rise waits for it.
@MainActor
@Observable
final class ChestRevealScene {
    /// "loading", then "usdz" for the real model or "drawn" for the stand-in. UI tests read it.
    private(set) var treasureShown = "loading"
    /// True once the treasure has started rising, for its sound.
    private(set) var isRising = false
    /// True once the treasure is fully out.
    private(set) var hasRevealed = false

    let look: TreasureLook
    let timing: RevealTiming
    let calm: Bool

    @ObservationIgnored private let catalog: TreasureCatalog
    @ObservationIgnored private let root = Entity()
    @ObservationIgnored private let chestHolder = Entity()
    @ObservationIgnored private let treasureHolder = Entity()
    @ObservationIgnored private var lid: (Float) -> Void = { _ in }
    @ObservationIgnored private var runes: (Float) -> Void = { _ in }
    @ObservationIgnored private var innerGlow: Entity?
    @ObservationIgnored private var beam: ModelEntity?
    @ObservationIgnored private var sparkles: [ModelEntity] = []
    @ObservationIgnored private var treasure: LoadedTreasure?
    @ObservationIgnored private var idle: IdleMotionPlayer?
    @ObservationIgnored private var chestTop: Float = 0.35
    @ObservationIgnored private var clock: TimeInterval = 0
    /// Seconds since the tap; nil while sealed.
    @ObservationIgnored private var opening: TimeInterval?
    @ObservationIgnored private var subscription: EventSubscription?

    init(look: TreasureLook, calm: Bool, catalog: TreasureCatalog = .bundled) {
        self.look = look
        self.calm = calm
        self.catalog = catalog
        timing = .forMotion(reduced: calm)
    }

    /// Builds the scene inside a `RealityView`. The chest shows as soon as it loads; the treasure
    /// keeps loading in the background.
    func make(_ content: inout RealityViewCameraContent) async {
        content.camera = .virtual
        content.add(root)
        root.addChild(chestHolder)
        root.addChild(treasureHolder)
        treasureHolder.isEnabled = false

        await addChest()
        addBeamAndSparkles()
        addCameraAndLights(to: &content)
        subscription = content.subscribe(to: SceneEvents.Update.self) { [weak self] event in
            self?.update(by: event.deltaTime)
        }
        Task { await loadTreasure() }
    }

    /// The child tapped: start the opening.
    func open() {
        guard opening == nil else { return }
        opening = 0
    }

    /// Skips to the end of the opening (and to the treasure, once it has loaded).
    func skip() {
        open()
        opening = timing.tapToTreasure
    }

    // MARK: Building

    private func addChest() async {
        if let chest = await TreasureEntities.chest(catalog: catalog) {
            chestHolder.addChild(chest.root)
            lid = { chest.setLidOpen($0) }
            runes = { chest.setRuneGlow($0) }
            innerGlow = chest.innerGlow
        } else {
            addDrawnChest()
        }
        Self.fit(chestHolder, width: 0.5)
        let bounds = chestHolder.visualBounds(relativeTo: root)
        chestHolder.position.y -= bounds.min.y
        chestTop = bounds.extents.y
        innerGlow?.isEnabled = false
        runes(calm ? 0.5 : 0.3)
        lid(0)
    }

    /// A plain box chest with a hinged lid, in case the model file can't load.
    private func addDrawnChest() {
        let wood = FallbackTreasure.material(UIColor(red: 0.35, green: 0.23, blue: 0.12, alpha: 1), metallic: 0, glow: 0)
        let base = ModelEntity(mesh: .generateBox(width: 0.5, height: 0.28, depth: 0.32, cornerRadius: 0.01), materials: [wood])
        base.position.y = 0.14
        let hinge = Entity()
        hinge.position = [0, 0.28, -0.16]
        let lidBox = ModelEntity(mesh: .generateBox(width: 0.5, height: 0.08, depth: 0.32, cornerRadius: 0.02), materials: [wood])
        lidBox.position = [0, 0.04, 0.16]
        hinge.addChild(lidBox)
        chestHolder.addChild(base)
        chestHolder.addChild(hinge)
        lid = { fraction in hinge.orientation = simd_quatf(angle: -110 * fraction * .pi / 180, axis: [1, 0, 0]) }
    }

    private func addBeamAndSparkles() {
        guard !calm else { return }
        let gold = UIColor(red: 1, green: 0.85, blue: 0.5, alpha: 1)
        var light = UnlitMaterial(color: gold)
        light.blending = .transparent(opacity: 0.55)
        let beam = ModelEntity(mesh: .generateCylinder(height: 1.4, radius: 0.13), materials: [light])
        beam.position.y = chestTop + 0.7
        beam.components.set(OpacityComponent(opacity: 0))
        root.addChild(beam)
        self.beam = beam

        for i in 0..<18 {
            let hue = 0.12 + 0.05 * CGFloat(i % 3)
            let dot = ModelEntity(mesh: .generateSphere(radius: 0.009),
                                  materials: [UnlitMaterial(color: UIColor(hue: hue, saturation: 0.4, brightness: 1, alpha: 1))])
            dot.isEnabled = false
            root.addChild(dot)
            sparkles.append(dot)
        }
    }

    private func addCameraAndLights(to content: inout RealityViewCameraContent) {
        let camera = PerspectiveCamera()
        camera.camera.fieldOfViewInDegrees = 40
        let focus: SIMD3<Float> = [0, (chestTop + 0.45) / 2, 0]
        camera.look(at: focus, from: focus + [0, 0.25, 1.35], relativeTo: nil)
        content.add(camera)

        let sun = DirectionalLight()
        sun.light.intensity = 3_500
        sun.look(at: .zero, from: [0.5, 1, 1], relativeTo: nil)
        content.add(sun)

        let fill = PointLight()
        fill.light.intensity = 30_000
        fill.position = [-0.5, 0.3, 0.7]
        content.add(fill)
    }

    private func loadTreasure() async {
        let loaded = await TreasureEntities.treasure(look, catalog: catalog)
        Self.fit(loaded.entity, width: 0.32)
        let pivot = Entity()
        pivot.addChild(loaded.entity)
        treasureHolder.addChild(pivot)
        addLookSparkles(to: treasureHolder)
        treasure = loaded
        idle = calm ? nil : loaded.idleMotion()
        treasureShown = loaded.isFallback ? "drawn" : "usdz"
    }

    /// The sparkles the child chose for this treasure, circling it.
    private func addLookSparkles(to holder: Entity) {
        let count = switch look.sparkles {
        case .none: 0
        case .some: 6
        case .lots, .rainbow: 12
        }
        for i in 0..<count {
            let color = look.sparkles == .rainbow
                ? UIColor(hue: CGFloat(i) / CGFloat(count), saturation: 0.7, brightness: 1, alpha: 1)
                : UIColor(red: 1, green: 0.97, blue: 0.85, alpha: 1)
            let angle = Float(i) / Float(count) * 2 * .pi
            let dot = ModelEntity(mesh: .generateSphere(radius: 0.007),
                                  materials: [FallbackTreasure.material(color, metallic: 0, glow: 1)])
            dot.position = [cos(angle) * 0.22, sin(angle * 3) * 0.06, sin(angle) * 0.22]
            holder.addChild(dot)
        }
    }

    // MARK: Each frame

    private func update(by delta: TimeInterval) {
        clock += delta
        guard var t = opening else {
            rattle()
            return
        }
        // The rise waits for the treasure if the tap beat the load.
        if treasure != nil {
            t += delta
        } else if t < timing.rise.lowerBound {
            t = min(t + delta, timing.rise.lowerBound)
        }
        opening = t
        chestHolder.orientation = simd_quatf(angle: 0, axis: [0, 0, 1])

        let lidOpen = RevealTiming.progress(t, in: timing.lid)
        lid(lidOpen)
        runes((calm ? 0.5 : 0.3) + (calm ? 0.5 : 0.7) * lidOpen)
        innerGlow?.isEnabled = lidOpen > 0.05

        if let range = timing.beam { animateBeam(t, range) }

        guard treasure != nil else { return }
        let rise = RevealTiming.progress(t, in: timing.rise)
        if rise > 0 {
            treasureHolder.isEnabled = true
            if !isRising { isRising = true }
        }
        let low = chestTop * 0.5, high = chestTop + 0.25
        treasureHolder.position.y = low + (high - low) * rise
        treasureHolder.scale = .init(repeating: 0.35 + 0.65 * rise)
        if rise >= 1 {
            if !hasRevealed { hasRevealed = true }
            idle?.update(time: t - timing.rise.upperBound)
        }
    }

    /// Short shakes with pauses, as if something inside wants out. None in the calm version.
    private func rattle() {
        guard !calm else { return }
        let cycle = clock.truncatingRemainder(dividingBy: 1.6)
        let angle = cycle < 0.5 ? sin(clock * 2 * .pi * 9) * 3 * (1 - cycle / 0.5) : 0
        chestHolder.orientation = simd_quatf(angle: Float(angle) * .pi / 180, axis: [0, 0, 1])
    }

    private func animateBeam(_ t: Double, _ range: ClosedRange<Double>) {
        let grow = RevealTiming.progress(t, in: range.lowerBound...(range.lowerBound + 0.4))
        let settle = RevealTiming.progress(t, in: (range.upperBound - 0.6)...range.upperBound)
        beam?.components.set(OpacityComponent(opacity: grow * (1 - 0.6 * settle)))
        beam?.scale = [1, max(grow, 0.01), 1]

        let active = t >= range.lowerBound
        for (i, dot) in sparkles.enumerated() {
            dot.isEnabled = active
            guard active else { continue }
            // Each sparkle loops upward on its own spiral.
            let phase = (t - range.lowerBound) / 1.4 + Double(i) / Double(sparkles.count)
            let life = Float(phase.truncatingRemainder(dividingBy: 1))
            let angle = Float(i) * 2.4 + life * 3
            let radius = 0.06 + 0.12 * life
            dot.position = [cos(angle) * radius, chestTop * 0.8 + life * 0.75, sin(angle) * radius]
            dot.scale = .init(repeating: 1.4 * (1 - life))
        }
    }

    /// Scales and centers an entity so its width (the largest side) fits.
    private static func fit(_ entity: Entity, width: Float) {
        let bounds = entity.visualBounds(relativeTo: entity.parent)
        let largest = max(bounds.extents.x, bounds.extents.y, bounds.extents.z)
        guard largest > 0 else { return }
        let scale = width / largest
        entity.scale *= scale
        entity.position -= bounds.center * scale
    }
}

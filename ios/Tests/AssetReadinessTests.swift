import Testing
@testable import Tatchamashay

@Suite("Automatic asset checks")
@MainActor
struct AssetReadinessTests {
    struct Loaders: AssetLoaders {
        var modelOK = true
        var chestOK = true
        var soundOK = true
        func modelLoads(_ model: BuiltInModel) async -> Bool { modelOK }
        func chestLoads() async -> Bool { chestOK }
        func soundLoads(_ effect: SoundEffect) -> Bool { soundOK }
    }

    let look = TreasureLook(model: .crown, color: .gold, name: "Crown")

    @Test("One treasure is ready without a story, hints, map download or setup checklist")
    func singleTreasure() async {
        #expect(await AssetReadiness.check(looks: [look], loaders: Loaders()).isEmpty)
    }

    @Test("An empty family has no asset problems to fix")
    func empty() async {
        #expect(await AssetReadiness.check(looks: [], loaders: Loaders(modelOK: false, chestOK: false, soundOK: false)).isEmpty)
    }

    @Test("Missing assets offer recovery and preserve the playable fallback")
    func missing() async {
        let problems = await AssetReadiness.check(looks: [look, look], loaders: Loaders(modelOK: false, chestOK: false, soundOK: false))
        #expect(problems.count == 3)
        #expect(problems.allSatisfy { $0.contains("reinstalling") })
        #expect(problems.contains { $0.contains("simple shape") })
    }
}

import Foundation

/// The built-in models and sound effects, read from `Assets/manifest.json` (documented in
/// `Assets/README.md`). Screens look up files and part names here instead of hard-coding them.
struct TreasureCatalog: Sendable {
    let treasures: [Entry]
    let chest: Entry
    let sounds: [Sound]
    /// The folder the manifest's relative paths start from: the app bundle's resources.
    let baseURL: URL

    /// The catalog in the app bundle. Empty if the manifest is missing or unreadable, so screens
    /// fall back to drawn shapes instead of crashing.
    static let bundled: TreasureCatalog = (try? load(from: .main)) ?? .empty

    static let empty = TreasureCatalog(
        treasures: [], chest: Entry(id: "chest", displayName: "Treasure Chest", kind: .chest, file: "",
                                    thumbnail: nil, description: nil, heightMeters: 0.5, tintMaterial: nil,
                                    tintableParts: [], defaultColor: nil, idleMotion: .none, idleMotionPart: nil,
                                    movingParts: [], namedParts: nil),
        sounds: [], baseURL: URL(fileURLWithPath: "/")
    )

    enum LoadError: Error, Equatable {
        case missingManifest
        case missingChest
    }

    static func load(from bundle: Bundle) throws -> TreasureCatalog {
        guard let url = bundle.url(forResource: "manifest", withExtension: "json") else {
            throw LoadError.missingManifest
        }
        return try load(manifest: Data(contentsOf: url), baseURL: url.deletingLastPathComponent())
    }

    static func load(manifest: Data, baseURL: URL) throws -> TreasureCatalog {
        let decoded = try JSONDecoder().decode(Manifest.self, from: manifest)
        guard let chest = decoded.models.first(where: { $0.kind == .chest }) else { throw LoadError.missingChest }
        return TreasureCatalog(treasures: decoded.models.filter { $0.kind == .treasure }, chest: chest,
                               sounds: decoded.sounds, baseURL: baseURL)
    }

    func entry(for model: BuiltInModel) -> Entry? { treasures.first { $0.id == model.rawValue } }

    /// The file for a manifest path, if it is in the bundle.
    func url(for path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        let url = baseURL.appending(path: path)
        return FileManager.default.fileExists(atPath: url.path(percentEncoded: false)) ? url : nil
    }

    func modelURL(for entry: Entry) -> URL? { url(for: entry.file) }
    func thumbnailURL(for model: BuiltInModel) -> URL? { url(for: entry(for: model)?.thumbnail) }
    /// The thumbnail painted in the treasure's default color (`<id>-default-color.png`), as the
    /// child first sees it; falls back to the plain thumbnail.
    func colorThumbnailURL(for model: BuiltInModel) -> URL? {
        url(for: entry(for: model)?.thumbnail.map { $0.replacingOccurrences(of: ".png", with: "-default-color.png") })
            ?? thumbnailURL(for: model)
    }
    func soundURL(for effect: SoundEffect) -> URL? { url(for: sounds.first { $0.id == effect.rawValue }?.file) }

    // MARK: Manifest types

    private struct Manifest: Decodable {
        var version: Int
        var models: [Entry]
        var sounds: [Sound]
    }

    struct Entry: Identifiable, Decodable, Hashable, Sendable {
        enum Kind: String, Decodable, Sendable { case chest, treasure }

        let id: String
        let displayName: String
        let kind: Kind
        /// USDZ path, relative to `baseURL`.
        let file: String
        let thumbnail: String?
        /// One friendly sentence for the reveal screen.
        let description: String?
        let heightMeters: Double
        let tintMaterial: String?
        /// Meshes to recolor with the child's `TreasureColor`.
        let tintableParts: [String]
        let defaultColor: HexColor?
        let idleMotion: IdleMotion
        /// Apply `idleMotion` to this part only. Nil means the whole model.
        let idleMotionPart: String?
        let movingParts: [MovingPart]
        /// Chest only.
        let namedParts: ChestParts?

        var model: BuiltInModel? { BuiltInModel(rawValue: id) }
    }

    /// A part with its own pivot: wings and flippers flap, lids hinge open.
    struct MovingPart: Decodable, Hashable, Sendable {
        enum Motion: String, Decodable, Sendable { case flap, hinge }

        let part: String
        let motion: Motion
        /// Rotation axis, in the part's parent space.
        let axis: [Float]
        /// `flap`: swing either side of rest.
        let degrees: Float?
        /// `hinge`: the angle that opens it.
        let openDegrees: Float?
    }

    struct ChestParts: Decodable, Hashable, Sendable {
        let lid: String
        let base: String
        let innerGlow: String
        let runes: [String]
    }

    struct Sound: Identifiable, Decodable, Hashable, Sendable {
        let id: String
        let file: String
        let use: String
    }
}

/// The idle motions the app plays in code (the USDZ files carry no animation).
enum IdleMotion: String, Decodable, Hashable, Sendable {
    case spin, bob, wiggle, flap, none
}

/// The manifest's sound effects. Raw values are the manifest's sound ids.
enum SoundEffect: String, CaseIterable, Sendable {
    /// Each tap of Dig!
    case dig
    /// The chest lid opening.
    case chestCreak = "chest_creak"
    /// The treasure rising out of the chest.
    case revealSparkle = "reveal_sparkle"
    /// The last treasure of an adventure is found.
    case finaleFanfare = "finale_fanfare"

    // A treasure's own sound (`TreasureSound`), which the child picks when inventing it.
    case boing, toot, giggle, splash, ding, snore, chime, fanfare

    /// The sound a treasure's look plays. The raw values match.
    init(_ sound: TreasureSound) {
        self = switch sound {
        case .boing: .boing
        case .toot: .toot
        case .giggle: .giggle
        case .splash: .splash
        case .ding: .ding
        case .snore: .snore
        case .chime: .chime
        case .fanfare: .fanfare
        }
    }
}

/// An sRGB color written as `#RRGGBB`.
struct HexColor: Decodable, Hashable, Sendable {
    let red: Double, green: Double, blue: Double

    init?(_ hex: String) {
        let digits = hex.hasPrefix("#") ? hex.dropFirst() : Substring(hex)
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
        red = Double((value >> 16) & 0xFF) / 255
        green = Double((value >> 8) & 0xFF) / 255
        blue = Double(value & 0xFF) / 255
    }

    init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        guard let color = HexColor(raw) else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Bad color \(raw)"))
        }
        self = color
    }
}

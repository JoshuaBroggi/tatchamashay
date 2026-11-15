import Foundation

/// A compact sRGB color, including colors chosen with the system color picker.
struct PaintColor: Codable, Hashable, Sendable {
    let hex: UInt32

    init(hex: UInt32) { self.hex = min(hex, 0xFFFFFF) }

    init(_ color: TreasureColor) {
        let c = color.rgb
        self.init(red: c.red, green: c.green, blue: c.blue)
    }

    init(red: Double, green: Double, blue: Double) {
        func component(_ value: Double) -> UInt32 {
            guard value.isFinite else { return 0 }
            return UInt32((min(max(value, 0), 1) * 255).rounded())
        }
        hex = component(red) << 16 | component(green) << 8 | component(blue)
    }

    var rgb: (red: Double, green: Double, blue: Double) {
        (Double((hex >> 16) & 255) / 255, Double((hex >> 8) & 255) / 255, Double(hex & 255) / 255)
    }

    var name: String {
        TreasureColor.allCases.first { PaintColor($0) == self }?.displayName
            ?? String(format: "#%06X", hex)
    }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        let hex = try values.decode(UInt32.self, forKey: .hex)
        guard hex <= 0xFFFFFF else {
            throw DecodingError.dataCorruptedError(forKey: .hex, in: values, debugDescription: "Invalid sRGB color")
        }
        self.hex = hex
    }
}

enum TreasureTexture: String, Codable, CaseIterable, Identifiable, Sendable {
    case natural, velvet, stripes, speckles, metallic
    var id: String { rawValue }
    var name: String { rawValue.capitalized }
    var symbol: String {
        switch self {
        case .natural: "leaf"
        case .velvet: "cloud.fill"
        case .stripes: "line.3.horizontal"
        case .speckles: "circle.dotted"
        case .metallic: "sparkles"
        }
    }
    var detail: String {
        switch self {
        case .natural: "The model’s original finish"
        case .velvet: "Soft, fine-grained and matte"
        case .stripes: "Dark bands across your colors"
        case .speckles: "A scattering of tiny spots"
        case .metallic: "A smooth, gleaming shell"
        }
    }
}

/// Assignments refer to catalog region IDs, never mesh names or live entities.
struct TreasurePaint: Codable, Hashable, Sendable {
    private(set) var colors: [PaintColor]
    private(set) var assignments: [String: Int] = [:]
    var texture: TreasureTexture = .natural

    init(color: TreasureColor) { colors = [PaintColor(color)] }

    mutating func setColorCount(_ count: Int) {
        let count = min(max(count, 1), 3)
        let extra = [PaintColor(.sand), PaintColor(.charcoal)]
        while colors.count < count { colors.append(extra[colors.count - 1]) }
        colors = Array(colors.prefix(count))
        assignments = assignments.mapValues { min($0, count - 1) }
    }

    mutating func setColor(_ color: PaintColor, at index: Int) {
        guard colors.indices.contains(index) else { return }
        colors[index] = color
    }

    mutating func assign(_ index: Int, to region: String) {
        guard colors.indices.contains(index) else { return }
        assignments[region] = index
    }

    func colorIndex(for region: String) -> Int { assignments[region] ?? 0 }
    func color(for region: String) -> PaintColor { colors[colorIndex(for: region)] }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        colors = try values.decode([PaintColor].self, forKey: .colors)
        assignments = try values.decodeIfPresent([String: Int].self, forKey: .assignments) ?? [:]
        texture = try values.decodeIfPresent(TreasureTexture.self, forKey: .texture) ?? .natural
        guard (1...3).contains(colors.count), assignments.values.allSatisfy({ colors.indices.contains($0) }) else {
            throw DecodingError.dataCorruptedError(forKey: .colors, in: values, debugDescription: "Invalid paint palette or placement")
        }
    }
}

extension TreasureLook {
    var primaryPaintColor: PaintColor { paint?.colors.first ?? PaintColor(color) }
}

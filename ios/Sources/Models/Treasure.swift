import CoreLocation
import SwiftUI

/// A digital treasure hidden at a real-world spot. Anyone can create one; anyone who reaches it can collect it.
struct Treasure: Identifiable, Codable, Hashable {
    var id = UUID()
    var title: String
    var story: String
    var creatorName: String
    var latitude: Double
    var longitude: Double
    var model: TreasureModel
    var rarity: Rarity
    var createdAt = Date()

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var location: CLLocation {
        CLLocation(latitude: latitude, longitude: longitude)
    }
}

/// What 3D object appears when the chest opens: one of the built-in animated models, or a creator's own USDZ file.
enum TreasureModel: Codable, Hashable {
    case builtIn(BuiltInModel)
    case usdz(fileName: String)

    var displayName: String {
        switch self {
        case .builtIn(let model): model.displayName
        case .usdz: "Custom 3D model"
        }
    }
}

enum BuiltInModel: String, Codable, CaseIterable, Identifiable {
    case gem, doubloon, crown, potion, orb

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .gem: "Sea Gem"
        case .doubloon: "Gold Doubloon"
        case .crown: "Sunken Crown"
        case .potion: "Mermaid's Potion"
        case .orb: "Storm Orb"
        }
    }

    var symbol: String {
        switch self {
        case .gem: "diamond.fill"
        case .doubloon: "circle.circle.fill"
        case .crown: "crown.fill"
        case .potion: "flask.fill"
        case .orb: "globe.americas.fill"
        }
    }
}

enum Rarity: String, Codable, CaseIterable, Identifiable {
    case common, rare, legendary

    var id: String { rawValue }

    var label: String { rawValue.capitalized }

    var color: Color {
        switch self {
        case .common: Color(red: 0.55, green: 0.42, blue: 0.25)
        case .rare: Color(red: 0.15, green: 0.45, blue: 0.75)
        case .legendary: Color(red: 0.85, green: 0.6, blue: 0.1)
        }
    }
}

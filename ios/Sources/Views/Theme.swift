import MapKit
import SwiftUI

enum Palette {
    static let parchment = Color(red: 0.96, green: 0.89, blue: 0.72)
    static let parchmentDark = Color(red: 0.82, green: 0.70, blue: 0.48)
    static let ink = Color(red: 0.30, green: 0.18, blue: 0.08)
    static let blood = Color(red: 0.72, green: 0.12, blue: 0.10)
    static let wood = Color(red: 0.45, green: 0.27, blue: 0.12)
    static let gold = Color(red: 0.95, green: 0.75, blue: 0.25)
}

extension Font {
    static func pirate(_ size: CGFloat, weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }
}

/// A look for the map. The pirate map is the default; more looks (and the treasures that go with them) can be added here.
enum MapTheme: String, CaseIterable, Identifiable {
    case pirate, explorer, midnight

    var id: String { rawValue }

    var name: String {
        switch self {
        case .pirate: "Pirate Map"
        case .explorer: "Explorer"
        case .midnight: "Midnight Sea"
        }
    }

    var mapStyle: MapStyle {
        switch self {
        case .pirate:
            .standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false)
        case .explorer:
            .standard(elevation: .realistic, pointsOfInterest: .excludingAll)
        case .midnight:
            .imagery(elevation: .flat)
        }
    }

    /// Recolors the Apple map tiles: 1 keeps original color, 0 is grayscale.
    var saturation: Double {
        switch self {
        case .pirate: 0.15
        case .explorer: 1
        case .midnight: 0.4
        }
    }

    /// Multiplied over the map so it takes on the theme's paper or ink color.
    var tint: Color {
        switch self {
        case .pirate: Palette.parchment
        case .explorer: .white
        case .midnight: Color(red: 0.55, green: 0.7, blue: 0.95)
        }
    }

    /// Darkened, burnt-looking edges around the map.
    var vignette: Color {
        switch self {
        case .pirate: Palette.ink.opacity(0.55)
        case .explorer: .clear
        case .midnight: .black.opacity(0.6)
        }
    }
}

/// Parchment panel used for cards and sheets.
struct ParchmentBackground: View {
    var body: some View {
        ZStack {
            Palette.parchment
            RadialGradient(colors: [.clear, Palette.parchmentDark.opacity(0.7)], center: .center, startRadius: 80, endRadius: 420)
        }
    }
}

import SwiftUI
import UIKit

/// Colors from the 2.0 design mockups (docs/design/2.0/README.md on the design branch).
enum Palette {
    // Grounds, darkest first
    static let ground0 = Color(hex: 0x08110B)
    static let ground1 = Color(hex: 0x0E1A12)
    static let ground2 = Color(hex: 0x15271B)
    static let ground3 = Color(hex: 0x1F3826)

    // Borders
    static let borderQuiet = Color(hex: 0x2E5236)
    static let borderStrong = Color(hex: 0x4E7A4A)

    // Text
    static let textPrimary = Color(hex: 0xF8FAEF)
    static let textSecondary = Color(hex: 0xC3D5B6)
    static let textMuted = Color(hex: 0x86A07E)

    /// Main buttons and treasure.
    static let gold = Color(hex: 0xD4A24C)
    /// Magic, runes, hunt signals.
    static let rune = Color(hex: 0x7FE3F0)
    /// Anything a child made themselves.
    static let invented = Color(hex: 0xE9A3C9)

    /// Dark translucent panel over the map or scene.
    static let panel = Color(hex: 0x08110B).opacity(0.78)

    // The pirate map
    static let parchment = Color(hex: 0xEAD9AE)
    static let parchmentMid = Color(hex: 0xD9C08A)
    static let parchmentEdge = Color(hex: 0xA9864E)
    static let mapInk = Color(hex: 0x4A3418)
    static let mapRed = Color(hex: 0x7A1F12)
}

/// Fonts from the mockups. Barlow Condensed, Inter and IM Fell English are used when bundled;
/// until then the closest system fonts stand in.
enum Typeface {
    /// Barlow Condensed 800, uppercase, letter-spaced: headlines and buttons.
    static func headline(_ size: CGFloat) -> Font {
        custom("BarlowCondensed-ExtraBold", size) ?? .system(size: size, weight: .heavy).width(.condensed)
    }

    /// Inter 400 / 600: body text.
    static func body(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        let name = weight == .regular ? "Inter-Regular" : "Inter-SemiBold"
        return custom(name, size) ?? .system(size: size, weight: weight)
    }

    /// Small letter-spaced labels such as "TREASURE MAP".
    static func label(_ size: CGFloat = 12) -> Font { body(size, weight: .semibold) }

    /// IM Fell English: names written on the parchment map.
    static func mapScript(_ size: CGFloat) -> Font {
        custom("IMFellEnglish-Regular", size) ?? .system(size: size, design: .serif).italic()
    }

    private static func custom(_ name: String, _ size: CGFloat) -> Font? {
        UIFont(name: name, size: size) != nil ? .custom(name, size: size) : nil
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }

    init(_ color: TreasureColor) {
        let c = color.rgb
        self.init(red: c.red, green: c.green, blue: c.blue)
    }
}

// MARK: - Shared pieces

/// The main gold action button. Square corners, as in the mockups.
struct GoldButtonStyle: ButtonStyle {
    var height: CGFloat = 56
    var fontSize: CGFloat = 22

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Typeface.headline(fontSize))
            .tracking(2)
            .textCase(.uppercase)
            .frame(maxWidth: .infinity, minHeight: height)
            .background(Palette.gold.opacity(configuration.isPressed ? 0.8 : 1))
            .foregroundStyle(Palette.ground1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

/// The quiet bordered button next to a gold one.
struct OutlineButtonStyle: ButtonStyle {
    var height: CGFloat = 52

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Typeface.body(15, weight: .semibold))
            .frame(maxWidth: .infinity, minHeight: height)
            .background(Palette.ground0.opacity(configuration.isPressed ? 0.9 : 0.7))
            .overlay(Rectangle().stroke(Palette.borderStrong, lineWidth: 1))
            .foregroundStyle(Palette.textPrimary)
    }
}

/// A small letter-spaced overline, such as "TREASURE MAP".
struct Overline: View {
    let text: String
    var color: Color = Palette.gold

    var body: some View {
        Text(text.uppercased())
            .font(Typeface.label())
            .tracking(3)
            .foregroundStyle(color)
    }
}

/// A clear banner shown on every screen while Demo mode is on.
struct DemoBanner: View {
    var body: some View {
        Text("DEMO MODE · TESTING ONLY · NOT YOUR REAL CHEST")
            .font(Typeface.label(11))
            .tracking(1.5)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(Palette.invented)
            .foregroundStyle(Palette.ground1)
    }
}

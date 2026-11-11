import SwiftUI

/// Captain Tumblebeard, drawn from `guide.md`: round and short, rosy cheeks, a big curly sand beard
/// with a shell, a feather and a lost button in it, a floppy green patched hat, a too-long blue coat
/// with gold buttons, rain boots, a rolled map and a little brass spyglass. Nib, a tiny hermit crab
/// with a pink striped shell, peeks out of the hat brim and waves a claw.
///
/// Drawn on a 200 × 240 grid and scaled to `height`.
struct CaptainTumblebeardView: View {
    var height: CGFloat = 120
    /// Moves the mouth.
    var talking = false
    /// Bigger bounce and a dancing Nib: getting close, a reveal, the finale.
    var excited = false
    /// No bobbing, blinking or waving.
    var still = false

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: still && !talking)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            drawing(t: t)
                .frame(width: 200, height: 240)
                .scaleEffect(height / 240)
                .frame(width: height * 200 / 240, height: height)
        }
        .accessibilityElement()
        .accessibilityLabel("Captain Tumblebeard and Nib the hermit crab")
    }

    private func drawing(t: Double) -> some View {
        let bob = still ? 0 : sin(t * (excited ? 7 : 2.2)) * (excited ? 6 : 2.5)
        let mouth = talking ? 0.35 + 0.65 * abs(sin(t * 11)) : 0.15
        let blink = !still && t.truncatingRemainder(dividingBy: 4.2) < 0.14
        let wave = still ? 0 : sin(t * (excited ? 10 : 3.5)) * (excited ? 30 : 16)
        return ZStack {
            // Shadow
            Ellipse().fill(.black.opacity(0.25)).frame(width: 130, height: 14).position(x: 100, y: 234)
            Group {
                boots
                coat
                arms
                head(blink: blink)
                beard(mouth: mouth)
                hat
                nib(wave: wave)
            }
            .offset(y: -abs(bob))
        }
    }

    // MARK: Parts

    private static let skin = Color(hex: 0xF6C9A2)
    private static let cheek = Color(hex: 0xF08F8F)
    private static let beardSand = Color(hex: 0xE6C68A)
    private static let beardShade = Color(hex: 0xC9A266)
    private static let coatBlue = Color(hex: 0x2F6FB8)
    private static let coatShade = Color(hex: 0x24578F)
    private static let hatGreen = Color(hex: 0x3E9A57)
    private static let hatShade = Color(hex: 0x2D7742)
    private static let bootYellow = Color(hex: 0xF5C542)
    private static let ink = Color(hex: 0x2B1D10)
    private static let brass = Color(hex: 0xC99A3B)
    private static let nibPink = Color(hex: 0xF59BC1)
    private static let nibStripe = Color(hex: 0xFFE3EF)
    private static let nibBody = Color(hex: 0xF06B4F)

    private var boots: some View {
        ZStack {
            ForEach([72.0, 128.0], id: \.self) { x in
                UnevenRoundedRectangle(topLeadingRadius: 6, bottomLeadingRadius: 10,
                                       bottomTrailingRadius: 14, topTrailingRadius: 6)
                    .fill(Self.bootYellow)
                    .overlay(UnevenRoundedRectangle(topLeadingRadius: 6, bottomLeadingRadius: 10,
                                                    bottomTrailingRadius: 14, topTrailingRadius: 6)
                        .stroke(Self.ink.opacity(0.5), lineWidth: 2))
                    .frame(width: 36, height: 30)
                    .position(x: x, y: 218)
            }
        }
    }

    private var coat: some View {
        ZStack {
            // Too long: it nearly reaches the boots.
            UnevenRoundedRectangle(topLeadingRadius: 52, bottomLeadingRadius: 20,
                                   bottomTrailingRadius: 20, topTrailingRadius: 52)
                .fill(Self.coatBlue)
                .overlay(UnevenRoundedRectangle(topLeadingRadius: 52, bottomLeadingRadius: 20,
                                                bottomTrailingRadius: 20, topTrailingRadius: 52)
                    .stroke(Self.ink.opacity(0.5), lineWidth: 2.5))
                .frame(width: 136, height: 112)
                .position(x: 100, y: 152)
            // The coat's opening
            Rectangle().fill(Self.coatShade).frame(width: 4, height: 70).position(x: 100, y: 172)
            ForEach([150.0, 172.0, 194.0], id: \.self) { y in
                Circle().fill(Self.brass)
                    .overlay(Circle().stroke(Self.ink.opacity(0.5), lineWidth: 1.5))
                    .frame(width: 13, height: 13)
                    .position(x: 88, y: y)
                Circle().fill(Self.brass)
                    .overlay(Circle().stroke(Self.ink.opacity(0.5), lineWidth: 1.5))
                    .frame(width: 13, height: 13)
                    .position(x: 112, y: y)
            }
        }
    }

    private var arms: some View {
        ZStack {
            // Left arm with the rolled-up map
            Capsule().fill(Self.coatBlue).overlay(Capsule().stroke(Self.ink.opacity(0.5), lineWidth: 2))
                .frame(width: 26, height: 58).rotationEffect(.degrees(28)).position(x: 38, y: 160)
            Capsule().fill(Palette.parchment).overlay(Capsule().stroke(Palette.mapInk, lineWidth: 2))
                .frame(width: 16, height: 52).rotationEffect(.degrees(-20)).position(x: 26, y: 180)
            Rectangle().fill(Palette.mapRed).frame(width: 15, height: 4).rotationEffect(.degrees(-20))
                .position(x: 26, y: 180)
            Circle().fill(Self.skin).overlay(Circle().stroke(Self.ink.opacity(0.4), lineWidth: 1.5))
                .frame(width: 20, height: 20).position(x: 30, y: 184)
            // Right arm with the spyglass
            Capsule().fill(Self.coatBlue).overlay(Capsule().stroke(Self.ink.opacity(0.5), lineWidth: 2))
                .frame(width: 26, height: 58).rotationEffect(.degrees(-28)).position(x: 162, y: 160)
            Capsule().fill(Self.brass).overlay(Capsule().stroke(Self.ink.opacity(0.6), lineWidth: 2))
                .frame(width: 13, height: 44).rotationEffect(.degrees(35)).position(x: 180, y: 170)
            Capsule().fill(Self.brass.opacity(0.75)).frame(width: 17, height: 9).rotationEffect(.degrees(35))
                .position(x: 191, y: 154)
            Circle().fill(Self.skin).overlay(Circle().stroke(Self.ink.opacity(0.4), lineWidth: 1.5))
                .frame(width: 20, height: 20).position(x: 172, y: 182)
        }
    }

    private func head(blink: Bool) -> some View {
        ZStack {
            Circle().fill(Self.skin).overlay(Circle().stroke(Self.ink.opacity(0.4), lineWidth: 2))
                .frame(width: 84, height: 84).position(x: 100, y: 82)
            // Rosy cheeks
            Circle().fill(Self.cheek.opacity(0.75)).frame(width: 16, height: 16).position(x: 72, y: 92)
            Circle().fill(Self.cheek.opacity(0.75)).frame(width: 16, height: 16).position(x: 128, y: 92)
            // Eyes
            ForEach([84.0, 116.0], id: \.self) { x in
                if blink {
                    Capsule().fill(Self.ink).frame(width: 11, height: 3).position(x: x, y: 80)
                } else {
                    Circle().fill(Self.ink).frame(width: 11, height: 12).position(x: x, y: 80)
                    Circle().fill(.white).frame(width: 4, height: 4).position(x: x + 2, y: 77)
                }
            }
            // Bushy brows and a round nose
            Capsule().fill(Self.beardShade).frame(width: 18, height: 5).rotationEffect(.degrees(-8)).position(x: 83, y: 68)
            Capsule().fill(Self.beardShade).frame(width: 18, height: 5).rotationEffect(.degrees(8)).position(x: 117, y: 68)
            Circle().fill(Color(hex: 0xEDA987)).frame(width: 15, height: 13).position(x: 100, y: 92)
        }
    }

    private func beard(mouth: Double) -> some View {
        // Curls: big overlapping circles under the chin, darker ones behind for depth.
        let curls: [(CGFloat, CGFloat, CGFloat)] = [
            (66, 104, 26), (82, 116, 30), (100, 122, 32), (118, 116, 30), (134, 104, 26),
            (74, 132, 26), (100, 140, 30), (126, 132, 26), (88, 150, 22), (112, 150, 22), (100, 160, 18),
        ]
        return ZStack {
            ForEach(Array(curls.enumerated()), id: \.offset) { _, curl in
                Circle().fill(Self.beardShade).frame(width: curl.2 + 4, height: curl.2 + 4)
                    .position(x: curl.0, y: curl.1 + 2)
            }
            ForEach(Array(curls.enumerated()), id: \.offset) { _, curl in
                Circle().fill(Self.beardSand).frame(width: curl.2, height: curl.2).position(x: curl.0, y: curl.1)
                Circle().trim(from: 0.1, to: 0.6).stroke(Self.beardShade, lineWidth: 2)
                    .frame(width: curl.2 * 0.5, height: curl.2 * 0.5).position(x: curl.0, y: curl.1)
            }
            // Moustache and mouth
            Capsule().fill(Self.beardShade).frame(width: 22, height: 9).rotationEffect(.degrees(12)).position(x: 90, y: 102)
            Capsule().fill(Self.beardShade).frame(width: 22, height: 9).rotationEffect(.degrees(-12)).position(x: 110, y: 102)
            Ellipse().fill(Color(hex: 0x7A2E2E))
                .frame(width: 18, height: 4 + 12 * mouth)
                .position(x: 100, y: 112 + 3 * mouth)
            // Tangled in the beard: a little shell, a feather and a lost button.
            Circle().trim(from: 0, to: 0.5).fill(Self.nibPink).frame(width: 13, height: 13)
                .rotationEffect(.degrees(180)).position(x: 76, y: 138)
            Ellipse().fill(Palette.mapRed).frame(width: 7, height: 24).rotationEffect(.degrees(30))
                .position(x: 128, y: 140)
            Circle().fill(Color(hex: 0x5DA3C8)).overlay(
                HStack(spacing: 2) { Circle().fill(Self.ink).frame(width: 2); Circle().fill(Self.ink).frame(width: 2) }
            ).frame(width: 10, height: 10).position(x: 104, y: 154)
        }
    }

    private var hat: some View {
        ZStack {
            // Floppy crown
            Path { p in
                p.move(to: CGPoint(x: 52, y: 58))
                p.addCurve(to: CGPoint(x: 112, y: 10), control1: CGPoint(x: 52, y: 22), control2: CGPoint(x: 82, y: 6))
                p.addCurve(to: CGPoint(x: 150, y: 46), control1: CGPoint(x: 140, y: 14), control2: CGPoint(x: 160, y: 30))
                p.addLine(to: CGPoint(x: 148, y: 58))
                p.closeSubpath()
            }
            .fill(Self.hatGreen)
            .overlay(Path { p in
                p.move(to: CGPoint(x: 52, y: 58))
                p.addCurve(to: CGPoint(x: 112, y: 10), control1: CGPoint(x: 52, y: 22), control2: CGPoint(x: 82, y: 6))
                p.addCurve(to: CGPoint(x: 150, y: 46), control1: CGPoint(x: 140, y: 14), control2: CGPoint(x: 160, y: 30))
            }.stroke(Self.ink.opacity(0.5), lineWidth: 2.5))
            // The patch, with stitches
            Rectangle().fill(Color(hex: 0x8BC34A)).frame(width: 20, height: 16).rotationEffect(.degrees(-10))
                .position(x: 84, y: 34)
            Rectangle().stroke(Self.ink.opacity(0.6), style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                .frame(width: 20, height: 16).rotationEffect(.degrees(-10)).position(x: 84, y: 34)
            // Brim, drooping on one side
            Capsule().fill(Self.hatShade).overlay(Capsule().stroke(Self.ink.opacity(0.5), lineWidth: 2.5))
                .frame(width: 132, height: 22).rotationEffect(.degrees(-6)).position(x: 98, y: 58)
        }
    }

    private func nib(wave: Double) -> some View {
        ZStack {
            // Eye stalks
            ForEach([146.0, 156.0], id: \.self) { x in
                Rectangle().fill(Self.nibBody).frame(width: 2.5, height: 10).position(x: x, y: 40)
                Circle().fill(.white).overlay(Circle().fill(Self.ink).frame(width: 3.5)).frame(width: 7, height: 7)
                    .position(x: x, y: 35)
            }
            // Body and the waving claw
            Ellipse().fill(Self.nibBody).frame(width: 22, height: 12).position(x: 151, y: 48)
            Circle().trim(from: 0.05, to: 0.85).fill(Self.nibBody).frame(width: 11, height: 11)
                .rotationEffect(.degrees(-60 + wave), anchor: .bottom).position(x: 166, y: 38)
            // Pink striped shell
            Circle().fill(Self.nibPink).overlay(Circle().stroke(Self.ink.opacity(0.5), lineWidth: 1.5))
                .frame(width: 24, height: 24).position(x: 136, y: 44)
            ForEach(0..<3, id: \.self) { i in
                Capsule().fill(Self.nibStripe).frame(width: 18 - CGFloat(i) * 4, height: 3)
                    .rotationEffect(.degrees(-30)).position(x: 136, y: 38 + CGFloat(i) * 6)
            }
        }
        .offset(y: wave > 20 ? -2 : 0)
    }
}

#Preview {
    VStack {
        CaptainTumblebeardView(height: 280, talking: true)
        CaptainTumblebeardView(height: 100, excited: true)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Palette.ground1)
}

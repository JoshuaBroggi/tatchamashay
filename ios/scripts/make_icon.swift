#!/usr/bin/env swift
// Draws the app icon: a red X on a parchment map inside a forest-green frame.
// Usage: swift scripts/make_icon.swift [output.png]
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let output = CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : "Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png"

func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
}

let space = CGColorSpace(name: CGColorSpace.sRGB)!
// No alpha channel: the App Store rejects icons with transparency.
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                    space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
let full = CGRect(x: 0, y: 0, width: size, height: size)

// Forest background: deep green, lighter toward the middle.
let forest = CGGradient(colorsSpace: space, colors: [color(0x2E5236), color(0x15271B), color(0x08110B)] as CFArray,
                        locations: [0, 0.6, 1])!
ctx.drawRadialGradient(forest, startCenter: CGPoint(x: 512, y: 560), startRadius: 0,
                       endCenter: CGPoint(x: 512, y: 512), endRadius: 760, options: .drawsAfterEndLocation)

// Leaves around the edge.
var seed: UInt64 = 42
func random() -> CGFloat {
    seed = seed &* 6364136223846793005 &+ 1442695040888963407
    return CGFloat((seed >> 33) % 10_000) / 10_000
}
for i in 0..<44 {
    let angle = CGFloat(i) / 44 * 2 * .pi + random() * 0.1
    let radius = 520 + random() * 110
    let centre = CGPoint(x: 512 + cos(angle) * radius, y: 512 + sin(angle) * radius)
    ctx.saveGState()
    ctx.translateBy(x: centre.x, y: centre.y)
    ctx.rotate(by: angle + .pi / 2 + (random() - 0.5))
    let length = 150 + random() * 90, width = 54 + random() * 30
    let leaf = CGMutablePath()
    leaf.move(to: CGPoint(x: 0, y: -length / 2))
    leaf.addQuadCurve(to: CGPoint(x: 0, y: length / 2), control: CGPoint(x: width, y: 0))
    leaf.addQuadCurve(to: CGPoint(x: 0, y: -length / 2), control: CGPoint(x: -width, y: 0))
    ctx.addPath(leaf)
    ctx.setFillColor(color([0x1F3826, 0x2E5236, 0x4E7A4A][i % 3]))
    ctx.fillPath()
    ctx.restoreGState()
}

// Parchment map, slightly tilted, with a wobbly torn edge.
ctx.saveGState()
ctx.translateBy(x: 512, y: 512)
ctx.rotate(by: -0.06)
let half: CGFloat = 330
let parchment = CGMutablePath()
let steps = 72
for i in 0...steps {
    let t = CGFloat(i) / CGFloat(steps) * 2 * .pi
    // A rounded square (superellipse) with a little wobble.
    let c = cos(t), s = sin(t)
    let r = half * (1 + (random() - 0.5) * 0.035)
    let p = CGPoint(x: r * (c < 0 ? -1 : 1) * pow(abs(c), 0.42), y: r * (s < 0 ? -1 : 1) * pow(abs(s), 0.42))
    if i == 0 { parchment.move(to: p) } else { parchment.addLine(to: p) }
}
parchment.closeSubpath()
ctx.setShadow(offset: CGSize(width: 0, height: -18), blur: 40, color: color(0x000000, 0.55))
ctx.addPath(parchment)
ctx.setFillColor(color(0xEAD9AE))
ctx.fillPath()
ctx.setShadow(offset: .zero, blur: 0, color: nil)
ctx.addPath(parchment)
ctx.clip()
let paper = CGGradient(colorsSpace: space, colors: [color(0xEAD9AE), color(0xD9C08A), color(0xA9864E)] as CFArray,
                       locations: [0, 0.7, 1])!
ctx.drawRadialGradient(paper, startCenter: .zero, startRadius: 0, endCenter: .zero, endRadius: 470,
                       options: .drawsAfterEndLocation)

// Dashed trail curling toward the X.
let trail = CGMutablePath()
trail.move(to: CGPoint(x: -300, y: -250))
trail.addCurve(to: CGPoint(x: -40, y: -20), control1: CGPoint(x: -120, y: -300), control2: CGPoint(x: -250, y: -40))
ctx.addPath(trail)
ctx.setStrokeColor(color(0x4A3418, 0.8))
ctx.setLineWidth(16)
ctx.setLineCap(.round)
ctx.setLineDash(phase: 0, lengths: [34, 34])
ctx.strokePath()
ctx.setLineDash(phase: 0, lengths: [])

// The red X, drawn as two brush strokes.
func stroke(from a: CGPoint, to b: CGPoint, bend: CGFloat) {
    let path = CGMutablePath()
    path.move(to: a)
    path.addQuadCurve(to: b, control: CGPoint(x: (a.x + b.x) / 2 + bend, y: (a.y + b.y) / 2 + bend))
    ctx.addPath(path)
    ctx.setStrokeColor(color(0x7A1F12))
    ctx.setLineWidth(96)
    ctx.setLineCap(.round)
    ctx.strokePath()
    ctx.addPath(path)
    ctx.setStrokeColor(color(0xB5351F))
    ctx.setLineWidth(64)
    ctx.strokePath()
}
stroke(from: CGPoint(x: -150, y: 190), to: CGPoint(x: 190, y: -170), bend: 18)
stroke(from: CGPoint(x: -160, y: -160), to: CGPoint(x: 180, y: 180), bend: -18)
ctx.restoreGState()

// A gold coin glint in the corner of the map.
ctx.setFillColor(color(0xD4A24C))
ctx.fillEllipse(in: CGRect(x: 690, y: 250, width: 96, height: 96))
ctx.setFillColor(color(0xF2D58A))
ctx.fillEllipse(in: CGRect(x: 708, y: 280, width: 44, height: 44))

let image = ctx.makeImage()!
let url = URL(fileURLWithPath: output)
let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("Could not write \(output)") }
print("Wrote \(output)")

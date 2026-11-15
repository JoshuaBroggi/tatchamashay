import RealityKit
import UIKit

/// Small, deterministic surface maps, generated once per finish and shared by model clones.
/// No downloads or work in the frame loop.
@MainActor
enum PaintSurface {
    private static var textures: [TreasureTexture: TextureResource] = [:]
    private static var previews: [TreasureTexture: UIImage] = [:]

    static func texture(_ finish: TreasureTexture) -> TextureResource? {
        guard finish == .velvet || finish == .stripes || finish == .speckles else { return nil }
        if let cached = textures[finish] { return cached }
        guard let cgImage = preview(finish).cgImage,
              let texture = try? TextureResource(image: cgImage, options: .init(semantic: .color)) else { return nil }
        textures[finish] = texture
        return texture
    }

    static func preview(_ finish: TreasureTexture) -> UIImage {
        if let cached = previews[finish] { return cached }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: CGSize(width: 128, height: 128), format: format).image { renderer in
            let context = renderer.cgContext
            UIColor.white.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 128, height: 128))
            switch finish {
            case .stripes:
                UIColor(white: 0.33, alpha: 1).setFill()
                for y in stride(from: 0, to: 128, by: 32) {
                    context.fill(CGRect(x: 0, y: y, width: 128, height: 12))
                }
            case .speckles, .velvet:
                var seed: UInt64 = 73
                func random() -> CGFloat {
                    seed = (seed &* 1_664_525 &+ 1_013_904_223) % 4_294_967_296
                    return CGFloat(seed) / 4_294_967_296
                }
                let count = finish == .velvet ? 2_000 : 160
                for _ in 0..<count {
                    let x = random() * 128, y = random() * 128
                    let size: CGFloat = finish == .velvet ? 1 : 2 + random() * 3
                    UIColor(white: finish == .velvet ? 0.72 : 0.3, alpha: 1).setFill()
                    context.fillEllipse(in: CGRect(x: x, y: y, width: size, height: size))
                }
            case .metallic:
                for x in 0..<128 {
                    let brightness = 0.45 + 0.55 * abs(sin(Double(x) / 128 * .pi))
                    UIColor(white: brightness, alpha: 1).setFill()
                    context.fill(CGRect(x: x, y: 0, width: 1, height: 128))
                }
            case .natural: break
            }
        }
        previews[finish] = image
        return image
    }
}

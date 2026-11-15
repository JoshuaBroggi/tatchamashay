import UIKit
import XCTest

final class TreasurePreviewUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    @MainActor
    func testSpiderPreviewRendersSelectedColors() throws {
        let app = XCUIApplication()
        #if targetEnvironment(simulator)
        app.launchArguments = ["-resetFamily", "-huntFixture", "-silent"]
        #else
        // Device verification uses the existing family and only edits an unsaved creation draft.
        app.launchArguments = ["-silent"]
        #endif
        app.launch()
        app.tabBars.buttons["Make"].tap()
        app.buttons["makeTreasure"].tap()
        let next = app.buttons["inventNext"]
        XCTAssertTrue(next.waitForExistence(timeout: 5))
        next.tap()
        let spider = app.buttons["object-spider"]
        if !spider.isHittable { app.scrollViews.firstMatch.swipeUp() }
        spider.tap()
        next.tap()
        XCTAssertTrue(app.staticTexts["What color is it?"].waitForExistence(timeout: 5))

        // Inspect the rendered pixels, since a correctly tinted material can still look white.
        for color in ["Red", "Blue", "Red"] {
            let swatch = app.buttons["color-\(color.lowercased())"]
            let ready = expectation(for: NSPredicate(format: "hittable == true"), evaluatedWith: swatch)
            wait(for: [ready], timeout: 10)
            swatch.tap()
            let preview = app.descendants(matching: .any)["treasureModel"].firstMatch
            let loaded = expectation(for: NSPredicate(format: "value == 'usdz'"), evaluatedWith: preview)
            wait(for: [loaded], timeout: 10)
            let rendered = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                (try? Self.coloredFraction(in: preview.screenshot(), color: color)) ?? 0 > 0.015
            }, object: nil)
            let result = XCTWaiter.wait(for: [rendered], timeout: 10)
            let screenshot = preview.screenshot()
            let attachment = XCTAttachment(screenshot: screenshot)
            attachment.name = "spider-\(color.lowercased())"
            attachment.lifetime = .keepAlways
            add(attachment)
            let fraction = try Self.coloredFraction(in: screenshot, color: color)
            XCTAssertEqual(result, .completed, "\(color) should visibly color the spider; colored fraction: \(fraction)")
        }
    }

    /// Ignore the dark background and white highlights; count visibly red or blue surface pixels.
    private static func coloredFraction(in screenshot: XCUIScreenshot, color: String) throws -> Double {
        let image = try XCTUnwrap(screenshot.image.cgImage)
        let size = 128
        var pixels = [UInt8](repeating: 0, count: size * size * 4)
        return pixels.withUnsafeMutableBytes { bytes -> Double in
            guard let context = CGContext(data: bytes.baseAddress, width: size, height: size,
                                          bitsPerComponent: 8, bytesPerRow: size * 4,
                                          space: CGColorSpaceCreateDeviceRGB(),
                                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return 0 }
            context.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))
            let values = bytes.bindMemory(to: UInt8.self)
            var colored = 0
            for offset in stride(from: 0, to: values.count, by: 4) {
                let red = Double(values[offset]) / 255
                let green = Double(values[offset + 1]) / 255
                let blue = Double(values[offset + 2]) / 255
                let chosen = color == "Red" ? red : blue
                let other = color == "Red" ? blue : red
                if chosen > 0.3 && chosen > green * 1.3 && chosen > other * 1.3 { colored += 1 }
            }
            return Double(colored) / Double(size * size)
        }
    }
}

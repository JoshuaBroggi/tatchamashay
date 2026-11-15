import UIKit
import XCTest

final class RestoredBeastUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    @MainActor
    func testAllThreeCreaturesAreSelectableAndRepaint() throws {
        let app = XCUIApplication()
        #if targetEnvironment(simulator)
        app.launchArguments = ["-resetFamily", "-huntFixture", "-silent"]
        #else
        // Only touch an unsaved creation draft when checking the installed family app.
        app.launchArguments = ["-silent"]
        #endif
        app.launch()
        ParentTestJourney.openParents(in: app)
        app.buttons["hideTreasure"].tap()
        for name in ["Demogorgon", "Demodog", "Vine Dog"] {
            app.buttons["beastModel"].tap()
            let choice = app.buttons[name]
            XCTAssertTrue(choice.waitForExistence(timeout: 5), "\(name) must be in the actual Beast picker")
            choice.tap()
            let preview = app.otherElements["treasureModel"]
            let loaded = expectation(for: NSPredicate(format: "value == 'usdz'"), evaluatedWith: preview)
            wait(for: [loaded], timeout: 15)
            app.buttons["beastColor"].tap()
            for color in ["red", "blue"] {
                let swatch = app.buttons["paintSwatch-\(color)"]
                reveal(swatch, in: app, upwards: true)
                swatch.tap()
                let painted = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                    (try? Self.coloredFraction(preview.screenshot(), color: color)) ?? 0 > 0.015
                }, object: nil)
                let result = XCTWaiter.wait(for: [painted], timeout: 10)
                let screenshot = preview.screenshot()
                let attachment = XCTAttachment(screenshot: screenshot)
                attachment.name = "\(name)-\(color)"
                attachment.lifetime = .keepAlways
                add(attachment)
                XCTAssertEqual(result, .completed, "\(name) should visibly turn \(color)")
            }
            let done = app.buttons["paintDone"]
            reveal(done, in: app, upwards: false)
            done.tap()
        }
        app.buttons["Cancel"].tap()
        app.buttons["Discard changes"].tap()
        XCTAssertTrue(app.buttons["hideTreasure"].waitForExistence(timeout: 5))
    }

    @MainActor
    private func reveal(_ element: XCUIElement, in app: XCUIApplication, upwards: Bool) {
        for _ in 0..<8 {
            if element.isHittable { return }
            if upwards { app.scrollViews.firstMatch.swipeUp() } else { app.scrollViews.firstMatch.swipeDown() }
        }
        XCTAssertTrue(element.isHittable)
    }

    private static func coloredFraction(_ screenshot: XCUIScreenshot, color: String) throws -> Double {
        let image = try XCTUnwrap(screenshot.image.cgImage)
        let size = 128
        var pixels = [UInt8](repeating: 0, count: size * size * 4)
        return pixels.withUnsafeMutableBytes { bytes in
            guard let context = CGContext(data: bytes.baseAddress, width: size, height: size, bitsPerComponent: 8,
                                          bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(),
                                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return 0 }
            context.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))
            let values = bytes.bindMemory(to: UInt8.self)
            var count = 0
            for offset in stride(from: 0, to: values.count, by: 4) {
                let red = Double(values[offset]) / 255, green = Double(values[offset + 1]) / 255
                let blue = Double(values[offset + 2]) / 255
                let chosen = color == "red" ? red : blue
                let other = color == "red" ? blue : red
                if chosen > 0.3 && chosen > green * 1.3 && chosen > other * 1.3 { count += 1 }
            }
            return Double(count) / Double(size * size)
        }
    }
}

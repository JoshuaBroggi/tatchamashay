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
            let loaded = expectation(for: NSPredicate(format: "value == 'usdz' AND label == %@", name), evaluatedWith: preview)
            wait(for: [loaded], timeout: 15)
            let paintButton = app.buttons["beastColor"]
            let ready = expectation(for: NSPredicate(format: "hittable == true"), evaluatedWith: paintButton)
            wait(for: [ready], timeout: 10)
            paintButton.tap()
            if !app.buttons["paintDone"].waitForExistence(timeout: 5) {
                let attachment = XCTAttachment(screenshot: app.screenshot())
                attachment.name = "\(name)-paint-controls-missing"
                attachment.lifetime = .keepAlways
                add(attachment)
                XCTFail("The paint controls did not open for \(name)")
                return
            }
            for color in ["red", "blue"] {
                let swatch = app.buttons["paintSwatch-\(color)"]
                reveal(swatch, in: app, upwards: true)
                swatch.tap()
                let painted = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                    // A front-facing four-legged creature occupies much less of the preview
                    // than the upright Demogorgon; white or unchanged bodies still score zero.
                    (try? Self.coloredFraction(Self.previewImage(in: app), color: color)) ?? 0 > 0.003
                }, object: nil)
                let result = XCTWaiter.wait(for: [painted], timeout: 10)
                let attachment = XCTAttachment(image: try Self.previewImage(in: app))
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
        let scroll = app.scrollViews.containing(.button, identifier: "paintDone").firstMatch
        for _ in 0..<16 {
            if element.exists && element.isHittable { return }
            var moveUp = upwards
            if element.exists && !element.frame.isEmpty {
                moveUp = element.frame.midY > scroll.frame.midY
            }
            let start = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: moveUp ? 0.75 : 0.25))
            let end = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: moveUp ? 0.35 : 0.65))
            start.press(forDuration: 0.05, thenDragTo: end)
        }
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "unreachable-paint-control"
        attachment.lifetime = .keepAlways
        add(attachment)
        XCTAssertTrue(element.isHittable)
    }

    @MainActor
    private static func previewImage(in app: XCUIApplication) throws -> UIImage {
        // RealityKit can expose an empty accessibility frame after changing models. Capture the
        // visible 220-point preview below the navigation bar from the full screen instead.
        let screenshot = app.screenshot().image
        let image = try XCTUnwrap(screenshot.cgImage)
        let scale = CGFloat(image.width) / app.frame.width
        let frame = CGRect(x: 0, y: app.navigationBars["Create a beast"].frame.maxY * scale,
                           width: CGFloat(image.width), height: 220 * scale)
        return UIImage(cgImage: try XCTUnwrap(image.cropping(to: frame)))
    }

    private static func coloredFraction(_ screenshot: UIImage, color: String) throws -> Double {
        let image = try XCTUnwrap(screenshot.cgImage)
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

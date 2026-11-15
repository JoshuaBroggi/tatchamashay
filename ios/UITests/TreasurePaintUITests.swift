import XCTest

final class TreasurePaintUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    @MainActor
    func testThreeColorsPlacementTextureAndPersistentPreview() {
        let app = XCUIApplication()
        app.launchArguments = ["-resetFamily", "-huntFixture", "-silent"]
        app.launch()
        ParentTestJourney.openParents(in: app)
        let settings = app.buttons["grownUpSettings"]
        if !settings.isHittable { app.collectionViews.firstMatch.swipeUp() }
        settings.tap()
        let motion = app.switches["motionToggle"]
        XCTAssertTrue(motion.waitForExistence(timeout: 5))
        if motion.value as? String != "1" {
            motion.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        }
        XCTAssertEqual(motion.value as? String, "1")
        app.navigationBars["Settings"].buttons.firstMatch.tap()
        if !app.buttons["hideTreasure"].isHittable { app.collectionViews.firstMatch.swipeDown() }
        app.buttons["hideTreasure"].tap()
        app.buttons["beastModel"].tap()
        app.buttons["Silky the Spider"].tap()
        app.buttons["beastSparkles"].tap()
        app.buttons["None"].tap()
        let preview = app.otherElements["treasureModel"]
        XCTAssertTrue(preview.waitForExistence(timeout: 8))
        let loaded = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "usdz"), object: preview)
        XCTAssertEqual(XCTWaiter.wait(for: [loaded], timeout: 15), .completed)
        // The USDZ can be loaded before the first GPU frame is visible on a cold simulator.
        for _ in 0..<30 {
            if !brightBounds(preview.screenshot()).isNull { break }
            Thread.sleep(forTimeInterval: 0.25)
        }
        XCTAssertFalse(brightBounds(preview.screenshot()).isNull)
        preview.pinch(withScale: 1.4, velocity: 1)
        preview.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.5))
            .press(forDuration: 0.1, thenDragTo: preview.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.5)))
        let beforeImage = settledScreenshot(preview)
        let before = XCTAttachment(screenshot: beforeImage)
        before.name = "spider-zoom-before-paint"
        before.lifetime = .keepAlways
        add(before)

        app.buttons["beastColor"].tap()
        app.segmentedControls["paintColorCount"].buttons["3 colors"].tap()
        app.buttons["paintPalette-Cobalt"].tap()
        let afterImage = settledScreenshot(preview)
        let after = XCTAttachment(screenshot: afterImage)
        after.name = "spider-zoom-after-paint"
        after.lifetime = .keepAlways
        add(after)
        // Eyes and sparkles retain their white materials. Their screen-space bounds detect a
        // camera reset without comparing the deliberately changed body color.
        let beforeBounds = brightBounds(beforeImage)
        let afterBounds = brightBounds(afterImage)
        XCTAssertFalse(beforeBounds.isNull)
        XCTAssertFalse(afterBounds.isNull)
        XCTAssertEqual(beforeBounds.minX, afterBounds.minX, accuracy: 3)
        XCTAssertEqual(beforeBounds.minY, afterBounds.minY, accuracy: 3)
        XCTAssertEqual(beforeBounds.width, afterBounds.width, accuracy: 3)
        XCTAssertEqual(beforeBounds.height, afterBounds.height, accuracy: 3)

        app.buttons["paintStep1"].tap()
        let abdomen = app.buttons["paintRegion-abdomen"]
        app.buttons["paintPot2"].press(forDuration: 1, thenDragTo: abdomen)
        XCTAssertTrue((abdomen.value as? String)?.contains("Color 3") == true)
        app.buttons["paintPot1"].tap()
        let head = app.buttons["paintRegion-head"]
        head.tap()
        XCTAssertTrue((head.value as? String)?.contains("Color 2") == true)
        let placement = XCTAttachment(screenshot: app.screenshot())
        placement.name = "spider-painted-areas"
        placement.lifetime = .keepAlways
        add(placement)

        app.scrollViews.firstMatch.swipeDown()
        app.buttons["paintStep2"].tap()
        let stripes = app.buttons["paintTexture-stripes"]
        reveal(stripes, in: app)
        stripes.tap()
        let texture = XCTAttachment(screenshot: app.screenshot())
        texture.name = "spider-striped-finish"
        texture.lifetime = .keepAlways
        add(texture)
        let done = app.buttons["paintNext"]
        reveal(done, in: app)
        done.tap()
        XCTAssertTrue(app.buttons["beastColor"].waitForExistence(timeout: 5))
        app.buttons["beastColor"].tap()
        XCTAssertEqual(app.segmentedControls["paintColorCount"].buttons["3 colors"].isSelected, true)
        app.buttons["paintStep1"].tap()
        XCTAssertTrue((app.buttons["paintRegion-head"].value as? String)?.contains("Color 2") == true)
        app.buttons["Cancel"].tap()
        app.buttons["Discard changes"].tap()
        XCTAssertTrue(app.buttons["hideTreasure"].waitForExistence(timeout: 5))
    }

    @MainActor
    private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<5 {
            if element.isHittable { return }
            app.scrollViews.firstMatch.swipeUp()
        }
        XCTAssertTrue(element.isHittable)
    }

    @MainActor
    private func settledScreenshot(_ element: XCUIElement) -> XCUIScreenshot {
        var previous = CGRect.null
        var result = element.screenshot()
        for _ in 0..<20 {
            result = element.screenshot()
            let bounds = brightBounds(result)
            if !bounds.isNull && bounds == previous { return result }
            previous = bounds
            Thread.sleep(forTimeInterval: 0.3)
        }
        return result
    }

    @MainActor
    private func brightBounds(_ screenshot: XCUIScreenshot) -> CGRect {
        let image = screenshot.image
        let width = Int(image.size.width), height = Int(image.size.height)
        var bytes = [UInt8](repeating: 0, count: width * height * 4)
        guard let cgImage = image.cgImage,
              let context = CGContext(data: &bytes, width: width, height: height, bitsPerComponent: 8,
                                      bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return .null }
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        var bounds = CGRect.null
        for y in 0..<height {
            for x in 0..<width {
                let i = (y * width + x) * 4
                if bytes[i] > 235 && bytes[i + 1] > 235 && bytes[i + 2] > 235 {
                    bounds = bounds.union(CGRect(x: x, y: y, width: 1, height: 1))
                }
            }
        }
        return bounds
    }
}

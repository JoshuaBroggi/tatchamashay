import XCTest

/// Run explicitly after installing on a physical phone. Never seeds or resets its family.
final class InstalledCharacterMapUITests: XCTestCase {
    @MainActor
    func testInstalledMapWithExistingCollection() throws {
        #if targetEnvironment(simulator)
        throw XCTSkip("This journey uses the existing family on the connected physical iPhone.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = []
        app.launch()
        XCTAssertTrue(app.buttons["mapSettings"].waitForExistence(timeout: 15))
        let originalProgress = app.staticTexts["huntProgress"].exists ? app.staticTexts["huntProgress"].label : nil
        app.buttons["mapSettings"].tap()
        let mode = app.switches["show3DMap"]
        let wasEnabled = mode.value as? String == "1"
        if !wasEnabled { tapSwitch(mode) }
        let flat = app.switches["flatCharacterMap"]
        XCTAssertTrue(flat.waitForExistence(timeout: 5))
        let wasFlat = flat.value as? String == "1"
        if wasFlat { tapSwitch(flat) }
        app.buttons["Done"].tap()
        XCTAssertTrue(app.staticTexts["characterMapMode"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["characterMapMode"].label.contains("3D exploration"))

        app.tabBars.buttons["My Chest"].tap()
        let collected = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "collectedTreasure-")).firstMatch
        XCTAssertTrue(collected.waitForExistence(timeout: 10))
        collected.tap()
        let select = app.buttons["beThisCharacter"]
        if select.exists {
            if !select.isHittable { app.swipeUp() }
            select.tap()
            XCTAssertTrue(app.buttons["transformationDone"].waitForExistence(timeout: 10))
            app.buttons["transformationDone"].tap()
        } else {
            XCTAssertTrue(app.staticTexts["activeCharacter"].exists)
            app.tabBars.buttons["Map"].tap()
        }
        XCTAssertTrue(app.buttons["mapSettings"].waitForExistence(timeout: 10))
        app.buttons["mapSettings"].tap()
        tapSwitch(app.switches["flatCharacterMap"])
        app.buttons["Done"].tap()
        XCTAssertTrue(app.staticTexts["characterMapMode"].label.contains("2D exploration"))

        // Restore presentation preferences; collecting and parent controls are never used here.
        app.buttons["mapSettings"].tap()
        if !wasFlat { tapSwitch(app.switches["flatCharacterMap"]) }
        if !wasEnabled { tapSwitch(app.switches["show3DMap"]) }
        app.buttons["Done"].tap()
        if let originalProgress { XCTAssertEqual(app.staticTexts["huntProgress"].label, originalProgress) }
        if !wasEnabled { XCTAssertFalse(app.staticTexts["characterMapMode"].exists) }
        #endif
    }

    @MainActor
    private func tapSwitch(_ element: XCUIElement) {
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).tap()
    }
}

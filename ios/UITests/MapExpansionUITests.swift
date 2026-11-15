import XCTest

final class MapExpansionUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    #if targetEnvironment(simulator)
    @MainActor
    func testExpandedMapKeepsTreasureSelectionAndProgress() {
        let app = XCUIApplication()
        app.launchArguments = ["-huntFixture", "-silent"]
        app.launch()
        let allow = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons["Allow While Using App"]
        if allow.waitForExistence(timeout: 3) { allow.tap() }
        XCTAssertTrue(app.buttons["chooseTreasure"].waitForExistence(timeout: 10))
        app.buttons["chooseTreasure"].tap()
        let choices = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "chooseTreasure-"))
        XCTAssertEqual(choices.count, 3)
        let secondMarkerID = choices.element(boundBy: 1).identifier
            .replacingOccurrences(of: "chooseTreasure-", with: "treasureMarker-")
        choices.element(boundBy: 0).tap()

        expandMap(in: app)
        app.buttons["showAllTreasures"].tap()
        let marker = app.buttons[secondMarkerID]
        XCTAssertTrue(marker.waitForExistence(timeout: 5))
        marker.tap()
        app.buttons["closeFullScreenMap"].tap()

        XCTAssertTrue(app.buttons["chooseTreasure"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["huntHint"].label, "By the little bridge")
        XCTAssertEqual(app.staticTexts["huntProgress"].label, "0 of 3 found")
        XCTAssertTrue(app.tabBars.buttons["Map"].isHittable)
        expandMap(in: app)
        app.maps.firstMatch.swipeLeft()
        app.buttons["showAllTreasures"].tap()
        app.buttons["closeFullScreenMap"].tap()
        XCTAssertTrue(app.staticTexts["huntHint"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["huntHint"].label, "By the little bridge")
    }

    @MainActor
    func testEmptyMapCanExpandAndClose() {
        let app = XCUIApplication()
        app.launchArguments = ["-resetFamily", "-silent"]
        app.launch()
        ParentTestJourney.createFamily(in: app)
        expandMap(in: app)
        XCTAssertFalse(app.buttons["showAllTreasures"].exists)
        app.buttons["closeFullScreenMap"].tap()
        XCTAssertTrue(app.staticTexts["No treasure is hidden yet."].waitForExistence(timeout: 5))
    }
    #else
    /// Runs only against the installed family, without fixtures, location overrides or saved writes.
    @MainActor
    func testInstalledMapExpansionPreservesFamily() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.buttons["expandMap"].waitForExistence(timeout: 15))
        let progress = app.staticTexts["huntProgress"]
        let progressBefore = progress.exists ? progress.label : nil
        expandMap(in: app)
        if app.buttons["showAllTreasures"].exists { app.buttons["showAllTreasures"].tap() }
        app.buttons["closeFullScreenMap"].tap()
        XCTAssertTrue(app.buttons["expandMap"].waitForExistence(timeout: 5))
        if let progressBefore { XCTAssertEqual(progress.label, progressBefore) }
        XCTAssertTrue(app.tabBars.buttons["Map"].isHittable)
    }
    #endif

    @MainActor
    private func expandMap(in app: XCUIApplication) {
        let embeddedHeight = app.maps.firstMatch.frame.height
        app.buttons["expandMap"].tap()
        XCTAssertTrue(app.buttons["closeFullScreenMap"].waitForExistence(timeout: 5))
        let expandedHeight = app.maps.firstMatch.frame.height
        XCTAssertGreaterThan(expandedHeight, embeddedHeight + 100)
        XCTAssertGreaterThanOrEqual(expandedHeight, app.frame.height * 0.9)
        XCTAssertFalse(app.buttons["chooseTreasure"].isHittable)
        XCTAssertFalse(app.buttons["parents"].isHittable)
        XCTAssertFalse(app.tabBars.buttons["Map"].isHittable)
        let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screenshot.name = "Full-screen treasure map"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}

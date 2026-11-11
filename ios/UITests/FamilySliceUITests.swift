import CoreLocation
import XCTest

/// Milestone 1 end to end: a parent hides one treasure on a reviewed spot, the child walks up, digs
/// (twice, fast), opens the chest, and the treasure is still in the chest after the app restarts.
///
/// Start the simulator at the spot first, e.g. `xcrun simctl location booted set 37.7694,-122.4862`.
/// Set SCREENSHOT_DIR (via TEST_RUNNER_SCREENSHOT_DIR) to also save screenshots as PNG files.
final class FamilySliceUITests: XCTestCase {
    private var app: XCUIApplication!
    private var step = 0

    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testHideFindOpenAndKeepAfterRestart() throws {
        app = XCUIApplication()
        app.launchArguments = ["-resetFamily"]
        app.launch()

        // Setup
        let fields = app.textFields
        fields.element(boundBy: 0).tap()
        fields.element(boundBy: 0).typeText("Dad")
        fields.element(boundBy: 1).tap()
        fields.element(boundBy: 1).typeText("Captain Emmanuel")
        snap("welcome")
        app.buttons["startAdventure"].tap()

        // The hunt starts empty
        XCTAssertTrue(app.staticTexts["No treasure is hidden yet."].waitForExistence(timeout: 5))

        // Parent hides a treasure
        app.tabBars.buttons["Grown-ups"].tap()
        app.buttons["hideTreasure"].tap()
        let nameField = app.textFields["Funny name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
        nameField.tap()
        nameField.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 20) + "Wobbly Crown")
        snap("choose-treasure")
        app.buttons["chooseSpot"].tap()

        let map = app.maps.firstMatch
        XCTAssertTrue(map.waitForExistence(timeout: 5))
        sleep(3)
        let zoomHint = app.staticTexts["Zoom in until you can see paths, roads and water."]
        var pinches = 0
        while zoomHint.exists && pinches < 8 {
            map.pinch(withScale: 3, velocity: 3)
            sleep(1)
            pinches += 1
        }
        XCTAssertFalse(zoomHint.exists, "the map should be detailed enough to review")

        let hideHere = app.buttons["hideHere"]
        XCTAssertFalse(hideHere.isEnabled, "can't hide before the parent confirms the spot")
        let clue = app.textFields.matching(NSPredicate(format: "placeholderValue BEGINSWITH 'Clue'")).firstMatch
        clue.tap()
        clue.typeText("By the big tree\n")
        let checked = app.switches["spotChecked"]
        if !checked.isHittable { app.swipeUp() }
        checked.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        snap("review-spot")
        XCTAssertTrue(hideHere.isEnabled)
        hideHere.tap()
        XCTAssertTrue(app.staticTexts["Wobbly Crown"].waitForExistence(timeout: 5))
        snap("parent-list")

        // Far from the spot: no Dig!
        let here = CLLocation(latitude: 37.7694, longitude: -122.4862)
        XCUIDevice.shared.location = XCUILocation(location: CLLocation(latitude: 37.7724, longitude: -122.4862))
        app.tabBars.buttons["Map"].tap()
        let dig = app.buttons["dig"]
        sleep(4)
        XCTAssertFalse(dig.exists, "no Dig! 330 m away")
        snap("hunt-far")

        // Walk up to the spot
        XCUIDevice.shared.location = XCUILocation(location: here)
        XCTAssertTrue(dig.waitForExistence(timeout: 15))
        snap("hunt-dig")
        dig.doubleTap()

        // The reveal
        let open = app.buttons["openChest"]
        XCTAssertTrue(open.waitForExistence(timeout: 5))
        snap("chest-sealed")
        open.tap()
        sleep(1)
        snap("chest-igniting")
        let done = app.buttons["revealDone"]
        XCTAssertTrue(done.waitForExistence(timeout: 5))
        sleep(2)
        snap("chest-revealed")
        done.tap()
        XCTAssertTrue(app.buttons["Play again"].waitForExistence(timeout: 5))
        snap("finale")

        app.tabBars.buttons["My Chest"].tap()
        XCTAssertTrue(app.staticTexts["1 treasure"].waitForExistence(timeout: 5), "double tap gives one treasure")
        snap("chest-before-restart")

        // Restart
        app.terminate()
        app.launchArguments = []
        app.launch()
        app.tabBars.buttons["My Chest"].tap()
        XCTAssertTrue(app.staticTexts["1 treasure"].waitForExistence(timeout: 5), "still there after restart")
        XCTAssertTrue(app.staticTexts["Wobbly Crown"].exists)
        snap("chest-after-restart")
        app.staticTexts["Wobbly Crown"].tap()
        sleep(2)
        snap("chest-detail")

        // Replay: found again, still one treasure
        app.tabBars.buttons["Map"].tap()
        app.buttons["Play again"].tap()
        // The simulator sends nothing new for a fixed location, so the last fix goes stale:
        // the map turns foggy and offers We found it instead of trusting an old position.
        XCTAssertTrue(app.staticTexts["The map's a bit foggy here, matey!"].waitForExistence(timeout: 15))
        XCTAssertFalse(dig.exists, "a stale location never shows Dig!")
        snap("stale-location-foggy")
        // A fresh fix a few meters away, like real GPS jitter, brings Dig! back.
        XCUIDevice.shared.location = XCUILocation(location: CLLocation(latitude: 37.76943, longitude: -122.48621))
        XCTAssertTrue(dig.waitForExistence(timeout: 15))
        dig.tap()
        XCTAssertTrue(app.buttons["openChest"].waitForExistence(timeout: 5))
        app.buttons["openChest"].tap()
        XCTAssertTrue(app.buttons["revealDone"].waitForExistence(timeout: 5))
        sleep(2)
        snap("found-again")
        app.buttons["revealDone"].tap()
        app.tabBars.buttons["My Chest"].tap()
        app.navigationBars.buttons.firstMatch.tap()   // back from the detail page
        XCTAssertTrue(app.staticTexts["1 treasure"].waitForExistence(timeout: 5), "a replay never duplicates")
    }

    @MainActor
    private func snap(_ name: String) {
        step += 1
        let shot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let dir = ProcessInfo.processInfo.environment["SCREENSHOT_DIR"] {
            let url = URL(fileURLWithPath: dir).appendingPathComponent(String(format: "%02d-%@.png", step, name))
            try? shot.pngRepresentation.write(to: url)
        }
    }
}

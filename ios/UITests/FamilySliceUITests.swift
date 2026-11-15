import CoreLocation
import XCTest

/// Milestone 1 end to end: a parent hides one treasure on a reviewed spot, the child walks up, digs
/// (twice, fast), opens the chest, and the treasure stays collected after the app restarts.
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
        app.launchArguments = ["-resetFamily", "-silent"]
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
        app.buttons["parents"].tap()
        let gateAnswer = app.textFields["parentGateAnswer"]
        XCTAssertTrue(gateAnswer.waitForExistence(timeout: 5))
        gateAnswer.tap()
        gateAnswer.typeText("25")
        app.buttons["parentGateContinue"].tap()
        app.buttons["hideTreasure"].tap()
        let nameField = app.textFields["beastName"]
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
        let clue = app.textFields["spotHint"]
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
        app.buttons["parentDone"].tap()

        // Far from the spot: no Dig!
        let here = CLLocation(latitude: 37.7694, longitude: -122.4862)
        XCUIDevice.shared.location = XCUILocation(location: CLLocation(latitude: 37.7724, longitude: -122.4862))
        app.tabBars.buttons["Map"].tap()
        app.buttons["chooseTreasure"].tap()
        app.buttons["Choose Wobbly Crown"].tap()
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
        let model = app.descendants(matching: .any)["treasureModel"]
        let real = expectation(for: NSPredicate(format: "value == 'usdz'"), evaluatedWith: model)
        wait(for: [real], timeout: 10)   // the real USDZ model, not the drawn stand-in
        sleep(2)
        snap("chest-revealed")
        done.tap()
        XCTAssertTrue(app.staticTexts["huntComplete"].waitForExistence(timeout: 5))
        snap("finale")

        app.tabBars.buttons["My Chest"].tap()
        XCTAssertTrue(app.staticTexts["1 treasure"].waitForExistence(timeout: 5), "double tap gives one treasure")
        snap("chest-before-restart")

        // Restart
        app.terminate()
        app.launchArguments = ["-silent"]
        app.launch()
        app.tabBars.buttons["My Chest"].tap()
        XCTAssertTrue(app.staticTexts["1 treasure"].waitForExistence(timeout: 5), "still there after restart")
        XCTAssertTrue(app.staticTexts["Wobbly Crown"].exists)
        snap("chest-after-restart")
        app.staticTexts["Wobbly Crown"].tap()
        sleep(2)
        snap("chest-detail")

        // Returning to the map never resets collection status or offers a parent-player turn.
        app.tabBars.buttons["Map"].tap()
        XCTAssertTrue(app.staticTexts["huntComplete"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["dig"].exists)
        XCTAssertFalse(app.buttons["chooseTreasure"].exists)
        XCTAssertFalse(app.buttons["Play again"].exists)

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

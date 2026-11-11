import XCTest

/// Milestone 2's parent setup end to end: pick a place, say what the pirate calls you, choose a
/// starter adventure, give each of its 3 chests a treasure, a clue and a reviewed spot, save, and
/// see **Get ready** reach Ready!. Then the grown-ups' settings.
///
/// Start the simulator at the park first, e.g. `xcrun simctl location booted set 37.7694,-122.4862`.
/// Set SCREENSHOT_DIR (via TEST_RUNNER_SCREENSHOT_DIR) to also save screenshots as PNG files.
final class ParentSetupUITests: XCTestCase {
    private var app: XCUIApplication!
    private var step = 0

    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testSetUpAThreeChestAdventure() throws {
        app = XCUIApplication()
        app.launchArguments = ["-resetFamily", "-silent"]
        app.launch()

        let fields = app.textFields
        fields.element(boundBy: 0).tap()
        fields.element(boundBy: 0).typeText("Josh")
        fields.element(boundBy: 1).tap()
        fields.element(boundBy: 1).typeText("Captain Emmanuel")
        app.buttons["startAdventure"].tap()

        app.tabBars.buttons["Grown-ups"].tap()
        XCTAssertTrue(app.buttons["setupHunt"].waitForExistence(timeout: 5))
        snap("grown-ups")
        app.buttons["setupHunt"].tap()

        // 1. Where are you playing?
        let map = app.maps.firstMatch
        XCTAssertTrue(map.waitForExistence(timeout: 5))
        sleep(3)
        zoomIn(map, until: app.staticTexts["Zoom in to your park or backyard."])
        let placeName = app.textFields["placeName"]
        placeName.tap()
        placeName.typeText("Golden Gate Park\n")
        snap("place")
        app.buttons["playHere"].tap()

        // 2. What does your pirate call you?
        XCTAssertTrue(app.buttons["call-Dad"].waitForExistence(timeout: 5))
        app.buttons["call-Dad"].tap()
        snap("grown-up")
        app.buttons["grownUpNext"].tap()

        // 3. Pick an adventure
        let story = app.buttons["story-moon-pebbles"]
        XCTAssertTrue(story.waitForExistence(timeout: 5))
        snap("adventure")
        story.tap()

        // 4. Three chests: treasure, clue, spot
        XCTAssertTrue(app.buttons["chest-1"].waitForExistence(timeout: 5))
        snap("chests")
        let saveHunt = app.buttons["saveHunt"]
        XCTAssertFalse(saveHunt.isEnabled, "can't save before every chest is hidden")

        let picks: [(model: String, blank: String)] = [("clam", "big tree"), ("star-compass", "red slide"),
                                                       ("doubloon", "swing high")]
        for (i, pick) in picks.enumerated() {
            app.buttons["chest-\(i + 1)"].tap()
            let model = app.buttons["model-\(pick.model)"]
            XCTAssertTrue(model.waitForExistence(timeout: 5))
            model.tap()
            let blank = app.textFields["clueBlank"]
            if !blank.isHittable { app.collectionViews.firstMatch.swipeUp() }
            blank.tap()
            blank.typeText(pick.blank + "\n")
            if i == 0 { snap("chest-treasure-and-clue") }
            let pickSpot = app.buttons["pickSpot"]
            if !pickSpot.isHittable { app.collectionViews.firstMatch.swipeUp() }
            pickSpot.tap()

            let spotMap = app.maps.firstMatch
            XCTAssertTrue(spotMap.waitForExistence(timeout: 5))
            sleep(2)
            // Each chest a little way from the last.
            spotMap.swipeLeft(velocity: .slow)
            zoomIn(spotMap, until: app.staticTexts["Zoom in until you can see paths, roads and water."])
            let hideHere = app.buttons["hideHere"]
            XCTAssertFalse(hideHere.isEnabled, "can't hide before the parent confirms the spot")
            let checked = app.switches["spotChecked"]
            if !checked.isHittable { app.collectionViews.firstMatch.swipeUp() }
            checked.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
            if i == 0 { snap("chest-spot") }
            XCTAssertTrue(hideHere.isEnabled)
            hideHere.tap()

            let done = app.buttons["chestDone"]
            XCTAssertTrue(done.waitForExistence(timeout: 5))
            if !done.isHittable { app.collectionViews.firstMatch.swipeUp() }
            XCTAssertTrue(done.isEnabled, "chest \(i + 1) has a treasure, a clue and a spot")
            done.tap()
            XCTAssertTrue(app.buttons["chest-\(i + 1)"].waitForExistence(timeout: 5))
            XCTAssertEqual(app.buttons["chest-\(i + 1)"].value as? String, "done")
        }
        snap("chests-done")
        XCTAssertTrue(saveHunt.isEnabled)
        saveHunt.tap()

        // 5. Get ready
        XCTAssertTrue(app.staticTexts["readyState"].waitForExistence(timeout: 30), "everything loads on the phone")
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS 'Without signal the map may be blank'"))
            .firstMatch.exists, "the map warning is always shown")
        snap("get-ready")
        app.buttons["getReadyDone"].tap()

        XCTAssertTrue(app.staticTexts["The Sleepy Blue Pebble"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["The Giggly Gold Pebble"].exists)
        XCTAssertTrue(app.staticTexts["The Twinkly Silver Pebble"].exists)
        XCTAssertTrue(app.staticTexts["Clue: Look near the big tree."].exists)
        XCTAssertTrue(app.staticTexts["The Three Moon Pebbles"].exists)
        snap("hunt-saved")

        // Settings
        app.buttons["grownUpSettings"].tap()
        let sound = app.switches["soundToggle"]
        XCTAssertTrue(sound.waitForExistence(timeout: 5))
        XCTAssertEqual(app.textFields["settingsGrownUpName"].value as? String, "Dad")
        sound.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        XCTAssertEqual(sound.value as? String, "0")
        app.buttons["addPirate"].tap()
        let pirateName = app.textFields["pirateNameField"]
        XCTAssertTrue(pirateName.waitForExistence(timeout: 5))
        pirateName.tap()
        pirateName.typeText("Captain Mia")
        app.buttons["savePirate"].tap()
        XCTAssertTrue(app.staticTexts["Captain Mia"].waitForExistence(timeout: 5))
        snap("settings")
        sound.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()   // leave sound on
    }

    @MainActor
    private func zoomIn(_ map: XCUIElement, until hint: XCUIElement) {
        var pinches = 0
        while hint.exists && pinches < 8 {
            map.pinch(withScale: 3, velocity: 3)
            sleep(1)
            pinches += 1
        }
        XCTAssertFalse(hint.exists, "the map should be detailed enough to review")
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
            let url = URL(fileURLWithPath: dir).appendingPathComponent(String(format: "setup-%02d-%@.png", step, name))
            try? shot.pngRepresentation.write(to: url)
        }
    }
}

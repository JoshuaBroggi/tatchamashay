import XCTest

/// First launch supports keyboard submission and the map button, including on compact iPhones.
final class WelcomeUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    @MainActor
    func testSaveCrewWhileEditingAndKeepAfterRestart() {
        let app = XCUIApplication()
        app.launchArguments = ["-resetFamily", "-silent"]
        app.launch()

        let parent = app.textFields.element(boundBy: 0)
        let pirate = app.textFields.element(boundBy: 1)
        let openMap = app.buttons["startAdventure"]
        XCTAssertTrue(parent.waitForExistence(timeout: 5))
        XCTAssertFalse(openMap.isEnabled, "both names are required")
        parent.tap()
        parent.typeText("Aunt Jo")
        XCTAssertFalse(openMap.isEnabled, "a pirate name is required too")
        pirate.tap()
        pirate.typeText("Captain Pearl")

        let keyboard = app.keyboards.firstMatch
        XCTAssertTrue(keyboard.exists)
        let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screenshot.name = "crew-setup-while-editing"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        XCTAssertTrue(openMap.isEnabled)
        XCTAssertTrue(openMap.isHittable)
        XCTAssertLessThanOrEqual(openMap.frame.maxY, app.frame.maxY)
        // Headless Simulator can park the software keyboard offscreen.
        if keyboard.frame.minY < app.frame.maxY {
            XCTAssertLessThanOrEqual(openMap.frame.maxY, keyboard.frame.minY,
                                     "the keyboard must not cover the save button")
        }
        // The whole visible button must respond, including the space beside its title.
        openMap.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        XCTAssertTrue(app.tabBars.buttons["Map"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Captain Pearl"].exists)
        XCTAssertTrue(app.staticTexts["No treasure is hidden yet."].exists)

        app.terminate()
        app.launchArguments = ["-silent"]
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["Map"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Captain Pearl"].exists)
        XCTAssertFalse(app.buttons["startAdventure"].exists)
    }

    @MainActor
    func testKeyboardNextAndDoneSaveCrew() {
        let app = XCUIApplication()
        app.launchArguments = ["-resetFamily", "-silent"]
        app.launch()
        let parent = app.textFields.element(boundBy: 0)
        XCTAssertTrue(parent.waitForExistence(timeout: 5))
        parent.tap()
        parent.typeText("Dad")
        let next = app.keyboards.buttons.matching(NSPredicate(format: "label ==[c] %@", "Next")).firstMatch
        XCTAssertTrue(next.exists, "Next should focus the pirate name")
        next.tap()
        app.textFields.element(boundBy: 1).typeText("Captain E")
        let done = app.keyboards.buttons.matching(NSPredicate(format: "label ==[c] %@", "Done")).firstMatch
        XCTAssertTrue(done.exists, "Done should save both names and open the map")
        done.tap()
        XCTAssertTrue(app.tabBars.buttons["Map"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Captain E"].exists)
    }
}

import CoreLocation
import XCTest

/// Milestone 2, child creation: the child invents a treasure one picture at a time, chooses to hide
/// it for the grown-up, the grown-up confirms the spot on a detailed map, then finds it. A new
/// version afterwards leaves the found copy in the chest alone.
///
/// Start the simulator at the spot first, e.g. `xcrun simctl location booted set 37.7694,-122.4862`.
/// Set SCREENSHOT_DIR (via TEST_RUNNER_SCREENSHOT_DIR) to also save screenshots as PNG files.
final class ChildCreationUITests: XCTestCase {
    private var app: XCUIApplication!
    private var step = 0

    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testInventHideConfirmAndFind() throws {
        let here = CLLocation(latitude: 37.7694, longitude: -122.4862)
        XCUIDevice.shared.location = XCUILocation(location: here)
        app = XCUIApplication()
        app.launchArguments = ["-resetFamily", "-silent"]
        app.launch()

        let fields = app.textFields
        fields.element(boundBy: 0).tap()
        fields.element(boundBy: 0).typeText("Dad")
        fields.element(boundBy: 1).tap()
        fields.element(boundBy: 1).typeText("Captain Emmanuel")
        app.buttons["startAdventure"].tap()

        // The treasure maker
        app.tabBars.buttons["Make"].tap()
        XCTAssertTrue(app.staticTexts["Created by Captain Emmanuel"].waitForExistence(timeout: 5))
        snap("create-home")
        app.buttons["makeTreasure"].tap()

        let next = app.buttons["inventNext"]
        XCTAssertTrue(app.descendants(matching: .any)["inventStart"].waitForExistence(timeout: 5))
        snap("create-start")
        next.tap()

        // One choice per screen; Next waits for it
        XCTAssertFalse(next.isEnabled, "pick a treasure first")
        app.buttons["object-star-compass"].tap()
        snap("create-object")
        next.tap()

        app.buttons["color-blue"].tap()
        let model = app.descendants(matching: .any)["treasureModel"]
        wait(for: [expectation(for: NSPredicate(format: "value == 'usdz'"), evaluatedWith: model)], timeout: 10)
        sleep(1)
        snap("create-color")
        next.tap()

        app.buttons["sparkles-rainbow"].tap()
        wait(for: [expectation(for: NSPredicate(format: "value == 'usdz'"), evaluatedWith: model)], timeout: 10)
        sleep(1)
        snap("create-sparkles")
        next.tap()

        XCTAssertFalse(next.isEnabled, "pick a name first")
        app.buttons["word-Snorty"].tap()
        app.buttons["word-Muffin"].tap()
        XCTAssertEqual(app.staticTexts["inventName"].label, "Snorty Muffin")
        snap("create-name")
        next.tap()

        app.buttons["sound-snore"].tap()
        snap("create-sound")
        next.tap()

        // The grown-up types the story
        let storyField = app.descendants(matching: .any)["inventStory"]
        XCTAssertTrue(storyField.waitForExistence(timeout: 5))
        storyField.tap()
        storyField.typeText("It fell off the moon and it snores all night.")
        snap("create-story")
        next.tap()

        // Hide it for Dad
        let hideForDad = app.buttons["hideForGrownUp"]
        XCTAssertTrue(hideForDad.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Snorty Muffin"].exists)
        snap("create-hide")
        hideForDad.tap()

        // Grown-up's turn
        XCTAssertTrue(app.descendants(matching: .any)["grownUpsTurn"].waitForExistence(timeout: 5))
        snap("create-grown-ups-turn")
        next.tap()

        // The grown-up confirms the spot on a detailed map
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
        XCTAssertFalse(hideHere.isEnabled, "nothing is hidden before the grown-up confirms the spot")
        let blank = app.textFields["spotBlank"]
        blank.tap()
        blank.typeText("back step\n")
        let checked = app.switches["spotChecked"]
        if !checked.isHittable { app.swipeUp() }
        checked.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        XCTAssertTrue(hideHere.isEnabled)
        snap("create-confirm-spot")
        hideHere.tap()

        XCTAssertTrue(app.descendants(matching: .any)["inventHidden"].waitForExistence(timeout: 5))
        snap("create-hidden")
        app.buttons["inventDone"].tap()
        XCTAssertTrue(app.staticTexts["Hidden for your grown-up"].waitForExistence(timeout: 5))
        snap("create-list-hidden")

        // The grown-up finds it
        XCUIDevice.shared.location = XCUILocation(location: CLLocation(latitude: 37.7724, longitude: -122.4862))
        app.tabBars.buttons["Map"].tap()
        sleep(2)
        XCUIDevice.shared.location = XCUILocation(location: here)
        let dig = app.buttons["dig"]
        XCTAssertTrue(dig.waitForExistence(timeout: 15))
        snap("create-hunt-dig")
        dig.tap()
        let open = app.buttons["openChest"]
        XCTAssertTrue(open.waitForExistence(timeout: 5))
        open.tap()
        let done = app.buttons["revealDone"]
        XCTAssertTrue(done.waitForExistence(timeout: 5))
        sleep(2)
        snap("create-found")
        done.tap()

        app.tabBars.buttons["My Chest"].tap()
        XCTAssertTrue(app.staticTexts["Snorty Muffin"].waitForExistence(timeout: 5))

        // A new version later: the found copy doesn't change
        app.tabBars.buttons["Make"].tap()
        XCTAssertTrue(app.staticTexts["Found!"].waitForExistence(timeout: 5))
        app.buttons["editInvention"].firstMatch.tap()
        XCTAssertTrue(app.buttons["object-star-compass"].waitForExistence(timeout: 5))
        next.tap()   // color
        next.tap()   // sparkles
        next.tap()   // name
        app.buttons["clearName"].tap()
        app.buttons["word-Sleepy"].tap()
        app.buttons["word-Sprout"].tap()
        snap("create-edit-name")
        next.tap()   // sound
        next.tap()   // story
        next.tap()   // hide
        XCTAssertTrue(hideForDad.waitForExistence(timeout: 5))
        hideForDad.tap()   // saves version 2
        XCTAssertTrue(app.descendants(matching: .any)["grownUpsTurn"].waitForExistence(timeout: 5))
        app.buttons["inventClose"].tap()
        XCTAssertTrue(app.staticTexts["Sleepy Sprout"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Found! · version 2"].exists)
        snap("create-list-version-2")

        app.tabBars.buttons["My Chest"].tap()
        XCTAssertTrue(app.staticTexts["Snorty Muffin"].waitForExistence(timeout: 5), "the chest keeps the look it was found with")
        XCTAssertFalse(app.staticTexts["Sleepy Sprout"].exists)
        snap("create-chest-unchanged")
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
            let url = URL(fileURLWithPath: dir).appendingPathComponent(String(format: "c%02d-%@.png", step, name))
            try? shot.pngRepresentation.write(to: url)
        }
    }
}

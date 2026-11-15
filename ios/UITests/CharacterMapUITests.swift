import CoreLocation
import XCTest

final class CharacterMapUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    @MainActor
    func testModeSwitchAndFallbackPreserveTheSelectedHunt() {
        let app = launchFixture()
        choose("Star Compass", in: app)
        XCTAssertFalse(app.staticTexts["characterMapMode"].exists)
        setMode(true, in: app)
        XCTAssertTrue(app.staticTexts["characterMapMode"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["characterMapMode"].label.contains("3D exploration"))
        XCTAssertEqual(app.staticTexts["huntHint"].label, "Look near the big tree")
        XCTAssertEqual(app.staticTexts["huntProgress"].label, "0 of 3 found")
        attach("Optional 3D street map")

        app.buttons["expandMap"].tap()
        XCTAssertTrue(app.buttons["closeFullScreenMap"].waitForExistence(timeout: 5))
        app.buttons["closeFullScreenMap"].tap()
        app.buttons["mapSettings"].tap()
        app.switches["flatCharacterMap"].coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).tap()
        app.buttons["Done"].tap()
        XCTAssertTrue(app.staticTexts["characterMapMode"].label.contains("2D exploration"))
        XCTAssertEqual(app.staticTexts["huntHint"].label, "Look near the big tree")
        setMode(false, in: app)
        XCTAssertFalse(app.staticTexts["characterMapMode"].exists)
        XCTAssertEqual(app.staticTexts["huntHint"].label, "Look near the big tree")
        XCTAssertEqual(app.staticTexts["huntProgress"].label, "0 of 3 found")
    }

    @MainActor
    func testAutoCharacterManualFlameAndRelaunch() {
        let app = launchFixture()
        setMode(true, in: app)
        collect("Star Compass", in: app)
        collect("Captain Squawk", in: app)
        app.tabBars.buttons["My Chest"].tap()
        XCTAssertTrue(app.staticTexts["2 treasures"].waitForExistence(timeout: 5))
        app.staticTexts["Star Compass"].firstMatch.tap()
        let select = app.buttons["beThisCharacter"]
        if !select.isHittable { app.swipeUp() }
        XCTAssertTrue(select.waitForExistence(timeout: 5))
        select.tap()
        XCTAssertTrue(app.staticTexts["transformationName"].waitForExistence(timeout: 8))
        XCTAssertEqual(app.staticTexts["transformationName"].label, "You're now Star Compass!")
        attach("Saved character transformation")
        app.buttons["transformationDone"].tap()
        XCTAssertTrue(app.staticTexts["characterMapMode"].waitForExistence(timeout: 5))

        app.terminate()
        app.launchArguments = ["-silent"]
        app.launch()
        XCTAssertTrue(app.staticTexts["characterMapMode"].waitForExistence(timeout: 10))
        app.tabBars.buttons["My Chest"].tap()
        app.staticTexts["Star Compass"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["activeCharacter"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["beThisCharacter"].exists)
        app.tabBars.buttons["Map"].tap()
        setMode(false, in: app)
        app.tabBars.buttons["My Chest"].tap()
        XCTAssertFalse(app.staticTexts["activeCharacter"].exists)
        XCTAssertFalse(app.buttons["beThisCharacter"].exists)
    }

    @MainActor
    private func launchFixture() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-huntFixture", "-silent"]
        app.launch()
        let allow = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons["Allow While Using App"]
        if allow.waitForExistence(timeout: 2) { allow.tap() }
        XCUIDevice.shared.location = XCUILocation(location: CLLocation(latitude: 37.7694, longitude: -122.4862))
        XCTAssertTrue(app.buttons["mapSettings"].waitForExistence(timeout: 10))
        return app
    }

    @MainActor
    private func setMode(_ on: Bool, in app: XCUIApplication) {
        app.buttons["mapSettings"].tap()
        let toggle = app.switches["show3DMap"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 5))
        if (toggle.value as? String == "1") != on {
            toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).tap()
        }
        XCTAssertEqual(toggle.value as? String, on ? "1" : "0")
        if on { XCTAssertTrue(app.switches["flatCharacterMap"].waitForExistence(timeout: 3)) }
        app.buttons["Done"].tap()
    }

    @MainActor
    private func choose(_ name: String, in app: XCUIApplication) {
        app.buttons["chooseTreasure"].tap()
        let button = app.buttons["Choose \(name)"]
        XCTAssertTrue(button.waitForExistence(timeout: 5))
        button.tap()
    }

    @MainActor
    private func collect(_ name: String, in app: XCUIApplication) {
        choose(name, in: app)
        app.buttons["weFoundIt"].tap()
        app.buttons["Yes, we found it"].tap()
        XCTAssertTrue(app.buttons["openChest"].waitForExistence(timeout: 8))
        app.buttons["openChest"].tap()
        XCTAssertTrue(app.buttons["revealDone"].waitForExistence(timeout: 12))
        app.buttons["revealDone"].tap()
        XCTAssertTrue(app.staticTexts["transformationName"].waitForExistence(timeout: 8))
        XCTAssertEqual(app.staticTexts["transformationName"].label, "You're now \(name)!")
        app.buttons["transformationDone"].tap()
        XCTAssertTrue(app.buttons["chooseTreasure"].waitForExistence(timeout: 5))
    }

    @MainActor
    private func attach(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

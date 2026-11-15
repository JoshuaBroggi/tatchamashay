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
        let preview = app.descendants(matching: .any)["transformationCharacter"].firstMatch
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "Ready"), object: preview)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 10), .completed)
        let model = app.descendants(matching: .any)["treasureModel"].firstMatch
        let rendered = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "usdz"), object: model)
        XCTAssertEqual(XCTWaiter.wait(for: [rendered], timeout: 10), .completed)
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
    func testVineDogWalksAndDemogorgonCanBeSelected() async throws {
        let app = launchFixture(characters: true)
        setMode(true, in: app)
        app.tabBars.buttons["My Chest"].tap()
        app.staticTexts["Vine Dog"].firstMatch.tap()
        let select = app.buttons["beThisCharacter"]
        if !select.isHittable { app.swipeUp() }
        select.tap()
        XCTAssertTrue(app.buttons["transformationDone"].waitForExistence(timeout: 5))
        app.buttons["transformationDone"].tap()
        let marker = app.descendants(matching: .any)["mapCharacter"].firstMatch
        XCTAssertTrue(marker.waitForExistence(timeout: 10))
        XCTAssertEqual(marker.label, "Playing as Vine Dog")
        // Two trusted, walking-speed movements start the gait; stationary updates then stop it.
        for north in [0.0, 4, 8] {
            XCUIDevice.shared.location = XCUILocation(location: CLLocation(
                coordinate: CLLocationCoordinate2D(latitude: 37.7694 + north / 111_320, longitude: -122.4862),
                altitude: 0, horizontalAccuracy: 5, verticalAccuracy: 5, timestamp: .now))
            try await Task.sleep(for: .seconds(2))
        }
        XCTAssertEqual(marker.value as? String, "Walking")
        attach("Vine Dog walking on the 3D map")
        try await Task.sleep(for: .seconds(3))
        XCTAssertEqual(marker.value as? String, "Standing")
        app.tabBars.buttons["My Chest"].tap()
        // Leave the previously selected detail before choosing the second discovery.
        if app.navigationBars.buttons.firstMatch.exists { app.navigationBars.buttons.firstMatch.tap() }
        app.staticTexts["Demogorgon"].firstMatch.tap()
        if !app.buttons["beThisCharacter"].isHittable { app.swipeUp() }
        app.buttons["beThisCharacter"].tap()
        XCTAssertTrue(app.staticTexts["transformationName"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["transformationName"].label, "You're now Demogorgon!")
        app.buttons["transformationDone"].tap()
        XCTAssertEqual(marker.label, "Playing as Demogorgon")
    }

    @MainActor
    private func launchFixture() -> XCUIApplication {
        launchFixture(characters: false)
    }

    @MainActor
    private func launchFixture(characters: Bool) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-huntFixture", "-silent"]
        if characters { app.launchArguments.append("-characterFixture") }
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
        let number = name == "Star Compass" ? 1 : 3
        let button = app.buttons["Choose Hidden treasure \(number)"]
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

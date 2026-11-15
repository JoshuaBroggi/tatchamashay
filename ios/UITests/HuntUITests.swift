import CoreLocation
import XCTest

/// All treasures are available across old hunts, freely selectable and permanently collected.
final class HuntUITests: XCTestCase {
    private var app: XCUIApplication!
    private let spots = [
        CLLocationCoordinate2D(latitude: 37.7694, longitude: -122.4862),
        CLLocationCoordinate2D(latitude: 37.7716, longitude: -122.4862),
        CLLocationCoordinate2D(latitude: 37.7694, longitude: -122.4834),
    ]

    override func setUp() { continueAfterFailure = false }

    @MainActor
    func testAllTreasuresAnyOrderAndRestart() throws {
        app = XCUIApplication()
        app.launchArguments = ["-huntFixture", "-silent"]
        app.launch()
        allowLocation()
        move(to: spots[0])
        XCTAssertTrue(app.staticTexts["huntProgress"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["huntProgress"].label, "0 of 3 found")
        XCTAssertFalse(app.tabBars.buttons["Make"].exists)
        XCTAssertFalse(app.tabBars.buttons["Grown-ups"].exists)

        // The chooser exposes every marker, including the two in the older saved group.
        app.buttons["chooseTreasure"].tap()
        for name in ["Star Compass", "Sparkle Crown", "Captain Squawk"] {
            XCTAssertTrue(app.buttons["Choose \(name)"].waitForExistence(timeout: 5))
        }
        app.buttons["Choose Captain Squawk"].tap()
        XCTAssertTrue(app.staticTexts["Under the picnic table"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["dig"].exists, "choosing a far target resets GPS eligibility")
        move(to: spots[2])
        XCTAssertTrue(app.buttons["dig"].waitForExistence(timeout: 15))
        snap("all-treasures-dig-third-first")
        app.buttons["dig"].doubleTap()
        closeReveal()
        XCTAssertTrue(app.staticTexts["1 of 3 found"].waitForExistence(timeout: 5))

        choose("Star Compass")
        XCTAssertFalse(app.buttons["dig"].exists, "the previous target's Dig state must not carry over")
        move(to: spots[0])
        XCTAssertTrue(app.buttons["dig"].waitForExistence(timeout: 15))
        app.buttons["dig"].tap()
        closeReveal()
        XCTAssertTrue(app.staticTexts["2 of 3 found"].waitForExistence(timeout: 5))

        // An inaccurate/stale fix never unlocks Dig; the grown-up can still confirm a find.
        choose("Sparkle Crown")
        move(to: spots[1], accuracy: 100)
        XCTAssertTrue(app.staticTexts["The map's a bit foggy here, matey!"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["dig"].exists)
        app.buttons["weFoundIt"].tap()
        app.buttons["Yes, we found it"].tap()
        closeReveal()
        XCTAssertTrue(app.staticTexts["huntComplete"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["3 of 3 found"].exists)
        XCTAssertFalse(app.buttons["Play again"].exists)
        snap("all-treasures-complete")
        app.buttons["showMyChest"].tap()
        XCTAssertTrue(app.staticTexts["3 treasures"].waitForExistence(timeout: 5))

        app.terminate()
        app.launchArguments = ["-silent"]
        app.launch()
        XCTAssertTrue(app.staticTexts["huntComplete"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["chooseTreasure"].exists)
        app.tabBars.buttons["My Chest"].tap()
        XCTAssertTrue(app.staticTexts["3 treasures"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testOverlappingTreasuresCanEachBeSelected() throws {
        app = XCUIApplication()
        app.launchArguments = ["-huntFixture", "-overlappingFixture", "-silent"]
        app.launch()
        allowLocation()
        choose("Star Compass")
        XCTAssertEqual(app.staticTexts["huntHint"].label, "Look near the big tree")
        choose("Sparkle Crown")
        XCTAssertEqual(app.staticTexts["huntHint"].label, "By the little bridge")
        app.buttons["weFoundIt"].tap()
        app.buttons["Yes, we found it"].tap()
        closeReveal()
        choose("Star Compass")
        XCTAssertEqual(app.staticTexts["huntHint"].label, "Look near the big tree")
        XCTAssertTrue(app.staticTexts["1 of 3 found"].exists)
    }

    @MainActor
    private func choose(_ name: String) {
        XCTAssertTrue(app.buttons["chooseTreasure"].waitForExistence(timeout: 10))
        app.buttons["chooseTreasure"].tap()
        let target = app.buttons["Choose \(name)"]
        XCTAssertTrue(target.waitForExistence(timeout: 5))
        target.tap()
    }

    @MainActor
    private func allowLocation() {
        let allow = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons["Allow While Using App"]
        if allow.waitForExistence(timeout: 3) { allow.tap() }
    }

    @MainActor
    private func move(to coordinate: CLLocationCoordinate2D, accuracy: CLLocationAccuracy = 5) {
        XCUIDevice.shared.location = XCUILocation(location: CLLocation(
            coordinate: coordinate, altitude: 0, horizontalAccuracy: accuracy, verticalAccuracy: 5, timestamp: .now
        ))
    }

    @MainActor
    private func closeReveal() {
        XCTAssertTrue(app.buttons["openChest"].waitForExistence(timeout: 5))
        app.buttons["openChest"].tap()
        XCTAssertTrue(app.buttons["revealDone"].waitForExistence(timeout: 12))
        app.buttons["revealDone"].tap()
    }

    @MainActor
    private func snap(_ name: String) {
        let shot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let dir = ProcessInfo.processInfo.environment["SCREENSHOT_DIR"] {
            try? shot.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}

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
        assertNamesHidden()

        // Only the gated parent area identifies treasures before their reveal.
        ParentTestJourney.openParents(in: app)
        for name in ["Star Compass", "Sparkle Crown", "Captain Squawk"] {
            XCTAssertTrue(app.staticTexts[name].firstMatch.waitForExistence(timeout: 5))
        }
        app.buttons["parentDone"].tap()
        assertNamesHidden()

        // The chooser exposes every marker, including the two in the older saved group.
        app.buttons["chooseTreasure"].tap()
        for number in 1...3 {
            XCTAssertTrue(app.buttons["Choose Hidden treasure \(number)"].waitForExistence(timeout: 5))
        }
        assertNamesHidden()
        app.buttons["Choose Hidden treasure 3"].tap()
        XCTAssertEqual(app.staticTexts["selectedTreasure"].label, "Hidden treasure 3")
        assertNamesHidden()
        XCTAssertTrue(app.staticTexts["Under the picnic table"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["dig"].exists, "choosing a far target resets GPS eligibility")
        move(to: spots[2])
        XCTAssertTrue(app.buttons["dig"].waitForExistence(timeout: 15))
        snap("all-treasures-dig-third-first")
        app.buttons["dig"].doubleTap()
        closeReveal(named: "Captain Squawk")
        XCTAssertTrue(app.staticTexts["1 of 3 found"].waitForExistence(timeout: 5))

        choose(1)
        XCTAssertFalse(app.buttons["dig"].exists, "the previous target's Dig state must not carry over")
        move(to: spots[0])
        XCTAssertTrue(app.buttons["dig"].waitForExistence(timeout: 15))
        app.buttons["dig"].tap()
        closeReveal(named: "Star Compass")
        XCTAssertTrue(app.staticTexts["2 of 3 found"].waitForExistence(timeout: 5))

        // An inaccurate/stale fix never unlocks Dig; the grown-up can still confirm a find.
        choose(2)
        move(to: spots[1], accuracy: 100)
        XCTAssertTrue(app.staticTexts["The map's a bit foggy here, matey!"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["dig"].exists)
        app.buttons["weFoundIt"].tap()
        app.buttons["Yes, we found it"].tap()
        closeReveal(named: "Sparkle Crown")
        XCTAssertTrue(app.staticTexts["huntComplete"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["3 of 3 found"].exists)
        XCTAssertFalse(app.buttons["Play again"].exists)
        snap("all-treasures-complete")
        app.buttons["showMyChest"].tap()
        XCTAssertTrue(app.staticTexts["3 treasures"].waitForExistence(timeout: 5))
        for name in ["Star Compass", "Sparkle Crown", "Captain Squawk"] {
            XCTAssertTrue(app.staticTexts[name].exists)
        }

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
        choose(1)
        XCTAssertEqual(app.staticTexts["huntHint"].label, "Look near the big tree")
        choose(2)
        XCTAssertEqual(app.staticTexts["huntHint"].label, "By the little bridge")
        app.buttons["weFoundIt"].tap()
        app.buttons["Yes, we found it"].tap()
        closeReveal(named: "Sparkle Crown")
        choose(1)
        XCTAssertEqual(app.staticTexts["huntHint"].label, "Look near the big tree")
        XCTAssertTrue(app.staticTexts["1 of 3 found"].exists)
    }

    @MainActor
    private func choose(_ number: Int) {
        XCTAssertTrue(app.buttons["chooseTreasure"].waitForExistence(timeout: 10))
        app.buttons["chooseTreasure"].tap()
        let target = app.buttons["Choose Hidden treasure \(number)"]
        XCTAssertTrue(target.waitForExistence(timeout: 5))
        assertNamesHidden()
        target.tap()
        XCTAssertEqual(app.staticTexts["selectedTreasure"].label, "Hidden treasure \(number)")
        assertNamesHidden()
    }

    @MainActor
    private func assertNamesHidden() {
        for name in ["Star Compass", "Sparkle Crown", "Captain Squawk"] {
            let matching = app.descendants(matching: .any).matching(
                NSPredicate(format: "label CONTAINS[cd] %@", name)
            )
            XCTAssertEqual(matching.count, 0, "Unrevealed names must also stay out of VoiceOver labels")
        }
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
    private func closeReveal(named name: String) {
        XCTAssertTrue(app.buttons["openChest"].waitForExistence(timeout: 5))
        assertNamesHidden()
        app.buttons["openChest"].tap()
        XCTAssertTrue(app.buttons["revealDone"].waitForExistence(timeout: 12))
        XCTAssertTrue(app.staticTexts[name].exists, "Opening the chest reveals the treasure's real name")
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

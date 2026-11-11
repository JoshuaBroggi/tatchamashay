import CoreLocation
import XCTest

/// Milestone 2's hunt: a 3-treasure adventure walked with simulated locations. Treasure 1 by Dig!,
/// treasure 2 by We found it on a foggy signal, treasure 3 by Dig!, then the finale.
///
/// Starts from `-huntFixture` (a ready adventure in Golden Gate Park), so it doesn't depend on parent
/// setup. Set SCREENSHOT_DIR (via TEST_RUNNER_SCREENSHOT_DIR) to also save screenshots as PNG files.
final class HuntUITests: XCTestCase {
    private var app: XCUIApplication!

    // HuntFixture.spots, in play order.
    private let spots = [
        CLLocationCoordinate2D(latitude: 37.7694, longitude: -122.4862),
        CLLocationCoordinate2D(latitude: 37.7716, longitude: -122.4862),
        CLLocationCoordinate2D(latitude: 37.7694, longitude: -122.4834),
    ]

    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testThreeTreasureHunt() throws {
        let far = CLLocationCoordinate2D(latitude: 37.7754, longitude: -122.4862)
        move(to: far)
        app = XCUIApplication()
        app.launchArguments = ["-huntFixture", "-silent"]
        app.launch()
        allowLocation()
        // Start far away: about 670 m north of the first spot. Set after launch so the app gets a
        // fresh fix.
        move(to: far)

        let progress = app.staticTexts["huntProgress"]
        XCTAssertTrue(progress.waitForExistence(timeout: 10))
        XCTAssertEqual(progress.label, "0 of 3 found")
        XCTAssertEqual(app.staticTexts["huntHint"].label, "Look near the big tree")
        XCTAssertTrue(app.buttons["weFoundIt"].exists, "We found it is always there")
        let dig = app.buttons["dig"]
        let warmth = app.descendants(matching: .any)["warmth"]
        XCTAssertTrue(warmth.waitForExistence(timeout: 10))
        wait(for: warmth, value: "Cold")
        XCTAssertTrue(dig.waitForNonExistence(timeout: 10), "no Dig! 670 m away")
        snap("hunt-far")

        // About 90 m south of the first spot: warm, still no Dig!
        move(to: CLLocationCoordinate2D(latitude: 37.7686, longitude: -122.4862))
        wait(for: warmth, value: "Warm")
        XCTAssertFalse(dig.exists)
        snap("hunt-warm")

        // At the spot: Dig! (tapped twice, fast).
        move(to: spots[0])
        XCTAssertTrue(dig.waitForExistence(timeout: 15))
        snap("hunt-dig")
        dig.doubleTap()
        closeReveal()
        XCTAssertTrue(app.staticTexts["1 of 3 found"].waitForExistence(timeout: 5), "a double tap finds one")
        XCTAssertEqual(app.staticTexts["huntHint"].label, "By the little bridge")
        XCTAssertFalse(dig.exists, "the next treasure is 245 m away")

        // Near the second spot (warm), then the signal turns bad: 100 m accuracy is never trusted, so
        // once the last good fix is 10 s old the map is foggy and the grown-up taps We found it.
        let nearSecond = CLLocationCoordinate2D(latitude: 37.7712, longitude: -122.4862)
        move(to: nearSecond)
        wait(for: warmth, value: "Warm")
        move(to: nearSecond, accuracy: 100)
        XCTAssertTrue(app.staticTexts["The map's a bit foggy here, matey!"].waitForExistence(timeout: 25))
        XCTAssertFalse(dig.exists, "a poor location never shows Dig!")
        sleep(1)   // let the signal fade out
        snap("hunt-foggy")
        app.buttons["weFoundIt"].tap()
        app.buttons["Yes, we found it"].tap()
        closeReveal()
        XCTAssertTrue(app.staticTexts["2 of 3 found"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["huntHint"].label, "Under the picnic table")
        snap("hunt-2-of-3")

        // The third spot: Dig!, then the finale.
        move(to: spots[2])
        XCTAssertTrue(dig.waitForExistence(timeout: 15))
        dig.tap()
        closeReveal()
        XCTAssertTrue(app.staticTexts["huntFinale"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["3 of 3 found"].exists)
        snap("hunt-finale")

        // Each moment reached the guide once, in order. Foggy spells can come and go between finds
        // while the simulator idles, so they're checked separately.
        let log = (app.descendants(matching: .any)["huntMoments"].value as? String ?? "")
            .split(separator: ",").map(String.init)
        XCTAssertEqual(log.filter { $0 != "foggy_gps" }, [
            "greeting", "getting_close", "dig_ready", "reveal", "next_treasure",
            "getting_close", "we_found_it", "next_treasure",
            "dig_ready", "reveal", "finale",
        ])
        XCTAssertTrue(log.contains("foggy_gps"))

        app.tabBars.buttons["My Chest"].tap()
        XCTAssertTrue(app.staticTexts["3 treasures"].waitForExistence(timeout: 5))
    }

    /// Accepts the location prompt if this simulator hasn't granted it yet.
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
    private func wait(for element: XCUIElement, value: String, timeout: TimeInterval = 15) {
        let match = expectation(for: NSPredicate(format: "value == %@", value), evaluatedWith: element)
        wait(for: [match], timeout: timeout)
    }

    /// Opens the chest and closes the reveal.
    @MainActor
    private func closeReveal() {
        let open = app.buttons["openChest"]
        XCTAssertTrue(open.waitForExistence(timeout: 5))
        open.tap()
        let done = app.buttons["revealDone"]
        XCTAssertTrue(done.waitForExistence(timeout: 10))
        done.tap()
    }

    @MainActor
    private func snap(_ name: String) {
        let shot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let dir = ProcessInfo.processInfo.environment["SCREENSHOT_DIR"] {
            // Numbered after the milestone 1 walkthrough's shots, so both fit in one folder.
            let index = ["hunt-far", "hunt-warm", "hunt-dig", "hunt-foggy", "hunt-2-of-3", "hunt-finale"]
                .firstIndex(of: name).map { $0 + 21 } ?? 99
            try? shot.pngRepresentation.write(to: URL(fileURLWithPath: dir)
                .appendingPathComponent(String(format: "%02d-%@.png", index, name)))
        }
    }
}

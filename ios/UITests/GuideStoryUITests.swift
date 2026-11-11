import XCTest

/// Milestone 2's guide and story: the captain greets the child and says the goal, reacts to three
/// hunt moments without talking over the reveal, then plays the finale and ends at "Back to the
/// ship!". Uses the `-guideRehearsal` test driver (debug builds), which plays "The Three Moon
/// Pebbles" as a Demo-mode family and feeds hunt moments in place of a walk.
final class GuideStoryUITests: XCTestCase {
    private var app: XCUIApplication!
    /// Screenshots number from 30 so they sort after the walkthrough's and the hunt's.
    private var step = 29

    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testOpeningThreeMomentsAndFinale() throws {
        app = XCUIApplication()
        app.launchArguments = ["-resetFamily", "-silent", "-guideRehearsal"]
        app.launch()

        let fields = app.textFields
        XCTAssertTrue(fields.element(boundBy: 0).waitForExistence(timeout: 10))
        fields.element(boundBy: 0).tap()
        fields.element(boundBy: 0).typeText("Dad")
        fields.element(boundBy: 1).tap()
        fields.element(boundBy: 1).typeText("Emmanuel")
        app.buttons["startAdventure"].tap()

        // Opening: greeting by pirate name, then the goal.
        XCTAssertTrue(element("adventureOpening").waitForExistence(timeout: 10))
        expectBubble(containing: "Emmanuel")
        expectBubble(containing: "three moon pebbles")
        expectBubble(containing: "Stay with Dad.")
        snap("guide-opening")

        app.buttons["letsGo"].tap()
        XCTAssertFalse(element("adventureOpening").exists)
        expectBubble(containing: "Look near the big tree.")

        // 1. Dig ready replaces the clue.
        drive("dig_ready")
        expectBubble(matching: ["Tap Dig", "Dig, dig, dig"])
        snap("guide-mid-hunt")

        // 2. The reveal: quiet while the chest opens, then the treasure's line.
        drive("reveal")
        XCTAssertFalse(bubble.exists, "the guide is quiet while the chest opens")
        // A clue arriving during the reveal waits its turn.
        drive("next_treasure")
        XCTAssertFalse(bubble.exists)
        expectBubble(containing: "blue moon pebble", timeout: 6)

        // 3. Next treasure: after the reveal lines, the next clue.
        expectBubble(containing: "Look by something red slide.", timeout: 15)
        snap("guide-next-clue")

        // Finale
        drive("finale")
        XCTAssertTrue(element("guideFinale").waitForExistence(timeout: 5))
        expectBubble(containing: "Back to the ship!")
        snap("guide-finale")
        let back = app.buttons["backToShip"]
        XCTAssertTrue(back.exists)
        XCTAssertEqual(back.label, "Back to the ship!")
        back.tap()

        // Back on the map, with a goodbye.
        expectBubble(matching: ["Bye bye", "waves bye", "See you next time"])
        XCTAssertFalse(element("guideFinale").exists)
        XCTAssertTrue(app.tabBars.buttons["Map"].isSelected)

        // The finale doesn't play twice.
        drive("finale")
        XCTAssertFalse(element("guideFinale").waitForExistence(timeout: 2))
    }

    // MARK: Helpers

    private var bubble: XCUIElement { element("guide.bubble") }

    private func element(_ id: String) -> XCUIElement { app.descendants(matching: .any)[id].firstMatch }

    private func drive(_ moment: String) { app.buttons["drive.\(moment)"].tap() }

    private func expectBubble(containing text: String, timeout: TimeInterval = 8,
                              file: StaticString = #filePath, line: UInt = #line) {
        expectBubble(matching: [text], timeout: timeout, file: file, line: line)
    }

    private func expectBubble(matching texts: [String], timeout: TimeInterval = 8,
                              file: StaticString = #filePath, line: UInt = #line) {
        let predicate = NSPredicate { object, _ in
            guard let element = object as? XCUIElement, element.exists else { return false }
            return texts.contains { element.label.contains($0) }
        }
        let found = XCTNSPredicateExpectation(predicate: predicate, object: bubble)
        XCTAssertEqual(XCTWaiter().wait(for: [found], timeout: timeout), .completed,
                       "bubble should say one of \(texts); says “\(bubble.exists ? bubble.label : "nothing")”",
                       file: file, line: line)
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

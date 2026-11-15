import XCTest

/// Reads the existing family on a physical phone; never creates, saves or resets records.
final class VineDogInstalledUITests: XCTestCase {
    @MainActor
    func testExistingVineDogUsesBundledModel() throws {
        #if targetEnvironment(simulator)
        throw XCTSkip("This walkthrough verifies the existing family on the connected iPhone.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = []
        app.launch()
        let parents = app.buttons["parents"]
        XCTAssertTrue(parents.waitForExistence(timeout: 15))
        parents.tap()
        let question = app.staticTexts["grownUpQuestion"]
        if question.waitForExistence(timeout: 3) {
            let numbers = question.label.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }
            guard numbers.count == 2 else {
                XCTFail("Could not read the grown-up question")
                return
            }
            let answer = app.textFields["grownUpAnswer"]
            answer.tap()
            answer.typeText(String(numbers[0] * numbers[1]))
            app.buttons["grownUpOpen"].tap()
        }
        let beast = app.buttons.matching(NSPredicate(
            format: "identifier BEGINSWITH %@ AND label CONTAINS[c] %@", "editBeast-", "Vine dog"
        )).firstMatch
        for _ in 0..<5 {
            if beast.exists && beast.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(beast.waitForExistence(timeout: 10))
        beast.tap()
        let model = app.otherElements["treasureModel"]
        XCTAssertTrue(model.waitForExistence(timeout: 15))
        let loaded = NSPredicate(format: "value == %@", "usdz")
        expectation(for: loaded, evaluatedWith: model)
        waitForExpectations(timeout: 30)
        let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screenshot.name = "Restored Vine dog on iPhone"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        app.buttons["Cancel"].tap()
        app.buttons["parentDone"].tap()
        #endif
    }
}

import CoreLocation
import XCTest

/// Creation belongs to parents; the child always collects into their own chest.
final class ChildCreationUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    @MainActor
    func testCreationRequiresParentGateAndCancelKeepsMapUnchanged() {
        let app = XCUIApplication()
        app.launchArguments = ["-resetFamily", "-huntFixture", "-silent"]
        app.launch()
        XCTAssertFalse(app.tabBars.buttons["Make"].exists)
        XCTAssertFalse(app.buttons["hideTreasure"].exists)
        app.buttons["parents"].tap()
        XCTAssertFalse(app.buttons["hideTreasure"].exists, "creation stays behind the parent gate")
        let answer = app.textFields["parentGateAnswer"]
        XCTAssertTrue(answer.waitForExistence(timeout: 5))
        answer.tap()
        answer.typeText("3")
        app.buttons["parentGateContinue"].tap()
        XCTAssertFalse(app.buttons["hideTreasure"].exists)
        ParentTestJourney.replace(answer, with: "25", in: app)
        app.buttons["parentGateContinue"].tap()
        XCTAssertTrue(app.buttons["hideTreasure"].waitForExistence(timeout: 5))
        app.buttons["hideTreasure"].tap()
        ParentTestJourney.replace(app.textFields["beastName"], with: "Unsaved Beast", in: app)
        app.buttons["Cancel"].tap()
        app.buttons["Discard changes"].tap()
        XCTAssertTrue(app.buttons["hideTreasure"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["Unsaved Beast"].exists)
    }

    @MainActor
    func testParentEditPreservesTreasureAlreadyInChildChest() {
        XCUIDevice.shared.location = XCUILocation(location: CLLocation(latitude: 37.7694, longitude: -122.4862))
        let app = XCUIApplication()
        app.launchArguments = ["-resetFamily", "-huntFixture", "-silent"]
        app.launch()
        let choose = app.buttons["chooseTreasure"]
        XCTAssertTrue(choose.waitForExistence(timeout: 5))
        choose.tap()
        app.buttons["Choose Hidden treasure 1"].tap()
        app.buttons["weFoundIt"].tap()
        app.buttons["Yes, we found it"].tap()
        let open = app.buttons["openChest"]
        XCTAssertTrue(open.waitForExistence(timeout: 5))
        open.tap()
        let done = app.buttons["revealDone"]
        XCTAssertTrue(done.waitForExistence(timeout: 10))
        done.tap()

        ParentTestJourney.openParents(in: app)
        let edit = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'editBeast-' AND label CONTAINS 'Star Compass'")).firstMatch
        XCTAssertTrue(edit.waitForExistence(timeout: 5))
        if !edit.isHittable { app.collectionViews.firstMatch.swipeUp() }
        edit.tap()
        ParentTestJourney.replace(app.textFields["beastName"], with: "Sleepy Sprout", in: app)
        app.buttons["chooseSpot"].tap()
        ParentTestJourney.reviewSpot(in: app)
        app.buttons["hideHere"].tap()
        XCTAssertTrue(app.buttons["hideTreasure"].waitForExistence(timeout: 10))
        app.buttons["parentDone"].tap()
        app.tabBars.buttons["My Chest"].tap()
        XCTAssertTrue(app.staticTexts["Star Compass"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["Sleepy Sprout"].exists, "a parent's edit never changes a collected copy")
    }
}

import CoreLocation
import XCTest

/// One parent-created beast is immediately playable, without an adventure or story setup.
final class ParentSetupUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    @MainActor
    func testCreateOneBeastThenReturnToChildMap() {
        XCUIDevice.shared.location = XCUILocation(location: CLLocation(latitude: 37.7694, longitude: -122.4862))
        let app = XCUIApplication()
        app.launchArguments = ["-resetFamily", "-silent"]
        app.launch()
        ParentTestJourney.createFamily(in: app)
        XCTAssertEqual(app.tabBars.buttons.count, 2)
        XCTAssertFalse(app.tabBars.buttons["Make"].exists)
        ParentTestJourney.openParents(in: app)
        app.buttons["hideTreasure"].tap()

        let name = app.textFields["beastName"]
        ParentTestJourney.replace(name, with: "Sleepy Sprout", in: app)
        XCTAssertFalse(app.textFields["A short story (optional)"].exists)
        app.buttons["chooseSpot"].tap()
        ParentTestJourney.reviewSpot(in: app)
        ParentTestJourney.replace(app.textFields["spotHint"], with: "By the back step", in: app)
        XCTAssertEqual(app.switches["spotChecked"].value as? String, "1", "Typing a hint keeps the reviewed viewpoint")
        app.navigationBars["Choose its spot"].buttons.firstMatch.tap()
        XCTAssertTrue(app.buttons["chooseSpot"].waitForExistence(timeout: 5))
        app.buttons["chooseSpot"].tap()
        let preservedHint = app.textFields["spotHint"]
        XCTAssertTrue(preservedHint.waitForExistence(timeout: 5))
        XCTAssertEqual(preservedHint.value as? String, "By the back step", "Back and Next preserve the placement draft")
        XCTAssertEqual(app.switches["spotChecked"].value as? String, "1")
        let save = app.buttons["hideHere"]
        XCTAssertEqual(save.label, "Hide for your child")
        XCTAssertFalse(app.buttons["Hide it for Dad"].exists)
        XCTAssertFalse(app.buttons["Hide it for Mom"].exists)
        XCTAssertTrue(save.isEnabled, "one reviewed treasure is enough")
        save.tap()

        XCTAssertTrue(app.buttons["hideTreasure"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Ready to find"].exists)
        XCTAssertTrue(app.staticTexts["Sleepy Sprout"].firstMatch.exists)
        XCTAssertFalse(app.buttons["getReady"].exists)
        XCTAssertFalse(app.buttons["setupHunt"].exists)
        app.buttons["parentDone"].tap()
        XCTAssertTrue(app.buttons["chooseTreasure"].waitForExistence(timeout: 5))
        app.buttons["chooseTreasure"].tap()
        XCTAssertTrue(app.buttons["Choose Hidden treasure 1"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Choose Sleepy Sprout"].exists)
    }

    @MainActor
    func testParentSettingsKeepChildProfilesAndSoundControls() {
        let app = XCUIApplication()
        app.launchArguments = ["-resetFamily", "-huntFixture", "-silent"]
        app.launch()
        ParentTestJourney.openParents(in: app)
        let settings = app.buttons["grownUpSettings"]
        if !settings.isHittable { app.collectionViews.firstMatch.swipeUp() }
        settings.tap()
        XCTAssertTrue(app.switches["soundToggle"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.switches["voiceToggle"].exists)
        app.buttons["addPirate"].tap()
        let name = app.textFields["pirateNameField"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText("Captain Mia")
        app.buttons["savePirate"].tap()
        XCTAssertTrue(app.staticTexts["Captain Mia"].waitForExistence(timeout: 5))
        app.buttons.containing(.staticText, identifier: "Captain Mia").firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Playing"].exists)
    }
}

/// Shared steps use the real parent gate and reviewed-map flow, with no test-only bypass.
@MainActor
enum ParentTestJourney {
    static func createFamily(in app: XCUIApplication) {
        let fields = app.textFields
        XCTAssertTrue(fields.element(boundBy: 0).waitForExistence(timeout: 5))
        fields.element(boundBy: 0).tap()
        fields.element(boundBy: 0).typeText("Dad")
        fields.element(boundBy: 1).tap()
        fields.element(boundBy: 1).typeText("Captain Emmanuel")
        app.buttons["startAdventure"].tap()
        XCTAssertTrue(app.buttons["parents"].waitForExistence(timeout: 5))
    }

    static func openParents(in app: XCUIApplication) {
        let parents = app.buttons["parents"]
        XCTAssertTrue(parents.waitForExistence(timeout: 5))
        parents.tap()
        let answer = app.textFields["parentGateAnswer"]
        XCTAssertTrue(answer.waitForExistence(timeout: 5))
        answer.tap()
        answer.typeText("25")
        app.buttons["parentGateContinue"].tap()
        XCTAssertTrue(app.buttons["hideTreasure"].waitForExistence(timeout: 5))
    }

    static func replace(_ field: XCUIElement, with text: String, in app: XCUIApplication) {
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        if !field.isHittable { app.collectionViews.firstMatch.swipeUp() }
        field.tap()
        let old = field.value as? String ?? ""
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: old.count) + text)
        if app.keyboards.buttons["Done"].exists { app.keyboards.buttons["Done"].tap() }
    }

    static func reviewSpot(in app: XCUIApplication) {
        let map = app.otherElements["spotMap"]
        XCTAssertTrue(map.waitForExistence(timeout: 5))
        let hint = app.staticTexts["Zoom in until you can see paths, roads and water."]
        sleep(2)
        var tries = 0
        while hint.exists && tries < 8 {
            map.pinch(withScale: 3, velocity: 3)
            sleep(1)
            tries += 1
        }
        XCTAssertFalse(hint.exists, "the map must show paths, roads and water")
        let save = app.buttons["hideHere"]
        XCTAssertFalse(save.isEnabled, "the parent must confirm the spot")
        let checked = app.switches["spotChecked"]
        if !checked.isHittable { app.collectionViews.firstMatch.swipeUp() }
        checked.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        XCTAssertTrue(save.isEnabled)
    }
}

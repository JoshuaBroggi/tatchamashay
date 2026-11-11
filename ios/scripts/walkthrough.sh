#!/bin/sh
# Runs every test, including the end-to-end slice walkthrough, on one simulator and saves its
# screenshots: full size in build/screenshots, small JPEG copies in docs/screenshots. Usage: scripts/walkthrough.sh <simulator-udid>
set -e
cd "$(dirname "$0")/.."
UDID="${1:?pass a simulator UDID (xcrun simctl list devices available)}"
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
# Stand at the treasure spot the walkthrough uses (Golden Gate Park, San Francisco).
xcrun simctl location "$UDID" set 37.7694,-122.4862
xcrun simctl privacy "$UDID" grant location com.tatchamashay.app 2>/dev/null || true
SHOTS="$PWD/build/screenshots"
rm -rf "$SHOTS" && mkdir -p "$SHOTS" build
xcodegen generate --quiet
TEST_RUNNER_SCREENSHOT_DIR="$SHOTS" xcodebuild -project Tatchamashay.xcodeproj -scheme Tatchamashay \
  -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath build test 2>&1 | tee build/last-test.log \
  | grep -E '^/.*(error|warning):|Test (case|Suite).*(passed|failed)|✔|✘|^\*\* ' || true
grep -q '\*\* TEST SUCCEEDED \*\*' build/last-test.log
rm -rf docs/screenshots && mkdir -p docs/screenshots
for f in "$SHOTS"/*.png; do
  sips -Z 900 -s format jpeg -s formatOptions 70 "$f" --out "docs/screenshots/$(basename "${f%.png}").jpg" >/dev/null
done

#!/bin/sh
# Generates the Xcode project and builds (or tests) for the iOS Simulator.
# Usage: scripts/build.sh [build|test] [simulator-udid-or-name]
set -e
cd "$(dirname "$0")/.."
ACTION="${1:-build}"
DEVICE="${2:-iPhone 18 Pro}"
case "$DEVICE" in
  *-*-*-*-*) DEST="platform=iOS Simulator,id=$DEVICE" ;;
  *) DEST="platform=iOS Simulator,name=$DEVICE" ;;
esac
xcodegen generate --quiet
xcodebuild -project Tatchamashay.xcodeproj -scheme Tatchamashay -destination "$DEST" \
  -derivedDataPath build "$ACTION" 2>&1 | tee build/last-$ACTION.log \
  | grep -E '^/.*(error|warning):|^\*\* |Test (case|Suite).*(passed|failed)|✔|✘' || true
grep -q "\*\* $(echo "$ACTION" | tr a-z A-Z) SUCCEEDED \*\*" build/last-$ACTION.log

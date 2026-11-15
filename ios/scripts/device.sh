#!/bin/sh
# Builds a signed debug build and installs it on a real iPhone.
# Usage: scripts/device.sh [device-name-or-udid]   (default: the first paired physical iPhone)
set -e
cd "$(dirname "$0")/.."
DEVICE="${1:-$(xcrun devicectl list devices 2>/dev/null | awk '/physical/ && /iPhone/ {for(i=1;i<=NF;i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) {print $i; exit}}')}"
[ -n "$DEVICE" ] || { echo "No paired iPhone found. Connect and unlock it, then try again."; exit 1; }
mkdir -p build
xcodegen generate --quiet
xcodebuild -project Tatchamashay.xcodeproj -scheme Tatchamashay -configuration Debug \
  -destination "platform=iOS,id=$DEVICE" -derivedDataPath build -allowProvisioningUpdates build 2>&1 \
  | tee build/last-device.log | grep -E '^/.*(error|warning):|error:|^\*\* ' || true
grep -q '\*\* BUILD SUCCEEDED \*\*' build/last-device.log
APP=build/Build/Products/Debug-iphoneos/Tatchamashay.app
xcrun devicectl device install app --device "$DEVICE" "$APP"
xcrun devicectl device process launch --device "$DEVICE" com.tatchamashay.app || \
  echo "Installed. Unlock the phone and tap Tatchamashay to open it."

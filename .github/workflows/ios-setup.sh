#!/bin/bash
# Helper for ios.yml. Usage: ios-setup.sh xcode | simulator
set -euo pipefail

case "${1:-}" in
  xcode)
    # Newest installed Xcode by version number (Xcode_27.1.app beats Xcode_26.6.app).
    newest=$(ls -d /Applications/Xcode_*.app | sort -V | tail -1)
    echo "Using $newest"
    sudo xcode-select -s "$newest/Contents/Developer"
    xcodebuild -version
    swift --version
    ;;
  simulator)
    # Newest iOS runtime that has an available iPhone; first iPhone in it.
    xcrun simctl list devices available
    udid=$(xcrun simctl list devices available -j | python3 -c '
import json, re, sys
devices = json.load(sys.stdin)["devices"]
best = None
for runtime, entries in devices.items():
    m = re.search(r"iOS-(\d+)-(\d+)", runtime)
    if not m:
        continue
    version = (int(m.group(1)), int(m.group(2)))
    phones = [d for d in entries if d["name"].startswith("iPhone") and d.get("isAvailable", True)]
    if phones and (best is None or version > best[0]):
        best = (version, phones[0])
if best is None:
    sys.exit("No available iPhone simulator on this runner")
print(best[1]["udid"])
sys.stderr.write("Picked %s on iOS %d.%d\n" % (best[1]["name"], *best[0]))
')
    echo "SIMULATOR_UDID=$udid" >> "$GITHUB_ENV"
    ;;
  *)
    echo "usage: $0 xcode|simulator" >&2
    exit 2
    ;;
esac

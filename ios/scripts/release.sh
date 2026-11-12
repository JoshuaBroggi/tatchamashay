#!/bin/sh
# Builds a signed App Store Connect .ipa for TestFlight and, with --upload, sends it.
# Usage: scripts/release.sh [--upload] [--allow-dirty]
# Upload needs ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH (see docs/RELEASING.md).
set -eu
cd "$(dirname "$0")/.."

TEAM=RAADXJAY3M
SCHEME=Tatchamashay
OUT=build/release
ARCHIVE="$OUT/$SCHEME.xcarchive"
UPLOAD=0
ALLOW_DIRTY=0

for arg in "$@"; do
  case "$arg" in
    --upload) UPLOAD=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    -h|--help) sed -n '2,4p' "$0" | sed 's/^# //'; exit 0 ;;
    *) echo "release: unknown option $arg" >&2; exit 2 ;;
  esac
done

fail() { echo "release: $*" >&2; exit 1; }

# Check everything we can before the slow build.
if [ "$ALLOW_DIRTY" -eq 0 ] && [ -n "$(git status --porcelain)" ]; then
  fail "uncommitted changes. Commit them, or pass --allow-dirty."
fi

# The API key is optional for building (Xcode's signed-in account is used instead)
# and required for uploading. Values are never printed.
HAVE_KEY=0
if [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ] && [ -n "${ASC_KEY_PATH:-}" ]; then
  [ -f "$ASC_KEY_PATH" ] || fail "ASC_KEY_PATH does not point to a file."
  HAVE_KEY=1
fi
if [ "$UPLOAD" -eq 1 ] && [ "$HAVE_KEY" -eq 0 ]; then
  missing=""
  [ -n "${ASC_KEY_ID:-}" ] || missing="$missing ASC_KEY_ID"
  [ -n "${ASC_ISSUER_ID:-}" ] || missing="$missing ASC_ISSUER_ID"
  [ -n "${ASC_KEY_PATH:-}" ] || missing="$missing ASC_KEY_PATH"
  fail "--upload needs an App Store Connect API key. Missing:$missing. See docs/RELEASING.md."
fi

VERSION=$(sed -n 's/^ *MARKETING_VERSION: *"\{0,1\}\([^"]*\)"\{0,1\} *$/\1/p' project.yml | head -1)
[ -n "$VERSION" ] || fail "could not read MARKETING_VERSION from project.yml."
BUILD=$(git rev-list --count HEAD)
echo "release: Tatchamashay $VERSION ($BUILD)"

# Runs xcodebuild, adding the API key when there is one, keeping the full log in a file.
run_xcodebuild() {
  log="$1"; shift
  if [ "$HAVE_KEY" -eq 1 ]; then
    set -- "$@" -authenticationKeyPath "$ASC_KEY_PATH" \
      -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID"
  fi
  if ! xcodebuild "$@" >"$log" 2>&1; then
    grep -E 'error:|^\*\* ' "$log" | sort -u >&2 || true
    fail "xcodebuild failed. Full log: ios/$log"
  fi
}

rm -rf "$OUT"
mkdir -p "$OUT"
xcodegen generate --quiet

echo "release: archiving…"
run_xcodebuild "$OUT/archive.log" archive \
  -project "$SCHEME.xcodeproj" -scheme "$SCHEME" -configuration Release \
  -destination generic/platform=iOS -derivedDataPath build \
  -archivePath "$ARCHIVE" -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" CODE_SIGNING_ALLOWED=YES CODE_SIGN_STYLE=Automatic \
  MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD"

echo "release: exporting .ipa…"
run_xcodebuild "$OUT/export.log" -exportArchive \
  -archivePath "$ARCHIVE" -exportPath "$OUT" \
  -exportOptionsPlist scripts/ExportOptions.plist -allowProvisioningUpdates

IPA=$(ls "$OUT"/*.ipa 2>/dev/null | head -1)
[ -n "$IPA" ] || fail "export finished but no .ipa was produced in ios/$OUT."
echo "release: built ios/$IPA"

if [ "$UPLOAD" -eq 0 ]; then
  echo "release: not uploaded (pass --upload to send it to TestFlight)."
  exit 0
fi

echo "release: uploading to App Store Connect…"
if ! xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID" --p8-file-path "$ASC_KEY_PATH" \
  >"$OUT/upload.log" 2>&1; then
  grep -iE 'error|fail' "$OUT/upload.log" | sort -u >&2 || true
  fail "upload failed. Full log: ios/$OUT/upload.log"
fi
echo "release: uploaded $VERSION ($BUILD). It appears in TestFlight after Apple finishes processing."

# Releasing Tatchamashay to TestFlight

One command builds a signed app and sends it to TestFlight:

```bash
ios/scripts/release.sh --upload
```

Without `--upload` it stops after producing `ios/build/release/Tatchamashay.ipa`, which
is a safe way to check that signing works.

## One-time setup (owner)

These steps need the Apple account holder for team `RAADXJAY3M`.

1. **Sign in to Xcode.** Xcode → Settings → Accounts → add the Apple ID that belongs to
   the team. The first release build creates the Apple Distribution certificate and the
   App Store provisioning profile by itself.
2. **Create the app record.** In [App Store Connect](https://appstoreconnect.apple.com)
   → Apps → **+** → New App: platform iOS, name Tatchamashay, bundle ID
   `com.tatchamashay.app`, any SKU (for example `tatchamashay-ios`). If the bundle ID is
   not in the list, register it first under
   [Identifiers](https://developer.apple.com/account/resources/identifiers/list).
   Uploads are rejected until this record exists.
3. **Create an API key.** App Store Connect → Users and Access → Integrations →
   App Store Connect API → Team Keys → **+**. Name it "Tatchamashay release", role
   **App Manager**. Note the **Key ID** and the **Issuer ID** shown on that page, and
   download the `AuthKey_<KeyID>.p8` file. It can be downloaded only once.
4. **Store the key on this Mac.** Keep the file outside the repo and readable only by you:

   ```bash
   mkdir -p ~/.appstoreconnect/private_keys && chmod 700 ~/.appstoreconnect
   mv ~/Downloads/AuthKey_*.p8 ~/.appstoreconnect/private_keys/ && chmod 600 ~/.appstoreconnect/private_keys/*.p8
   ```

   Then add these to `~/.zshrc` (fill in your own values):

   ```bash
   export ASC_KEY_ID=<Key ID>
   export ASC_ISSUER_ID=<Issuer ID>
   export ASC_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_<Key ID>.p8
   ```

5. **Store the key as GitHub secrets** (for a future release workflow). Repo → Settings →
   Secrets and variables → Actions, or from the terminal:

   ```bash
   gh secret set ASC_KEY_ID
   gh secret set ASC_ISSUER_ID
   gh secret set ASC_KEY_P8 < ~/.appstoreconnect/private_keys/AuthKey_<Key ID>.p8
   ```

   A workflow writes `ASC_KEY_P8` to a temporary file and points `ASC_KEY_PATH` at it.
   Never commit the `.p8` file or paste its contents anywhere else.

## Cutting a build

1. Merge what you want to ship into `main` and check it out with nothing uncommitted.
2. Run `ios/scripts/release.sh --upload`.

What the script does:

- Refuses to run with uncommitted changes (override with `--allow-dirty`).
- Takes the version (`2.0`) from `MARKETING_VERSION` in `ios/project.yml` and the build
  number from the number of commits (`git rev-list --count HEAD`). Every new commit gives
  a higher build number, which App Store Connect requires. To change the version, edit
  `project.yml`.
- Archives a Release build with automatic signing, exports the `.ipa`, and uploads it
  when `--upload` is passed.
- Writes full logs to `ios/build/release/` (`archive.log`, `export.log`, `upload.log`)
  and prints only errors. It never prints the key values.

If the three `ASC_*` variables are set, the build also uses the API key for signing, so
it works on a machine where Xcode is not signed in. Building the same commit twice gives
the same build number, and App Store Connect rejects the second upload.

## Getting it onto testers' phones

1. After upload, Apple processes the build for roughly 5–30 minutes. It then shows under
   App Store Connect → the app → TestFlight.
2. The first build asks an export compliance question (the app uses no custom
   encryption, so answer "None of the algorithms mentioned above").
3. One time: TestFlight → Internal Testing → **+** → create a group (for example
   "Family"), turn on automatic distribution, and add the testers. Internal testers must
   first be added as users under Users and Access (any role, for example Developer or
   Marketing) and accept that invitation.
4. Each tester installs the **TestFlight** app from the App Store, accepts the email
   invitation, and taps Install. Later builds appear in TestFlight automatically; no
   Apple review is needed for internal testers.

## Troubleshooting

- **"No signing certificate" or "No profiles for 'com.tatchamashay.app'"** — Xcode is not
  signed in to the team and no API key is set. Do step 1 or step 4 above.
- **"No suitable application records were found"** on upload — the app record from step 2
  is missing.
- **"Bundle version must be higher"** — that commit was already uploaded. Make a new
  commit and run again.

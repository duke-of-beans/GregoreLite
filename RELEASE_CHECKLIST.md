# Gregore Lite — Release Checklist

Every release follows these steps. Do not skip any.

---

## 1. Version Bump

Update the version string in all three files:

- `app/src-tauri/tauri.conf.json` → `"version": "X.Y.Z"`
- `app/src-tauri/Cargo.toml` → `version = "X.Y.Z"`
- `app/package.json` → `"version": "X.Y.Z"`

## 2. Build

Run the build script from the repo root:

```
build-installer.bat
```

This runs `pnpm build` (Next.js) then `cargo tauri build` (Rust + NSIS installer).

Output location: `app/src-tauri/target/release/bundle/nsis/Gregore-Lite_X.Y.Z_x64-setup.exe`

## 3. Sign the Installer

The auto-updater requires a signed artifact. Sign the .nsis.zip bundle (not the .exe):

```
cd app/src-tauri
npx @tauri-apps/cli signer sign target/release/bundle/nsis/Gregore-Lite_X.Y.Z_x64-setup.nsis.zip -k .keys/updater.key -p greglite
```

This produces a `.sig` file alongside the bundle. Copy the signature content — you'll need it for latest.json.

## 4. Git Tag

```
git add -A
git commit -m "release: vX.Y.Z"
git tag vX.Y.Z
git push origin master --tags
```

## 5. Create GitHub Release

Go to: https://github.com/duke-of-beans/GregoreLite/releases/new

- Tag: `vX.Y.Z`
- Title: `Gregore Lite vX.Y.Z`
- Description: release notes (what changed)
- Attach files:
  - `Gregore-Lite_X.Y.Z_x64-setup.exe` (the NSIS installer)
  - `latest.json` (see step 6)

## 6. Create latest.json

Create a file named `latest.json` with this exact structure:

```json
{
  "version": "X.Y.Z",
  "notes": "Release notes here",
  "pub_date": "2026-03-04T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "PASTE_SIGNATURE_FROM_STEP_3_HERE",
      "url": "https://github.com/duke-of-beans/GregoreLite/releases/download/vX.Y.Z/Gregore-Lite_X.Y.Z_x64-setup.nsis.zip"
    }
  }
}
```

Upload this file as an attachment to the GitHub Release created in step 5.

The auto-updater checks `https://github.com/duke-of-beans/GregoreLite/releases/latest/download/latest.json` — GitHub serves the latest release's attachments at this URL automatically.

## 7. Verify

After publishing the release:

1. Download the installer from the release page
2. Run it — verify Start Menu shortcut, install path, uninstaller in Add/Remove Programs
3. Launch the app — verify version shows X.Y.Z
4. (Future releases) Verify the previous version detects the update and prompts

---

## Code Signing Note

Windows Defender will warn on unsigned executables. For personal/internal use this is acceptable — click "More info" → "Run anyway". Proper code signing (EV certificate or Microsoft trusted publisher program) is a post-v1.0.0 concern and requires purchasing a certificate from a CA like DigiCert or Sectigo.

## Updater Keys

- Private key: `app/src-tauri/.keys/updater.key` (NEVER commit to git)
- Public key: embedded in `tauri.conf.json` under `plugins.updater.pubkey`
- Password: `greglite`

If you lose the private key, you must generate a new keypair and release a version that updates the pubkey — existing installations will need manual update for that one release.

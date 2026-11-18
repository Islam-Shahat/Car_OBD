# GitHub Repository & Release Setup Guide

This guide details the post-push configuration steps required for the repository owner (`Islam-Shahat`) on GitHub for the **Car OBD** project.

---

## 1. Repository Settings on GitHub

Once pushed to `https://github.com/Islam-Shahat/Car_OBD`, configure the repository metadata:

1. **Repository Visibility**:
   - Ensure the repository visibility is set to **Public** under **Settings -> General -> Danger Zone -> Change repository visibility**.
   - Note: Public visibility does not grant reuse rights. The repository remains proprietary ("© 2026 Islam-Shahat. All rights reserved.").

2. **About / Repository Details** (Gear icon on the main repository page):
   - **Description**: `Offline-first Windows passenger-car OBD-II diagnostic desktop scanner for ELM327 adapters with full Arabic RTL UI.`
   - **Website**: `https://islam-shahat.github.io/Car_OBD/`
   - **Topics**: Add the following repository tags:
     `obd2`, `elm327`, `diagnostics`, `windows`, `tauri`, `rust`, `react`, `arabic`, `offline-first`
   - **Features**: Ensure **Issues** is enabled. Disable Wikis if not used.

---

## 2. GitHub Pages Configuration (Remote Config Hosting)

The application fetches the cryptographically signed emergency kill-switch and feature flag manifest from:
`https://islam-shahat.github.io/Car_OBD/config.json`

### Why GitHub Pages is Needed

Car OBD operates offline-first. To provide emergency kill-switch capability and feature status updates without running an always-on dedicated server, the application pulls static, Ed25519-signed JSON payloads from GitHub Pages over HTTPS.

### Steps to Configure Pages:

1. Navigate to **Settings -> Pages** in the GitHub repository.
2. Under **Build and deployment -> Source**, select **Deploy from a branch** (e.g. branch `gh-pages` or a `/docs` folder on `main`).
3. Place `config.json` at the root of the serving branch.
4. Verify the deployment:
   ```bash
   curl -I https://islam-shahat.github.io/Car_OBD/config.json
   ```
   Confirm that HTTP 200 OK is returned with the signed JSON envelope.

---

## 3. GitHub Actions Secrets Configuration

For automated releases and self-updating binaries, configure the repository secrets under **Settings -> Secrets and variables -> Actions**:

### Required Secrets for `.github/workflows/release.yml`:

1. `TAURI_SIGNING_PRIVATE_KEY`:
   - The Minisign / Tauri private key string.
   - If not yet generated, generate a new updater key pair locally:
     ```bash
     npm run tauri signer generate
     ```
   - Copy the private key block into this secret.
   - **Critical**: Securely back up this private key and its passphrase offline (e.g. on an encrypted external drive or password manager). If lost, automatic updates to installed clients cannot be signed.
2. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`:
   - The passphrase chosen during `npm run tauri signer generate`.

---

## 4. Code Signing & Windows SmartScreen

### Proprietary License Impact

- Open-source signing services (such as SignPath Foundation Free) require an approved open-source license (OSI-approved). Because Car OBD is proprietary (All rights reserved), SignPath free open-source signing **does not apply**.

### Production Code Signing Options:

1. **Commercial OV/EV Code Signing Certificate**: Purchase an Authenticode certificate from a trusted CA (e.g. Sectigo, DigiCert) with a hardware USB token or cloud HSM.
2. **Azure Trusted Signing (formerly Azure Code Signing)**: Cloud-based signing integrated into GitHub Actions via Microsoft Azure.

### Running Unsigned in Early Releases (v0.9.0-rc.1):

Until a commercial certificate is provisioned:

- Windows Defender SmartScreen will display an unknown publisher prompt:
  > _"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."_
- Instruct users to click:
  1. **More info** (المزيد من المعلومات)
  2. **Run anyway** (تشغيل على أي حال)

---

## 5. Remote Configuration Signing Workflow

Whenever feature flags or the minimum required version must be updated:

1. Prepare the raw payload JSON (e.g. `config.raw.json`):
   ```json
   {
     "app_enabled": true,
     "min_version": "0.9.0-rc.1",
     "latest_version": "0.9.0-rc.1",
     "message": null,
     "features": {
       "clear_codes": true,
       "live_data": true,
       "pre_purchase_report": true
     },
     "issued_at": "2026-11-18T12:00:00.000Z"
   }
   ```
2. Sign the configuration using the offline Ed25519 private key:
   ```bash
   node tools/sign-remote-config.mjs --config config.raw.json --key <OFFLINE_PRIVATE_KEY_BASE64> --out config.json
   ```
3. Verify the generated signature against the embedded public key:
   ```bash
   node tools/sign-remote-config.mjs --verify config.json --pubkey ZVRZNYrjEECIBwbxasdiuqIXMIIpVv2aD7YEcfNAwQs=
   ```
4. Commit and push `config.json` to the GitHub Pages branch (`gh-pages`).

---

## 6. Release Workflow & Publishing

Automated builds and releases are triggered when a Git version tag is pushed:

1. **Tagging a Release**:
   ```bash
   git tag v0.9.0-rc.1
   git push origin v0.9.0-rc.1
   ```
2. **Workflow Execution**:
   - The `.github/workflows/release.yml` workflow triggers automatically.
   - It compiles the Rust backend and React frontend on `windows-latest`.
   - It signs updater bundles with `TAURI_SIGNING_PRIVATE_KEY`.
   - It creates a GitHub Release and uploads:
     - `Car_OBD-setup.exe` (NSIS standalone installer)
     - `Car_OBD.msi` (Windows Installer package)
     - `Car_OBD.zip` & `Car_OBD.zip.sig` (Auto-updater packages)
     - `latest.json` (Updater manifest with download links and Minisign signature)
3. **Release Verification**:
   - Inspect the release at `https://github.com/Islam-Shahat/Car_OBD/releases`.
   - Verify all installer assets and signatures are attached and accessible.

---

## 7. Offline Backup Recommendation

GitHub is a hosting and collaboration platform, not a fault-tolerant offline backup:

- Regularly create an offline mirror of the complete repository:
  ```bash
  git clone --mirror https://github.com/Islam-Shahat/Car_OBD.git Car_OBD-mirror.git
  ```
- Store this mirror alongside the offline Ed25519 private key and Tauri Minisign updater key on secure, encrypted offline media.

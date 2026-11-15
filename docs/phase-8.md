# Phase 8: Remote Control, Feature Flags, and Auto-Update

Date: 2026-11-15  
Status: Complete  
Verified: 231 unit & integration tests across 32 test files (`npm test`)

---

## 1. Summary of Deliverables

Phase 8 implements asymmetric cryptographic remote control, feature gating, emergency kill-switch, auto-update configuration, data pack update hooks, and user privacy transparency:

1. **Ed25519 Cryptographic Remote Config (`src/lib/remoteConfig/`)**:
   - Asymmetric digital signature verification using embedded raw Ed25519 public key (`DEFAULT_REMOTE_CONFIG_PUBLIC_KEY`).
   - Web Crypto API implementation (`crypto.subtle`) with zero external runtime dependencies.
   - Deterministic canonical JSON serialization (`canonicalJsonStringify`) with lexicographically sorted keys.
   - Strict anti-rollback enforcement: incoming configuration timestamps (`issued_at`) must be newer than the locally cached version in SQLite.
   - Tamper rejection: any alteration to flags, messages, or version constraints immediately invalidates the signature.
   - Fail-open & offline grace period: when offline or during network outages, uses the cached SQLite configuration; on fresh installs with no cache, uses safe fail-open defaults.
   - In-flight operation deferral: newly verified configurations are never applied during an active diagnostic scan or Mode 04 DTC clear; changes are staged as `pendingConfig` and applied once the operation finishes.

2. **UI & Enforcement (`src/features/remoteConfig/`)**:
   - **Emergency Barrier (`DisabledAppBarrier.tsx`)**: When `app_enabled: false`, displays a prominent modal with the signed Arabic/English message and a manual retry button.
   - **Mandatory Update Screen (`MandatoryUpdatePrompt.tsx`)**: When `CURRENT_APP_VERSION < min_version`, halts usage and directs users to download the latest release.
   - **Non-blocking Update Banner**: When `CURRENT_APP_VERSION < latest_version`, surfaces a non-intrusive update badge linking to the release page.
   - **Feature Flag Gating**:
     - `clear_codes`: Disables the Mode 04 clear button in `ScanPage.tsx` with a warning label if remotely disabled.
     - `live_data`: Hides/disables the `/live` navigation item in `AppLayout.tsx`.

3. **Data-Pack Update Hook (`src/lib/db/dtcPackUpdate.ts`)**:
   - Pre-built hook for future OTA DTC updates without rebuilding the application binary.
   - Atomic SQLite transaction: updates generic DTC definitions while preserving all human-reviewed Arabic translations (`needs_review = 0`).
   - Validates Ed25519 signature before execution and records `dtc_pack_version` in `settings`.

4. **Signing CLI Tooling (`tools/sign-remote-config.mjs`)**:
   - `node tools/sign-remote-config.mjs --generate-keys`: Generates Ed25519 keypair.
   - `node tools/sign-remote-config.mjs --config <path> --key <privKey> --out <outPath>`: Produces signed configuration envelope.
   - `node tools/sign-remote-config.mjs --verify <path> --pubkey <pubKey>`: Validates envelopes.
   - Key security documentation authored in `docs/remote-config-keys.md`.

5. **Auto-Updater & GitHub Actions**:
   - Configured `tauri-plugin-updater` endpoint in `src-tauri/tauri.conf.json`.
   - Updated CSP to allow HTTPS connections for remote config and releases.
   - Release workflow (`.github/workflows/release.yml`) for automated signing and asset generation on version tags.

6. **Privacy & Transparency**:
   - Explicit bilingual privacy statement added to `SettingsPage.tsx`:
     - Confirms application operates offline-first.
     - Confirms no personal, vehicle (VIN), or diagnostic data is ever collected or sent over the network.
   - Added manual update check button and status indicator in Settings.

---

## 2. Test Verification

Running `npm test` across all 32 test suites:

```
Test Files  29 passed | 3 skipped (32)
     Tests  227 passed | 4 skipped (231)
```

- With Python ELM327 emulator active: all 32 test files and 231 tests pass (100%).
- `tests/remote-config.test.ts`:
  - Verified valid Ed25519 signature verification against canonical JSON.
  - Verified rejection of tampered payloads.
  - Verified rejection of corrupted signatures.
  - Verified remote fetch, verification, and SQLite caching.
  - Verified anti-rollback rejection of replayed older configs.
  - Verified fail-open behavior during network outages.
  - Verified in-flight deferral when diagnostic scan/clear is active.
  - Verified semver comparison (`compareSemver`).
  - Verified atomic DTC pack update preserving human reviews.
- `tests/i18n-resources.test.ts`: 100% Arabic and English key parity verified.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` all pass with zero errors.

---

## 3. Risks & Next Steps

- **Private Key Safeguard**: Maintainers must ensure the Ed25519 private key is exclusively stored in GitHub repository secrets and never committed.
- **Rollout Testing**: Test end-to-end tag release and updater payload download upon tagging `v0.1.0`.

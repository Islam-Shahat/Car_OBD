# OBD Diagnose — Release Checklist

Date: 2026-11-15  
Status: **PRE-RELEASE CANDIDATE (v0.9.0-rc.1) — BLOCKED ON HARDWARE, SIGNING, AND ICONS**  
Release Target: **v0.9.0-rc.1** (Release Candidate)

---

## 1. Core Architecture & Strict Invariants

| Status | Item                                                                                                   | Verified on  | Notes                                                     |
| :----: | :----------------------------------------------------------------------------------------------------- | :----------- | :-------------------------------------------------------- |
|  [x]   | **Stack**: Tauri v2 + React 19 + TypeScript (strict) + Tailwind CSS v4                                 | mock / build | Enforced in build configuration                           |
|  [x]   | **Separation of Concerns**: Rust side is exclusively a thin serial-port bridge; diagnostic logic in TS | mock / code  | Verified via Rust bridge and TypeScript driver boundaries |
|  [x]   | **Storage**: Fully local SQLite behind Repository interfaces. Zero remote database                     | mock         | Node:sqlite test suites & SQLite migrations               |
|  [x]   | **Licensing & Scope**: 100% free; generic powertrain OBD-II only; writes strictly Mode 04              | mock / code  | Strict interlock and scope checks                         |

---

## 2. Arabic & RTL User Experience

| Status | Item                                                                                             | Verified on    | Notes                                       |
| :----: | :----------------------------------------------------------------------------------------------- | :------------- | :------------------------------------------ |
|  [x]   | **First-Class RTL**: Right-to-Left layout symmetry across all screens, modals, dialogs           | mock / browser | Verified in headless browser & preview      |
|  [x]   | **Local Typography**: Packaged Google Cairo font (`woff2`) rendered offline; zero web fonts      | mock / build   | Local assets bundled in `src/assets/fonts/` |
|  [x]   | **Bilingual Key Parity**: 100% resource key and parameter parity between `ar.json` and `en.json` | mock           | Verified in `tests/i18n-resources.test.ts`  |
|  [x]   | **DTC Explanation Transparency**: Clear translation tier labeling with 1-tap English toggle      | mock           | Verified in `tests/db-review.test.ts`       |

---

## 3. Vehicle Detection & Catalog Search

| Status | Item                                                                                           | Verified on     | Notes                                                                      |
| :----: | :--------------------------------------------------------------------------------------------- | :-------------- | :------------------------------------------------------------------------- |
|  [x]   | **VIN First Identification**: Automatic Mode 09 PID 02 query; offline WMI decoding             | emulator / mock | Tested against synthetic VIN frames and Python emulator                    |
|  [x]   | **Multi-Brand WMI User Mapping**: Support for shared group WMIs with `last_used_at` preference | mock            | Verified in `tests/db-migrations.test.ts` & `tests/obd-vin-decode.test.ts` |
|  [x]   | **Manual Catalog Fallback**: 377 models across 46 makes with Arabic-normalized search          | mock            | Verified in `tests/vehicle-catalog.test.ts`                                |

---

## 4. Diagnostic Scan & Safe Clear Flow

| Status | Item                                                                                                            | Verified on      | Notes                                                  |
| :----: | :-------------------------------------------------------------------------------------------------------------- | :--------------- | :----------------------------------------------------- |
|  [x]   | **Scan Modes**: Reads Stored (03), Pending (07), Permanent (0A), Readiness (0101), Freeze Frame (02)            | emulator         | Verified against Python `scripts/emulator-dtc.py`      |
|  [x]   | **Banner Wording & Severity**: Neutral green state ("لم يتم العثور على أكواد أعطال") with powertrain disclaimer | mock / code      | Verified in `tests/phase-5-5-review.test.ts`           |
|  [x]   | **Separate Scan Notes**: Protocol/adapter notices isolated without coloring green banner                        | mock / code      | Isolated in UI                                         |
|  [x]   | **Safe DTC Clear Interlock**: Mandatory durable SQLite backup before sending Mode 04                            | mock             | Verified in `tests/runtime-storage.test.ts`            |
|  [ ]   | **Real Vehicle Mode 04 Execution**: Clearing trouble codes on real ECU hardware                                 | **not verified** | **BLOCKED**: Requires testing on a physical automobile |

---

## 5. Live Telemetry & Sensor Monitoring

| Status | Item                                                                                  | Verified on      | Notes                                                        |
| :----: | :------------------------------------------------------------------------------------ | :--------------- | :----------------------------------------------------------- |
|  [x]   | **Sequential Polling**: Sequential PID queries respecting half-duplex ELM327 protocol | emulator / mock  | Verified in `tests/live-poller.test.ts`                      |
|  [x]   | **Adaptive Delay Scheduler**: 10ms–100ms pauses preventing clone buffer overflow      | mock             | Unit tested in poller tests                                  |
|  [x]   | **Zero Memory Growth**: Fixed capacity 300-point ring buffer                          | mock             | Audited in live store tests                                  |
|  [x]   | **Performance Benchmark**: 54.16 updates/sec on 4 PIDs                                | emulator         | Benchmarked over TCP socket in `tests/live-emulator.test.ts` |
|  [ ]   | **Live Data on Physical Vehicle**: Continuous telemetry from a running car engine     | **not verified** | **BLOCKED**: Requires testing on a physical automobile       |

---

## 6. Remote Control, Feature Flags & Auto-Update

| Status | Item                                                                                        | Verified on | Notes                                     |
| :----: | :------------------------------------------------------------------------------------------ | :---------- | :---------------------------------------- |
|  [x]   | **Ed25519 Digital Signatures**: Raw 32-byte public key embedded in client; canonical JSON   | mock        | Verified in `tests/remote-config.test.ts` |
|  [x]   | **Anti-Rollback**: Rejects configs with older `issued_at` timestamps                        | mock        | Verified in `tests/remote-config.test.ts` |
|  [x]   | **Fail-Open & Offline Grace**: Uses cached config when offline; defaults to safe open state | mock        | Verified in `tests/remote-config.test.ts` |
|  [x]   | **In-Flight Safety**: Never interrupts an active scan or clear                              | mock        | Unit tested in remote config service      |
|  [x]   | **Tauri Updater Configuration**: Configured with Minisign pubkey and release endpoint       | mock / code | Configured in `tauri.conf.json`           |

---

## 7. Phase 7: History, PDF Reports & Pre-Purchase Mode

| Status | Item                                                                                                            | Verified on          | Notes                                                                                                               |
| :----: | :-------------------------------------------------------------------------------------------------------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------ |
|  [x]   | **Historical Scan Session Browser**: Viewing past scans from SQLite, comparing scans, and soft-delete           | emulator / synthetic | Implemented, verified only on the emulator and synthetic data (`HistoryPage.tsx`, `tests/history-flow.test.ts`)     |
|  [x]   | **Printable HTML / PDF Report Export**: Arabic RTL print stylesheet and WebView2 `PrintToPdf`                   | emulator / synthetic | Implemented, verified only on the emulator and synthetic data (`ReportModal.tsx`, `docs/samples/report-sample.pdf`) |
|  [x]   | **Pre-Purchase Used Car Mode**: Scoring drive cycles, monitor readiness, permanent codes, and suspicious resets | emulator / synthetic | Implemented, verified only on the emulator and synthetic data (`prePurchase.ts`, `tests/pre-purchase.test.ts`)      |

---

## 8. Quality Assurance & Real-Hardware Compatibility

| Status | Item                                                                                          | Verified on      | Notes                                                              |
| :----: | :-------------------------------------------------------------------------------------------- | :--------------- | :----------------------------------------------------------------- |
|  [x]   | **Synthetic Dialogue Multi-Protocol Tests**: Parser tests for CAN, KWP, and ISO 9141-2        | mock             | Verified against `tests/fixtures/synthetic-captures.json`          |
|  [x]   | **Python Emulator End-to-End**: Full driver and scan flow over TCP                            | emulator         | Tested via `scripts/run-emulator.py` and `scripts/emulator-dtc.py` |
|  [ ]   | **Physical ELM327 USB Adapter Test**: Handshake and commands on FTDI/PIC18F25K80              | **not verified** | **BLOCKED**: Requires physical adapter                             |
|  [ ]   | **Physical ELM327 Bluetooth Adapter Test**: Windows Bluetooth virtual COM port pairing        | **not verified** | **BLOCKED**: Requires physical adapter                             |
|  [ ]   | **Real Vehicle OBD-II Verification**: Full scan and live data on a real automobile            | **not verified** | **BLOCKED**: Requires testing on a physical car                    |
|  [ ]   | **Clean Windows Machine Verification**: Install and test on fresh non-developer Windows 10/11 | **not verified** | **BLOCKED**: Requires clean test machine                           |

---

## 9. Release Assets, Branding & Code Signing

| Status | Item                                                                                                | Verified on      | Notes                                                  |
| :----: | :-------------------------------------------------------------------------------------------------- | :--------------- | :----------------------------------------------------- |
|  [x]   | **Release Notes**: Authored for v0.9.0-rc.1 release candidate (`docs/release-notes-v0.9.0-rc.1.md`) | mock / code      | Updated to release candidate status                    |
|  [x]   | **Bilingual Documentation**: Comprehensive Arabic/English `README.md` and legal terms               | mock / code      | Maintained in repo                                     |
|  [ ]   | **Branded Application Icons**: Custom icons replacing default Tauri placeholders                    | **not verified** | **BLOCKED**: Default Tauri icons in `src-tauri/icons/` |
|  [ ]   | **Windows Authenticode Code Signing**: Microsoft SmartScreen trusted certificate                    | **not verified** | **BLOCKED**: Binaries currently unsigned               |

# Phase 3 — OBD-II services, scan, and safe clear

Status: **done**. Scope: typed OBD-II reads on top of the Phase 2 ELM327 driver, pure decoders,
full-scan orchestration, the scan UI, and the only permitted write flow (Service 04).

## Delivered

| Module                                 | Responsibility                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/lib/obd/frames.ts`                | Hex line parsing, ISO-TP `0:`/`1:` reassembly, length-line padding trim, multi-ECU messages            |
| `src/lib/obd/dtc.ts`                   | SAE J2012 P/C/B/U decoding, CAN vs ISO 9141/14230 payload shapes, de-duplication                       |
| `src/lib/obd/pids.ts`                  | Mode 01 PID decoders, supported-PID bitmap walking, core PID list                                      |
| `src/lib/obd/readiness.ts`             | PID 0101 MIL status, spark/compression ignition, continuous/non-continuous monitors                    |
| `src/lib/obd/vin.ts`                   | Mode 09 PID 02 VIN extraction, ISO 3779 check digit with an `applicable` flag                          |
| `src/lib/obd/obdService.ts`            | Typed Mode 01/02/03/07/0A/09 reads, supported-PID discovery, negative and optional-read classification |
| `src/lib/obd/scanService.ts`           | Full scan, progress events, single-operation lock, backup → confirm → clear → verification scan        |
| `src/lib/obd/scanTypes.ts`             | `ScanResult`, `ClearResult`, `ScanWarning`, `ScanProgress`, `DtcModeSupport`                           |
| `src/lib/obd/backup.ts`                | `ScanBackup` and `ScanBackupRepository` storage seam                                                   |
| `src/lib/db/localBackupRepository.ts`  | Verified localStorage backup store (interim until the SQLite phase)                                    |
| `src/features/scan/ScanPage.tsx`       | Connection-aware scan session, progress, clear confirmation dialog, clear result                       |
| `src/features/scan/ScanResultView.tsx` | VIN/check digit, MIL/readiness, DTC groups, freeze frames, live data, warnings, timing                 |

### Behaviour

- **Never assume a PID.** The scan walks `0100`, `0120`, `0140` … until the next-group bit is clear
  (cap: 8 groups) and requests only claimed PIDs. Missing bitmaps or `NO DATA` become warnings.
- **Mode support is discovered, not assumed.** Modes 03/07/0A and Mode 02 are attempted; negative
  responses and `NO DATA` mark the mode unsupported without failing the scan.
- **Freeze frames** (Mode 02) are read only when stored codes exist, one frame per stored code
  (cap 5). The frame DTC comes from Mode 02 PID 02; core PIDs are decoded from `42 PID FRAME data`.
- **VIN checksum** flags `vin-invalid` only when position 9 is a digit/X and does not match. A
  non-numeric position 9 is `applicable: false` (common outside North America), not a failure.
- **DTC payloads** handle CAN answers (even length, zero padding) and ISO 9141/14230 answers (odd
  length, count byte); identical codes from several ECUs are de-duplicated.
- **DTC count consistency**: PID 0101's stored-code count is compared with Mode 03 and a
  `dtc-count-mismatch` warning is emitted when they differ.
- **Safe clear** order is enforced in `ScanService`, not the UI: full pre-clear scan → durable,
  verified backup → explicit `confirm: true` → Service `04` → require `44` → full verification scan
  → report returning stored/pending codes. The operation lock refuses concurrent scans/clears.
- **Progress** (`ScanProgress`) is emitted for PIDs, status, DTCs, VIN, live data, freeze frames,
  backup, clear and verification. A throwing UI listener cannot abort a scan.
- **UI**: the not-connected state, run/rescan, step progress, structured results, all labels in
  Arabic and English, and Service 04 behind a confirmation dialog that states the backup and reset
  consequences.

## Proof

- **OBD unit tests**: 68 tests across `tests/obd-{frames,dtc,pids,readiness,vin,service,scan}.test.ts`.
  Full suite: **109 passed, 3 skipped** (the two opt-in emulator files are skipped without
  `ELM_EMULATOR=1`).
- **Acceptance examples covered**:
  - `43 01 33` → `P0133` (and P/C/B/U plus P1xxx/P2xxx/P3xxx ranges);
  - `4100 BE3F A813`, `4120 901F F015`, `4140 7A1C 8021` bitmap decoding;
  - VIN `WP0ZZZ99ZTS390000` (position 9 `Z` → checksum not applicable) and
    `1M8GDM9AXKP042788` (valid `X` check digit);
  - clear refuses without confirmation, saves before `04`, refuses during a scan, does not send
    `04` when the backup fails, reports a rejected/unconfirmed `04`, and reports a successful clear
    whose verification scan failed.
- **Live emulator (opt-in)**: `tests/obd-emulator.test.ts` starts `scripts/emulator-dtc.py`, which
  patches the stock scenario to store `P0143`, `P0196`, `P0234` (pending `P0300`, permanent
  `P0420`). Both tests pass against the real TCP emulator:
  - full scan returns the VIN, MIL on with 3 stored codes, all three DTC groups, supported PIDs and
    live data;
  - clear saves the backup, sends `04`, re-scans, and reports MIL off with no codes.
- **Gates**: `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `cargo fmt --check`, `cargo clippy -- -D warnings`.
- **Build**: `npm run tauri build` produced `obd-diagnose.exe` (3.19 MB), MSI (1.80 MiB) and NSIS
  (1.29 MiB).

## Emulator-only / fixture-only verification

| Area                                       | Verified against                                    |
| ------------------------------------------ | --------------------------------------------------- |
| Frame parsing, multi-ECU answers           | Unit fixtures only                                  |
| ISO 9141/14230 DTC count byte              | Unit fixtures only (emulator uses CAN)              |
| Mode 02 freeze frames                      | Unit fixtures only; emulator answers `NO DATA`/`7F` |
| Supported-PID walk `0100`…`0160`           | Unit fixtures + live emulator                       |
| Mode 01 decoders (RPM, temps, trims, O2…)  | Unit fixtures + live emulator where claimed         |
| PID 0101 readiness (spark, complete flags) | Unit fixtures + live emulator (MIL off/on)          |
| Mode 03/07/0A DTC decoding                 | Unit fixtures + live emulator (patched scenario)    |
| VIN multi-frame + checksum                 | Unit fixtures + live emulator                       |
| Service 04 clear + verification            | Unit fixtures + live emulator (patched scenario)    |

Still hardware-only: real ELM327/vehicle timing, clone-adapter quirks, unplug/replug, non-CAN
protocols, multi-ECU cars and freeze-frame support on real ECUs.

## Risks and follow-ups

- **Backup storage is interim.** `LocalStorageScanBackupRepository` keeps the last 20 backups in the
  WebView's localStorage; SQLite repositories, scan history and export arrive in Phase 4. The
  `ScanBackupRepository` seam already isolates this change.
- **Freeze frames are fixture-proven only.** The stock emulator does not implement positive Mode 02
  answers, so real-ECU frame layouts (frame echo, bitmap, DTC) remain unverified on hardware.
- **VIN checksum applicability** is a heuristic: a non-numeric position 9 is treated as
  "not applicable", never as a checksum failure.
- **DTC count mismatch** can be a false positive on ECUs that report a different count convention;
  it is a warning, not a failure.
- **No real COM E2E this phase** (no com0com/admin rights or physical adapter). The TCP emulator
  exercises the full TypeScript stack, not the Rust serial bridge.
- Installers are unsigned and app icons remain the default Tauri placeholders.

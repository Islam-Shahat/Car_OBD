# Architecture

Offline-first Windows diagnostic scanner for passenger cars. Arabic (RTL) first, English second.
This document is the working map of the codebase; keep it updated at the end of every phase.

## Scope guardrails

In scope: generic OBD-II (powertrain / engine) over ELM327-compatible adapters, DTC read, safe DTC
clear (Service 04), readiness monitors, live PIDs, PDF reports, pre-purchase inspection, local
history, signed remote config + auto-update.

Out of scope: cost/parts pricing, hardware sales, workshop billing, paid tiers, ECU
programming/flashing/adaptations, manufacturer-specific modules (ABS, airbag, transmission) in v1.
Anything that writes to the car other than Service 04 is forbidden.

## Layers

```
React + TypeScript UI          src/features/*, src/app/*
  business logic               src/lib/*
        │  Tauri IPC (invoke / events)
Rust host                      src-tauri  (COM-port bridge only, no OBD logic)
        │  COM port (USB / Bluetooth)
ELM327 adapter → OBD-II → ECU

SQLite (local, via tauri-plugin-sql behind Repository interfaces) — added with the data phase
```

Rules that keep the layers honest:

- **Rust stays thin.** It owns `list_ports / open / close / write / read` plus events. Parsing,
  protocol state machines, retries and decoding belong to TypeScript.
- **The Transport interface is the seam** between the ELM327 driver and the outside world:
  `SerialTransport` (Tauri invoke) and `MockTransport` (tests + emulator). The driver depends on the
  interface only.
- **Repositories own SQL.** UI and features never write SQL. Every repository has a SQLite
  implementation; the schema follows UUID primary keys plus `created_at`, `updated_at`,
  `deleted_at` (soft delete) so future sync does not need a redesign.
- **Pure functions for parsing.** Adapter responses, DTCs and PID frames decode through pure
  functions so they are unit-testable without a car.

## Repo layout

```
src-tauri/            Tauri host: config, capabilities, COM-port bridge (phase 2+)
src/
  app/                shell: layout, navigation, router, theme/language toggles
  features/           connection, scan, vehicles, dtc, livedata, history, reports, settings
  lib/
    elm327/           ELM327 driver over the Transport interface (phase 2+)
    obd/              OBD services, PID/DTC parsing
    db/               repositories + SQLite access
    i18n/             i18next setup, resources, direction rules
    remote-config/    signed remote configuration (later phase)
    theme/            theme preference + document class
  data/               DTC seed, vehicle seed (JSON)
tests/                Vitest unit tests
docs/                 architecture + per-phase reports
```

## Runtime shell (implemented)

- Hash-based routing (`src/app/router.tsx`) because the bundled app is served from Tauri's asset
  protocol: `/` Connect, `/scan`, `/history`, `/settings`.
- Arabic is the default language; `<html lang dir>` is the single source of truth for direction.
  `directionFor()` maps Arabic to `rtl` and everything else to `ltr`; components use logical CSS
  properties (`border-e`, `ps-*`, `me-*`) so no layout mirrors are needed.
- i18n keys must exist in both `ar.json` and `en.json`; a unit test enforces key and placeholder
  parity, and TypeScript types `t()` against the Arabic resource.
- Theme (`light | dark | system`) is a React context; the resolved theme toggles the `dark` class on
  `<html>`, and the preference is stored in `localStorage`. System changes are observed live.
- Fonts are bundled (`src/assets/fonts`, Cairo variable subsets) — no CDN requests at runtime.
  The Tauri CSP also blocks remote scripts/fonts.

## Connection and ELM327 driver (phase 2)

```
ConnectionPage → connectionStore (zustand)
                   │ connect()
             connect.ts  ── baud probe 38400 → 115200 → 9600
                   │
             Elm327Driver (src/lib/elm327)
                   │ Transport interface
        SerialTransport (Tauri invoke/events)  |  MockTransport (tests)
                   │
             Rust serial bridge → COM port
```

- **Rust bridge** (`src-tauri/src/serial.rs`) exposes `list_ports`, `open_port`, `close_port`
  and `write_port`. A reader thread emits `serial-data` (byte arrays) and `serial-closed`
  (with the OS error text). Closing the port sets a stop flag and joins the thread; a read
  timeout of 50 ms keeps the thread responsive. No OBD logic lives in Rust.
- **Transport seam** (`src/lib/elm327/transport.ts`): `open`, `close`, `write`, `onData`,
  `onClosed`. `SerialTransport` registers event listeners before opening so early bytes are
  not lost, and fails loudly on invalid UTF-8. `MockTransport` replays scripted responses and
  can simulate unplugging.
- **Command queue**: one command in flight. Every `send()` is chained onto a promise queue, so
  concurrent callers (scan, live data) cannot interleave bytes.
- **Framing**: responses end at `>`; echo, blank lines, `SEARCHING...`, `BUS INIT: ...OK` and
  the prompt are stripped. Multi-frame lines (`0: ...`, `1: ...`) are preserved for the OBD
  layer. Adapter tokens (`NO DATA`, `UNABLE TO CONNECT`, `BUS INIT ... ERROR`, `CAN ERROR`,
  `BUFFER FULL`, `?`, `ERROR`, `STOPPED`, `<DATA ERROR>`) map to typed `ElmError` codes.
- **Timeouts**: normal command 3 s, `ATZ` 6 s, ECU check (`0100`) 20 s. `ATST` is set from a
  200 ms target (`ATST32`), and host-side adaptive timing raises the timeout up to 12 s based
  on the last five response latencies. On timeout the driver sends a lone CR to resync the
  prompt and rejects with `timeout`; the queue continues with the next command.
- **Init**: `ATZ`, `ATE0`, `ATL0`, `ATS0`, `ATH0`, `ATI`, `AT@1`, `ATST32`, `ATAT1`, `ATSP0`,
  `0100`, `ATDP`. Optional commands (`ATI`, `AT@1`, `ATST`, `ATAT1`) may be rejected; that sets
  `limitedCommands`. Mandatory commands fail the connection. A failed `0100` with a "no ECU"
  code keeps the session open with `ecuPresent: false` (ignition off, wrong protocol, no ECU).
- **Baud autodetect**: after a failed init the transport is closed and the next baud rate is
  tried; the last adapter error is surfaced if all fail.
- **Clone warning**: `ATI` is parsed for `ELM327 vX.Y`. Versions 1.5/1.5a and 2.1 are flagged
  as likely clones; unknown versions are flagged too. Branded adapters with no ELM version
  string are not flagged. The warning is informational only — the app keeps working.
- **Disconnect**: `serial-closed` rejects the in-flight command with `closed`, the driver
  stops accepting commands, and the store returns to idle with a `disconnected` message.
  `SerialTransport.close()` always calls `close_port` (even when the OS already dropped the
  port), and `open_port` discards a stale session whose reader thread has finished. A fresh
  connect therefore re-runs the full init after replugging, without restarting the app.

Emulator setup and the hardware assumptions still to validate are in `docs/emulator.md`.

## OBD services and scan (phase 3)

```
ScanPage → ScanSession → ScanService ── operation lock, progress, backup → clear → verify
                              │
                          ObdService ── Mode 01/02/03/07/0A/09 reads, negative responses
                              │
                      pure decoders: frames, dtc, pids, readiness, vin
                              │
                        Elm327Driver (one command in flight)
```

- **Supported PIDs first.** `ObdService.readSupportedPids()` walks `0100`, `0120`, `0140` … until the
  “next group” bit is clear (hard cap at 8 groups). The scan only requests PIDs that the bitmaps
  claim; a missing bitmap or `NO DATA` becomes a `pids-unavailable` warning, never an assumption.
- **Pure decoding.** `frames.ts` parses hex lines, reassembles ISO-TP `0:`/`1:` blocks, trims the
  length line’s padding and separates answers from several ECUs. `dtc.ts` decodes SAE J2012 P/C/B/U
  codes and distinguishes CAN answers (even payload, no count byte) from ISO 9141/14230 answers
  (odd payload, count byte). `pids.ts` owns the Mode 01 decoders and the supported-PID bitmap;
  `readiness.ts` owns PID 0101; `vin.ts` extracts the VIN and applies the ISO 3779 check digit.
- **Vehicle identity.** `vinDecode.ts` adds the WMI (`manufacturerName`, canonical `makeSlug`) from
  the verified NHTSA vPIC table in `src/data/wmi.json`, plus both model-year candidates encoded by
  VIN position 10. `VehicleIdentityCache` is created by the connection store and shared with the
  scan; the VIN is read once per connection, concurrent callers share the promise, and a missing
  VIN is cached as `null` and never blocks a scan. Dataset provenance is in `docs/data-sources.md`.
- **VIN check digit.** A non-numeric position 9 is reported as `applicable: false` and is not a
  failure; only a numeric/`X` check digit can produce `vin-invalid`.
- **Multi-ECU headers.** For CAN 11-bit sessions the scan sends `ATH1`, keeps the `7E8`–`7EF`
  response identifier as `ecuId`, reassembles frames per ECU, and restores `ATH0` in a `finally`
  block. `readPidAll()` returns one reading per ECU; DTCs show their `ecuId`. 29-bit CAN and legacy
  buses stay header-off, and a rejected `ATH1` produces a `headers-unavailable` warning without
  failing the scan.
- **Typed reads.** `ObdService` reads Mode 01 PIDs, MIL/readiness, Modes 03/07/0A, Mode 09 PID 02 and
  Mode 02 freeze frames. ECU negative responses become `ObdError` with the NRC; `NO DATA` and
  “service not supported” are classified as optional-read failures so a car that lacks Mode 07/0A/02
  still produces a complete scan with warnings. NRCs are mapped to translated messages.
- **One scan service.** `ScanService.runFullScan()` returns adapter info, protocol, VIN identity, MIL
  status, stored/pending/permanent DTCs, freeze frames, live core PIDs, drive-history PIDs, supported
  PIDs, warnings and timing, and emits `ScanProgress` events. Freeze frames are read only when stored
  codes exist (capped at 5 frames). A DTC-count mismatch between PID 0101 and Mode 03 is reported,
  not hidden.
- **Safe clear.** `ScanService.clearStoredCodes()` holds a single-operation lock, refuses without
  `confirm: true`, runs a full pre-clear scan, saves the backup and verifies it before sending `04`,
  requires the `44` confirmation, then re-scans and classifies the result as `codes_returned`,
  `no_codes_returned` or `verification_failed`. Readiness is snapshotted before and after, and RPM
  above zero adds an engine-running warning without blocking. A failed verification scan is reported
  separately from a failed clear. Clear never runs during a scan.
- **Backup repository seam.** `ScanBackupRepository` is the storage boundary. Until the SQLite phase
  it is implemented by `LocalStorageScanBackupRepository`, which reads back and verifies its write
  before `save()` resolves; Mode 04 is never sent after a silently failed backup. `ScanBackup` stores
  explicit DTC groups, freeze frames and readiness for the Phase 4 tables.
- **Scan UI.** `ScanPage` shows the not-connected state, runs the scan with step progress, renders
  VIN/WMI/year/check-digit status, MIL and readiness, all three DTC groups with ECU identifiers,
  freeze frames, live readings, drive history, warnings and timing, and gates Service 04 behind an
  explicit confirmation dialog. All labels, units, monitors, warnings and NRC messages are
  translated in Arabic and English.

## Safety invariants (DTC clear)

Clearing codes is the only write operation and must always follow this order:

1. Show the warning and disclaimer (diagnosis only; clearing does not fix the fault; readiness
   monitors and freeze frame are reset).
2. Persist a local snapshot of stored codes, pending codes and the freeze frame before anything is
   sent. Today this is the verified localStorage repository; the SQLite repository replaces it in
   the data phase.
3. Require explicit confirmation (dialog in the UI, `confirm: true` in `ScanService`).
4. Send Service 04, then re-scan and report whether codes returned (verification re-scan).

A clear must never start while a scan is running, and a remote-config update must never interrupt an
in-flight clear. These rules live in the scan/clear service, not in the UI.

## Remote governance and updates (later phase)

Signed JSON feature flags with a full offline grace period; Tauri v2 updater backed by GitHub
Releases. Config can hide/disable features but cannot abort a clear or block local diagnosis.
No paywalls, no licensing: the app is free and fully client-side.

## Build and quality gates

- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`.
- `cargo fmt --check`, `cargo clippy -- -D warnings`.
- `npm run tauri build` produces NSIS + MSI installers under `src-tauri/target/release/bundle/`.
- CI (`.github/workflows/build.yml`) runs the gates above on Windows and reports installer sizes in
  the job summary; it uploads the installers as build artifacts (no GitHub Release yet).
- Release profile is size-oriented: `lto`, `opt-level = "s"`, `strip`, `panic = "abort"`.

## Phase plan

| Phase | Content                                                                            | Status |
| ----- | ---------------------------------------------------------------------------------- | ------ |
| 1     | Scaffold, tooling, app shell, i18n/RTL, theme, CI                                  | done   |
| 2     | Serial bridge + Transport abstraction + ELM327 emulator + connection UI            | done   |
| 3     | OBD services: PIDs, DTCs, readiness, VIN, freeze frames, scan UI, safe clear       | done   |
| 3.5   | Review fixes: VIN/WMI identity, PID audit, multi-ECU headers, NRC, clear reporting | done   |
| 4     | SQLite schema, repositories, scan history                                          |        |
| 5     | Safe clear persistence in SQLite + history reporting                               |        |
| 6     | Live data (uPlot)                                                                  |        |
| 7     | PDF reports                                                                        |        |
| 8     | Pre-purchase inspection mode                                                       |        |
| 9     | Signed remote config + auto-updater, real-car validation                           |        |

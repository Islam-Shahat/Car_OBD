# Phase 3.5 — review fixes on top of Phase 3

Status: **done**. Base commit: `47fe30c` (Phase 3). Scope: the review items only — vehicle
identity, PID audit, multi-ECU headers, negative-response messages, clear reporting and emulator
proof. No Phase 4 work, no SQLite, no UI redesign.

## A. Vehicle identity from the VIN

- `VehicleIdentity` extends the existing `VinResult` with `wmi`, `manufacturerName`, `makeSlug` and
  `yearCandidates` (`src/lib/obd/vinDecode.ts`).
- The WMI table is generated from the NHTSA vPIC API (266 verified entries). Source, licence and
  retrieval date are recorded in `src/data/wmi.json` and `docs/data-sources.md`.
- An unknown WMI is not an error: manufacturer and make are `null`; the VIN and year candidates are
  still shown.
- Model-year candidates come from position 10 and are always a pair 30 years apart (`T` →
  1996/2026). The model itself is never inferred.
- The check-digit rule is unchanged and stricter than "always validate": a mismatch is reported
  only when position 9 is a digit or `X`. A letter means "not applicable", which avoids false
  alarms on VINs from markets that do not use the check digit. Both messages explain the rule.
- `ObdService.readVehicleIdentity()` reads the VIN once. `VehicleIdentityCache` is created by the
  connection store after a successful init and shared with `ScanService`; concurrent callers reuse
  the same promise, and a failed read is cached as `null`. A missing VIN never blocks a scan; it
  becomes the existing `vin-unavailable` warning.
- `makes.json` is a 61-slug canonical list used for `makeSlug` and the future vehicle catalog. No
  Appendix C exists in the repository or its history, so no appendix claims are made.

## B. PID audit

PIDs are still read only when the supported-PID bitmap claims them. The audit fixed the gaps below;
no PID was added speculatively.

### Mode 01 measurements

| PID           | Measurement                                 | Formula                                | Unit | Notes                      |
| ------------- | ------------------------------------------- | -------------------------------------- | ---- | -------------------------- |
| `0x04`        | Calculated engine load                      | `raw * 100 / 255`                      | %    |                            |
| `0x05`        | Coolant temperature                         | `raw - 40`                             | °C   |                            |
| `0x06`        | Short fuel trim, bank 1                     | `(raw - 128) * 100 / 128`              | %    |                            |
| `0x07`        | Long fuel trim, bank 1                      | same                                   | %    |                            |
| `0x08`        | Short fuel trim, bank 2                     | same                                   | %    |                            |
| `0x09`        | Long fuel trim, bank 2                      | same                                   | %    | audit added                |
| `0x0C`        | Engine speed                                | `word / 4`                             | rpm  | multi-ECU via `readPidAll` |
| `0x0D`        | Vehicle speed                               | `raw`                                  | km/h |                            |
| `0x0F`        | Intake-air temperature                      | `raw - 40`                             | °C   |                            |
| `0x10`        | Mass air flow                               | `word / 100`                           | g/s  |                            |
| `0x11`        | Throttle position                           | `raw * 100 / 255`                      | %    |                            |
| `0x14`–`0x1B` | O2 voltage and trim, banks 1–2, sensors 1–4 | `raw / 200`, `(raw - 128) * 100 / 128` | V, % | matrix covered by tests    |
| `0x2F`        | Fuel level                                  | `raw * 100 / 255`                      | %    |                            |
| `0x42`        | Control-module voltage                      | `word / 1000`                          | V    |                            |
| `0x46`        | Ambient-air temperature                     | `raw - 40`                             | °C   |                            |
| `0x5C`        | Engine-oil temperature                      | `raw - 40`                             | °C   |                            |

### Drive-history PIDs (new)

These are read once per scan when claimed and stored in `ScanResult.driveHistory`. Unsupported
fields stay `null`; nothing is guessed.

| PID    | Field                     | Formula | Unit    |
| ------ | ------------------------- | ------- | ------- |
| `0x1F` | `runTimeSeconds`          | `word`  | seconds |
| `0x21` | `distanceWithMilKm`       | `word`  | km      |
| `0x30` | `warmupsSinceCleared`     | `raw`   | cycles  |
| `0x31` | `distanceSinceClearedKm`  | `word`  | km      |
| `0x4D` | `timeWithMilMinutes`      | `word`  | minutes |
| `0x4E` | `timeSinceClearedMinutes` | `word`  | minutes |

New units (`seconds`, `minutes`, `km`, `count`) and labels are translated in English and Arabic.
O2 bank/sensor labels use the same `o2Voltage`/`o2Trim` keys with `bank`/`sensor` parameters.

## C. Multi-ECU headers

The Phase 3 scan left the driver in its init state (`ATH0`), so every response was header-off and
the optional `ecuId` field was never populated. Changes:

- CAN 11-bit sessions (`ISO 15765`, not `29`-bit) send `ATH1` for the scan and restore `ATH0` in a
  `finally` block. 29-bit CAN and legacy ISO 9141/14230 stay header-off.
- `frames.ts` recognises response identifiers `7E8`–`7EF`, keeps them as `ecuId`, and reassembles
  ISO-TP frames per ECU instead of merging them.
- `readPidAll()` returns one `PidReading` per answering ECU; scalar displays use the first reading.
  DTCs carry `ecuId`; the result view shows it next to the code.
- If an adapter rejects `ATH1`, the scan continues header-off and emits a translated
  `headers-unavailable` warning. It never fails the scan.

Verified by unit fixtures and the live emulator (single ECU). Real multi-ECU cars, 29-bit CAN and
legacy buses remain hardware-only.

## D. Negative-response messages

- `ObdError.nrc` is preserved for Modes 03/07/0A/04 and any negative response.
- `src/lib/i18n/errorKeys.ts` maps the common NRCs (`0x10`, `0x11`, `0x12`, `0x13`, `0x21`, `0x22`,
  `0x31`, `0x33`, `0x78`, `0x7E`/`0x7F`) to translated messages in English and Arabic.
- Unknown NRCs fall back to a translated message that includes the numeric code, so the UI never
  shows an untranslated identifier.
- The scan UI prefers the NRC message and keeps the technical detail as secondary text.

## E. Clear reporting

- `ClearOutcome` is exactly `codes_returned`, `no_codes_returned` or `verification_failed`. The UI
  shows the machine-readable outcome and explains it; it never says the fault was "fixed" or
  "confirmed fixed".
- A clean verification scan is followed by a note that codes may return after driving, so the user
  should re-check after a few drive cycles.
- `verification_failed` is reported separately from a failed clear: the ECU accepted `04`, but the
  verification scan did not complete.
- `ClearResult` now carries `readinessBefore`/`readinessAfter` and `engineRunning`.
- `ScanBackup` stores explicit `stored`, `pending`, `permanent`, `freezeFrames` and `readiness`
  fields for the Phase 4 tables, while keeping `result` for compatibility with existing entries.
- Before the confirmation dialog, RPM is read from the live PID `0x0C` (first ECU). RPM above zero
  adds a translated warning that stopping the engine is safer, but the user can still continue.
  There is no new blocking condition.

## F. Emulator and docs

- `scripts/emulator-dtc.py` still stores `P0143`, `P0196`, `P0234` (pending `P0300`, permanent
  `P0420`) and now patches Mode 02: supported freeze-frame PIDs, the frame DTC, coolant, RPM and
  speed. Stock Mode 02 request patterns only allow one trailing frame byte, so the wrapper widens
  them to accept the app's full `02 <pid> <frame>` request.
- The opt-in live test asserts the freeze frame (`P0143`, 55 °C, 1726 rpm, 10 km/h), the drive
  history (117 s, 0 km with MIL, 4 warm-ups, 50 km since cleared, 0 min with MIL, 91 min since
  cleared), the DTC groups, VIN and the clear flow.
- Only freeze-frame 0 is implemented by the wrapper. Frames 1–2 return no supported-PID bitmap, so
  the scan records one `freeze-frame-unavailable` warning and keeps frame 0. Real multi-frame
  layouts still need hardware.
- `docs/data-sources.md` is the data register; this file is the Phase 3.5 report;
  `docs/phase-3.md` counts are corrected; `docs/architecture.md` and `docs/emulator.md` describe the
  identity cache, headers and freeze-frame patch.

## AGENTS.md finding

- `AGENTS.md` was introduced in `3dbdfd7` together with `CLAUDE.md`.
- Both files are 49 lines and contain the same "Part 0: Permanent project context" text; the AGENTS
  file has no agent-specific instructions of its own.
- Its deletion (`D AGENTS.md`) exists only in the working tree and is not part of Phase 3.5. It was
  not restored or deleted by this work, and it is excluded from every Phase 3.5 commit.
- `CLAUDE.md` remains the permanent project context. If `AGENTS.md` is kept later, it should contain
  agent-specific rules instead of duplicating `CLAUDE.md`; that is a separate decision.

## Proof

- **Default suite**: 143 passed, 3 skipped, 146 total. The 3 skips are the two opt-in emulator
  files.
- **OBD cases**: 104 (including the 2 opt-in emulator tests).
- **Live emulator**: `$env:ELM_EMULATOR = '1'; npx vitest run tests/obd-emulator.test.ts` → 2
  passed.
- **New/updated tests**: VIN/WMI decoding and dataset integrity, year candidates, identity-cache
  reuse, ATH1 single/multi-frame parsing, per-ECU PID and DTC `ecuId`, NRC mapping and Mode 03/07/0A
  rejections, O2 matrix, drive-history decoders and null behaviour, clear outcomes, readiness
  snapshots, RPM warning and the `7F0422` clear rejection.
- **Gates**: `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `cargo fmt --check`, `cargo clippy -- -D warnings`.

## Still fixture-only or hardware-only

| Area                                  | Verified against                                      |
| ------------------------------------- | ----------------------------------------------------- |
| WMI table and year candidates         | Unit tests + generated dataset                        |
| VIN check digit applicability         | Unit tests                                            |
| Multi-ECU ATH1 parsing and `ecuId`    | Unit fixtures + live emulator (single ECU)            |
| Real multi-ECU car                    | Hardware only                                         |
| 29-bit CAN and ISO 9141/14230 headers | Unit fixtures only                                    |
| Mode 02 freeze frames                 | Unit fixtures + live emulator (frame 0, patched)      |
| Multiple freeze frames on a real ECU  | Hardware only                                         |
| Drive-history PIDs                    | Unit fixtures + live emulator                         |
| NRC messages                          | Unit tests                                            |
| Service 04 clear and verification     | Unit fixtures + live emulator (patched scenario)      |
| Real COM-port end-to-end              | Not run (no com0com/admin rights or physical adapter) |

## Risks and follow-ups

- The emulator wrapper patches frame 0 only; a real ECU's frame echo and bitmap layouts still need
  validation.
- `headers-unavailable` is a warning by design. On a clone that rejects `ATH1`, multi-ECU answers
  remain indistinguishable.
- The WMI dataset covers only makes returned by the API at retrieval time; unknown or ambiguous
  WMIs stay `null` rather than being guessed.
- The `ScanBackup` shape gained fields; old localStorage entries still read through `result`, but
  Phase 4 must write and read the explicit fields.
- `AGENTS.md` remains a working-tree deletion and needs a separate decision.

Part 0: Permanent project context (CLAUDE.md)

Product
A lightweight Windows desktop app (laptop) that connects to a passenger car through an ELM327 OBD-II adapter (USB or Bluetooth, both appear as a COM port), lets the user pick the car (make / model / year), runs a scan, reads fault codes (DTCs), shows a clear Arabic/English explanation, can clear codes safely, shows live sensor data, and exports a PDF report. Includes a "Pre-purchase inspection" mode that detects suspicious code clearing on used cars.

Hard decisions already made (do not revisit)
• Stack: Tauri v2 + React + TypeScript (strict). NOT Electron. Goal: small installer (a few MB) and low RAM. OBD logic lives in TypeScript; Rust is only a thin serial-port bridge.
• Database: local SQLite (offline-first) via tauri-plugin-sql behind Repository interfaces. No cloud database for core data.
• Pricing: everything is free. No paid tiers, no licensing, no payments.
• Target OS: Windows 10/11 first (WebView2). Keep code portable where cheap.
• Language: Arabic first (RTL), English second. Language toggle in settings.

Explicitly OUT of scope (do not build, do not scaffold)
• Repair cost estimation and spare-parts prices.
• Selling hardware or adapter bundling.
• Workshop mode (customers, invoices, multi-customer management).
• Paid tiers, subscriptions, license keys.
• ECU programming, coding, flashing, adaptations, or anything that writes to the car beyond the standard OBD-II "clear DTCs" service (Mode 04).
• Manufacturer-specific systems (ABS, airbag, transmission via UDS) in v1. Engine/powertrain generic OBD-II only. Design so it can be added later.

Architecture
React + TS UI (all business logic lives here)
ELM327 driver | OBD services | DTC decoder | report builder | remote-config
| Tauri IPC invoke()/events
Rust (thin): serial port bridge only
list_ports / open / close / write / read (+ events)
| COM port (USB or Bluetooth)
ELM327 adapter -> OBD-II -> ECU
SQLite via tauri-plugin-sql (migrations), behind a Repository interface. Keep Rust minimal. Do not move OBD logic into Rust.

Fault-code data and lookup
• Generic SAE J2012 codes (~9,500) imported at build time from OBDex, bundled offline as a static asset (`public/dtc-pack.json`) to keep JS bundle lean.
• Arabic in tiers (Tier 1 descriptions/causes/steps, Tier 2 descriptions), flagged `needs_review = 1` until a mechanic confirms via CSV review workflow. Manufacturer-specific codes out of scope for v1.
• Code lookup order: make-specific row, then generic row, then unknown-code fallback.

Car identification
• VIN first (Mode 09 PID 02, offline WMI decode to a make slug via `wmi.json`, year candidates the user confirms, never infer the model).
• Fallback is manual selection from `vehicle_catalog` (reconciled with Appendix C, 46 makes / 380 models) with Arabic/English search and a free-text option. Never block a scan because of VIN.

Repo layout
/src-tauri Rust: serial bridge, updater/plugin wiring
/src
/features/connection, scan, vehicles, dtc, livedata, history, reports, settings
/lib/elm327, obd, db, i18n, remote-config
/data dtc manifest, vehicle catalog, glossary, wmi (JSON)
/tests, /docs

Engineering rules
• TypeScript strict. No any without a comment. Small modules, pure functions for parsing so they are unit-testable.
• Transport abstraction: Transport interface (open/close/write/onData) with SerialTransport (real) and MockTransport (tests/emulator). The ELM327 driver depends only on the interface.
• Repository pattern for all data access: VehicleRepository, ScanRepository, DtcRepository, etc., with SqliteRepository implementations. UI never writes SQL directly.
• All primary keys are UUIDs; every table has created_at, updated_at, deleted_at (soft delete). This keeps future sync possible without redesign.
• Lightweight by default: prefer small dependencies. Charts via uPlot (or equally light). State via Zustand or React context. Avoid heavy UI kits. Bundle fonts locally (Cairo variable); no CDN calls.
• i18n with i18next; no hard-coded user-facing strings. Use CSS logical properties (margin-inline-start, etc.) for RTL.
• Errors: never swallow serial/protocol errors silently; map them to friendly Arabic/English messages.
• Verify current Tauri v2 plugin APIs from official docs before using them; do not rely on memory for API names.
• Reports and docs are claims, not facts: verify against code and git history.
• Every phase ends with: summary, test results, what was verified only on fixtures or the emulator, risks, suggested next phase.

Safety and wording rules (non-negotiable)
• Clearing codes is the only write operation. It must: (1) show a warning, (2) auto-save a backup of stored/pending codes and freeze frame to SQLite first, (3) require explicit confirmation, (4) re-scan afterwards and report whether codes returned.
• Wording rule: after a clear, report `codes_returned`, `no_codes_returned`, or `verification_failed`; never say "fixed" or "confirmed fixed".
• Never start a clear while a scan is in progress. Never interrupt an in-flight clear because of remote config.
• Show a clear disclaimer: the app is for diagnosis; clearing a code does not fix the fault; readiness monitors and freeze frame are reset by clearing.

Definition of done (per phase)
Builds with no TS/Rust warnings, unit tests pass, acceptance criteria met and demonstrated (emulator or real car), docs updated.

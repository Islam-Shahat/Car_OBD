Part 0: Permanent project context (put in CLAUDE.md)
Product
A lightweight Windows desktop app (laptop) that connects to a passenger car through an ELM327 OBD-II adapter (USB or Bluetooth, both appear as a COM port), lets the user pick the car (make / model / year), runs a scan, reads fault codes (DTCs), shows a clear Arabic/English explanation, can clear codes safely, shows live sensor data, and exports a PDF report. Includes a "Pre-purchase inspection" mode that detects suspicious code clearing on used cars.
Hard decisions already made (do not revisit)
• Stack: Tauri v2 + React + TypeScript. NOT Electron. Goal: small installer (a few MB) and low RAM.
• Database: local SQLite (offline-first). No cloud database for core data. Supabase is NOT used now.
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
SQLite via tauri-plugin-sql (migrations), behind a Repository interface
Keep Rust minimal. Do not move OBD logic into Rust.
Repo layout (adjust only with good reason)
/src-tauri Rust: serial bridge, updater/plugin wiring
/src
/features/connection, scan, vehicles, dtc, livedata, history, reports, settings
/lib/elm327, obd, db, i18n, remote-config
/data dtc seed, vehicles seed (JSON)
/tests, /docs
Engineering rules
• TypeScript strict. No any without a comment. Small modules, pure functions for parsing so they are unit-testable.
• Transport abstraction: Transport interface (open/close/write/onData) with SerialTransport (real) and MockTransport (tests/emulator). The ELM327 driver depends only on the interface.
• Repository pattern for all data access: VehicleRepository, ScanRepository, DtcRepository, etc., with SqliteRepository implementations. UI never writes SQL directly.
• All primary keys are UUIDs; every table has created_at, updated_at, deleted_at (soft delete). This keeps future sync possible without redesign.
• Lightweight by default: prefer small dependencies. Charts via uPlot (or equally light). State via Zustand or React context. Avoid heavy UI kits. Bundle fonts locally (Cairo or Noto Naskh Arabic); no CDN calls.
• i18n with i18next; no hard-coded user-facing strings. Use CSS logical properties (margin-inline-start, etc.) for RTL.
• Errors: never swallow serial/protocol errors silently; map them to friendly Arabic/English messages.
• Verify current Tauri v2 plugin APIs from official docs before using them; do not rely on memory for API names.
• Each phase: write tests, update /docs, keep a clean commit history, and end by summarizing what was done, what is untested, and open risks.
Safety rules (non-negotiable)
• Clearing codes is the only write operation. It must: (1) show a warning, (2) auto-save a backup of stored/pending codes and freeze frame to SQLite first, (3) require explicit confirmation, (4) re-scan afterwards and report whether codes returned.
• Never start a clear while a scan is in progress. Never interrupt an in-flight clear because of remote config.
• Show a clear disclaimer: the app is for diagnosis; clearing a code does not fix the fault; readiness monitors and freeze frame are reset by clearing.
Definition of done (per phase)
Builds with no TS/Rust warnings, unit tests pass, acceptance criteria met and demonstrated (emulator or real car), docs updated.

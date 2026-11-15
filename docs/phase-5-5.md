# Phase 5.5: Review Fixes from Phase 5 and Safe Browser Preview Mode

Date: 2026-11-15  
Status: Complete  
Verified: 210 unit & integration tests (`npm test`, 207 passed, 3 skipped when live emulator offline), 0 TypeScript errors (`npm run typecheck`), 0 ESLint errors (`npm run lint`), release `.exe` and installers verified.

---

## 1. Summary of Changes

Phase 5.5 addresses all items identified during the Phase 5 review and resolves the browser storage initialization error (`Cannot read properties of undefined (reading 'invoke')`) when running outside Tauri:

1. **Safe Browser Preview Mode (`src/lib/db/runtime.ts`)**:
   - **Root Cause of Initial Error**: `@tauri-apps/plugin-sql` expects Tauri IPC bridges (`window.__TAURI_INTERNALS__`). In standard web browsers outside Tauri, `__TAURI_INTERNALS__` is undefined, throwing `Cannot read properties of undefined (reading 'invoke')`.
   - **Environment Gating**: Added `isTauriEnvironment(): boolean` and `isDevPreview(): boolean`.
   - **In-Memory Fallback**: When running in browser preview during development (`!isTauriEnvironment() && !import.meta.env.PROD`), storage safely initializes in-memory (`openBrowserStorage()`), seeded with the full vehicle catalog (377 entries) and preview DTC codes.
   - **Production Safety Invariant**: In production builds (`import.meta.env.PROD === true`), storage **never** falls back silently. Running outside Tauri throws `Error('Tauri IPC bridge is unavailable in production build. Real SQLite storage is required.')` and displays the real error screen. Verified by `tests/runtime-storage.test.ts`.
   - **Mode 04 Durability Check**: In the real Tauri application, Mode 04 clear requires a verified SQLite backup (`SqliteScanBackupRepository`). An in-memory backup can never satisfy this invariant in production.

2. **Permanent Browser Preview Banner (`src/app/AppLayout.tsx`)**:
   - Rendered at the top of the application in development browser preview:
     - **Arabic**: "وضع المعاينة في المتصفح: لا يتم حفظ أي بيانات ولا يمكن الاتصال بمحول حقيقي."
     - **English**: "Browser preview mode: Nothing is saved and no real adapter can connect."
   - Real serial port connection is disabled in preview mode with clear notices.

3. **Virtual Demo Experience (`src/lib/elm327/demoSession.ts`)**:
   - Offered in preview mode: "بدء تجربة وضع العرض" / "Start Demo Experience".
   - Uses `MockTransport` with a scripted adapter fixture responding to AT commands, PIDs, stored/pending/permanent codes (P0133, P0300, P0420), Porsche VIN (`WP0ZZZ99ZTS390000`), and live engine RPM (1726 RPM).
   - Allows experiencing the full diagnostic journey (connect, car selection, scan progress, DTC inspection, clear confirmation dialog, Mode 04 clear against mock, and post-clear verification re-scan).
   - Prominently labeled with a purple demo badge: "وضع تجريبي (بيانات وهمية)" / "Demo Data".
   - Strictly guarded: `createDemoConnection()` throws if `!isDevPreview()`, ensuring it is unreachable in production builds.

4. **Result Banner Wording & Meaning (`src/features/scan/ScanResultView.tsx` & locales)**:
   - Replaced "Healthy" / "سليم" with:
     - **Green state title**: "لم يتم العثور على أكواد أعطال" / "No fault codes found"
     - **Green state note**: "أكواد المحرك والانبعاثات فقط؛ الأنظمة الأخرى مثل الفرامل (ABS) والوسائد الهوائية وناقل الحركة لم يتم فحصها. عدم وجود أعطال لا يعني بالضرورة أن السيارة بحالة جيدة." / "Engine and emissions codes only. Other systems such as ABS, airbags, and transmission are not scanned. The absence of fault codes does not prove the overall vehicle condition is good."
     - **Yellow state title**: "أكواد معلقة" / "Pending codes"
     - **Red state title**: "تم اكتشاف أعطال" / "Faults detected"
   - **Banner Color Independence**: Banner color derives strictly from car fault data (`stored.length > 0 || mil.on ? 'fault' : pending.length > 0 ? 'warning' : 'healthy'`). Adapter and protocol warnings (`warnings`) moved to a distinct "Scan notes" ("ملاحظات الفحص") section and do not alter banner color.

5. **VIN-to-Make Multi-Brand Memory (`wmi_user_map`)**:
   - Migration 7 introduced `wmi_user_map_v2` with `PRIMARY KEY (wmi, make_slug)` and `last_used_at`.
   - Allows multiple makes per group WMI (e.g. `LVT` for Chery, Jetour, Exeed).
   - Remembers the last used make for that WMI.
   - On detected unmapped WMIs, prefills the last used make, displays badge: "من اختيارك السابق" / "From your previous choice", and asks the user to confirm the make rather than resolving silently.
   - Verified entries in `wmi.json` are never overridden.

6. **Clear Dialog Confirmation**:
   - Confirmed clear dialog inspects live PID 010C: if RPM > 0, displays the engine-running warning banner: "يبدو أن المحرك يعمل (دورات المحرك أكبر من صفر). إطفاء المحرك قبل المسح أكثر أمانًا. يمكنك المتابعة على أي حال."
   - Warns without blocking user action.

---

## 2. Clarifications & Discrepancy Reconciliation

1. **Live Data & Charts Claim**:
   - A previous summary mistakenly mentioned browsing live data and charts in preview.
   - **Correction**: Live data monitoring, PID scheduling, and uPlot time-series charts do NOT exist yet; they belong strictly to Phase 6. Phase 5 and 5.5 are confined to the core diagnostic flow (Connect -> Car Selection -> Scan -> Results -> Safe Clear Flow).

2. **Catalog Model Count**:
   - A previous summary mentioned "245+ models".
   - **Correction**: `src/data/vehicle-catalog.json` contains exactly **377 unique entries** across **46 makes**.

3. **Test Suite Count**:
   - Baseline at Phase 5 delivery (commit `93a3e98`): 25 test files, 200 tests.
   - In an earlier working session, Phase 6 code and tests (`tests/live-data-poller.test.ts`, `tests/live-charts.test.ts`, `tests/live-session.test.ts`, `tests/obd-units.test.ts`) were drafted prematurely.
   - Those 4 Phase 6 test files and all telemetry code were isolated to git branch `feature/phase-6-wip` so `master` remains strictly on Phase 5.5.
   - Phase 5.5 test suite on `master`: **27 test files, 210 tests** (207 passed, 3 skipped when live emulator offline).
   - New test files added in Phase 5.5:
     - `tests/runtime-storage.test.ts` (4 tests): verifies non-Tauri detection, loud production error without fallback, and in-memory preview storage initialization.
     - `tests/phase-5-5-review.test.ts` (6 tests): verifies demo experience, result banner wording and health tier calculation, multi-make WMI user map, and engine-running clear warning.

---

## 3. Real App Proof & Measurements

### Idle RAM Measurements

Measured on release build (`src-tauri/target/release/obd-diagnose.exe`) using Windows Process Management APIs (`Win32_Process` / `Get-Process`):

| Component | Process | Private Bytes (MB) | Working Set (MB) |
|---|---|---|---|
| **Host Application** | `obd-diagnose.exe` | **10.33 MB** | **42.36 MB** |
| **WebView2 Browser** | `msedgewebview2.exe` (Main) | 40.86 MB | 132.31 MB |
| **WebView2 Renderer** | `msedgewebview2.exe` (Tab) | 98.73 MB | 113.97 MB |
| **WebView2 GPU** | `msedgewebview2.exe` (GPU) | 32.43 MB | 71.06 MB |
| **WebView2 Utilities** | `msedgewebview2.exe` (3 procs) | 22.30 MB | 68.35 MB |
| **Total Process Tree** | **Host + 6 Children** | **204.65 MB** | **428.05 MB** |

- Host private memory remains exceptionally low (~10.3 MB), and working set is stable (~42.3 MB vs 42.2 MB in Phase 4.6 baseline).

### Release Binaries & Installers

- Binary: `src-tauri/target/release/obd-diagnose.exe`
- NSIS Setup: `src-tauri/target/release/bundle/nsis/OBD Diagnose_0.1.0_x64-setup.exe` (**2.09 MiB** / 2,186,795 bytes)
- MSI Installer: `src-tauri/target/release/bundle/msi/OBD Diagnose_0.1.0_x64_en-US.msi` (**2.71 MiB** / 2,842,624 bytes)

### Captured Screenshots (`docs/screens/`)

All 20 screenshots captured at 1280x850 in Arabic RTL and English LTR:

| File | Language | View Description |
|---|---|---|
| `docs/screens/01-connect-idle-ar.png` | Arabic RTL | Connect screen (idle, preview banner, demo card available, real serial disabled) |
| `docs/screens/01-connect-idle-en.png` | English LTR | Connect screen (idle) |
| `docs/screens/02-connect-demo-ar.png` | Arabic RTL | Connect screen (connected to virtual demo adapter) |
| `docs/screens/02-connect-demo-en.png` | English LTR | Connect screen (connected to virtual demo adapter) |
| `docs/screens/03-vehicles-detected-ar.png` | Arabic RTL | Vehicles page (detected VIN with model-year candidates & user choice confirmation) |
| `docs/screens/03-vehicles-detected-en.png` | English LTR | Vehicles page (detected VIN) |
| `docs/screens/04-vehicles-manual-catalog-ar.png` | Arabic RTL | Vehicles page (manual catalog search with Arabic normalization) |
| `docs/screens/04-vehicles-manual-catalog-en.png` | English LTR | Vehicles page (manual catalog search) |
| `docs/screens/05-scan-progress-ar.png` | Arabic RTL | Scan progress bar and active diagnostic steps |
| `docs/screens/05-scan-progress-en.png` | English LTR | Scan progress bar |
| `docs/screens/06-scan-result-healthy-ar.png` | Arabic RTL | Green banner ("لم يتم العثور على أكواد أعطال") with engine/emissions disclaimer |
| `docs/screens/06-scan-result-healthy-en.png` | English LTR | Green banner ("No fault codes found") |
| `docs/screens/07-scan-result-warning-ar.png` | Arabic RTL | Yellow banner ("أكواد معلقة") |
| `docs/screens/07-scan-result-warning-en.png` | English LTR | Yellow banner ("Pending codes") |
| `docs/screens/08-scan-result-fault-ar.png` | Arabic RTL | Red banner ("تم اكتشاف أعطال"), stored P0133, pending P0300, permanent P0420 |
| `docs/screens/08-scan-result-fault-en.png` | English LTR | Red banner ("Faults detected") |
| `docs/screens/09-clear-confirm-dialog-ar.png` | Arabic RTL | Clear dialog with engine-running warning (RPM > 0) |
| `docs/screens/09-clear-confirm-dialog-en.png` | English LTR | Clear dialog with engine-running warning |
| `docs/screens/10-clear-result-ar.png` | Arabic RTL | Clear result view (`no_codes_returned` with drive cycle advisory) |
| `docs/screens/10-clear-result-en.png` | English LTR | Clear result view |

---

## 4. Layout Observations

1. **RTL Directional Symmetry**:
   - The Arabic layout renders cleanly using Cairo font with appropriate leading and kerning.
   - All icons, badges, and progress meters mirror correctly without clipped text or overflowing containers.
2. **Clear Dialog Accessibility**:
   - Clear confirmation dialog focuses on the primary clear action while highlighting the engine-running warning in amber.
   - Non-blocking behavior allows immediate clear execution without hindering the mechanic.
3. **Banner Hierarchy**:
   - Separating adapter/protocol notes into "Scan notes" ensures that adapter quirks (such as clone detection) do not falsely alarm the user that the vehicle has mechanical trouble codes.

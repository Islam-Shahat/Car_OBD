# Phase 7: History, PDF Reports, and Pre-Purchase Inspection Mode

Date: 2026-11-15  
Status: Complete  
Verification: 246 tests passing across 33 test files (`npm test`), clean build (`tsc -b && vite build`), automated sample PDF generation (`docs/samples/report-sample.pdf`), preview screenshot (`docs/samples/report-sample-preview.png`), and embedded font CMap extraction (`tools/verify-sample-pdf.py`).  
**Honesty Notice**: Tested exclusively against synthetic captures, the Python ELM327 emulator, and automated browser/Tauri preview environments. **Zero real cars and zero physical OBD adapters were used in this verification.**

---

## 1. Summary of Deliverables

Phase 7 delivers historical vehicle record management, printable PDF reporting with bilingual Arabic/English typography, and a dedicated Pre-Purchase Inspection Mode:

### 1.1 History Management (`src/features/history/`)
- **Vehicle-Grouped Session Browser (`HistoryPage.tsx`)**:
  - Filter historical diagnostic sessions by vehicle or view all records chronologically.
  - Cards summarize session date, vehicle identity (VIN / make / model / year), overall status badge, and DTC count.
- **Side-by-Side Scan Comparison (`ScanCompareModal.tsx`)**:
  - Compare any two historical sessions for the same vehicle (or cross-vehicle).
  - Categorizes codes into:
    - **Resolved Codes**: Present in earlier scan, cleared in later scan.
    - **Persistent Codes**: Present across both scans.
    - **New Codes**: Detected in the newer scan.
  - Displays side-by-side readiness monitor status changes (e.g. Incomplete $\rightarrow$ Ready).
- **Soft-Delete with Confirmation**:
  - Repository interface extended with `softDelete(id: string): Promise<void>`.
  - Implemented in both `InMemoryScanRepository` and `SqliteScanRepository` (`UPDATE scan_sessions SET deleted_at = ?, updated_at = ? WHERE id = ?`).
  - History UI excludes soft-deleted sessions and prompts with a modal dialog before deleting.

### 1.2 Diagnostic Report & PDF Export (`src/features/reports/`)
- **Printable Report Component (`DiagnosticReportView.tsx`)**:
  - Structured printable A4 layout designed with Tailwind CSS and dedicated `@media print` rules in `src/index.css`.
  - Uses the Cairo variable font for Arabic and Latin text, guaranteeing typography consistency across desktop and print renderers.
  - Page-break protection (`break-inside: avoid`, `page-break-inside: avoid`) on cards and tables to prevent splitting codes or readiness items across pages.
  - Color preservation enabled via `-webkit-print-color-adjust: exact` and `print-color-adjust: exact`.
- **Watermark & Transparency**:
  - Prominent `"SAMPLE - emulator data"` (and Arabic `"عينة - بيانات محاكي"`) badge and background watermark on emulator/sample reports.
- **VIN Masking Toggle**:
  - Privacy switch in report modal and WhatsApp summary allowing the user to display or mask the vehicle VIN (e.g. `JM1BM1***123456`).
- **Legal & Technical Disclaimers**:
  - Mandatory report footer detailing app version (`0.9.0-rc.1`), scan timestamp, engine and emissions scope limitation, and code-clearing warning:
    > "Clearing codes turns off the warning light but does not repair the underlying defect. If the fault persists, the check engine light will return."
- **Sharing Channels**:
  - **Print / Save as PDF**: Invokes `window.print()` targeting the native OS print engine (defaulting to Microsoft Print to PDF on Windows).
  - **WhatsApp Summary (`whatsAppSummary.ts`)**: Generates an emoji-structured, clean text summary in Arabic or English with vehicle info, status, DTC list, readiness overview, and disclaimer for quick messaging.

### 1.3 Pre-Purchase Inspection Mode (`src/lib/obd/prePurchase.ts` & `docs/pre-purchase-inspection.md`)
- **Dedicated Diagnostic Mode**:
  - User selectable on the Scan page (`normal` vs `pre_purchase`).
  - Persisted in session metadata (`scan_sessions.mode = 'pre_purchase'`).
- **Multi-Factor Heuristics**:
  - Evaluates Readiness Monitors (PID 0101, uncompleted count).
  - Evaluates Distance Since Codes Cleared (PID 0131).
  - Evaluates Warm-ups Since Codes Cleared (PID 0130).
  - Evaluates Time Since Codes Cleared (PID 014E).
  - Evaluates Engine Run Time (PID 011F).
  - Evaluates Distance Traveled with MIL Active (PID 0121).
  - Evaluates Permanent Diagnostic Trouble Codes (Mode 0A), which survive standard Mode 04 clearing commands.
- **Indicator Scoring & Non-Accusatory Classification**:
  - Classifies findings into three neutral levels:
    - `no_indicators`: Normal driving cycle completed with monitors ready.
    - `some_indicators`: Partial drive cycle or ambiguous conditions (e.g. recent battery disconnect or short commute).
    - `several_indicators`: Incomplete readiness monitors paired with near-zero distance/warmups or surviving Mode 0A permanent codes.
  - **Strictly Non-Accusatory Wording**: Uses cautious phrasing such as *"Indicators suggest codes may have been cleared recently"*; never asserts fraud or seller intent.
  - Displays all raw counters in the report to allow human mechanics and buyers to form their own judgment.
  - Explicitly states technical limitations: repairs, battery disconnects, and ECU resets reset counters; monitor drive cycles take time; counters saturate (e.g. 255 warm-ups, 65,535 km).

---

## 2. Sample PDF Generation & Verification Evidence

As required, a real sample PDF was generated from an emulator scan journey and thoroughly verified:

### 2.1 Artifacts Generated
- Sample PDF: `docs/samples/report-sample.pdf` (1,237,569 bytes)
- Visual Preview: `docs/samples/report-sample-preview.png` (151,292 bytes)

### 2.2 Verification Methodology & Results
1. **Generation Pipeline (`tools/generate-sample-report.mjs`)**:
   - Spawns local preview server and headless Chromium via Chrome DevTools Protocol (CDP).
   - Simulates pre-purchase inspection scan session with Arabic locale.
   - Triggers `Page.printToPDF` with A4 dimensions and background graphics enabled.
   - Captures full-page viewport screenshot for visual proof.
2. **Font Embedding & CMap Inspection (`tools/verify-sample-pdf.py`)**:
   - Decompressed PDF font subset streams and parsed `ToUnicode` CMaps:
     - **CMaps Parsed**: 51 font subset CMaps.
     - **Mapped Characters**: 208 glyph mappings.
     - **Arabic Glyphs**: 123 shaped Arabic glyphs and ligatures mapped, including isolated, initial, medial, and final forms (e.g. Initial Feh `ﻓ`, Medial Hah `ﺤ`, Final Sad `ﺺ` for `فحص`).
     - **Latin Characters**: 40 glyphs mapped.
     - **Embedded Font Family**: Verified presence of the embedded **Cairo** font family.
3. **Visual & Layout Inspection**:
   - Inspected `docs/samples/report-sample-preview.png`:
     - Clean RTL directionality with Cairo font rendering.
     - Latin text (DTC codes `P0143`, `P0196`, `P0234`, `P0300`, `P0420` and PIDs) properly aligned left-to-right within RTL text flow without bidirectional glitches.
     - High-contrast status badges and pre-purchase warning cards properly styled with exact print colors.
     - Prominent watermark `"SAMPLE - emulator data"` present.

---

## 3. Test Suite Verification

All 33 test files and 246 tests pass without error:

```
Test Files  33 passed | 3 skipped (36)
     Tests  246 passed | 4 skipped (250)
  Duration  4.54s
```

### New Tests Added:
- `tests/pre-purchase.test.ts`:
  - `evaluates recently cleared codes as several_indicators`: Simulates low km (12 km), 1 warmup, 4 incomplete monitors, and 1 permanent DTC $\rightarrow$ flags `several_indicators`.
  - `evaluates normal extended driving as no_indicators`: Simulates 1,850 km, 64 warmups, all monitors complete $\rightarrow$ flags `no_indicators`.
  - `evaluates partial driving / battery disconnect as some_indicators`: Simulates 55 km, 6 warmups, partial monitors $\rightarrow$ flags `some_indicators`.
  - `handles vehicles with missing drive history PIDs gracefully`: Ensures missing PIDs do not crash assessment and are marked `unavailable`.
- `tests/history-flow.test.ts`:
  - `manages sessions, lists by vehicle, and supports soft-delete`: Verifies session creation, filtering by `vehicleId`, and soft-delete exclusion.
  - `masks VIN according to privacy settings`: Validates `maskVin` formatting for 17-character VINs and shorter IDs.
  - `generates WhatsApp summary text`: Verifies bilingual summary text formatting, DTC lists, readiness statistics, and disclaimers.

---

## 4. Hardware Verification Notice & Known Risks

- **Real Car Status**: **NOT VERIFIED ON A REAL CAR.** All tests and verification were performed on the Python ELM327 emulator (`python -m elm -s car`) and synthetic test fixtures.
- **Physical Printer / Windows Print Dialog**:
  - In the Tauri desktop application on Windows, calling `window.print()` triggers the native Windows system print dialog. On Windows 10/11, the default selected printer is typically "Microsoft Print to PDF", allowing instant file saving.
  - A fallback option to copy formatted text for WhatsApp is provided directly in the UI.
- **Heuristic Limitations**:
  - Pre-purchase inspection heuristics rely on standard OBD-II PIDs (0131, 0130, 014E, etc.). Some vehicle models or older ECUs do not implement these optional PIDs. When a PID is unsupported, the heuristic marks that factor as `unavailable` rather than assuming guilt or innocence.

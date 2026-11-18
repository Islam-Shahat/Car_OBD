# Phase 7.6 Hardening and Security Audit Report

## 1. Overview & Provenance

- **Repository**: `obd-diagnose`
- **Commits**: `7b5e9d9` through `a4b930b`
- **Target Version**: `0.9.0-rc.1`
- **Scope**: Hardening, security remediations, and verification of Phase 7 features (Scan History, Printable PDF Reports, Pre-Purchase Inspection Heuristics) against emulator and synthetic fixtures only.
- **Verification Rule**: Emulator and synthetic fixtures only. No claims of real-vehicle or real-hardware testing.

---

## 2. Item-by-Item Changes & Evidence

### Item 1: Path Injection Hardening for PDF Export (`7b5e9d9`)
- **Files Touched**: `src-tauri/src/lib.rs`
- **What Changed**:
  - Implemented `PdfExportState` with a synchronized `HashSet<PathBuf>` to track authorized, application-generated PDF export paths.
  - Constrained `save_pdf` to write exclusively to the user's `Downloads` folder with programmatic filenames (`obd-report-<timestamp>.pdf`).
  - Added strict authorization check in `show_in_folder` rejecting unrecorded, external, or path-traversal paths before spawning `explorer.exe`.
  - Replaced shell-concatenated command arguments with parameterized argument slices (`build_explorer_select_args`).
- **Test Proof**:
  - `src-tauri/src/lib.rs::tests::builds_fixed_folder_pdf_save_path`
  - `src-tauri/src/lib.rs::tests::rejects_unrecorded_or_tampered_paths_in_show_in_folder_guard`
  - `src-tauri/src/lib.rs::tests::builds_separate_explorer_arguments_without_shell_concatenation`

### Item 2: Webview Environment Security (`a49f864`)
- **Files Touched**: `src-tauri/src/main.rs`
- **What Changed**:
  - Stripped `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` environment variable before initializing the Tauri runtime in non-debug builds (`#[cfg(not(debug_assertions))]`).
  - Prevents external processes from injecting Chromium flags into the desktop webview.
- **Verification**: Clean compilation and manual inspection of environment sanitization logic.

### Item 3: Database Migrations & Session Type Provenance (`d73a4e4`)
- **Files Touched**: `src/lib/db/migrations.ts`, `tests/db-migrations.test.ts`, `tests/session-watermark.test.ts`
- **What Changed**:
  - Restored missing migration 2 schema statements for clean zero-to-head migration runs.
  - Updated migration 8 to ensure legacy sessions created prior to provenance tracking default to `session_type = 'unknown'`.
  - Proved watermark decisions derive strictly from `sessionType` ('demo' or 'unknown' show watermark; 'real' does not).
- **Test Proof**:
  - `tests/db-migrations.test.ts`: "produces an identical schema on a fresh database vs a database upgraded from version 7, and marks existing sessions as unknown"
  - `tests/session-watermark.test.ts`: "determines watermark visibility strictly from sessionType, never from content"

### Item 4: Pre-Purchase Inspection Heuristics Hardening (`7863821`)
- **Files Touched**: `src/lib/obd/prePurchase.ts`, `tests/pre-purchase.test.ts`
- **What Changed**:
  - Saturated counter values (`0xFF` / 255 warmups, `0xFFFF` / 65,535 km / 65,535 min) are now treated as `unavailable` rather than reassuring proof of extended driving.
  - PIDs `0121` (Distance with MIL on) and `014D` (Time with MIL on) are scored inversely: zero distance/time is normal (0 points), while high or saturated distance/time is scored as suspicious (+2 points).
  - Clarified heuristic note: "No indicators found does not prove that codes were not cleared."
- **Test Proof**:
  - `tests/pre-purchase.test.ts`: "treats 0xFF/0xFFFF counter values as unavailable instead of normal driving"
  - `tests/pre-purchase.test.ts`: "scores PIDs 0121 and 014D (distance/time with MIL on) in the opposite direction of since-cleared counters"

### Item 5: Enforced VIN Masking Default (`15e8a40`)
- **Files Touched**: `src/features/reports/DiagnosticReportView.tsx`, `src/features/reports/SampleReportPage.tsx`, `src/features/reports/whatsAppSummary.ts`, `tests/history-flow.test.ts`
- **What Changed**:
  - Enforced masked VIN (`WVWZZZAUZ********`) as default across all report views, exports, and WhatsApp summaries.
  - Unmasking requires explicit user interaction (`showVin`).
- **Test Proof**:
  - `tests/history-flow.test.ts`: WhatsApp summary VIN masking tests verifying masked default.

### Item 6: Release Binary PDF Verification Without Remote Debugging (`35e0a6f`)
- **Files Touched**: `src-tauri/src/lib.rs`, `src/app/App.tsx`, `src/features/reports/SampleReportPage.tsx`, `docs/samples/report-sample.pdf`, `tools/verify-sample-pdf.py`
- **What Changed**:
  - Removed `--remote-debugging-port` dependency for sample PDF verification.
  - Added internal `--sample-pdf-check` CLI switch and Tauri `save_pdf` command driving WebView2 `PrintToPdf` natively.
  - Generated and validated `docs/samples/report-sample.pdf` (582,978 bytes, 4 pages, A4 format).
- **Test Proof**:
  - `tools/verify-sample-pdf.py` verified 33 embedded font subsets and ToUnicode CMaps covering Cairo Arabic and Latin glyphs.

### Item 7: Sample PDF Text Extraction & Arabic Stream Order (`a4b930b`)
- **Files Touched**: `docs/samples/pdf-visual-inspection.md`, `tools/verify-sample-pdf.py`
- **What Changed**:
  - Extracted coordinate-level PDF text streams.
  - Discovered and documented Chromium's visual LTR stream order limitation for Arabic glyphs.
- **Test Proof**:
  - `tools/verify-sample-pdf.py` copy/paste text extraction order test.

---

## 3. Honest Limitations Identified in Phase 7.6

1. **PDF Copy/Paste Reading Order**:
   - WebView2 / Chromium's `PrintToPdf` writes Arabic glyphs in **visual left-to-right stream order** inside the PDF content stream (`/ReversedChars`).
   - Copying Arabic text from the PDF produces reversed character and word ordering in external PDF readers.
   - Visual display and physical printing are completely normal and unaffected.
   - The "Copy for WhatsApp" button in the Report Modal provides clean logical Unicode UTF-8 text as the recommended workaround.
2. **Pre-existing ESLint Errors in Phase 7 UI Files**:
   - 16 ESLint errors existed in `HistoryPage.tsx`, `ReportModal.tsx`, `DiagnosticReportView.tsx`, `reportTypes.ts`, and `ScanResultView.tsx` (primarily `no-explicit-any` on dynamic i18n keys and `no-misused-promises` on button onClick handlers).
   - Handed off for remediation in Phase 7.7.

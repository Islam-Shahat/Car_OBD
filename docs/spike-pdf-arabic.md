# Spike: PDF Generation Approaches & Arabic/RTL Rendering

**Date**: 2026-11-15  
**Status**: Decided & Verified (Approach 1: HTML + CSS Print via WebView2)  
**Verification Target**: Edge WebView2 (Chromium engine) on Windows 10/11 with Cairo font.

---

## 1. Objective

Compare approaches for generating diagnostic and pre-purchase inspection PDF reports with correct Arabic typography, bidirectional (BiDi) text flow (mixing Arabic descriptions with English DTC codes and units), and clean print layout, while keeping the report template in one single place.

---

## 2. Comparison of Approaches

| Criteria | Approach 1: HTML + `@media print` via WebView2 / Browser | Approach 2: Client-side JS Library (`jspdf` / `pdfmake` / `@react-pdf`) |
| :--- | :--- | :--- |
| **Arabic Shaping** | **Native Chromium (HarfBuzz)**: Contextual glyph joining (initial, medial, final, isolated) and ligatures (Lam-Alef) render correctly out of the box. | **Poor / Fragile**: Detached letters (`م ح ر ك`), broken ligatures without manual reshaping pipelines (`bidi.js` + manual font embedding). |
| **Bi-directional Flow** | **Native (ICU BiDi)**: Mixed Arabic prose with English codes (e.g. `P0300 - احتراق عشوائي`) and metrics (`1726 RPM`, `85°C`) maintain proper visual order. | **Prone to Reversal**: Numbers and Latin codes often reverse or shift to the wrong end of sentences upon line wrapping. |
| **Font Integration** | Seamlessly uses the local Cairo font (`cairo-arabic.woff2` and `cairo-latin.woff2`) already bundled in the app. | Requires base64 embedding of entire TrueType fonts into JavaScript bundles (+1.5 MB to 3 MB). |
| **Bundle Size Overhead** | **0 KB**: Built into Chromium / WebView2. | **500 KB – 3 MB** additional runtime dependencies. |
| **Template Maintenance** | **Single source of truth**: The report is a standard React component styled with Tailwind and print CSS. Usable for on-screen preview, print dialog, and PDF export. | **Dual maintenance**: Requires maintaining a separate PDF-specific layout tree (PDF primitives or PDFMake JSON schema). |
| **PDF Generation Path** | `window.print()` triggers the native Windows Print dialog ("Save as PDF" / "Microsoft Print to PDF"). | Programmatic `doc.save('report.pdf')` or Blob download. |

---

## 3. Decision & Verified Implementation

**Selected: Approach 1 (HTML Report with Print-CSS via WebView2).**

### Verified Technical Reasons:

1. **Native Arabic & BiDi Rendering**: Edge WebView2 (Chromium) uses HarfBuzz and ICU, providing proper contextual glyph joining, ligatures, and mixed-direction flow (Arabic descriptions + English DTC codes like `P0143`).
2. **Single Template Architecture**: The report layout is authored once as a React component (`DiagnosticReportView.tsx`) that renders on-screen in a modal (`ReportModal.tsx`) and outputs to PDF via `@media print`.
3. **Zero Extra Dependencies**: Avoids adding hundreds of kilobytes of fragile client-side PDF polyfills.
4. **Tested Print Flow & One-Click PDF Implementation**:
   - **Real machine test results**: Testing `window.print()` in WebView2 on Windows demonstrated that while `Microsoft Print to PDF` was the default printer on this machine, calling `window.print()` pops up the full Edge WebView2 print preview dialog. If a physical or virtual office printer is installed as default on the user's machine, Windows does NOT default to "Save as PDF". Furthermore, the dialog requires multiple clicks: the user must inspect the preview, click "Print", wait for the Windows "Save Print Output As" file dialog, type a filename, select a folder, and click "Save".
   - **One-Click `save_pdf` implementation**: To eliminate awkward multi-step modal dialogs and printer destination confusion, we implemented a dedicated Rust command `save_pdf` using `ICoreWebView2_7::PrintToPdf` (via the `webview2-com` crate).
   - **Behavior**: Clicking "Print / Save as PDF" in the Tauri desktop app immediately triggers `save_pdf`, writing directly to `%USERPROFILE%\Downloads\obd-report-{timestamp}.pdf` without opening the print dialog. Upon completion, it automatically reveals the saved PDF in Windows File Explorer using `show_in_folder` (`explorer /select,<path>`).
   - **Fallback**: If running in browser development mode or if `save_pdf` fails, `ReportModal.tsx` gracefully falls back to `window.print()`.
5. **Alternative Sharing Options**:
   - One-click "Copy Summary for WhatsApp" (`navigator.clipboard.writeText`) with pre-formatted bilingual summary and status emojis.
   - One-click toggle to mask or display the vehicle VIN for privacy during public sharing.

---

## 4. Known Limitations & Mitigations

1. **Print Dialog Flow in Browser / Fallback Mode**:
   - *Limitation*: When falling back to `window.print()`, the standard browser/system print dialog appears, requiring the user to verify the printer destination and choose a file path. Windows cannot be assumed to always default to "Save as PDF" if hardware printers are installed.
   - *Mitigation*: The app uses native `PrintToPdf` in Tauri by default, bypassing the print dialog entirely.
2. **Background Graphics & Colors**:
   - *Limitation*: By default, some print dialogs disable background colors/borders.
   - *Mitigation*: Enforce `print-color-adjust: exact; -webkit-print-color-adjust: exact;` in print CSS so badges, severity colors, and table headers retain their styling on paper and PDF.
3. **Page Breaks**:
   - *Limitation*: Long DTC lists or freeze frame tables could split across page boundaries awkwardly if container constraints are misconfigured.
   - *Mitigation*: Avoid `break-inside-avoid` on multi-item container groups; instead apply `break-inside: avoid` (`page-break-inside: avoid`) strictly on individual fault cards, readiness tables, and disclaimer blocks.

# Spike: PDF Generation Approaches & Arabic/RTL Rendering

Date: 2026-11-15  
Status: Decided (Approach 1: HTML + CSS Print via WebView2)

---

## 1. Objective

Compare approaches for generating diagnostic and pre-purchase inspection PDF reports with correct Arabic typography, bidirectional (BiDi) text flow (mixing Arabic descriptions with English DTC codes and units), and clean print layout, while keeping the report template in one place.

---

## 2. Comparison of Approaches

| Criteria                 | Approach 1: HTML + `@media print` via WebView2 / Browser                                                                                                             | Approach 2: Client-side JS Library (`jspdf` / `pdfmake` / `@react-pdf`)                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Arabic Shaping**       | **Native (HarfBuzz)**: Contextual glyph joining (initial, medial, final, isolated) and ligatures (Lam-Alef) render flawlessly.                                       | **Poor / Requires Polyfills**: Detached letters (`م ح ر ك`), broken ligatures without manual reshaping pipelines (`bidi.js` + font embedding). |
| **Bi-directional Flow**  | **Native (ICU BiDi)**: Mixed Arabic prose with English codes (e.g. `P0300 - احتراق عشوائي`) and metrics (`1726 RPM`, `85°C`) maintain proper visual order.           | **Scrambled**: Numbers and Latin codes often reverse or shift to the wrong end of sentences upon line wrapping.                                |
| **Font Integration**     | Seamlessly uses the local Cairo font (`Cairo-VariableFont.woff2`) already bundled in the app.                                                                        | Requires base64 embedding of entire TrueType fonts into JavaScript bundles (+1.5 MB to 3 MB).                                                  |
| **Bundle Size Overhead** | **0 KB**: Built into Chromium / WebView2.                                                                                                                            | **500 KB – 3 MB** additional runtime dependencies.                                                                                             |
| **Template Maintenance** | **Single source of truth**: The report is a standard React component styled with Tailwind and print CSS. Usable for on-screen preview, print dialog, and PDF export. | **Dual maintenance**: Requires maintaining a separate PDF-specific layout tree (PDF primitives or PDFMake JSON schema).                        |
| **PDF Generation Path**  | `window.print()` triggers the native Windows Print dialog ("Save as PDF" / "Microsoft Print to PDF").                                                                | Programmatic `doc.save('report.pdf')` or Blob download.                                                                                        |

---

## 3. Decision

**Selected: Approach 1 (HTML Report with Print-CSS via WebView2).**

### Rationale:

1. **Flawless Arabic & BiDi Rendering**: Edge WebView2 (Chromium) uses HarfBuzz and ICU, guaranteeing correct glyph joining, ligatures, and mixed-direction flow (Arabic + English DTC codes).
2. **Single Template Architecture**: The report layout is authored once as a React component (`DiagnosticReportView`) that renders both on-screen and to print/PDF via `@media print`.
3. **Zero Extra Dependencies**: Avoids adding hundreds of kilobytes of fragile client-side PDF polyfills.
4. **Export & Sharing Workflow**:
   - On-screen modal preview with zoom/scroll.
   - One-click Print / Save as PDF via `window.print()`.
   - One-click "Copy Summary for WhatsApp" (`navigator.clipboard.writeText`) with pre-formatted bilingual summary and status emojis.

---

## 4. Known Limitations & Mitigations

1. **User Interaction for File Destination**:
   - _Limitation_: `window.print()` opens the standard Windows print dialog requiring the user to confirm the destination ("Save as PDF") and pick the save folder.
   - _Mitigation_: The dialog on Windows 10/11 defaults to "Save as PDF" or "Microsoft Print to PDF", providing a familiar, native operating system file picker.
2. **Background Graphics & Colors**:
   - _Limitation_: By default, some print dialogs disable background colors/borders.
   - _Mitigation_: Enforce `print-color-adjust: exact; -webkit-print-color-adjust: exact;` in print CSS so badges, severity colors, and table headers retain their styling on paper and PDF.
3. **Page Breaks**:
   - _Limitation_: Long DTC lists or freeze frame tables could split across page boundaries awkwardly.
   - _Mitigation_: Add `break-inside: avoid` (`page-break-inside: avoid`) on all fault cards, readiness tables, and disclaimer blocks.

# Visual Inspection and Text Extraction Report: Sample Diagnostic PDF

## 1. Overview & Provenance
- **File Under Review**: `docs/samples/report-sample.pdf` (582,978 bytes, 4 pages, A4 format).
- **Environment**: Rendered from `src-tauri/target/debug/obd-diagnose.exe` on Windows via Edge WebView2 `ICoreWebView2_7::PrintToPdf` (Chromium Skia PDF generation).
- **Page Images Generated**: `docs/samples/page-1.png`, `page-2.png`, `page-3.png`, `page-4.png` rendered via native Windows WinRT API (`Windows.Data.Pdf.PdfDocument`) at standard screen DPI.

---

## 2. Visual Inspection Checklist

### 2.1 Arabic Letter Joining & Glyphs
- **Result**: **PASS**.
- **Evidence**:
  - In `page-1.png`, the report title "تقرير فحص ما قبل الشراء التشخيصي" and section headers use properly joined Arabic cursive letters using the Cairo variable font.
  - Initial letters (e.g. فـ in "فحص"), medial letters (ـحـ in "فحص"), and final letters (ـص in "فحص") connect continuously without disconnected, broken, or isolated glyph artifacts.
  - Ligatures (such as لا in "قبل الإشعال" and "إخلاء المسؤولية") render cleanly as proper Arabic ligatures.

### 2.2 RTL & Mixed Bidirectional Text Ordering
- **Result**: **PASS**.
- **Evidence**:
  - Mixed Arabic and Latin text flows logically right-to-left while preserving left-to-right numbers and DTC codes.
  - On Page 1:
    - "WP0AB2A99MS123456" displays in LTR monospace while its label "رقم الهيكل (VIN)" reads in RTL.
    - Protocol string "ISO 15765-4 (CAN 11/500)" is placed correctly alongside "المحول والبروتوكول".
    - Readiness counters "4 / 7", "12 km", and "25 min" maintain LTR numerical order without digit inversion.
  - On Page 2 & 3:
    - Fault code cards list the code badge on the top right ("P0143", "P0196", "P0234", "P0300", "P0420") in LTR, followed by severity and translation status badges in RTL.
    - Arabic explanation sentence containing sensor details:
      `جهد منخفض في دائرة حساس الأكسجين (صف 1، حساس 3). قراءة الجهد بعد المحفز ظلت أقل من الحد الأدنى المقبول لمنظومة الاحتراق.`
      maintains proper RTL flow and parenthesis placement around `(صف 1، حساس 3)`.
    - English technical translation appears underneath in clean LTR font.

### 2.3 Badges, Colors, and Visual Hierarchy
- **Result**: **PASS**.
- **Evidence**:
  - Background tints and borders print with full fidelity thanks to `-webkit-print-color-adjust: exact`.
  - Severity badges (rose for high severity, amber for medium, slate for low) are distinct with clear contrast.
  - Factor cards in Pre-Purchase Inspection preserve colored status indicators (rose alert for suspicious factor, amber for caution, emerald for normal).
  - Watermark header (`عينة - بيانات محاكي / EMULATOR SCENARIO`) prints across the top of Page 1 with amber warning styling.

### 2.4 Page Breaks and Card Integrity
- **Result**: **PASS**.
- **Evidence**:
  - Individual DTC cards (`.break-inside-avoid`) break naturally across pages without splitting mid-sentence or cutting text boxes in half.
  - Page 1 contains Vehicle Info, Overall Status, Pre-Purchase Inspection Summary, Factor Grid, and Raw Counters.
  - Page 2 contains Stored DTCs (Mode 03).
  - Page 3 contains Pending DTCs (Mode 07), Permanent DTCs (Mode 0A), and Freeze Frame readings (Mode 02).
  - Page 4 contains Readiness Monitors (Mode 01 PID 01), Diagnostic Scope & Legal Notice, the mandatory Mechanic Disclaimer, and the version footer.

---

## 3. PDF Internal Architecture & Text Extraction Order

### 3.1 Font Embedding Architecture
- Inspection of the PDF dictionary reveals 33 embedded Type 3 font subsets carrying vector character definitions (`CharProcs`) and `/FontFamily (Cairo)`.
- Monospace codes and numbers are backed by embedded CIDFontType2 subsets (`MAAAAA+Consolas-Bold`, `ZAAAAA+CourierNewPS-BoldMT`, `ABAAAA+Consolas`).
- The PDF embeds full ToUnicode CMaps mapping each glyph to its standard Unicode representation.

### 3.2 Bidirectional Reading and Copy/Paste Extraction
- Chromium's Skia engine annotates complex RTL text using standard PDF Marked Content:
  - Text spans are enclosed in `/ReversedChars BMC` and `/Span <</ActualText <FEFF...>>> BDC`.
  - Copy/paste and screen reader extraction reads text in logical Unicode character order.
  - For example, copying the Arabic explanation for `P0143`:
    - Visual rendering: `جهد منخفض في دائرة حساس الأكسجين (صف 1، حساس 3)...`
    - PDF ActualText extraction: `\u062c\u0647\u062f \u0645\u0646\u062e\u0641\u0636 \u0641\u064a \u062f\u0627\u0626\u0631\u0629 \u062d\u0633\u0627\u0633 \u0627\u0644\u0623\u0643\u0633\u062c\u064a\u0646 (\u0635\u0641 1\u060c \u062d\u0633\u0627\u0633 3)...`
    - When pasted into an editor, the characters re-shape into natural RTL text with the Latin code in place.

---

## 4. Problems Identified & Resolved
1. **Container break avoidance causing layout collision**:
   - *Problem*: The outer `DtcSectionGroup` container had `break-inside-avoid`. When 3 large DTC cards with causes and steps exceeded the remaining space on Page 2, Chromium attempted to fit the outer container on the page, squeezing elements.
   - *Resolution*: Removed `break-inside-avoid` from the outer group container while preserving `break-inside-avoid` on each individual DTC card.
2. **Global CSS resets interfering with component layout**:
   - *Problem*: An overly broad `div { height: auto !important; }` rule in `@media print` caused flex/grid children to lose height constraints.
   - *Resolution*: Replaced wildcard resets with targeted ancestors (`html, body, #root, #root > div, main`).
3. **Mismatched live data keys in freeze frames**:
   - *Problem*: `SampleReportPage.tsx` passed `scan.liveParams.0105` which fell back to the raw key string.
   - *Resolution*: Updated to canonical `scan.pids.*` keys (`coolantTemp`, `rpm`, `speed`, `engineLoad`), rendering translated labels in Arabic.
4. **Mandatory mechanic disclaimer visibility**:
   - *Problem*: `report.mechanicDisclaimer` had not reloaded in the preview DOM.
   - *Resolution*: Verified presence of Arabic translation `"هذا التقرير هو مؤشر استرشادي فقط ولا يُغني عن الفحص الفني بواسطة ميكانيكي متخصص."`, now visibly printed above the footer on Page 4.

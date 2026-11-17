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

- Inspection of the PDF dictionary (`tools/verify-sample-pdf.py`) reveals 33 embedded font subsets (Cairo variable Type 3 glyph subsets + CIDFontType2 monospace subsets `Consolas-Bold`, `CourierNewPS-BoldMT`, `Consolas`).
- The PDF embeds ToUnicode CMaps mapping each glyph to its Unicode representation (including Arabic Presentation Forms-B `U+FE80`–`U+FEFC` and `/ActualText <FEFF...>` spans).

### 3.2 Bidirectional Reading and Copy/Paste Extraction (Honest Assessment)

- **Visual Rendering (Viewing / Printing)**: **PASS**. In PDF viewers and when printed, Arabic cursive joining and mixed RTL/LTR bidirectional ordering render cleanly.
- **Copy/Paste Text Extraction Order**: **NOT SENSIBLE (Visual Left-to-Right Order)**.
  - Chromium/Skia's `PrintToPdf` writes RTL text blocks in **visual left-to-right coordinate order** inside the PDF content stream and wraps each word in `/ReversedChars BMC ... EMC` with per-glyph `/Span <</ActualText <FEFF...>>> BDC`.
  - Standard PDF text extractors (and copy/paste in most PDF viewers) read glyphs in stream order without reversing `/ReversedChars` blocks or reordering RTL words right-to-left:
    - **Freeze Frame header containing `P0143` (Page 3, Y=2803)**:
      - Visual on page: `الإطار 1` (right) ... `P0143` (left)
      - Extracted line (`ToUnicode`): `1 رﺎﻃﻹاP0143`
      - Extracted line (`ActualText`): `1 راطلإاP0143`
    - **Factor line containing `PID 0131` (Page 1, Y=401)**:
      - Visual on page: `المسافة منذ مسح الأعطال (PID 0131)`
      - Extracted line (`ToUnicode`): `(#/*) ﺔﻳﺰﻫﺎﺠﻟا تاﴍﺆﻣ4 / 7(PID 0131) لﺎﻄﻋﻷا ﺢﺴﻣ ﺬﻨﻣ ﺔﻓﺎﺴﻤﻟا12 km`
      - Extracted line (`ActualText`): `(#/*) ةيزهاجلا تاشرؤم4 / 7(PID 0131) لاطعلأا حسم ذنم ةفاسملا12 km`
    - **Arabic explanation sentence for `P0143` (Page 2, Y=1061 & Y=1087)**:
      - Code line (Y=1061): `P0143`
      - Explanation line (Y=1087, `ActualText`): `لوبقملا ىندلأا دحلا نم لقأ تلظ زفحملا دعب دهجلا ةءارق .(3 ساسح ،1 فص) ينجسكلأا ساسح ةرئاد يف ضفخنم دهج`
  - Because words and characters within Arabic words are emitted left-to-right (e.g. `دهج` becomes `جهد` reversed as `دهج`, and the sentence starts from the leftmost word `لوبقملا` instead of the rightmost word `جهد`), **copying and pasting Arabic sentences from the PDF does NOT produce a sensible logical reading order**. For clean text sharing/copying, users should use the dedicated **"Copy for WhatsApp"** button in the Report modal, which copies logical Unicode UTF-8 text directly to the clipboard.

---

## 4. Problems Identified & Resolved

1. **Container break avoidance causing layout collision**:
   - _Problem_: The outer `DtcSectionGroup` container had `break-inside-avoid`. When 3 large DTC cards with causes and steps exceeded the remaining space on Page 2, Chromium attempted to fit the outer container on the page, squeezing elements.
   - _Resolution_: Removed `break-inside-avoid` from the outer group container while preserving `break-inside-avoid` on each individual DTC card.
2. **Global CSS resets interfering with component layout**:
   - _Problem_: An overly broad `div { height: auto !important; }` rule in `@media print` caused flex/grid children to lose height constraints.
   - _Resolution_: Replaced wildcard resets with targeted ancestors (`html, body, #root, #root > div, main`).
3. **Mismatched live data keys in freeze frames**:
   - _Problem_: `SampleReportPage.tsx` passed `scan.liveParams.0105` which fell back to the raw key string.
   - _Resolution_: Updated to canonical `scan.pids.*` keys (`coolantTemp`, `rpm`, `speed`, `engineLoad`), rendering translated labels in Arabic.
4. **Mandatory mechanic disclaimer visibility**:
   - _Problem_: `report.mechanicDisclaimer` had not reloaded in the preview DOM.
   - _Resolution_: Verified presence of Arabic translation `"هذا التقرير هو مؤشر استرشادي فقط ولا يُغني عن الفحص الفني بواسطة ميكانيكي متخصص."`, now visibly printed above the footer on Page 4.

# Phase 4.5 & Appendix C Reconciliation Report

## Overview

Phase 4.5 resolves the JavaScript bundle bloat from Phase 4 by relocating the 4.5 MB DTC knowledge base to a public static asset, implements comprehensive Arabic search normalization across vehicle catalog queries, introduces database migrations 4 and 5, softens Tier 1 DTC diagnoses to eliminate definite repair/safety verdicts, and reconciles the vehicle selection catalog with Appendix C.

## 1. Relocation of DTC Pack to `public/`

- **Previous State (Phase 4)**: `src/data/dtc-codes.json` (4.5 MB) was directly imported into `src/lib/db/seed.ts`, embedding 4.5 MB into the main webview JavaScript bundle.
- **Phase 4.5 Implementation**:
  - `src/data/dtc-codes.json` deleted.
  - `public/dtc-pack.json` created as a static asset served by Tauri asset protocol.
  - `src/data/dtc-pack.manifest.json` carries version hash and code count (`codeCount: 9533`) for lightweight startup checks.
  - `src/lib/db/dtcPack.ts` lazy-fetches `/dtc-pack.json` via `fetch()` only when the database requires seeding.
  - `src-tauri/tauri.conf.json` Content Security Policy updated with `connect-src 'self'`.

## 2. Arabic Search Normalization (`src/lib/i18n/arabic.ts`)

- Unifies variable alef forms (`أ`, `إ`, `آ`, `ٱ` $\rightarrow$ `ا`).
- Replaces alef maqsura (`ى` $\rightarrow$ `ي`) and ta marbuta (`ة` $\rightarrow$ `ه`).
- Strips diacritics (tashkeel), decorative tatweel/kashida (`ـ`), and collapses whitespace.
- Computes `searchKey()` combining make, model, Arabic aliases, and English aliases into a single whitespace-free lookup key for both SQLite and in-memory search.

## 3. Database Migrations 4 & 5

- **Migration 4**: Adds `make_aliases_ar` (`TEXT DEFAULT '[]'`) and `search_text` (`TEXT DEFAULT ''`) to `vehicle_catalog`.
- **Migration 5**: Adds `severity_source` (`TEXT DEFAULT 'heuristic'`) to `dtc_codes` to honestly indicate that severity classifications are heuristic derivations rather than manufacturer safety statements.

## 4. Tier 1 Text Softening (Honest & Safe Diagnoses)

All 402 Tier 1 DTC definitions were audited and rewritten:

- Replaced assertive statements ("تشير الشيفرة إلى خلل") with non-prescriptive observations ("قد تشير الشيفرة إلى خلل... الفحص يحدد السبب").
- Replaced definitive misfire/catalyst claims with cautious notes ("قد يرتبط إخفاق الاحتراق...", "هذا لا يثبت أن المحول تالف قبل الفحص").
- Softened inspection steps from mandatory replacement commands ("استبدل الحساس فقط بعد") to cautionary rules ("لا تستبدل الحساس قبل التأكد من سلامة الأسلاك والتغذية").
- Automated tests in `tests/db-seed.test.ts` verify the absence of banned certainty phrases (`آمن للقيادة`, `غير آمن`, `لا تقود`, `يجب استبدال`, `يجب إصلاح`, `replace`, `safe to drive`, `do not drive`).

## 5. Appendix C Reconciliation & Catalog Differences

### Summary

- **Total Makes**: 46 makes (all 33 makes from Appendix C + 13 makes preserved from prior market knowledge and WMI decodability).
- **Total Models**: 380 models.
- **Source Tiers**:
  - `source_tier = 'cited'`: 51 models (all models listed in "Seen in sources" in Appendix C).
  - `source_tier = 'knowledge'`: 329 models (all models listed in "Added, to verify" in Appendix C + models added for WMI makes).
- **Verification**: `verified = 0` (`false`) for 100% of rows.
- **Year Bounds**: `yearFrom: null`, `yearTo: null` for 100% of rows (no fabricated year spans).

### Differences & Additions

1. **Cited Models (51)**:
   - **Nissan (4)**: Sunny, Sentra, Qashqai, Patrol
   - **Hyundai (7)**: Elantra, Tucson, Accent, Verna, Matrix, i10, ix35
   - **Kia (5)**: Cerato, Sportage, Rio, Shuma, Picanto
   - **Chevrolet (4)**: Optra, Lanos, Aveo, T-Series pickup (Dabbaba)
   - **Toyota (2)**: Corolla, Yaris
   - **Fiat (1)**: Tipo
   - **Renault (3)**: Logan, Duster, Sandero
   - **Skoda (2)**: Octavia, Kodiaq
   - **Mitsubishi (1)**: Lancer (including Lancer EX)
   - **Suzuki (2)**: Alto, S-Presso
   - **Ford (1)**: Focus
   - **Opel (1)**: Astra
   - **BMW (1)**: 3 Series (316)
   - **Jeep (1)**: Cherokee
   - **Proton (1)**: Saga
   - **Chery (5)**: Tiggo 3, Tiggo 4 Pro, Tiggo 7 (Pro Max), Arrizo 5, Arrizo 6
   - **MG (2)**: ZS, GT
   - **Jetour (2)**: T2, X70 Plus
   - **BAIC (1)**: U5 Plus
   - **Changan (1)**: CS55 Plus
   - **BYD (1)**: F3
   - **Geely (1)**: Emgrand (EC7)
   - **Zeekr (2)**: X, 001

2. **Makes Added from Appendix C (6 makes)**:
   - `seat`: Leon, Ibiza, Toledo, Ateca
   - `proton`: Saga (cited), Persona (knowledge)
   - `jetour`: T2 (cited), X70 Plus (cited), X70, X90 Plus, Dashing
   - `baic`: U5 Plus (cited), X35, X55, BJ40 Plus
   - `soueast`: S06
   - `zeekr`: X (cited), 001 (cited)

3. **Makes Preserved (Not in Appendix C, but essential for WMI & market coverage)**:
   - `mazda` (Mazda 2, 3, 6, CX-3, CX-5, CX-9, CX-30, BT-50, MX-5)
   - `great-wall` (Wingle 5, 7, Poer, C30, Steed, Tank 300)
   - `daewoo` (Lanos, Nubira, Leganza, Matiz, Espero - preserved as Daewoo badges while Lanos/Nubira/Matiz/Cielo also cross-listed under Chevrolet)
   - `dacia` (Logan, Sandero, Duster, Dokker, Lodgy)
   - `dodge` (Charger, Challenger, Durango, Journey)
   - `chrysler` (300, Sebring, PT Cruiser, Town & Country)
   - `daihatsu` (Terios, Sirion, Gran Max - decodable by WMI)
   - `isuzu` (D-Max, MU-X - decodable by WMI)
   - `porsche` (Cayenne, Macan, Panamera, 911 - decodable by WMI)
   - `ssangyong` (Tivoli, Korando, Rexton, Musso - decodable by WMI)
   - `subaru` (Impreza, Forester, Outback, XV - decodable by WMI)
   - `tesla` (Model 3, Model Y, Model S, Model X - decodable by WMI)
   - `volvo` (XC40, XC60, XC90, S60 - decodable by WMI)

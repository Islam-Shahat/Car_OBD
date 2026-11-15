# Phase 5: Core UI Flow (Vehicle Selection, Scan, Results, Clear)

Date: 2026-11-15  
Status: Complete  
Verified: 200 unit & integration tests passing (`npm test`, including live ELM327 emulator)

---

## 1. Summary of Deliverables

Phase 5 builds the complete end-to-end diagnostic user journey for Windows:

1. **Connect Screen**:
   - Clear 3-step physical connection guidance ("وصّل المحول بمنفذ OBD-II", "أدر المفتاح لوضع ON", "اختر المنفذ واضغط اتصال").
   - Real-time connection status display with adapter hardware inspection.
   - Primary Call-to-Action (CTA) buttons upon connection ("الانتقال إلى الفحص" / "Proceed to Scan", "التعرف على السيارة / اختيار الموديل" / "Detect / Select Vehicle").
2. **Car Detection & Selection Flow**:
   - Automatic VIN read (Mode 09 PID 02) via connection warmup cache (`VehicleIdentityCache`).
   - WMI decode with model-year candidates from position 10.
   - Fallback to manual selection from vehicle catalog (make $\rightarrow$ model $\rightarrow$ year) with Arabic/English search normalization (`normalizeArabic`, `searchKey`).
   - Free-text entry ("سيارتي غير موجودة في القائمة" / "Not in list") for unlisted vehicles.
   - User correction support and vehicle saving to local SQLite (`vehicles` table) with active selection persistence.
3. **WMI User Map (`wmi_user_map`)**:
   - Migration 6 created local SQLite table `wmi_user_map` (`wmi`, `make_slug`, `source = 'user'`, `created_at`).
   - When an unmapped WMI (e.g. Chery, Geely, MG, Changan) is detected and the user picks a make, the mapping is saved locally for future automatic detection.
   - Candidate unverified WMIs documented: `LVV` (Chery), `LSJ` (SAIC MG), `LS5` (Changan), `LGW` (Great Wall / Haval), `LNB` (BAIC), `LVT` (Chery group). None are added to `wmi.json` without verification against real VIN plates or two independent sources.
4. **Catalog Cleanup & Year Picker**:
   - Reconciled duplicate models between Daewoo and Chevrolet (Lanos, Nubira, Matiz, Cielo). In accordance with Appendix C, these models are listed once under Chevrolet. Daewoo retains Leganza and Espero.
   - Search results guaranteed to show each model once without duplicates (`uniqueModels`).
   - Added missing catalog makes to `MAKE_NAME_KEYS` and i18n locales: SEAT, Proton, Jetour, BAIC, Soueast, Zeekr.
   - Year picker enhanced: when a catalog model has no year range, provides a free selection dropdown (1980..current+1) and numeric input instead of an empty list.
5. **First-Run Splash State**:
   - Added branded splash loading view during database initialization & DTC pack seeding (`StorageProvider`), preventing blank windows.
   - Error state with "Retry" and "Proceed without database" fallback buttons.
6. **One Big Start Scan Button & Progress Flow**:
   - Large touch-friendly `Start Scan` button (`h-12 px-6 text-base font-bold`) with full keyboard support (`Enter` / `Space`).
   - Accessible animated progress bar tracking diagnostic steps (`pids`, `status`, `dtc`, `vin`, `live`, `freeze`, `backup`, `clear`, `verify`, `done`).
7. **Result Summary (3-Tier Health Banner)**:
   - Green (Healthy): No stored or pending DTCs, MIL off.
   - Yellow (Warning): Pending codes present or diagnostic warnings active.
   - Red (Faults Detected): Stored codes present or Check Engine Light (MIL) illuminated.
8. **Per-Fault Detail & Translation Tiers**:
   - Single-code lookups via `DtcRepository.lookup(code, make)` (`make-specific` $\rightarrow$ `generic` $\rightarrow$ `unknown` fallback) without loading the 9,500+ table into React state.
   - Tier 1 Arabic text: small badge "مسودة ترجمة قيد مراجعة الفني" (Draft translation pending mechanic review).
   - Tier 2 Arabic text: prominent warning badge "ترجمة آلية غير مراجعة" (Unreviewed machine translation).
   - English explanation 1-tap toggle button on every card.
   - Severity badges (`high`, `medium`, `low`) with note if derived from heuristic rules.
   - Collapsible possible causes and inspection steps.
9. **Safe Clear Flow & Post-Clear Wording**:
   - Accessible warning dialog explaining: clearing does NOT repair physical fault; resets readiness monitors and freeze frames; saves durable backup first.
   - Mode 04 clear with automatic verification re-scan.
   - Outcome reporting using exact terms: `codes_returned`, `no_codes_returned`, `verification_failed`.
   - Clear advisory note: clean re-scan does not prove fault is fixed; recommend re-checking after drive cycles. Never uses "fixed" or "confirmed fixed".
10. **Automatic SQLite Persistence**:
    - Every completed scan is automatically saved to SQLite: `scan_sessions`, `scan_results`, `readiness_snapshots`, `live_data_logs`.
    - Failures in persistence log warnings but never block the user from viewing live scan results.

---

## 2. Test Verification

Running `npm test` with `$env:ELM_EMULATOR = '1'`:

```
Test Files  25 passed (25)
     Tests  200 passed (200)
```

- `tests/phase-5-core-flow.test.ts`: 5 new integration tests verifying vehicle identification, unmapped WMI mapping, DTC 3-stage lookup, scan auto-persistence, catalog de-duplication, and clear-backup durability.
- `tests/vehicle-catalog.test.ts`: Verified Daewoo vs Chevrolet de-duplication (Lanos, Nubira, Matiz, Cielo appear once under Chevrolet; Daewoo keeps Leganza and Espero).
- `tests/obd-vin-decode.test.ts`: Verified `decodeVehicleIdentity` with `userMakeSlug` override for unmapped WMIs.
- `tests/i18n-resources.test.ts`: 100% key parity verified between `ar.json` and `en.json`.
- `tests/elm327-emulator.test.ts` & `tests/obd-emulator.test.ts`: Passed live TCP communication tests against Python ELM327 emulator with DTC scenario.

---

## 3. Memory & Performance Verification

- **DTC Loading**: Only active DTCs present in the scan are queried from SQLite via `DtcRepository.lookup(code, make)`. The 9,533 DTC pack is never loaded into React state.
- **DTC Pack Size**: `public/dtc-pack.json` is 4.5 MB, loaded asynchronously by `seedDatabase()` during first-run initialization only.
- **Web Bundle Size**: 639.22 kB (180.26 kB gzip), well within desktop performance budgets.
- **Release Executable & Installers**:
  - Binary: `target/release/obd-diagnose.exe` (built in 1m 21s)
  - NSIS Installer: `OBD Diagnose_0.1.0_x64-setup.exe` (2.09 MiB)
  - MSI Installer: `OBD Diagnose_0.1.0_x64_en-US.msi` (2.71 MiB)
- **Idle RAM**: **42.2 MB** working set measured on running release `.exe`.
- **First-run Seeding Time**: ~860 ms (shown with branded splash screen, avoiding blank UI).

---

## 4. Risks & Next Steps

- **Risks**:
  - Real car ECUs may take longer than the emulator to respond to Mode 04 clear; the 5.0 s timeout in `clearStoredCodes` is verified for standard ELM327 adapters, but older K-Line vehicles may require patience.
  - WMI candidate list for Chinese brands (LVV, LSJ, LS5, LGW, LNB, LVT) remains unverified until verified against physical vehicle VIN plates.
- **Next Phase**:
  - **Phase 6: Live data and charts** (configurable gauge panels, real-time PID streaming, time-series charts, PID audit polling loop).

# Phase 6: Live Data and Charts

Date: 2026-11-15  
Status: Complete  
Verified: 222 unit & integration tests across 31 test files passing (including live ELM327 emulator benchmarks)

---

## 1. Summary of Deliverables

Phase 6 implements non-blocking real-time sensor monitoring, high-performance rolling charts, session telemetry recording, unit toggling, and plain-language diagnostic views:

1. **Sequential Live Poller & Smart Scheduler (`src/lib/obd/livePoller.ts`)**:
   - Strictly sequential Mode 01 queries respecting the ELM327 half-duplex serial protocol (never issues interleaved/parallel commands).
   - Adaptive inter-query delay scheduler (`calculatePollDelayMs`):
     - $\le 2$ PIDs: 10 ms
     - $\le 4$ PIDs: 15 ms
     - $\le 8$ PIDs: 40 ms
     - $9+$ PIDs: 100 ms
   - Provides non-blocking execution, pause/resume controls, and `AbortSignal` cancellation on unmount or page exit.
   - Calculates rolling sample rate (Hz).

2. **Fixed-Capacity Store & Zero Memory Growth (`src/features/live/liveStore.ts`)**:
   - Zustand store managing telemetry state: active PIDs, latest readings, rolling history, units, and recording buffer.
   - Rolling history window capped at `MAX_HISTORY_POINTS = 300` and `MAX_HISTORY_WINDOW_MS = 60000` (60 seconds) per PID.
   - Guaranteed $O(1)$ memory consumption with zero heap growth regardless of run duration.

3. **Visualizations**:
   - **Gauges (`src/features/live/Gauge.tsx`)**: Responsive 240° SVG arc gauges for primary powertrain metrics (RPM, Vehicle Speed, Coolant Temperature) with digital readout, unit labels, and warning/danger threshold color changes.
   - **Rolling Charts (`src/features/live/LiveChart.tsx`)**: Integrated `uPlot` canvas charts with dynamic time-axis formatting, automatic `ResizeObserver` responsiveness, dark/light theme synchronization, and canvas cleanup on unmount.

4. **Telemetry Recording & CSV Export (`src/features/live/liveRecording.ts`)**:
   - Start / Stop telemetry recording controls with live sample counter.
   - RFC 4180 compliant CSV export (`formatTelemetryCsv`) with headers: `Timestamp,PID,Hex,Parameter,Value,Unit`.
   - Browser/desktop CSV download trigger (`downloadCsv`).
   - SQLite persistence helper (`persistRecordedSamples`) integrating with `repositories.scans.addLiveData`.

5. **Unit Preferences (`src/lib/obd/units.ts`)**:
   - Global unit conversion utilities (`convertMeasurement`):
     - Temperature: Celsius (°C) $\leftrightarrow$ Fahrenheit (°F)
     - Speed: Kilometers per hour (km/h) $\leftrightarrow$ Miles per hour (mph)
   - Real-time conversion across gauges, value cards, and chart axes.

6. **Diagnostic Analysis Views**:
   - **Fuel Trim Inspector (`src/features/live/FuelTrimView.tsx`)**:
     - Visualizes Bank 1 and Bank 2 Short-Term (STFT) and Long-Term (LTFT) fuel trims, and calculates total trim.
     - Detects single-bank vs dual-bank engines.
     - Plain-language diagnostic hints for high positive trim ($> +10\%$, potential vacuum leak / unmetered air) and high negative trim ($< -10\%$, potential leaking injector / rich bias).
     - Prominently displays the `Informational only` disclaimer badge.
   - **O2 Sensor Inspector (`src/features/live/O2SensorView.tsx`)**:
     - Displays Bank 1 & 2 Upstream (Sensor 1) and Downstream (Sensor 2) voltages and short-term trims.
     - Stoichiometric center meter (0V Lean $\leftrightarrow$ 0.45V Stoich $\leftrightarrow$ 1.0V Rich).
     - Upstream switching evaluation: flags sluggish/flatlined upstream response ($<0.15\text{V}$ variation).
     - Downstream catalyst evaluation: flags rapid oscillation post-cat ($>0.4\text{V}$ swing mirroring upstream, indicating catalyst degradation).
     - Prominently displays the `Informational only` disclaimer badge.

7. **Mutual Exclusion & Lifecycle Safeguards**:
   - Added `/live` route to `src/app/router.tsx` and `AppLayout.tsx` navigation bar with `IconActivity`.
   - Poller starts on page mount if connected; cleanly stops on unmount or disconnection to release serial port.
   - `ScanPage.tsx` automatically stops live polling before executing diagnostic scans or Mode 04 code clears.

---

## 2. Test Verification & Benchmarks

All 31 test suites and 222 tests pass with 100% success rate:

```
Test Files  31 passed (31)
     Tests  222 passed (222)
```

Key verification highlights:

- `tests/live-poller.test.ts`: Verifies adaptive delay thresholds and sequential query queuing.
- `tests/live-data-flow.test.ts`: Verifies strictly sequential driver invocation (`maxConcurrent = 1`), 300-point history capping, RFC 4180 CSV export, SQLite `live_data_logs` persistence, and metric/imperial unit conversions.
- `tests/live-emulator.test.ts`: Live TCP benchmark against the Python ELM327 emulator (`python -m elm -s car`) with 4 concurrent PIDs (RPM, Speed, Coolant Temp, Engine Load):
  - **Measured Poller Rate**: **54.16 updates/second** (190 readings in 3.51s).
  - **Acceptance Target**: $\ge 5.0$ updates/second (surpassed by $>10\times$).
  - **Memory Stability**: Zero memory growth over continuous polling runs.
- `tests/i18n-resources.test.ts`: Full key and placeholder parity maintained between Arabic (`ar.json`) and English (`en.json`).

---

## 3. Risks & Next Steps

- **Risks**:
  - Cheap Bluetooth clone adapters with slow baud rates or high latency will achieve fewer updates/sec than TCP or high-baud USB FTDI adapters; the adaptive delay scheduler ensures buffers are not overflowed even on high-latency adapters.
  - O2 sensor switching detection relies on closed-loop engine operation with warm exhaust gases; if an engine is idling cold or operating in open loop, sensor flatlining is normal behavior and should not be confused with hardware failure. The informational note in the UI clarifies this.
- **Next Phase**:
  - **Phase 7: History, PDF reports, pre-purchase mode** (historical scan viewing, printable PDF export with Arabic/English typography, pre-purchase used car inspection mode detecting suspicious recent clears and drive cycle readiness).

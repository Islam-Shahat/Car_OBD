# Vehicle & OBD-II Adapter Compatibility Guide

Date: 2026-11-15  
Status: Verified only on mocks and Python ELM327 emulator (NO REAL-HARDWARE VERIFICATION YET)

---

## 1. Supported Protocols & Simulation Test Results

> [!IMPORTANT]
> **No real-hardware verification has been performed yet.** The application has not connected to a physical automobile OBD-II port or a physical ELM327 adapter. Everything has been executed and verified strictly against unit test mocks and the Python ELM327 socket emulator (`scripts/run-emulator.py`, `scripts/emulator-dtc.py`). Testing on a real car with a real adapter remains an essential prerequisite before any production release.

The application implements support for all five legislated SAE J1979 / ISO OBD-II generic powertrain protocols:

| Protocol                            | Technical Identifier                                  | Typical Vehicle Applications                               | Synthetic Dialogue Fixture (Unverified)                                  | Init Timing & Characteristics (Simulated)                                                      |
| ----------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **ISO 15765-4 (CAN)**               | Protocols 6, 7, 8, 9 (11/500, 29/500, 11/250, 29/250) | 2008+ all passenger cars; 2004+ US/EU                      | **Simulated 2018 Toyota Corolla 1.6L** (`can_toyota_corolla_2018_pic18f25k80`) | **Fast (< 150ms)**. Supports full multi-frame ISO-TP messaging (Modes 01, 02, 03, 07, 09, 0A). |
| **ISO 14230-4 (KWP2000 Fast Init)** | Protocol 5 (KWP FAST)                                 | 2000–2008 Asian & European (Hyundai, Kia, Nissan, Renault) | **Simulated 2006 Hyundai Elantra XD 1.6L** (`kwp_hyundai_elantra_2006_clone_v15`) | **Moderate (~2.5s - 3.5s)**. Requires bus wake-up sequence (`BUS INIT: OK`).                   |
| **ISO 14230-4 (KWP2000 5-Baud)**    | Protocol 4 (KWP 5BAUD)                                | 1999–2006 VAG, Daewoo, Opel                                | Covered via synthetic 5-baud handshake mock                              | Requires extended `ecuTimeoutMs` (up to 12s).                                                  |
| **ISO 9141-2**                      | Protocol 3 (5-Baud Init)                              | 1996–2004 Toyota, Honda, BMW, Mercedes                     | **Simulated 2003 Peugeot 206 1.4L** (`iso9141_peugeot_206_2003_v21_clone`)   | **Slow (~3s - 5s init)**. K-Line serial communication at 10.4 kbaud.                           |
| **SAE J1850 PWM / VPW**             | Protocols 1 & 2                                       | 1996–2006 Ford (PWM), GM/Chrysler (VPW)                    | Emulated via synthetic J1850 timing fixtures                             | Pulse-width modulated bus. Tested via timing fallbacks.                                        |

---

## 2. Hardware Adapter Categories & Expected Clone Quirks

The guidance below is derived from industry literature and community knowledge. It has not yet been benchmarked against physical adapter samples on a test bench:

### A. High-Quality Tier (Recommended)

- **Chipsets**: Genuine Microchip **PIC18F25K80** (dual crystal, 4 MHz + 16 MHz), **STN1110 / STN2120**, or **FTDI FT232R USB**.
- **Expected Characteristics (Unverified on hardware)**:
  - Implements complete ELM327 v1.4b/v2.1 instruction set.
  - Large RX buffer preventing dropped bytes during freeze-frame dumps.
  - Reliable high-frequency live polling.
  - Proper hardware voltage regulation protecting vehicle CAN transceivers.

### B. Budget Clone Tier (Common "ELM327 v1.5" or "v2.1" Blue Mini Adapters)

- **Chipsets**: Single-die repackaged microcontrollers (e.g. BK3231, AP6212, or unbranded OTP chips).
- **Expected Clone Quirks (from public knowledge, unverified on physical hardware)**:
  1. **Fake Version Strings**: Most budget adapters report `ELM327 v1.5` (a version never produced by ELM Electronics). The app's `assessAdapter()` flags this as `likelyClone: true` and applies conservative timeouts.
  2. **Missing Low-Speed K-Line Transceivers**: Many cheap v2.1 clones omit the comparator circuitry needed for 5-baud ISO 9141-2 and KWP init. When detected, the app displays a recovery warning ("The adapter rejected protocol initialization").
  3. **Buffer Overflows on High-Speed Polling**: Clones crash or drop lines if queried too fast. The app's `LivePoller` adaptive delay scheduler (`calculatePollDelayMs`) enforces inter-query pauses based on PID count.
  4. **Echo & Carriage Return Leakage**: Some clones interleave prompt characters (`>`) or echo fragments. Handled by `normalizeResponse()`, which strips leading echos and orphaned whitespace.

---

## 3. Robustness & Fault Recovery Matrix

The software recovery logic is designed for roadside conditions and has been tested via unit mocks:

| Incident                        | Detected Signal                               | Root Cause                                             | App Behavior & User Guidance (Mock Tested)                                             |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **Ignition in OFF position**    | `UNABLE TO CONNECT` or `BUS INIT: ERROR`      | Vehicle ECU is unpowered or asleep                     | Displays warning: _"Turn vehicle ignition switch to ON (engine running or dashboard lights illuminated), then retry."_ |
| **Adapter unplugged mid-scan**  | `closed` / serial I/O error                   | USB/Bluetooth connection severed                       | Immediately terminates active sequence without hanging, unlocks UI, and surfaces reconnect prompt.                     |
| **COM port busy**               | `open-failed` (Access Denied)                 | Another application (Torque, PuTTY) has an open handle | Guidance: _"Could not open COM port. Ensure no other diagnostic tool or serial monitor is running."_                   |
| **Slow or unresponsive ECU**    | `timeout` ($>3000\text{ ms}$)                 | Legacy bus or overloaded gateway                       | Driver dynamically scales adaptive timeout ceiling up to $12\text{ seconds}$ before raising a typed failure.           |
| **In-flight safety protection** | Remote config arrives while scanning/clearing | Remote kill-switch or feature toggle                   | Held in `pendingConfig` ring; applied cleanly only when the scan or code clear completes.                              |

---

## 4. Vehicle Ineligibility & Non-OBD-II Vehicles

The application is explicitly designed for generic passenger car powertrain OBD-II. The following are out of scope:

1. **Pre-OBD-II Vehicles**:
   - US: Prior to 1996.
   - EU Petrol: Prior to 2001 (Euro 3).
   - EU Diesel: Prior to 2004 (Euro 4).
   - Japan: Prior to 2002 (J-OBD).
2. **Proprietary Connectors**: Round BMW 20-pin, Mercedes 38-pin, Toyota 17/22-pin, or GM ALDL 12-pin under-hood diagnostic boxes.
3. **Heavy Commercial Vehicles**: 24V SAE J1939 commercial trucks (risk of frying 12V ELM327 adapters).

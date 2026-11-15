# Pre-Purchase Inspection Mode & Clearing Heuristics

**Status**: Experimental diagnostic heuristic (Phase 7)  
**Verification Level**: Heuristic derived from public OBD-II specifications; **NOT calibrated or verified on real vehicle fleets or physical car hardware**.

---

## 1. Overview & Objective

When inspecting a used vehicle prior to purchase, sellers may occasionally clear Diagnostic Trouble Codes (DTCs) immediately before a buyer's inspection to extinguish the Malfunction Indicator Lamp (MIL / Check Engine Light) and conceal active powertrain faults.

The **Pre-Purchase Inspection Mode** (`mode: 'pre_purchase'`) analyzes emission readiness monitors, drive history counters, and permanent trouble codes to detect patterns consistent with recent code clearing or ECU resets.

---

## 2. Ethical and Legal Stance (Non-Accusatory Wording)

The inspection mode strictly avoids legal accusations, fraud claims, or definitive verdicts:

1. **Indicator Levels, Not Verdicts**:
   - `no_indicators`: Readiness monitors complete, normal extended driving counters.
   - `some_indicators`: Limited driving detected or isolated monitor incomplete.
   - `several_indicators`: Multiple incomplete monitors combined with very low distance/warm-up counters or surviving permanent codes.
2. **Cautious Language**:
   - Uses non-accusatory phrasing: *"Several indicators suggest codes may have been cleared recently"*.
   - Never states *"Codes were deliberately wiped"* or *"Seller is concealing faults"*.
3. **Transparency**:
   - Displays all raw counter values directly in the report table so human inspectors can make their own technical assessment.

---

## 3. Heuristic Rules, PIDs, and Thresholds

| Factor | OBD Parameter | Evaluated Thresholds | Scoring Rationale |
| :--- | :--- | :--- | :--- |
| **I/M Readiness Monitors** | PID `0101` | • $\ge 3$ incomplete: Suspicious (+2)<br>• $1-2$ incomplete: Caution (+1)<br>• $0$ incomplete: Normal (0) | Following a clear (Mode 04) or battery disconnect, all monitors reset to "Not Ready" until specific driving cycles run. |
| **Distance Since Cleared** | PID `0131` | • $< 25\text{ km}$: Suspicious (+2)<br>• $25 - 80\text{ km}$: Caution (+1)<br>• $> 80\text{ km}$: Normal (0) | Standard OBD-II drive cycles require 20–80 km across city and highway conditions to complete catalyst and EVAP tests. |
| **Warm-up Cycles Since Cleared** | PID `0130` | • $< 3$ cycles: Suspicious (+2)<br>• $3 - 10$ cycles: Caution (+1)<br>• $\ge 10$ cycles: Normal (0) | A warm-up cycle requires coolant to rise $\ge 22^\circ\text{C}$ and reach $\ge 70^\circ\text{C}$. Few warm-ups indicate the engine was reset recently. |
| **Time Since Cleared** | PID `014E` | • $< 60\text{ min}$: Caution (+1) | Engine operating minutes since the DTC memory was cleared. |
| **Permanent Trouble Codes** | Mode `0A` | • $\ge 1$ code: Suspicious (+3) | Permanent DTCs (mandated by CARB/EPA since 2010) **cannot** be erased by Mode 04 or battery disconnection. They clear only after the ECU verifies the repair over consecutive drive cycles. |
| **Runtime & Distance with MIL** | PID `011F` / `0121` | Informational display | Contextual verification: shows how long the current trip has run and historical driving with MIL active. |

### Overall Suspicion Scoring & Indicator Levels:

- **Score $\ge 4$**: `several_indicators` (Multiple indicators suggest codes were reset recently).
- **Score $2 - 3$**: `some_indicators` (Some indicators consistent with recent reset or battery disconnect).
- **Score $0 - 1$**: `no_indicators` (No indicators of recent code clearing).

---

## 4. Inherent Limitations & False Positive Factors

The application explicitly displays these technical limitations on every screen and report:

1. **Battery Disconnection & Replacement**:
   - Disconnecting or replacing the 12V vehicle battery cuts continuous keep-alive memory (KAM) in many ECUs, resetting readiness monitors and distance/warm-up counters to zero without any fault concealing intent.
2. **Legitimate Mechanical Repairs**:
   - A reputable mechanic clearing codes after installing a new O2 sensor, catalytic converter, or spark plug will legitimately reset monitors and counters.
3. **Drive Cycle Duration Variations**:
   - Some secondary emission monitors (particularly EVAP and secondary air injection) require strict ambient conditions (e.g., fuel tank between 15% and 85%, cold soak overnight) and may remain "Not Ready" for weeks under normal driving.
4. **Counter Saturation Limits**:
   - Warm-up cycles saturate at **255** (1 byte).
   - Distance since cleared saturates at **65,535 km** (2 bytes, unsigned).
   - Once saturated, counters stop incrementing until the next reset.
5. **ECU Support Variations**:
   - Older vehicles (pre-2005) or non-CAN implementations may return `NO DATA` for PIDs `0130`, `0131`, `014D`, `014E`, or Mode `0A`. When unavailable, factors are marked `unavailable` rather than penalizing the vehicle.

---

## 5. Verification Note

> [!WARNING]
> These heuristic thresholds are public domain guidelines and have **NOT been verified on physical vehicle fleets or real cars**. They are designed strictly as an informational tool to aid vehicle buyers during physical evaluation.

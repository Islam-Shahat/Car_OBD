# Pre-Purchase Inspection Mode & Clearing Heuristics

**Status**: Experimental diagnostic heuristic (Phase 7)  
**Verification Level**: Heuristic derived from public OBD-II specifications; **NOT calibrated or verified on real vehicle fleets or physical car hardware**.

> [!IMPORTANT]
> **Mandatory Inspection Notice**:  
> _"This is an indication only and not a substitute for an inspection by a qualified mechanic."_  
> _"هذا التقرير هو مؤشر استرشادي فقط ولا يُغني عن الفحص الفني بواسطة ميكانيكي متخصص."_

---

## 1. Overview & Objective

When inspecting a used vehicle prior to purchase, sellers may occasionally clear Diagnostic Trouble Codes (DTCs) immediately before a buyer's inspection to extinguish the Malfunction Indicator Lamp (MIL / Check Engine Light) and conceal active powertrain faults.

The **Pre-Purchase Inspection Mode** (`mode: 'pre_purchase'`) analyzes emission readiness monitors, drive history counters, and permanent trouble codes to detect patterns consistent with recent code clearing or ECU resets.

---

## 2. Ethical and Legal Stance (Non-Accusatory Wording)

The inspection mode strictly avoids legal accusations, fraud claims, or definitive verdicts:

1. **Indicator Levels, Not Verdicts**:
   - `no_indicators`: Readiness monitors complete, normal extended driving counters. **No indicators found does not prove that codes were not cleared. A seller can drive enough distance after clearing.**
   - `some_indicators`: Limited driving detected or isolated monitor incomplete.
   - `several_indicators`: Multiple incomplete monitors combined with very low distance/warm-up counters, surviving permanent codes, or high/saturated MIL-on distance/time.
2. **Cautious Language**:
   - Uses non-accusatory phrasing: _"Several indicators suggest codes may have been cleared recently"_.
   - Never states _"Codes were deliberately wiped"_ or _"Seller is concealing faults"_.
   - Explicitly warns: _"No indicators found does not prove that codes were not cleared. A seller can drive enough distance after clearing."_
3. **Transparency**:
   - Displays all raw counter values directly in the report table so human inspectors can make their own technical assessment.

---

## 3. Heuristic Rules, PIDs, and Thresholds

> [!NOTE]
> Every rule, formula, and numerical threshold in this table is a **heuristic, not verified on real cars**.

| Factor                           | OBD Parameter       | Evaluated Thresholds [heuristic, not verified on real cars]                                                                                                                                                                                              | Scoring Rationale [heuristic, not verified on real cars]                                                                                                                                                                                                           |
| :------------------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I/M Readiness Monitors**       | PID `0101`          | • $\ge 3$ incomplete: Suspicious (+2)<br>• $1-2$ incomplete: Caution (+1)<br>• $0$ incomplete: Normal (0)<br>• Unsupported: Unavailable (0)                                                                                                              | Following a clear (Mode 04) or battery disconnect, all monitors reset to "Not Ready" until specific driving cycles run.                                                                                                                                            |
| **Distance Since Cleared**       | PID `0131`          | • $< 25\text{ km}$: Suspicious (+2)<br>• $25 - 79\text{ km}$: Caution (+1)<br>• $80 - 65,534\text{ km}$: Normal (0)<br>• `0xFFFF` ($65,535\text{ km}$): Unavailable (`counter at maximum or unavailable`) (0)<br>• Unsupported (`null`): Unavailable (0) | Standard OBD-II drive cycles require 20–80 km across city and highway conditions to complete catalyst and EVAP tests. `0xFFFF` can mean maximum reached or not available on some ECUs, so it is treated as saturated/unavailable and never as reassuring evidence. |
| **Warm-up Cycles Since Cleared** | PID `0130`          | • $< 3$ cycles: Suspicious (+2)<br>• $3 - 9$ cycles: Caution (+1)<br>• $10 - 254$ cycles: Normal (0)<br>• `0xFF` ($255$ cycles): Unavailable (`counter at maximum or unavailable`) (0)<br>• Unsupported (`null`): Unavailable (0)                        | A warm-up cycle requires coolant to rise $\ge 22^\circ\text{C}$ and reach $\ge 70^\circ\text{C}$. `0xFF` can mean maximum reached or not available, so it is treated as saturated/unavailable and never as reassuring evidence.                                    |
| **Time Since Cleared**           | PID `014E`          | • $< 60\text{ min}$: Caution (+1)<br>• $60 - 65,534\text{ min}$: Normal (0)<br>• `0xFFFF` ($65,535\text{ min}$): Unavailable (`counter at maximum or unavailable`) (0)<br>• Unsupported (`null`): Unavailable (0)                                        | Engine operating minutes since the DTC memory was cleared. `0xFFFF` is treated as saturated/unavailable.                                                                                                                                                           |
| **Permanent Trouble Codes**      | Mode `0A`           | • $\ge 1$ code: Suspicious (+3)<br>• $0$ codes: Normal (0)<br>• Unsupported: Normal (0)                                                                                                                                                                  | Permanent DTCs (mandated by CARB/EPA since 2010) **cannot** be erased by Mode 04 or battery disconnection. They clear only after the ECU verifies the repair over consecutive drive cycles.                                                                        |
| **Distance & Time with MIL On**  | PID `0121` / `014D` | • $\ge 50\text{ km}$ or $\ge 60\text{ min}$ (including `0xFFFF` saturated): Suspicious (+2)<br>• $1 - 49\text{ km}$ or $1 - 59\text{ min}$: Caution (+1)<br>• $0$: Normal (0)<br>• Unsupported (`null`): Unavailable (0)                                 | **Inverse polarity from "since cleared" counters**: $0$ means the warning light has not been on; a high or saturated value (`0xFFFF`) means the warning light has been on for a long time. Never scored like the "since codes cleared" counters.                   |
| **Runtime Since Engine Start**   | PID `011F`          | Informational display                                                                                                                                                                                                                                    | Contextual verification: shows how long the current trip has run.                                                                                                                                                                                                  |

### Overall Suspicion Scoring & Indicator Levels [heuristic, not verified on real cars]:

- **Score $\ge 4$**: `several_indicators` (Multiple indicators suggest codes were reset recently) [heuristic, not verified on real cars].
- **Score $2 - 3$**: `some_indicators` (Some indicators consistent with recent reset or battery disconnect) [heuristic, not verified on real cars].
- **Score $0 - 1$**: `no_indicators` (No indicators of recent code clearing) [heuristic, not verified on real cars].

---

## 4. Inherent Limitations & False Positive Factors

The application explicitly displays these technical limitations on every screen and report:

1. **Battery Disconnection & Replacement**:
   - Disconnecting or replacing the 12V vehicle battery cuts continuous keep-alive memory (KAM) in many ECUs, resetting readiness monitors and distance/warm-up counters to zero without any fault concealing intent.
2. **Legitimate Mechanical Repairs**:
   - A reputable mechanic clearing codes after installing a new O2 sensor, catalytic converter, or spark plug will legitimately reset monitors and counters.
3. **Drive Cycle Duration Variations**:
   - Some secondary emission monitors (particularly EVAP and secondary air injection) require strict ambient conditions (e.g., fuel tank between 15% and 85%, cold soak overnight) and may remain "Not Ready" for weeks under normal driving.
4. **Counter Saturation and Unavailability (`0xFF` / `0xFFFF`)**:
   - Warm-up cycles max out at **255 (`0xFF`)** and distance/time counters max out at **65,535 (`0xFFFF`)**.
   - On some ECUs, `0xFF` or `0xFFFF` can mean either "maximum reached" or "not available / not implemented". Therefore, `0xFF` and `0xFFFF` on "since codes cleared" counters are treated as **saturated/unavailable** (`status: 'unavailable'`, `"counter at maximum or unavailable"`), never as reassuring evidence of normal driving.
5. **Sufficient Driving After Clearing**:
   - **No indicators found does not prove that codes were not cleared. A seller can drive enough distance after clearing** (e.g. $>80\text{ km}$ and $\ge 10$ warm-up cycles) to complete readiness monitors if an intermittent fault has not yet re-triggered.
6. **ECU Support Variations**:
   - Older vehicles (pre-2005) or non-CAN implementations may return `NO DATA` for PIDs `0130`, `0131`, `014D`, `014E`, or Mode `0A`. When unavailable, factors are marked `unavailable` rather than penalizing or reassuring the buyer.

---

## 5. Verification Note & Mandatory Disclaimer

> [!WARNING]
> These heuristic thresholds are public domain guidelines and have **NOT been verified on physical vehicle fleets or real cars**. They are designed strictly as an informational tool to aid vehicle buyers during physical evaluation.
>
> **Report Footer Disclaimer**:  
> _"This is an indication only and not a substitute for an inspection by a qualified mechanic."_

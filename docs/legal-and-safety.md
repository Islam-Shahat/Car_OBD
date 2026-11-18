# Legal Notices, Safety Terms, and Privacy Policy

Date: 2026-11-15  
Application: OBD Diagnose (0.9.0-rc.1)

---

## 1. Safety Notice & Diagnostic Disclaimer

> [!WARNING]
> **Diagnostic Tool Only — Clearing Codes Does Not Fix Faults**  
> Clearing diagnostic trouble codes (DTCs) resets the Engine Control Unit (ECU) error memory, turns off the Check Engine Light (MIL), and clears emissions readiness monitors. It **does NOT repair physical hardware faults, damaged wiring, or failing sensors**. If the underlying problem is not repaired, the fault code will return as soon as the vehicle completes its drive cycles.

### Rules for Safe Operation:

1. **Vehicle Stationary**: Never operate the diagnostic scanner, read live telemetry, or interact with the user interface while driving. Park the vehicle safely with the handbrake engaged.
2. **Ignition State for Clearing Codes**: When clearing fault codes (Mode 04), ensure the **engine is OFF and the ignition switch is in the ON position** (dashboard warning lights illuminated). Attempting to clear fault codes while the engine is running is unsafe and rejected by most ECUs.
3. **Emissions Inspection Impact**: Clearing DTCs immediately resets all I/M readiness monitors (Catalyst, Evaporative System, O2 Sensors, EGR, etc.) to **"Not Ready"**. If you take the vehicle for a government or regulatory emissions inspection immediately after clearing codes, it will automatically fail until driven through several complete manufacturer drive cycles.
4. **Informational Nature of Fault Text**: Arabic and English fault descriptions, probable causes, and inspection procedures are educational aids. Always consult an authorized factory service manual or a certified mechanic for definitive diagnosis.

---

## 2. Privacy Policy & Offline Guarantees

The OBD Diagnose application is built with an **Offline-First Privacy Architecture**:

1. **Zero Personal Data Collection**:
   - The application does not collect, record, or transmit user identities, names, emails, IP addresses, or location data.
2. **Local Data Confinement**:
   - Vehicle Identification Numbers (VINs), saved vehicle profiles, DTC scan histories, freeze frames, and live sensor recordings are stored **strictly in a local SQLite database on your device**.
   - No cloud synchronizers, advertising SDKs, or third-party analytics trackers are included in the codebase.
3. **Network Communication Scope**:
   - The application accesses the internet solely for two automated maintenance functions:
     1. Checking GitHub Releases for application updates.
     2. Fetching the cryptographically signed remote configuration (Ed25519) to verify service availability and security advisories.
   - These HTTP requests are anonymous `GET` requests containing zero user, vehicle, or diagnostic payload.
   - Because these requests are standard HTTPS requests directed to GitHub infrastructure (GitHub Releases and GitHub Pages), GitHub's servers receive the user's public IP address and standard HTTP request metadata (such as timestamps and User-Agent headers) in accordance with GitHub's standard privacy statement. No identifying application data is attached.

---

## 3. Terms of Use & Limitation of Liability

1. **License**: This software is free and open-source under the MIT License.
2. **As-Is Warranty**: The software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement.
3. **Damage Limitation**: In no event shall the authors or copyright holders be liable for any claim, damages, vehicular damage, mechanical failure, traffic citations, inspection failures, or other liability arising from the use of this software or ELM327 hardware adapters.

---

## 4. Vehicle Compatibility & Exclusions

This software is compatible exclusively with vehicles compliant with legislated **SAE J1979 / ISO OBD-II generic powertrain standards**:

- **United States**: 1996 and newer passenger cars and light trucks.
- **European Union**: 2001 and newer petrol cars; 2004 and newer diesel cars.
- **Japan / Asia**: Typically 2002–2008 and newer depending on market regulations.

**Pre-OBD-II vehicles, proprietary manufacturer diagnostic buses (e.g. BMW 20-pin, Mercedes 38-pin round connectors), 24V commercial trucks, and electric vehicle proprietary battery management systems are unsupported.**

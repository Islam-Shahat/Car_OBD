# Car OBD (برنامج تشخيص وفحص أعطال السيارات) — v0.9.0-rc.1

[![Build & Release](https://github.com/Islam-Shahat/Car_OBD/actions/workflows/build.yml/badge.svg)](https://github.com/Islam-Shahat/Car_OBD/actions)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6.svg)](https://github.com/Islam-Shahat/Car_OBD/releases)
[![Tests](https://img.shields.io/badge/Tests-254%20passed%20%7C%204%20skipped-brightgreen.svg)](#test-suite--verification)

> **Copyright**: © 2026 Islam-Shahat. All rights reserved. (Proprietary / All rights reserved)

---

## اللغة العربية (Arabic)

### نظرة عامة
**Car OBD** هو تطبيق مكتبي لنظام التشغيل Windows مخصص لتشخيص وقراءة أعطال سيارات الركاب عبر بروتوكولات **OBD-II** القياسية باستخدام محولات **ELM327** عبر منافذ USB التسلسلية أو البلوتوث (Virtual COM Ports). يتميز البرنامج بكونه **يعمل دون اتصال بالإنترنت بالكامل (Offline-first)** لحماية خصوصية المستخدم والعمل في الورش والأماكن المنقطعة عن الشبكة.

> [!IMPORTANT]
> **حالة الإصدار (Status)**: الإصدار الحالي **v0.9.0-rc.1** هو مرشح إصدار (Release Candidate). تم التحقق منه بالكامل واختباره برمجياً على **محاكي بروتوكول ELM327 وبيانات محاكاة اصطناعية (Synthetic Fixtures) فقط**. الفحص والاختبار الميداني على أجهزة حقيقية وسيارات فعلية مجدول للمراحل القادمة قبل إطلاق v1.0 النهائي.

---

### المميزات الرئيسية (Features)
- 🌍 **واجهة عربية أصيلة أولاً (Arabic-first RTL)**: تصميم عصري يدعم اتجاه القراءة من اليمين لليسار بخط Cairo المدمج كلياً، مع إمكانية التبديل للإنجليزية.
- 🚗 **التعرف على السيارة برقم الهيكل (VIN Decode)**: قراءة رقم الهيكل (Mode 09 PID 02) وتحديد الصانع وسنة الصنع مع كتالوج محلي مدمج يضم **377 طرازاً عبر 46 شركة مصنعة**.
- 🔍 **قراءة وفحص أكواد الأعطال (DTC Read)**:
  - الأعطال المسجلة (Stored DTCs - Mode 03).
  - الأعطال المعلقة (Pending DTCs - Mode 07).
  - الأعطال الدائمة (Permanent DTCs - Mode 0A).
  - بيانات إطار التجميد (Freeze Frame - Mode 02).
  - شروحات عربية مبسطة وأسباب محتملة مستندة لبيانات معيارية.
- 🚦 **مؤشرات الجاهزية (Readiness Monitors)**: فحص مؤشرات الانبعاثات وفحص ما قبل الفحص الدوري أو فحص الشراء.
- 🛡️ **مسار مسح الأعطال الآمن (Safe Code Clearing)**:
  - البرنامج للقراءة فقط افتراضياً؛ مسح الأعطال (Mode 04) هو أمر الكتابة الوحيد.
  - حفظ نسخة احتياطية إجبارية في قاعدة بيانات SQLite محلية قبل المسح.
  - صمام أمان يمنع المسح أثناء دوران المحرك (RPM = 0).
  - إعادة فحص تلقائية بعد المسح وإخطار المستخدم بحالة دورات القيادة.
- ⚡ **بث مباشر للبيانات والرسوم البيانية (Live Sensor Streaming)**: قراءة دورية لبيانات الحساسات مع عدادات دائرية ورسوم بيانية (`uPlot`) وإمكانية تصدير البيانات إلى CSV وحفظها محلياً.
- 📋 **فحص ما قبل الشراء (Pre-purchase Inspection Mode)**: تقييم لحالة السيارة المستعملة واكتشاف عمليات المسح الحديثة للأعطال ومسافة القيادة منذ آخر مسح.
- 🖨️ **تقارير فحص تشخيصية PDF**: تصدير تقارير فحص احترافية بصيغة PDF وتنسيق طباعة يدعم اللغة العربية بالكامل.
- 📝 **سجل أوامر المحول الآمن (TrafficLogger)**: تسجيل كافة إطارات TX/RX مع حجب تلقائي إجباري لأرقام الهيكل (VIN Redaction) لحماية الخصوصية وتصدير السجل لدعم التشخيص.
- 🔐 **إعدادات التحكم الموقعة عن بُعد (Signed Remote Config)**: آلية اختيارية لتعطيل الميزات الطارئة وتحديث بيانات التوافق، موثقة بمفتاح رقمي غير متماثل (Ed25519).

---

### البروتوكولات المدعومة عبر محولات ELM327
- **CAN Bus (ISO 15765-4)**: معرفات 11-bit و 29-bit بسرعات 250kbps و 500kbps (البروتوكول السائد في كافة سيارات الركاب الحديثة بعد 2008).
- **K-Line**: بروتوكولات ISO 9141-2 و ISO 14230-4 (KWP2000).
- **SAE J1850**: بروتوكولات PWM و VPW (المستخدمة في بعض طرازات فورد وجنرال موتورز القديمة).

> [!WARNING]
> **تنبيه بخصوص المحولات المقلدة**: العديد من المحولات الرخيصة التي تحمل اسم "ELM327 v1.5" أو "v2.1" تفتقر إلى عتاد الإرسال الخاص ببروتوكولات K-Line و J1850، وقد تعمل فقط مع سيارات CAN Bus الحديثة. نوصي باستخدام محولات معتمدة على شرائح PIC18F25K80 الأصلية أو أجهزة STN1110/STN2120 أو محولات FTDI USB السلكية.

---

### إخلاء المسؤولية والسلامة القانونية (Safety & Legal Disclaimer)
- البرنامج مصمم للمساعدة في فحص وقراءة بيانات السيارة، ولا يُعد بديلاً عن الفحص الميكانيكي المتخصص أو مركز الصيانة المعتمد.
- التطبيق **للقراءة فقط (Read-only)** في كافة عملياته باستثناء أمر مسح الأعطال المعتمد (Mode 04).
- لا يتحمل المطور أو الناشر أي مسؤولية عن أي أضرار ناتجة عن استخدام محولات فحص رديئة أو التعامل الخاطئ مع صيانة المركبة. لمزيد من التفاصيل، راجع [وثيقة السلامة والإخلاء القانوني](docs/legal-and-safety.md).

---

### الخصوصية التامة (Privacy Guarantee)
- **أوفلاين بالكامل**: لا يتم جمع أو حفظ أو رفع أي بيانات تشخيصية، أو أرقام هياكل (VIN)، أو أكواد أعطال، أو سجلات فحص إلى أي خادم خارجي.
- **بدون تحليلات**: البرنامج لا يحتوي على أي حزم تتبع، إعلانات، أو تحليلات مجهولة (Zero Telemetry).
- **الوصول للشبكة**: يُستخدم الاتصال بالإنترنت فقط وبشكل اختياري في حالتين:
  1. التحقق من وجود تحديثات رسمية عبر GitHub Releases.
  2. جلب ملف الإعدادات الموقّع رقمياً (Remote Config) المستضاف على GitHub Pages.
- *ملاحظة*: خوادم GitHub تقوم بتسجيل عناوين IP الخاصة بالمستخدمين عند تنزيل التحديثات أو الملفات وفقاً لسياسة الخصوصية الخاصة بشركة GitHub.

---

## English Overview

### Overview
**Car OBD** is an offline-first Windows desktop application designed for passenger-car diagnostics using standard **ELM327** adapters over USB serial or Bluetooth (Virtual COM ports). It offers deep OBD-II diagnostic access with zero cloud dependency, making it ideal for automotive technicians, enthusiasts, and vehicle inspection in field environments.

> [!IMPORTANT]
> **Release Status**: The current version **v0.9.0-rc.1** is a Release Candidate. It has been rigorously tested and verified against an **ELM327 software emulator and synthetic fixtures only**. Physical hardware integration and on-vehicle road testing are scheduled for an upcoming release phase prior to final v1.0 GA.

---

### Key Features
- 🌍 **Bilingual & RTL-First UI**: Native Arabic RTL and English LTR layouts with bundled offline Cairo typography.
- 🚗 **Automated VIN Decoding**: Mode 09 PID 02 decoding, WMI manufacturer mapping, and built-in offline catalog covering **377 models across 46 makes**.
- 🔍 **DTC Diagnostics & Freeze Frame**:
  - Stored trouble codes (Mode 03).
  - Pending trouble codes (Mode 07).
  - Permanent trouble codes (Mode 0A).
  - Freeze Frame telemetry snapshot (Mode 02).
  - Clear explanations, possible causes, and inspection steps.
- 🚦 **I/M Readiness Monitors**: Continuous and non-continuous emission monitor status verification.
- 🛡️ **Safe DTC Clearing Workflow**:
  - Read-only by default; Mode 04 code clear is the sole write command.
  - Mandatory local SQLite backup snapshot created prior to clearing.
  - Safety interlock enforcing zero engine RPM before executing clear.
  - Automatic re-scan and drive-cycle readiness advisory post-clear.
- ⚡ **Live Sensor Streaming**: High-throughput PID polling with circular dials, real-time `uPlot` charts, and export to CSV / persistent SQLite storage.
- 📋 **Pre-Purchase Evaluation Mode**: Heuristic assessment calculating drive cycles and distance since last clear to detect recent fault clearing.
- 🖨️ **Printable Diagnostic Reports**: Comprehensive PDF generation via WebView2 printing with RTL styling and complete session logs.
- 📝 **TrafficLogger with VIN Redaction**: Capture raw ELM327 TX/RX frames and timing with mandatory automated VIN masking.
- 🔐 **Signed Remote Configuration**: Emergency kill-switch and feature control authenticated via offline Ed25519 asymmetric signatures.

---

### Supported Protocols (via ELM327)
- **CAN Bus (ISO 15765-4)**: 11-bit & 29-bit identifiers at 250 kbps & 500 kbps (Standard for 2008+ modern vehicles).
- **ISO 9141-2 & ISO 14230-4 (KWP2000)**: K-Line protocols commonly found on older Asian and European passenger cars.
- **SAE J1850 (PWM & VPW)**: Legacy pulse-width and variable-pulse modulation protocols.

> [!WARNING]
> **Hardware Clone Advisory**: Budget clones labeled "v1.5" or "v2.1" frequently omit transceivers for K-Line and J1850 protocols and may only function on CAN bus lines. Genuine PIC18F25K80, STN1110/STN2120, or FTDI USB adapters are strongly recommended.

---

### Prerequisites & Building from Source

#### Prerequisites
- **Operating System**: Windows 10 (20H2+) or Windows 11 (64-bit).
- **Runtime**: Microsoft Edge WebView2 (pre-installed on Windows 10/11).
- **Node.js**: v24.x (LTS recommended) + npm.
- **Rust**: Latest stable Rust toolchain (`rustc`, `cargo`, `rustfmt`, `clippy`).
- **C++ Build Tools**: Visual Studio 2022 C++ Build Tools (MSVC).

#### Build Commands
```bash
# 1. Clone the repository
git clone https://github.com/Islam-Shahat/Car_OBD.git
cd Car_OBD

# 2. Install frontend dependencies
npm ci

# 3. Run development mode (Hot-reload UI + Tauri dev shell)
npm run tauri dev

# 4. Compile production installer (NSIS .exe & .msi)
npm run tauri build
```

---

### Project Structure
```text
Car_OBD/
├── .github/                 # Workflows (build, release) and issue/PR templates
├── docs/                    # Architecture, Phase reports, safety, and protocols
├── src/                     # React + TypeScript frontend application
│   ├── app/                 # Application shell, router, providers, and layout
│   ├── assets/              # Fonts (Cairo), brand icons, and static assets
│   ├── components/          # Reusable UI widgets, modals, buttons, and alerts
│   ├── data/                # Seed DTC database (OBDex) and vehicle catalog JSON
│   ├── features/            # Domain modules (connection, scan, live, history, reports)
│   ├── i18n/                # Arabic and English localization resources
│   └── lib/                 # Core logic: ELM327 driver, DB migrations, VIN decoder
├── src-tauri/               # Rust Tauri backend (OS serial bridge, SQLite, PDF printing)
│   ├── src/                 # Native commands (save_pdf, show_in_folder, serial port list)
│   ├── Cargo.toml           # Rust package configuration
│   └── tauri.conf.json      # Tauri application and updater configuration
├── tests/                   # Vitest unit and integration test suites
└── tools/                   # Maintenance scripts (DTC parser, catalog generator)
```

---

### Data Sources
- **OBDex**: Diagnostic trouble code definitions are derived from the open automotive data project [OBDex](https://github.com/opencode/obdex) under Creative Commons Zero (**CC0 1.0 Universal**).
- **Vehicle Catalog**: Curated offline database containing 377 vehicle models across 46 passenger-car manufacturers.

---

### Safety and Legal Disclaimer
This software is intended solely as an informational diagnostic aid. It does not replace professional mechanical inspection, maintenance, or certified automotive workshop diagnosis.
- All operations are strictly **read-only**, with the exception of the standard Mode 04 trouble code clearing command.
- The authors and maintainers assume no liability for vehicle damage, safety incidents, or regulatory non-compliance resulting from use.
- Read the full [Legal and Safety Policy](docs/legal-and-safety.md) before operating.

---

### Privacy & Data Protection
- **Completely Offline**: Diagnostic logs, trouble codes, vehicle identification numbers, and inspection sessions remain stored exclusively in your local machine's SQLite database (`%APPDATA%/obd-diagnose.db`).
- **Zero Telemetry**: No tracking cookies, telemetry beacons, or analytical scripts are included.
- **Outbound Connections**: Network requests occur solely for:
  1. User-initiated checks for releases via GitHub Releases.
  2. Fetching the signed configuration file from GitHub Pages (`https://islam-shahat.github.io/Car_OBD/config.json`).
- *Note*: GitHub services process downloader IP addresses in accordance with the [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement).

---

### Contributing
Contributions to improve translations, expand vehicle catalog accuracy, or report adapter quirks are welcome!
- **Bug Reports**: Open an issue using the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md).
- **Catalog Corrections**: Submit corrections using the [Catalog Correction Template](.github/ISSUE_TEMPLATE/catalog_correction.md).
- **WMI / VIN Contributions**: Propose missing manufacturers via the [WMI Contribution Template](.github/ISSUE_TEMPLATE/wmi_contribution.md).
- **Pull Requests**: Follow our [Pull Request Template](.github/pull_request_template.md).

---

### Test Suite & Verification
The test suite is executed and validated locally:
- **Test Files**: 38 files (35 active test files passing, 3 live emulator integration files skipped pending active hardware harness).
- **Test Count**: **254 passed | 4 skipped (258 total tests)**.
- **Verification Command**:
  ```bash
  npm test
  npm run typecheck
  npm run lint
  ```

---

### License
**Proprietary / All Rights Reserved.**  
© 2026 Islam-Shahat. All rights reserved.  
Public availability of this repository does not grant permission to copy, modify, redistribute, or use this software without explicit authorization. Third-party software notices and data licenses are detailed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

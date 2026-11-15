# OBD Diagnose (برنامج تشخيص وفحص أعطال السيارات) — v0.9.0-rc.1

[![Build & Release](https://github.com/islamshahat/obd-diagnose/actions/workflows/build.yml/badge.svg)](https://github.com/islamshahat/obd-diagnose/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6.svg)](https://github.com/islamshahat/obd-diagnose/releases)

---

## اللغة العربية (Arabic)

**OBD Diagnose** هو برنامج مجاني مفتوح المصدر لنظام التشغيل Windows، مصمم ليعمل **دون اتصال بالإنترنت بالكامل (Offline-first)** لتشخيص وفحص أعطال سيارات الركاب عبر محولات **ELM327** القياسية (سواء عبر كابل USB أو البلوتوث عبر منافذ COM التسلسلية).

> [!NOTE]
> **حالة الإصدار**: الإصدار الحالي **v0.9.0-rc.1** هو **مرشح إصدار (Release Candidate)** مخصص للمراجعة والتقييم، وليس إصداراً نهائياً عاماً. الفحص والتحقق على محولات وسيارات حقيقية قيد الإجراء قبل الإطلاق النهائي v1.0.

### المميزات الرئيسية

- 🌍 **واجهة عربية أصيلة (RTL)**: تصميم متكامل من اليمين لليسار بخط Cairo المدمج، مع إمكانية التبديل للإنجليزية في أي وقت.
- 🚗 **تحديد هوية السيارة برقم الهيكل (VIN First)**: قراءة رقم الهيكل تلقائيًا وفك ترميز الصانع (WMI) والسنوات المقترحة، مع فهرس بحث محلي يضم 380 طرازًا لأكثر من 33 شركة.
- 🔍 **فحص شامل للأعطال ومؤشرات الجاهزية**: قراءة الأعطال المسجلة (Stored - Mode 03)، والمعلقة (Pending - Mode 07)، والدائمة (Permanent - Mode 0A)، وبيانات إطار التجميد (Freeze Frame).
- 📖 **شروحات عربية مبسطة لأكواد الأعطال**: تفاصيل الأكواد SAE J2012 مع الأسباب المحتملة وخطوات الفحص، مع توضيح مستوى المراجعة (مراجعة ميكانيكية أو ترجمة تقنية).
- 🛡️ **مسار مسح الأعطال الآمن (Safe Clear Flow)**: نسخ احتياطي إجباري في قاعدة بيانات SQLite محلية قبل المسح، والتحقق من توقف المحرك (RPM = 0)، مع إعادة الفحص التلقائي والتنبيه بعدم اكتمال دورات القيادة.
- ⚡ **بيانات حية وعدادات سريعة (Live Telemetry)**: استعلام متسلسل ذكي يتجاوز 50 تحديثًا/ثانية، وعدادات دائرية، ورسوم بيانية (`uPlot`) دون أي زيادة في استهلاك الذاكرة، مع تصدير CSV.
- 🔒 **خصوصية تامة 100%**: لا يتم جمع أو إرسال أي بيانات شخصية أو بيانات تخص السيارة أو نتائج الفحص إلى أي خادم عبر الإنترنت. الاتصال بالإنترنت يُستخدم فقط للتحقق من التحديثات وإشارات التحكم الموقّعة رقمياً (Ed25519).

### ميزات مخططة قيد التطوير (المرحلة 7 — Planned Features)

- 📋 **سجل الفحوصات السابقة (History Browser)**: استعراض ومقارنة الفحوصات السابقة المحفوظة في قاعدة بيانات SQLite المحلية (مخطط).
- 🖨️ **تصدير تقارير فحص PDF**: توليد تقارير تشخيصية قابلة للطباعة والحفظ بصيغة PDF مع دعم كامل للغة العربية (مخطط).
- 🔍 **فحص ما قبل الشراء للسيارات المستعملة (Pre-purchase Mode)**: تحليل دورات القيادة واكتشاف المسح المشبوه للأعطال (مخطط).

### توصيات محولات الفحص (Hardware Recommendations)

> ملاحظة: نوصي باختيار المحول بناءً على **شريحة التحكم الداخلية (Chipset)** لضمان استقرار الاتصال. لا نوفر أسعاراً لكونها تختلف حسب الدولة والمورد.

1. **المحولات الموصى بها (الفئة الممتازة)**:
   - المحولات المعتمدة على شريحة **Microchip PIC18F25K80** الأصلية (تأتي بكريستال مزدوج 4MHz و 16MHz).
   - المحولات المعتمدة على شرائح **STN1110** أو **STN2120** (مثل عائلة OBDLink SX USB).
   - محولات USB السلكية المعتمدة على شريحة **FTDI FT232R** لضمان ثبات الإشارة وعدم انقطاع الاتصال.
2. **محولات النسخ الرخيصة (Clones v1.5 / v2.1)**:
   - العديد من المحولات الرخيصة التي تحمل اسم "v2.1" تفتقر لمكونات الاتصال مع بروتوكولات K-Line القديمة (مثل ISO 9141-2 و KWP2000 للسيارات الأقدم من 2006).
   - البرنامج يحتوي على آليات ذكية للتعامل مع بطء النسخ المقلدة وتفادي فيضان الذاكرة المؤقتة (Buffer Overflow).

### خطوات البدء السريع

1. حمّل ملف التثبيت (`obd-diagnose-setup.exe` أو `.msi`) من صفحة [Releases](https://github.com/islamshahat/obd-diagnose/releases).
2. ركّب محول ELM327 في منفذ الفحص (OBD-II) بالسيارة (عادةً أسفل عجلة القيادة).
3. **أدر مفتاح تشغيل السيارة إلى وضع التشغيل ON** (إضاءة لمبات الطبلون، مع إمكانية تشغيل المحرك لقراءة البيانات الحية، أو إيقافه لمسح الأعطال).
4. افتح البرنامج، اختر منفذ الـ COM الخاص بالمحول، واضغط **اتصال**.

### استكشاف الأخطاء الشائعة (Troubleshooting)

- **تعذر الاتصال بالسيارة (UNABLE TO CONNECT)**: تأكد من أن مفتاح السيارة في وضع ON وليس في وضع الإغلاق (OFF) أو ملحقات الراديو (ACC).
- **المنفذ مشغول (Access Denied / Port Busy)**: تأكد من إغلاق أي برنامج آخر يستخدم المنفذ التسلسلي (مثل برامج الفحص الأخرى أو شاشات المراقبة).
- **محول البلوتوث لا يظهر**: تأكد من إقران المحول بنظام Windows أولاً عبر إعدادات Bluetooth وإدخال رمز PIN (عادةً `1234` أو `0000`).

---

## English Overview

**OBD Diagnose** is a free, open-source, **offline-first** Windows desktop application engineered for passenger car diagnostics using standard **ELM327** adapters over USB or Bluetooth virtual COM ports.

> [!NOTE]
> **Release Status**: Version **v0.9.0-rc.1** is a **Release Candidate (RC)** for evaluation and testing, not a final release. Physical hardware and real-vehicle validations are pending prior to v1.0 GA.

### Key Highlights

- **First-Class Bilingual UI**: Native Arabic RTL and English LTR layouts with bundled offline Cairo typography.
- **VIN-First Identification**: Automated Mode 09 PID 02 decoding, offline WMI mapping, and 380-model local catalog.
- **Complete Diagnostic Coverage**: Stored (Mode 03), Pending (Mode 07), Permanent (Mode 0A), freeze frames, and readiness monitors.
- **Safe Code Clearing**: Mandatory pre-clear local SQLite backup, engine-running interlock, and automated re-scan.
- **High-Rate Live Telemetry**: Sequential scheduler exceeding 50 updates/sec on quality hardware, responsive dials, uPlot charts, and CSV export.
- **Decentralized Remote Control**: Asymmetric Ed25519-signed feature flags and emergency kill-switch with anti-rollback and fail-open resilience.
- **100% Privacy Guarantee**: Zero telemetry, zero analytics. Vehicle and diagnostic records stay strictly on your local disk.

### Planned Features (Phase 7 — Under Development)

- 📋 **Historical Scan Session Browser**: Review and compare previous diagnostic sessions saved in local SQLite (planned).
- 🖨️ **Printable PDF Reports**: Export formatted diagnostic reports using native print CSS with full Arabic RTL support (planned).
- 🔍 **Pre-Purchase Used Car Inspection Mode**: Detect suspicious code resets and correlate drive cycles with monitor readiness (planned).

### Hardware Adapter Guidelines

For the best diagnostic experience, select adapters based on their **internal microcontroller**:

- **Recommended**: Genuine **Microchip PIC18F25K80**, **STN1110 / STN2120**, or genuine **FTDI USB** interfaces.
- **Budget Clones**: Inexpensive "ELM327 v1.5 / v2.1" adapters function for modern CAN bus vehicles, but often lack transceivers for older ISO 9141-2 / KWP protocols. The app includes adaptive delays to prevent clone buffer overruns.

---

## Development & Building

```bash
# Clone the repository
git clone https://github.com/islamshahat/obd-diagnose.git
cd obd-diagnose

# Install dependencies
npm ci

# Run dev environment
npm run dev

# Run all test suites
npm test

# Run quality checks
npm run typecheck
npm run lint
npm run format:check

# Build Windows desktop installer
npm run tauri build
```

---

## License

Licensed under the [MIT License](LICENSE).

# Release Notes — OBD Diagnose v0.9.0-rc.1 (Release Candidate)

Release Date: 2026-11-15  
Platform: Windows 10 / 11 (64-bit)  
Architecture: x86_64 (NSIS Installer & MSI Package)  
Release Type: Pre-release Candidate (مرشح إصدار تجريبي)

---

## Arabic Summary | ملخص الإصدار باللغة العربية

نقدم مرشح الإصدار التجريبي الأول **v0.9.0-rc.1** من برنامج **OBD Diagnose**، وهو برنامج مجاني مفتوح المصدر ومصمم للعمل دون اتصال بالإنترنت (Offline-first) لتشخيص وفحص أعطال سيارات الركاب عبر محولات ELM327 (عبر منافذ USB أو Bluetooth COM).

> [!NOTE]
> هذا الإصدار هو **مرشح إصدار (Release Candidate)** مخصص للاختبار والمراجعة، ولم يتم اختباره بعد على مركبات حقيقية أو محولات فعلية على أرض الواقع. كما أن ميزات المرحلة السابعة (تصدير تقارير PDF وسجل الفحوصات وفحص ما قبل الشراء) ميزات مخططة لم تصدر بعد.

- **واجهة عربية متكاملة (RTL)**: دعم كامل للغة العربية من اليمين لليسار مع إمكانية التبديل للإنجليزية بضغطة زر.
- **تحديد هوية السيارة عبر رقم الهيكل (VIN)**: قراءة رقم الهيكل تلقائيًا وتحديد الشركة المصنعة ونطاق سنوات الموديل، مع فهرس يدوي يضم 377 طرازًا لأكثر من 46 شركة.
- **فحص شامل للأعطال ومؤشرات الجاهزية**: قراءة الأعطال المسجلة (Stored)، والمعلقة (Pending)، والدائمة (Permanent)، وقراءة إطارات التجميد (Freeze Frames).
- **شروحات عربية مبسطة لأكواد الأعطال**: ترجمة مبسطة ومصنفة لأكواد الأعطال SAE J2012 مع بيان الأسباب المحتملة وخطوات الفحص، مع الالتزام بالشفافية الكاملة وتحديد حالة المراجعة الميكانيكية.
- **مسار مسح الأعطال الآمن**: النسخ الاحتياطي التلقائي للأعطال في قاعدة بيانات SQLite محلية قبل المسح، والتحقق من حالة تشغيل المحرك، مع فحص تلقائي بعد المسح وتنبيه بضرورة القيادة لعدة دورات للتأكد من الإصلاح.
- **بيانات حية وعدادات بيانية عالية الأداء**: مراقبة سريعة ومجدولة للمستشعرات مع عدادات دائرية ورسوم بيانية (`uPlot`) دون أي استهلاك زائد للذاكرة، وتصدير السجلات بصيغة CSV.
- **تحكم عن بُعد موقّع رقميًا (Ed25519)**: تحديثات وإدارة للميزات وحماية أمنية للمركبات دون المساس بالخصوصية ودون إرسال أي بيانات شخصية أو بيانات للمركبة إلى الإنترنت.

---

## English Summary

This is the **v0.9.0-rc.1** release candidate of **OBD Diagnose**, an offline-first Windows desktop application for passenger car diagnostics using ELM327 OBD-II adapters.

> [!NOTE]
> This build is a **Release Candidate (RC)** for evaluation and testing. It has been verified against synthetic fixtures and the Python ELM327 emulator, but **has not yet been validated on a physical vehicle or physical adapter**. Phase 7 features (PDF reports, history log viewer, and pre-purchase inspection analysis) are implemented and verified only on the emulator and synthetic data.

### Features & Highlights:

1. **Full RTL & Arabic First-Class Experience**: Native Arabic typography using the bundled Cairo font with instant bilingual switching.
2. **Vehicle Identification (VIN First)**: Automated Mode 09 PID 02 reading, WMI offline decoding, and an offline vehicle catalog with Arabic normalization.
3. **Core Diagnostic Suite**: Modes 01, 02, 03, 07, and 0A diagnostics, freeze frame inspection, and I/M readiness monitor evaluation.
4. **Safe Code Clearing Flow**: Mandatory durable local SQLite backup prior to sending Mode 04, engine-running safety interlock, and automated post-clear re-scan.
5. **Real-Time Live Telemetry & Gauges**: Responsive SVG dials, sequential PID polling with adaptive delay scheduler, uPlot charts, and CSV export.
6. **Decentralized Remote Control**: Ed25519-signed feature gating and emergency kill-switch with anti-rollback and fail-open offline grace.
7. **Privacy & Transparency**: Zero telemetry, zero analytics. Vehicle data never leaves your device.
8. **Diagnostic Traffic Logging**: Support debug logger with automatic 17-character VIN redaction.

### Phase 7 Features (Implemented, Verified on Emulator & Synthetic Data):

- **Historical Scan Session Browser**: View, filter by vehicle, compare two scans side-by-side, and soft-delete past diagnostic sessions from local SQLite (`HistoryPage.tsx`, `tests/history-flow.test.ts`). *(implemented, verified only on the emulator and synthetic data)*
- **Printable HTML / PDF Diagnostic Reports**: Export formatted diagnostic reports using WebView2 PrintToPdf and native print CSS with full Arabic RTL Cairo typography (`ReportModal.tsx`, `docs/samples/report-sample.pdf`). *(implemented, verified only on the emulator and synthetic data)*
- **Pre-Purchase Used Car Inspection Mode**: Multi-factor heuristic analyzing monitor readiness, distance/warmups since clearing, and permanent Mode 0A DTCs with transparent counter displays and mechanic disclaimer (`prePurchase.ts`, `tests/pre-purchase.test.ts`). *(implemented, verified only on the emulator and synthetic data)*

---

## Verification & Status

- **Automated Tests**: Tested against unit suites and Python ELM327 socket emulator.
- **Hardware Status**: Pending physical adapter and vehicle verification.
- **Code Signing**: Unsigned binaries (self-built / preview).

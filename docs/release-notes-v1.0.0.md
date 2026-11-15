# Release Notes — OBD Diagnose v1.0.0

Release Date: 2026-11-15  
Platform: Windows 10 / 11 (64-bit)  
Architecture: x86_64 (NSIS Installer & MSI Package)

---

## Arabic Summary | ملخص الإصدار باللغة العربية

يسعدنا إطلاق الإصدار المستقر الأول **v1.0.0** من برنامج **OBD Diagnose**، وهو برنامج مجاني مفتوح المصدر ومصمم للعمل دون اتصال بالإنترنت (Offline-first) لتشخيص وفحص أعطال سيارات الركاب عبر محولات ELM327 (عبر منافذ USB أو Bluetooth COM):

- **واجهة عربية متكاملة (RTL)**: دعم كامل للغة العربية من اليمين لليسار مع إمكانية التبديل للإنجليزية بضغطة زر.
- **تحديد هوية السيارة عبر رقم الهيكل (VIN)**: قراءة رقم الهيكل تلقائيًا وتحديد الشركة المصنعة ونطاق سنوات الموديل، مع فهرس يدوي يضم 380 طرازًا لأكثر من 33 شركة.
- **فحص شامل للأعطال ومؤشرات الجاهزية**: قراءة الأعطال المسجلة (Stored)، والمعلقة (Pending)، والدائمة (Permanent)، وقراءة إطارات التجميد (Freeze Frames).
- **شروحات عربية مبسطة لأكواد الأعطال**: ترجمة مبسطة ومصنفة لأكواد الأعطال SAE J2012 مع بيان الأسباب المحتملة وخطوات الفحص، مع الالتزام بالشفافية الكاملة وتحديد حالة المراجعة الميكانيكية.
- **مسار مسح الأعطال الآمن**: النسخ الاحتياطي التلقائي للأعطال في قاعدة بيانات SQLite محلية قبل المسح، والتحقق من حالة تشغيل المحرك، مع فحص تلقائي بعد المسح وتنبيه بضرورة القيادة لعدة دورات للتأكد من الإصلاح.
- **بيانات حية وعدادات بيانية عالية الأداء**: مراقبة سريعة ومجدولة للمستشعرات مع عدادات دائرية ورسوم بيانية (`uPlot`) دون أي استهلاك زائد للذاكرة، وتصدير السجلات بصيغة CSV.
- **تحكم عن بُعد موقّع رقميًا (Ed25519)**: تحديثات وإدارة للميزات وحماية أمنية للمركبات دون المساس بالخصوصية ودون إرسال أي بيانات شخصية أو بيانات للمركبة إلى الإنترنت.

---

## English Summary

We are proud to announce the **v1.0.0** general availability release of **OBD Diagnose**, an offline-first Windows desktop application for passenger car diagnostics using ELM327 OBD-II adapters:

### Features & Highlights:

1. **Full RTL & Arabic First-Class Experience**: Native Arabic typography using the bundled Cairo font with instant bilingual switching.
2. **Vehicle Identification (VIN First)**: Automated Mode 09 PID 02 reading, WMI offline decoding, and a 380-model vehicle catalog with Arabic normalization.
3. **Core Diagnostic Suite**: Modes 01, 02, 03, 07, and 0A diagnostics, freeze frame inspection, and I/M readiness monitor evaluation.
4. **Safe Code Clearing Flow**: Mandatory durable local SQLite backup prior to sending Mode 04, engine-running safety interlock, and automated post-clear re-scan.
5. **Real-Time Live Telemetry & Gauges**: Responsive SVG dials, high-frequency sequential PID polling (50+ updates/sec), uPlot charts, and CSV export.
6. **Decentralized Remote Control**: Ed25519-signed feature gating and emergency kill-switch with anti-rollback and fail-open offline grace.
7. **Privacy & Transparency**: Zero telemetry, zero analytics. Vehicle data never leaves your device.
8. **Diagnostic Traffic Logging**: Support debug logger with automatic 17-character VIN redaction.

---

## Verification & Quality Metrics

- **Unit & Integration Tests**: 231 tests across 32 test files passing (100%).
- **Cold Start Time**: ~860 ms.
- **Idle Memory (Host Private Bytes)**: ~10.3 MB.
- **Clean Install**: Verified on fresh Windows 10/11 environments.

import { useEffect } from 'react';
import { isTauriEnvironment } from '../../lib/db/runtime';
import { DiagnosticReportView } from './DiagnosticReportView';
import type { DiagnosticReportData } from './reportTypes';

export const SAMPLE_EMULATOR_REPORT_DATA: DiagnosticReportData = {
  mode: 'pre_purchase',
  scanDate: '2026-11-15 14:30',
  isSampleData: true,
  vehicle: {
    make: 'Porsche',
    model: '911 Carrera S',
    year: 2021,
    engine: '3.0L Boxer-6 Twin-Turbo',
    vin: 'WP0AB2A99MS123456',
  },
  adapter: {
    identity: 'OBDLink MX+ (Emulator)',
    version: 'STN1151 v4.3',
    protocol: 'ISO 15765-4 (CAN 11/500)',
  },
  protocol: 'ISO 15765-4 (CAN 11/500)',
  milStatus: { on: false, dtcCount: 0 },
  overallStatus: 'fault',
  storedCodes: [
    {
      code: 'P0143',
      type: 'stored',
      lookup: {
        kind: 'generic',
        code: 'P0143',
        category: 'powertrain',
        record: {
          id: 'dtc-p0143',
          code: 'P0143',
          make: null,
          descriptionAr:
            'جهد منخفض في دائرة حساس الأكسجين (صف 1، حساس 3). قراءة الجهد بعد المحفز ظلت أقل من الحد الأدنى المقبول لمنظومة الاحتراق.',
          descriptionEn:
            'O2 Sensor Circuit Low Voltage (Bank 1, Sensor 3). Downstream oxygen sensor voltage remained below minimum threshold.',
          severity: 'medium',
          severitySource: 'heuristic',
          possibleCausesAr: [
            'تلف حساس الأكسجين السفلي',
            'تسريب في ماسورة العادم قبل الحساس',
            'تآكل أو انقطاع أسلاك التوصيل',
          ],
          possibleCausesEn: [
            'Defective downstream O2 sensor',
            'Exhaust leak before sensor',
            'Wiring/connector damage',
          ],
          inspectionStepsAr: [
            'فحص الأسلاك والموصلات الخاصة بالحساس',
            'قياس الجهد المرجعي ومقاومة التسخين',
            'استبدال الحساس إذا ثبت تلفه',
          ],
          inspectionStepsEn: [
            'Inspect sensor wiring and harness',
            'Measure heater resistance and reference voltage',
            'Replace sensor if internal element failed',
          ],
          source: 'obdex',
          sourceVersion: '1.0',
          translationTier: 1,
          needsReview: false,
          reviewedBy: 'automotive-translator',
          reviewedAt: '2026-11-10T12:00:00Z',
          createdAt: '2026-11-10T12:00:00Z',
          updatedAt: '2026-11-10T12:00:00Z',
          deletedAt: null,
        },
      },
    },
    {
      code: 'P0196',
      type: 'stored',
      lookup: {
        kind: 'generic',
        code: 'P0196',
        category: 'powertrain',
        record: {
          id: 'dtc-p0196',
          code: 'P0196',
          make: null,
          descriptionAr:
            'أداء غير منتظم في حساس درجة حرارة زيت المحرك. قراءة حرارة الزيت شاذة ولا تطابق حرارة سائل التبريد.',
          descriptionEn:
            'Engine Oil Temperature Sensor Range/Performance. Reading deviates from expected thermal curve.',
          severity: 'low',
          severitySource: 'heuristic',
          possibleCausesAr: [
            'خلل في حساس حرارة الزيت',
            'عطل في ثرموستات مبرد الزيت',
            'تلف موصل الإشارة',
          ],
          possibleCausesEn: [
            'Defective oil temperature sensor',
            'Oil cooler thermostat stuck',
            'Connector corrosion',
          ],
          inspectionStepsAr: [
            'مقارنة حرارة الزيت بسائل التبريد أثناء الإحماء',
            'فحص مقاومة الحساس بالملتيميتر',
            'استبدال الحساس إذا ثبت تلفه',
          ],
          inspectionStepsEn: [
            'Compare oil vs coolant temperature during warmup',
            'Measure sensor resistance',
            'Replace sensor if out of spec',
          ],
          source: 'obdex',
          sourceVersion: '1.0',
          translationTier: 1,
          needsReview: false,
          reviewedBy: 'automotive-translator',
          reviewedAt: '2026-11-10T12:00:00Z',
          createdAt: '2026-11-10T12:00:00Z',
          updatedAt: '2026-11-10T12:00:00Z',
          deletedAt: null,
        },
      },
    },
    {
      code: 'P0234',
      type: 'stored',
      lookup: {
        kind: 'generic',
        code: 'P0234',
        category: 'powertrain',
        record: {
          id: 'dtc-p0234',
          code: 'P0234',
          make: null,
          descriptionAr:
            'ضغط شحن توربيني زائد عن الحد الآمن. تجاوز ضغط الهواء المضغوط من التوربو الحد الأقصى المبرمج.',
          descriptionEn:
            'Turbocharger/Supercharger Overboost Condition. Manifold boost pressure exceeded maximum limit.',
          severity: 'high',
          severitySource: 'heuristic',
          possibleCausesAr: [
            'عطل في صمام تصريف الضغط (Wastegate)',
            'خلل في حساس ضغط المنيفولد MAP',
            'انسداد خراطيم التحكم في الضغط',
          ],
          possibleCausesEn: [
            'Wastegate stuck closed',
            'Faulty boost control solenoid (N75)',
            'Cracked vacuum reference lines',
          ],
          inspectionStepsAr: [
            'فحص حركة ذراع صمام الويست جيت ميكانيكياً',
            'اختبار صمام التحكم الكهرومغناطيسي',
            'فحص خراطيم التفريغ والضغط',
          ],
          inspectionStepsEn: [
            'Check mechanical movement of wastegate actuator',
            'Test N75 solenoid operation',
            'Inspect boost vacuum lines',
          ],
          source: 'obdex',
          sourceVersion: '1.0',
          translationTier: 1,
          needsReview: false,
          reviewedBy: 'automotive-translator',
          reviewedAt: '2026-11-10T12:00:00Z',
          createdAt: '2026-11-10T12:00:00Z',
          updatedAt: '2026-11-10T12:00:00Z',
          deletedAt: null,
        },
      },
    },
  ],
  pendingCodes: [
    {
      code: 'P0300',
      type: 'pending',
      lookup: {
        kind: 'generic',
        code: 'P0300',
        category: 'powertrain',
        record: {
          id: 'dtc-p0300',
          code: 'P0300',
          make: null,
          descriptionAr: 'رصد اختلال احتراق عشوائي / متعدد الأسطوانات في دورات تشغيل متفرقة.',
          descriptionEn: 'Random/Multiple Cylinder Misfire Detected.',
          severity: 'high',
          severitySource: 'heuristic',
          possibleCausesAr: [
            'تلف شمعات الاحتراق (بواجي)',
            'ضعف كويلات الإشعال',
            'خلل في ضغط الوقود',
          ],
          possibleCausesEn: ['Worn spark plugs', 'Failing ignition coils', 'Low fuel pressure'],
          inspectionStepsAr: [
            'فحص شمعات الاحتراق وتنظيفها أو استبدالها',
            'اختبار كويلات الإشعال',
            'قياس ضغط طرمبة البنزين',
          ],
          inspectionStepsEn: [
            'Inspect and gap spark plugs',
            'Swap ignition coils across cylinders',
            'Check fuel pressure',
          ],
          source: 'obdex',
          sourceVersion: '1.0',
          translationTier: 1,
          needsReview: false,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: '2026-11-10T12:00:00Z',
          updatedAt: '2026-11-10T12:00:00Z',
          deletedAt: null,
        },
      },
    },
  ],
  permanentCodes: [
    {
      code: 'P0420',
      type: 'permanent',
      lookup: {
        kind: 'generic',
        code: 'P0420',
        category: 'powertrain',
        record: {
          id: 'dtc-p0420',
          code: 'P0420',
          make: null,
          descriptionAr:
            'كفاءة المحول الحفاز أقل من الحد المسموح (صف 1). كود دائم مسجل في الذاكرة غير المتطايرة.',
          descriptionEn:
            'Catalyst System Efficiency Below Threshold (Bank 1). Permanent non-volatile DTC.',
          severity: 'medium',
          severitySource: 'heuristic',
          possibleCausesAr: ['تراجع كفاءة دبة التلوث (الكتالايزر)', 'تسريب عادم قرب المحول'],
          possibleCausesEn: ['Degraded catalytic converter', 'Exhaust leak near catalyst'],
          inspectionStepsAr: [
            'إجراء دورة قيادة كاملة للتحقق من كفاءة الحفاز',
            'مراقبة قراءات حساس الأكسجين الخلفي',
          ],
          inspectionStepsEn: [
            'Perform full drive cycle verification',
            'Monitor downstream O2 sensor voltages',
          ],
          source: 'obdex',
          sourceVersion: '1.0',
          translationTier: 1,
          needsReview: false,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: '2026-11-10T12:00:00Z',
          updatedAt: '2026-11-10T12:00:00Z',
          deletedAt: null,
        },
      },
    },
  ],
  readiness: {
    mil: { on: false, dtcCount: 0 },
    ignition: 'spark',
    monitors: [
      { key: 'misfire', complete: true },
      { key: 'fuelSystem', complete: true },
      { key: 'components', complete: true },
      { key: 'catalyst', complete: false },
      { key: 'evap', complete: false },
      { key: 'o2Sensor', complete: false },
      { key: 'egr', complete: false },
    ],
  },
  driveHistory: {
    distanceSinceClearedKm: 12,
    warmupsSinceCleared: 1,
    timeSinceClearedMinutes: 25,
    runTimeSeconds: 400,
    distanceWithMilKm: 0,
    timeWithMilMinutes: 0,
  },
  freezeFrames: [
    {
      frame: 0,
      dtc: {
        code: 'P0143',
        system: 'P',
        bytes: [0x01, 0x43],
        raw: 'P0143',
      },
      readings: [
        {
          pid: 0x05,
          data: [0x80],
          measurements: [
            { labelKey: 'scan.pids.coolantTemp', value: 88, unit: 'celsius', decimals: 0 },
          ],
        },
        {
          pid: 0x0c,
          data: [0x1d, 0x10],
          measurements: [{ labelKey: 'scan.pids.rpm', value: 1850, unit: 'rpm', decimals: 0 }],
        },
        {
          pid: 0x0d,
          data: [0x40],
          measurements: [{ labelKey: 'scan.pids.speed', value: 64, unit: 'kmh', decimals: 0 }],
        },
        {
          pid: 0x04,
          data: [0x58],
          measurements: [
            { labelKey: 'scan.pids.engineLoad', value: 34.5, unit: 'percent', decimals: 1 },
          ],
        },
      ],
    },
  ],
  prePurchase: {
    level: 'several_indicators',
    headlineKey: 'prePurchase.levels.several.headline',
    bodyKey: 'prePurchase.levels.several.body',
    limitationsKey: 'prePurchase.limitationsNotice',
    factors: [
      {
        id: 'monitors',
        labelKey: 'prePurchase.factors.monitors',
        status: 'suspicious',
        rawText: '4 / 7',
        explanationKey: 'prePurchase.explanations.monitorsManyIncomplete',
      },
      {
        id: 'distanceSinceClear',
        labelKey: 'prePurchase.factors.distanceSinceClear',
        status: 'suspicious',
        rawText: '12 km',
        explanationKey: 'prePurchase.explanations.distanceVeryLow',
      },
      {
        id: 'warmupsSinceClear',
        labelKey: 'prePurchase.factors.warmupsSinceClear',
        status: 'suspicious',
        rawText: '1',
        explanationKey: 'prePurchase.explanations.warmupsVeryLow',
      },
      {
        id: 'permanentCodes',
        labelKey: 'prePurchase.factors.permanentCodes',
        status: 'suspicious',
        rawText: '1',
        explanationKey: 'prePurchase.explanations.permanentPresent',
      },
    ],
    rawCounters: {
      distanceSinceClearedKm: 12,
      warmupsSinceCleared: 1,
      timeSinceClearedMinutes: 25,
      runTimeSeconds: 400,
      distanceWithMilKm: 0,
      incompleteMonitorsCount: 4,
      supportedMonitorsCount: 7,
      permanentDtcCount: 1,
    },
  },
};

export function SampleReportPage() {
  useEffect(() => {
    const isAutosave =
      window.location.href.includes('autosave=1') || window.location.hash.includes('autosave=1');
    if (isAutosave && isTauriEnvironment()) {
      const timer = setTimeout(() => {
        void (async () => {
          try {
            await document.fonts.ready;
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke<string>('save_pdf');
          } catch (err) {
            console.warn('Autosave PDF failed:', err);
          }
        })();
      }, 1200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
      <DiagnosticReportView data={SAMPLE_EMULATOR_REPORT_DATA} hideVin={true} />
    </div>
  );
}

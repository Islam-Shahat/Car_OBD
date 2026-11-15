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
      tier: 1,
      titleEn: 'O2 Sensor Circuit Low Voltage (Bank 1, Sensor 3)',
      titleAr: 'جهد منخفض في دائرة حساس الأكسجين (صف 1، حساس 3)',
      descriptionEn: 'The downstream oxygen sensor voltage remained below minimum threshold.',
      descriptionAr: 'جهد حساس الأكسجين بعد المحفز ظل أقل من الحد الأدنى المقبول لمنظومة الاحتراق.',
      causesAr: ['تلف حساس الأكسجين السفلي', 'تسريب في ماسورة العادم قبل الحساس', 'تآكل أو انقطاع أسلاك التوصيل'],
      stepsAr: ['فحص الأسلاك والموصلات الخاصة بالحساس', 'قياس الجهد المرجعي ومقاومة التسخين', 'استبدال الحساس إذا ثبت تلفه'],
    },
    {
      code: 'P0196',
      tier: 1,
      titleEn: 'Engine Oil Temperature Sensor Range/Performance',
      titleAr: 'أداء غير منتظم في حساس درجة حرارة زيت المحرك',
      descriptionEn: 'Engine oil temperature reading does not match expected thermal model.',
      descriptionAr: 'قراءة درجة حرارة الزيت غير متوافقة مع النموذج الحراري المتوقع للمحرك أثناء التشغيل.',
      causesAr: ['خلل في حساس حرارة الزيت', 'عطل في ثرموستات مبرد الزيت', 'تلف موصل الإشارة'],
      stepsAr: ['قراءة حرارة الزيت في البيانات الحية ومقارنتها بسائل التبريد', 'فحص مقاومة الحساس', 'استبدال الحساس إذا كانت قراءته شاذة'],
    },
    {
      code: 'P0234',
      tier: 1,
      titleEn: 'Turbocharger/Supercharger Overboost Condition',
      titleAr: 'ضغط شحن توربيني زائد عن الحد المسموح',
      descriptionEn: 'Manifold boost pressure exceeded maximum calibrated limit.',
      descriptionAr: 'تجاوز ضغط الهواء المضغوط من التوربو الحد الأقصى الآمن المبرمج في وحدة التحكم.',
      causesAr: ['عطل في صمام تصريف الضغط (Wastegate)', 'خلل في حساس ضغط المنيفولد MAP', 'انسداد خراطيم التحكم في الضغط'],
      stepsAr: ['فحص حركة ذراع صمام الويست جيت ميكانيكياً', 'اختبار صمام التحكم الكهرومغناطيسي N75', 'فحص خراطيم التفريغ والضغط'],
    },
  ],
  pendingCodes: [
    {
      code: 'P0300',
      tier: 1,
      titleEn: 'Random/Multiple Cylinder Misfire Detected',
      titleAr: 'رصد اختلال احتراق عشوائي / متعدد الأسطوانات',
      descriptionEn: 'Irregular engine rotational speed indicating random misfiring.',
      descriptionAr: 'تذبذب في سرعة دوران العمود المرفقي يرجح حدوث اختلال احتراق في أسطوانة أو أكثر.',
      causesAr: ['تلف شمعات الاحتراق (بواجي)', 'ضعف كويلات الإشعال', 'خلل في ضغط الوقود'],
      stepsAr: ['فحص شمعات الاحتراق وتنظيفها أو استبدالها', 'اختبار كويلات الإشعال', 'قياس ضغط طرمبة البنزين'],
    },
  ],
  permanentCodes: [
    {
      code: 'P0420',
      tier: 1,
      titleEn: 'Catalyst System Efficiency Below Threshold (Bank 1)',
      titleAr: 'كفاءة المحول الحفاز أقل من الحد المسموح (صف 1)',
      descriptionEn: 'Permanent diagnostic code stored in non-volatile memory; survives standard clearing.',
      descriptionAr: 'كود دائم محفوظ في الذاكرة غير المتطايرة لوحدة التحكم ولا يُمحى بمسح الأعطال العادي بل يتطلب دورة قيادة كاملة.',
      causesAr: ['تراجع كفاءة دبة التلوث (الكتالايزر)', 'تسريب عادم قرب المحول'],
      stepsAr: ['إجراء دورة قيادة كاملة للتحقق من كفاءة الحفاز', 'مراقبة قراءات حساس الأكسجين الخلفي'],
    },
  ],
  readiness: {
    mil: { on: false, dtcCount: 0 },
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
      dtc: { code: 'P0143', type: 'stored' },
      readings: [
        {
          pid: '0105',
          measurements: [
            { labelKey: 'scan.pids.0105', value: 88, unit: 'celsius' },
          ],
        },
        {
          pid: '010C',
          measurements: [
            { labelKey: 'scan.pids.010C', value: 1850, unit: 'rpm' },
          ],
        },
        {
          pid: '010D',
          measurements: [
            { labelKey: 'scan.pids.010D', value: 64, unit: 'kmh' },
          ],
        },
        {
          pid: '0104',
          measurements: [
            { labelKey: 'scan.pids.0104', value: 34.5, unit: 'percent' },
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
        titleKey: 'prePurchase.factors.monitors.title',
        status: 'suspicious',
        summaryKey: 'prePurchase.factors.monitors.suspiciousSummary',
        detailKey: 'prePurchase.factors.monitors.suspiciousDetail',
      },
      {
        id: 'distanceSinceClear',
        titleKey: 'prePurchase.factors.distanceSinceClear.title',
        status: 'suspicious',
        summaryKey: 'prePurchase.factors.distanceSinceClear.suspiciousSummary',
        detailKey: 'prePurchase.factors.distanceSinceClear.suspiciousDetail',
      },
      {
        id: 'warmupsSinceClear',
        titleKey: 'prePurchase.factors.warmupsSinceClear.title',
        status: 'suspicious',
        summaryKey: 'prePurchase.factors.warmupsSinceClear.suspiciousSummary',
        detailKey: 'prePurchase.factors.warmupsSinceClear.suspiciousDetail',
      },
      {
        id: 'permanentCodes',
        titleKey: 'prePurchase.factors.permanentCodes.title',
        status: 'suspicious',
        summaryKey: 'prePurchase.factors.permanentCodes.suspiciousSummary',
        detailKey: 'prePurchase.factors.permanentCodes.suspiciousDetail',
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
} as unknown as DiagnosticReportData;

export function SampleReportPage() {
  return (
    <div className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
      <DiagnosticReportView data={SAMPLE_EMULATOR_REPORT_DATA} hideVin={false} />
    </div>
  );
}

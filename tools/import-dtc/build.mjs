import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';

import { DATA_FILES, DOWNLOADED_AT, SOURCE_NAME, SOURCE_VERSION } from './sources.mjs';
import { createArabicTitles, describeTitle, loadGlossary } from './translate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, '.cache');
const outputPath = join(here, '..', '..', 'public', 'dtc-pack.json');
const manifestPath = join(here, '..', '..', 'src', 'data', 'dtc-pack.manifest.json');
const reviewsPath = join(here, '..', '..', 'src', 'data', 'dtc-reviews.json');

const TIER1_RANGES = [
  ['P0100', 'P0199'],
  ['P0300', 'P0312'],
  ['P0420', 'P0431'],
  ['P0440', 'P0457'],
  ['P0500', 'P0559'],
  ['P0600', 'P0629'],
  ['P0641', 'P0659'],
  ['P0700', 'P0749'],
  ['U0100', 'U0199'],
];

const glossary = loadGlossary();
const { title: titleAr } = createArabicTitles(glossary);

function isTier1(code) {
  if (!/^[PCBU]\d{4}$/.test(code)) return false;
  return TIER1_RANGES.some(([from, to]) => code >= from && code <= to);
}

function severityOf(entry) {
  if (entry.flags?.limp_mode_possible) return 'high';
  if (entry.flags?.mil) return 'warning';
  return 'info';
}

function familyOf(code, title) {
  if (/misfire/i.test(title)) return 'misfire';
  if (/system too (lean|rich)|fuel trim/i.test(title)) return 'mixture';
  if (/catalyst/i.test(title)) return 'catalyst';
  if (/evap/i.test(title)) return 'evap';
  if (code.startsWith('U0') || /lost communication/i.test(title)) return 'network';
  if (
    code.startsWith('P07') ||
    /transmission|torque converter|pressure control solenoid|gear ratio|shift/i.test(title)
  ) {
    return 'transmission';
  }
  if (/^P06/.test(code) || /control module|processor|memory|checksum|programming/i.test(title)) {
    return 'module';
  }
  if (/idle/i.test(title)) return 'idle';
  return 'circuit';
}

const FAMILY_INTRO = {
  circuit:
    'قد تشير الشيفرة إلى خلل في الدائرة الكهربائية أو في الإشارة القادمة من هذا المكون إلى وحدة التحكم؛ الفحص يحدد السبب.',
  misfire:
    'قد يرتبط إخفاق الاحتراق بعدم احتراق الوقود بشكل صحيح في الأسطوانة، وقد يسبب اهتزازًا وضعفًا في الأداء وارتفاعًا في الانبعاثات.',
  mixture:
    'قد يؤثر اختلال خليط الهواء والوقود على الأداء والانبعاثات؛ من المفيد التحقق من تسرب الهواء وضغط الوقود وقراءات الحساسات.',
  catalyst:
    'قد تشير الشيفرة إلى انخفاض كفاءة المحول الحفاز، وغالبًا يسبقه إخفاق احتراق أو خليط غني. هذا لا يثبت أن المحول تالف قبل الفحص.',
  evap: 'يمنع نظام الأبخرة تسرب بخار الوقود إلى الجو؛ قد يؤدي تسرب أو خلل في الصمامات إلى إضاءة لمبة فحص المحرك.',
  idle: 'قد يظهر خلل التحكم في الخمول كسرعة غير مستقرة أو ارتفاع أو انخفاض في دورات المحرك أثناء التوقف.',
  module:
    'قد تشير الشيفرة إلى خلل داخلي أو كهربائي في وحدة التحكم أو في تغذيتها وأرضياتها؛ يُستحسن فحص البطارية والشحن أولًا.',
  transmission:
    'قد تشير الشيفرة إلى خلل في ناقل الحركة أو في إشارات التحكم فيه؛ من المفيد فحص الزيت والصمامات والأسلاك قبل أي إصلاح.',
  network:
    'قد يعني فقدان الاتصال أن وحدة تحكم لم تعد تتبادل البيانات على ناقل CAN؛ قد يكون السبب التغذية أو الأرضي أو الأسلاك أو الوحدة نفسها.',
};

const FAMILY_COPY = {
  misfire: {
    causesEn: [
      'Worn or fouled spark plug in the affected cylinder',
      'Faulty ignition coil or coil boot',
      'Clogged or leaking fuel injector',
      'Vacuum leak or low cylinder compression',
    ],
    causesAr: [
      'شمعة إشعال متآكلة أو متسخة في الأسطوانة المعنية',
      'ملف إشعال (كويل) أو جلبة تالفة',
      'بخاخ وقود مسدود أو به تسرب',
      'تسرب هواء أو انخفاض ضغط الأسطوانة',
    ],
    stepsEn: [
      'Read the misfire counters and identify the affected cylinder',
      'Swap the coil and spark plug with another cylinder and see whether the misfire moves',
      'Check the injector pulse and spray pattern',
      'Run a compression or cylinder leak-down test',
      'Smoke-test the intake for unmetered air',
    ],
    stepsAr: [
      'اقرأ عدادات إخفاق الاحتراق وحدد الأسطوانة المعنية',
      'قايض ملف الإشعال والشمعة مع أسطوانة أخرى ولاحظ هل ينتقل العطل',
      'افحص نبضة البخاخ ونمط رشه',
      'قِس ضغط الأسطوانة أو أجرِ اختبار تسرب الضغط',
      'افحص مسار السحب بالدخان بحثًا عن هواء غير محسوب',
    ],
  },
  mixture: {
    causesEn: [
      'Unmetered air entering through a hose, gasket or intake manifold',
      'Dirty or faulty mass air flow sensor',
      'Low fuel pressure or a restricted fuel filter',
      'Leaking or clogged fuel injector',
      'Aged oxygen sensor sending a biased signal',
    ],
    causesAr: [
      'دخول هواء غير محسوب عبر خرطوم أو جوان أو مشعب السحب',
      'حساس تدفق الهواء متسخ أو تالف',
      'ضغط وقود منخفض أو فلتر وقود مسدود',
      'بخاخ وقود به تسرب أو مسدود',
      'حساس أكسجين قديم يرسل إشارة منحازة',
    ],
    stepsEn: [
      'Watch short and long fuel trim at idle and at 2,500 rpm',
      'Smoke-test the intake for vacuum leaks',
      'Clean the mass air flow sensor and compare its reading with the expected airflow',
      'Measure fuel pressure and delivery volume',
      'Check injector balance and the oxygen sensor response',
    ],
    stepsAr: [
      'راقب تصحيح خليط الوقود قصير وطويل المدى في الخمول وعند 2500 دورة',
      'افحص مسار السحب بالدخان بحثًا عن تسرب هواء',
      'نظف حساس تدفق الهواء وقارن قراءته بتدفق الهواء المتوقع',
      'قِس ضغط الوقود ومعدل تدفقه',
      'افحص توازن البخاخات واستجابة حساس الأكسجين',
    ],
  },
  catalyst: {
    causesEn: [
      'Catalyst aged, contaminated or overheated',
      'Exhaust leak before or at the rear oxygen sensor',
      'Rear oxygen sensor sluggish or damaged',
      'Earlier misfire or rich running that damaged the catalyst',
    ],
    causesAr: [
      'المحول الحفاز متقدم في العمر أو ملوث أو تعرض لسخونة زائدة',
      'تسرب في العادم قبل الحساس الخلفي أو عنده',
      'حساس الأكسجين الخلفي بطيء أو تالف',
      'إخفاق احتراق أو خليط غني سابق أضر بالمحول',
    ],
    stepsEn: [
      'Check history for misfire or mixture codes',
      'Inspect the exhaust for leaks ahead of the rear oxygen sensor',
      'Watch the rear oxygen sensor switching rate',
      'Compare catalyst inlet and outlet temperature',
      'Do not replace the catalyst until the other causes are excluded',
    ],
    stepsAr: [
      'راجع سجل الأعطال بحثًا عن إخفاق احتراق أو خلل خليط سابق',
      'افحص العادم بحثًا عن تسرب قبل الحساس الخلفي',
      'راقب معدل تبديل إشارة حساس الأكسجين الخلفي',
      'قارن حرارة دخول وخروج المحول الحفاز',
      'لا تستبدل المحول الحفاز قبل استبعاد الأسباب الأخرى',
    ],
  },
  evap: {
    causesEn: [
      'Fuel cap loose, missing or sealing badly',
      'Cracked EVAP hose, pipe or canister',
      'Purge valve stuck open or closed',
      'Vent valve or its circuit faulty',
      'EVAP pressure sensor inaccurate',
    ],
    causesAr: [
      'غطاء الوقود مرتخٍ أو مفقود أو لا يحكم الإغلاق',
      'خرطوم أو أنبوب أو علبة فحم متشققة',
      'صمام التطهير عالق مفتوحًا أو مغلقًا',
      'صمام التهوية أو دائرته تالف',
      'حساس ضغط نظام الأبخرة غير دقيق',
    ],
    stepsEn: [
      'Inspect the fuel cap and make sure it seals',
      'Inspect EVAP hoses, pipes and the canister',
      'Smoke-test the EVAP system',
      'Command the purge and vent valves and listen for operation',
      'Check the EVAP pressure sensor reading against a known good value',
    ],
    stepsAr: [
      'افحص غطاء الوقود وتأكد من إحكام إغلاقه',
      'افحص خراطيم ومواسير نظام الأبخرة وعلبة الفحم',
      'افحص نظام الأبخرة بالدخان',
      'شغّل صمام التطهير وصمام التهوية وتحقق من عملهما',
      'قارن قراءة حساس ضغط النظام بقيمة مرجعية سليمة',
    ],
  },
  idle: {
    causesEn: [
      'Carbon build-up in the throttle body',
      'Unmetered air leak after the throttle',
      'Idle air control valve or its circuit faulty',
      'Throttle body adaptation lost',
    ],
    causesAr: [
      'تراكم الكربون في جسم الخانق',
      'تسرب هواء غير محسوب بعد الخانق',
      'صمام التحكم في هواء الخمول أو دائرته تالف',
      'فقدان معايرة جسم الخانق',
    ],
    stepsEn: [
      'Clean the throttle body and the idle air passage',
      'Check for vacuum leaks after the throttle',
      'Compare commanded and actual idle speed',
      'Test the idle air control valve and its wiring',
      'Relearn the idle and throttle adaptation',
    ],
    stepsAr: [
      'نظف جسم الخانق وممر هواء الخمول',
      'افحص تسرب الهواء بعد الخانق',
      'قارن سرعة الخمول المطلوبة بالفعلية',
      'اختبر صمام التحكم في هواء الخمول وأسلاكه',
      'أعد تعلم معايرة الخمول والخانق',
    ],
  },
  module: {
    causesEn: [
      'Low or unstable battery voltage',
      'Poor ground or connector at the control module',
      'Control module software or calibration fault',
      'Internal control module hardware failure',
    ],
    causesAr: [
      'جهد بطارية منخفض أو غير مستقر',
      'أرضي أو موصل ضعيف عند وحدة التحكم',
      'خطأ في برنامج أو معايرة وحدة التحكم',
      'عطل داخلي في عتاد وحدة التحكم',
    ],
    stepsEn: [
      'Test the battery and charging voltage',
      'Inspect the module connectors, grounds and fuses',
      'Check for a software update or reprogramming',
      'Check the CAN bus between the modules',
      'Do not replace the module until wiring and supply are proven good',
    ],
    stepsAr: [
      'اختبر البطارية وجهد الشحن',
      'افحص موصلات وحدة التحكم وأرضياتها وفيوزاتها',
      'تحقق من وجود تحديث للبرنامج أو إعادة برمجة',
      'افحص ناقل CAN بين الوحدات',
      'لا تستبدل الوحدة قبل التأكد من سلامة الأسلاك والتغذية',
    ],
  },
  transmission: {
    causesEn: [
      'Low, dirty or overheated transmission fluid',
      'Faulty shift or pressure control solenoid',
      'Damaged wiring or connector at the transmission',
      'Internal hydraulic or mechanical wear',
      'TCM software or calibration fault',
    ],
    causesAr: [
      'زيت ناقل حركة منخفض أو متسخ أو ساخن جدًا',
      'صمام تغيير سرعة أو صمام تحكم في الضغط تالف',
      'أسلاك أو موصل تالف عند ناقل الحركة',
      'تآكل هيدروليكي أو ميكانيكي داخلي',
      'خطأ في برنامج أو معايرة وحدة التحكم في الناقل',
    ],
    stepsEn: [
      'Check transmission fluid level, colour and smell',
      'Read the transmission control module codes',
      'Inspect solenoid wiring and connectors',
      'Measure solenoid resistance and compare with the specification',
      'Check internal line pressure and consult a transmission specialist',
    ],
    stepsAr: [
      'افحص مستوى زيت ناقل الحركة ولونه ورائحته',
      'اقرأ أعطال وحدة التحكم في ناقل الحركة',
      'افحص أسلاك وموصلات الصمامات',
      'قِس مقاومة الصمامات وقارنها بالمواصفة',
      'افحص ضغط الزيت الداخلي واستشر مختص ناقل حركة',
    ],
  },
  network: {
    causesEn: [
      'Weak battery or charging system',
      'Damaged CAN wiring, connector or ground',
      'Missing or incorrect terminating resistor',
      'Control module not powered or internally failed',
    ],
    causesAr: [
      'بطارية ضعيفة أو نظام شحن غير سليم',
      'أسلاك أو موصل أو أرضي ناقل CAN تالف',
      'مقاومة إنهاء مفقودة أو غير صحيحة',
      'وحدة التحكم بلا تغذية أو بها عطل داخلي',
    ],
    stepsEn: [
      'Test the battery and charging voltage first',
      'Inspect CAN wiring and connectors for damage',
      'Measure bus resistance (about 60 ohms across the pair)',
      'Check power and ground at the missing module',
      'Do not reprogram or replace the module until the wiring is proven good',
    ],
    stepsAr: [
      'اختبر البطارية وجهد الشحن أولًا',
      'افحص أسلاك وموصلات ناقل CAN بحثًا عن تلف',
      'قِس مقاومة الناقل (حوالي 60 أوم بين طرفي الزوج)',
      'افحص التغذية والأرضي عند الوحدة المفقودة',
      'لا تعد برمجة الوحدة أو تستبدلها قبل التأكد من سلامة الأسلاك',
    ],
  },
};

function circuitCopy(baseEn, baseAr) {
  return {
    causesEn: [
      `${baseEn} faulty or reading out of range`,
      `Wiring or connector at ${baseEn} loose, corroded or damaged`,
      `Open or short in the ${baseEn} circuit`,
      `Reference voltage or ground at ${baseEn} not correct`,
    ],
    causesAr: [
      `تلف ${baseAr} أو خروج قراءته عن النطاق`,
      `أسلاك أو موصل ${baseAr} مرتخٍ أو متآكل أو تالف`,
      `انقطاع أو قصر في دائرة ${baseAr}`,
      `جهد المرجع أو الأرضي عند ${baseAr} غير سليم`,
    ],
    stepsEn: [
      `Read the freeze frame and record ${baseEn} behaviour when the fault set`,
      `Inspect the connector and wiring at ${baseEn} for looseness, corrosion or damage`,
      `Measure the supply voltage (usually 5 V) and ground at ${baseEn}`,
      `Compare the live ${baseEn} reading with the expected value`,
      `Do not replace ${baseEn} until the wiring and supply are proven good`,
    ],
    stepsAr: [
      `اقرأ لقطة بيانات لحظة العطل وسجّل سلوك ${baseAr} عند ظهور العطل`,
      `افحص الموصل والأسلاك عند ${baseAr} بحثًا عن ارتخاء أو تآكل أو تلف`,
      `قِس جهد التغذية (5 فولت عادة) والأرضي عند ${baseAr}`,
      `قارن قراءة ${baseAr} في البيانات الحية مع القيمة المتوقعة`,
      `لا تستبدل ${baseAr} قبل التأكد من سلامة الأسلاك والتغذية`,
    ],
  };
}

function tier1Copy(code, englishTitle) {
  const { baseEn, baseAr } = describeTitle(englishTitle, glossary);
  const family = familyOf(code, englishTitle);
  const copy = family === 'circuit' ? circuitCopy(baseEn, baseAr) : FAMILY_COPY[family];
  return {
    descriptionAr: `${titleAr(englishTitle)}. ${FAMILY_INTRO[family]}`,
    causesEn: copy.causesEn,
    causesAr: copy.causesAr,
    stepsEn: copy.stepsEn,
    stepsAr: copy.stepsAr,
  };
}

function loadReviews() {
  if (!existsSync(reviewsPath)) return {};
  const parsed = JSON.parse(readFileSync(reviewsPath, 'utf8'));
  return parsed.reviews ?? {};
}

function main() {
  const reviews = loadReviews();
  const rows = [];

  for (const file of DATA_FILES) {
    const documents = parse(readFileSync(join(cacheDir, file.name), 'utf8'));
    for (const entry of documents) {
      const code = String(entry.code).trim().toUpperCase();
      if (!/^[PCBU][0-9A-F]{4}$/.test(code)) {
        throw new Error(`Unexpected DTC identifier: ${entry.code} in ${file.name}`);
      }
      const englishTitle = String(entry.title?.en ?? '')
        .trim()
        .replace(/\.$/, '');
      if (!englishTitle) throw new Error(`Missing English title for ${code}`);

      const tier = isTier1(code) ? 1 : 2;
      const copy =
        tier === 1
          ? tier1Copy(code, englishTitle)
          : {
              descriptionAr: `تشير الشيفرة إلى: ${titleAr(englishTitle)}.`,
              causesEn: [],
              causesAr: [],
              stepsEn: [],
              stepsAr: [],
            };

      const review = reviews[code];
      rows.push({
        code,
        category: entry.category ?? 'powertrain',
        descriptionEn: englishTitle,
        descriptionAr: review?.descriptionAr ?? copy.descriptionAr,
        // The OBDex record carries flags, not a safety rating. This label is
        // our estimate and is stored with its provenance so nobody mistakes it
        // for a manufacturer statement.
        severity: severityOf(entry),
        severitySource: 'heuristic',
        causesEn: copy.causesEn,
        causesAr: review?.causesAr ?? copy.causesAr,
        stepsEn: copy.stepsEn,
        stepsAr: review?.stepsAr ?? copy.stepsAr,
        tier,
        needsReview: !review,
        reviewedBy: review?.reviewedBy ?? null,
        reviewedAt: review?.reviewedAt ?? null,
      });
    }
  }

  rows.sort((left, right) => left.code.localeCompare(right.code));
  const unique = new Set(rows.map((row) => row.code));
  if (unique.size !== rows.length)
    throw new Error('The upstream data contains duplicate DTC codes');

  const tier1 = rows.filter((row) => row.tier === 1);
  const tier2 = rows.filter((row) => row.tier === 2);
  const needingReview = rows.filter((row) => row.needsReview);

  const version = createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
  const payload = {
    version,
    source: SOURCE_NAME,
    sourceVersion: SOURCE_VERSION,
    license: 'CC0-1.0',
    generatedAt: DOWNLOADED_AT,
    codes: rows,
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload)}\n`, 'utf8');
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        version,
        source: SOURCE_NAME,
        sourceVersion: SOURCE_VERSION,
        license: 'CC0-1.0',
        generatedAt: DOWNLOADED_AT,
        codeCount: rows.length,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  // Coverage check: count Latin words left in the Arabic description, so a
  // missing glossary entry surfaces here instead of in the UI.
  const leftovers = new Map();
  for (const row of rows) {
    for (const word of row.descriptionAr.match(/[A-Za-z][A-Za-z0-9/]{2,}/g) ?? []) {
      leftovers.set(word, (leftovers.get(word) ?? 0) + 1);
    }
  }
  const topLeftovers = [...leftovers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);

  console.log(`Wrote ${outputPath}`);
  console.log(`Wrote ${manifestPath} (version ${version})`);
  console.log(`Imported: ${rows.length} generic codes`);
  console.log(`Tier 1: ${tier1.length}  Tier 2: ${tier2.length}`);
  console.log(`Needs review: ${needingReview.length}`);
  console.log(`Tier 1 needing review: ${tier1.filter((row) => row.needsReview).length}`);
  console.log(`Leftover Latin words: ${leftovers.size} distinct`);
  console.log(topLeftovers.map(([word, count]) => `  ${count}  ${word}`).join('\n'));
  for (const code of [
    'P0100',
    'P0171',
    'P0301',
    'P0420',
    'P0442',
    'P0500',
    'P0600',
    'P0700',
    'U0100',
  ]) {
    const row = rows.find((entry) => entry.code === code);
    console.log(`${code} [T${row.tier}] ${row.descriptionAr}`);
  }
  // Sanity: every row has non-empty English and Arabic text.
  const empty = rows.filter((row) => !row.descriptionEn || !row.descriptionAr);
  if (empty.length > 0) throw new Error(`${empty.length} rows are missing a description`);
}

main();

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const GLOSSARY_PATH = join(here, '..', '..', 'src', 'data', 'glossary-ar.json');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * One pass, longest entry first: a replacement is never re-scanned, so Arabic
 * text that contains Latin acronyms (ECM/PCM, CAN, O2) stays intact.
 */
export function createTranslator(glossary) {
  const entries = [...glossary.entries].sort((left, right) => right.en.length - left.en.length);
  const byLower = new Map(entries.map((entry) => [entry.en.toLowerCase(), entry.ar]));
  const pattern = entries
    .map((entry) => {
      const startsAlnum = /^[A-Za-z0-9]/.test(entry.en);
      const endsAlnum = /[A-Za-z0-9]$/.test(entry.en);
      const plural = /^[A-Za-z]+$/.test(entry.en) ? '(?:s|es)?' : '';
      const left = startsAlnum ? '(?<![A-Za-z])' : '';
      const right = endsAlnum ? '(?![A-Za-z])' : '';
      return `${left}${escapeRegExp(entry.en)}${plural}${right}`;
    })
    .join('|');
  const matcher = new RegExp(`(?:${pattern})`, 'gi');

  function replacement(match) {
    const lower = match.toLowerCase();
    if (byLower.has(lower)) return byLower.get(lower);
    const singular = lower.endsWith('es') ? lower.slice(0, -2) : lower.replace(/s$/, '');
    return byLower.get(singular) ?? match;
  }

  function translate(text) {
    return text.replace(matcher, replacement);
  }

  return { translate, entries };
}

export function loadGlossary() {
  return JSON.parse(readFileSync(GLOSSARY_PATH, 'utf8'));
}

const QUALIFIERS = [
  { re: /\(?\s*Bank\s+(\d+)\s+Sensor\s+(\d+)\s*\)?$/i, ar: (m) => `البنك ${m[1]}، الحساس ${m[2]}` },
  { re: /\(?\s*Bank\s+(\d+)\s*\)?$/i, ar: (m) => `البنك ${m[1]}` },
  { re: /\(?\s*Sensor\s+(\d+)\s*\)?$/i, ar: (m) => `الحساس ${m[1]}` },
  { re: /\(?\s*Cylinder\s+(\d+)\s*\)?$/i, ar: (m) => `الأسطوانة ${m[1]}` },
  { re: /\(?\s*Cylinder\s+(\d+)\s+(\w+)\s*\)?$/i, ar: (m) => `الأسطوانة ${m[1]}` },
];

const CIRCUIT_CONDITIONS = [
  ['Circuit Range/Performance', 'النطاق/الأداء'],
  ['Circuit Low Voltage', 'جهد منخفض'],
  ['Circuit High Voltage', 'جهد مرتفع'],
  ['Circuit Slow Response', 'استجابة بطيئة'],
  ['Circuit No Activity Detected', 'لا يوجد نشاط'],
  ['Circuit Intermittent/Erratic/High', 'إشارة متقطعة/غير منتظمة/مرتفعة'],
  ['Circuit Intermittent/Erratic', 'إشارة متقطعة/غير منتظمة'],
  ['Circuit Intermittent', 'إشارة متقطعة'],
  ['Circuit Performance/Stuck Off', 'أداء غير صحيح/عالق مفتوح'],
  ['Circuit Stuck On', 'عالق مغلق'],
  ['Circuit No Signal', 'لا توجد إشارة'],
  ['Circuit Electrical', 'عطل كهربائي'],
  ['Circuit Shorted', 'قصر'],
  ['Circuit Open', 'انقطاع'],
  ['Circuit/Open', 'انقطاع'],
  ['Circuit Low', 'إشارة منخفضة'],
  ['Circuit High', 'إشارة مرتفعة'],
  ['Circuit', ''],
];

const KNOWN_EVAP_LEAKS = new Map([
  ['small leak', 'تسرب صغير'],
  ['very small leak', 'تسرب صغير جدًا'],
  ['large leak', 'تسرب كبير'],
  ['fuel cap loose/off', 'غطاء الوقود مرتخٍ أو مفقود'],
]);

function clean(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([،:.])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+-\s+/g, ' — ')
    .trim();
}

export function createArabicTitles(glossary) {
  const { translate } = createTranslator(glossary);

  function nouns(text) {
    return clean(translate(text));
  }

  function bank(match) {
    return match ? ` في البنك ${match}` : '';
  }

  /** Adds a trailing qualifier (bank/sensor/cylinder) in Arabic. */
  function withQualifier(text, qualifierAr) {
    return qualifierAr ? `${text} — ${qualifierAr}` : text;
  }

  function splitQualifier(raw) {
    for (const qualifier of QUALIFIERS) {
      const match = qualifier.re.exec(raw);
      if (match)
        return { title: raw.slice(0, match.index).trim(), qualifierAr: qualifier.ar(match) };
    }
    return { title: raw, qualifierAr: '' };
  }

  function circuitTitle(raw) {
    const match = /^(.*)\s+Circuit(?:\s+(.+))?$/i.exec(raw);
    if (!match) return null;
    const base = nouns(match[1] ?? '');
    const conditionText = (match[2] ?? '').trim();
    if (!conditionText) return `دائرة ${base}`;
    const condition = CIRCUIT_CONDITIONS.find(
      ([english]) => english === `Circuit ${conditionText}`,
    );
    if (!condition) return `دائرة ${base}: ${nouns(conditionText)}`;
    return condition[1] ? `دائرة ${base}: ${condition[1]}` : `دائرة ${base}`;
  }

  /**
   * Full Arabic rendering of an English DTC title. Whole-title patterns cover
   * the SAE sentence forms; everything else goes through the glossary.
   */
  function title(rawTitle) {
    const raw = rawTitle.trim();
    const { title: withoutQualifier, qualifierAr } = splitQualifier(raw);
    const text = withoutQualifier;

    const lost = /^Lost Communication With (.+)$/i.exec(text);
    if (lost) return withQualifier(`فقدان الاتصال مع ${nouns(lost[1])}`, qualifierAr);

    const misfire = /^Cylinder (\d+) Misfire Detected$/i.exec(text);
    if (misfire) return `تم رصد إخفاق احتراق في الأسطوانة ${misfire[1]}`;
    if (/^Random\/Multiple Cylinder Misfire Detected$/i.test(text)) {
      return 'تم رصد إخفاق احتراق عشوائي/متعدد الأسطوانات';
    }

    const lean = /^System Too Lean(?: Bank (\d+))?$/i.exec(text);
    if (lean) return `خليط فقير جدًا${bank(lean[1])}`;
    const rich = /^System Too Rich(?: Bank (\d+))?$/i.exec(text);
    if (rich) return `خليط غني جدًا${bank(rich[1])}`;
    const trim = /^Fuel Trim(?: Bank (\d+))?$/i.exec(text);
    if (trim) return `تصحيح خليط الوقود${bank(trim[1])}`;

    if (/^Insufficient Coolant Temperature for Closed Loop Fuel Control$/i.test(text)) {
      return 'حرارة سائل التبريد غير كافية للتحكم في خليط الوقود في الحلقة المغلقة';
    }
    if (/^Insufficient Coolant Temperature for Stable Operation$/i.test(text)) {
      return 'حرارة سائل التبريد غير كافية للتشغيل المستقر';
    }
    if (/^Intake Air Temperature Too High$/i.test(text)) return 'حرارة هواء السحب مرتفعة جدًا';
    if (/^Barometric Pressure Too Low$/i.test(text)) return 'الضغط الجوي منخفض جدًا';
    if (/^Fuel Temperature Too High$/i.test(text)) return 'حرارة الوقود مرتفعة جدًا';
    if (/^Incorrect Fuel Composition$/i.test(text)) return 'تركيب الوقود غير صحيح';
    if (/^Incorrect Immobilizer Key$/i.test(text)) return 'مفتاح مانع التشغيل غير صحيح';
    if (/^Engine Oil Pressure Too Low$/i.test(text)) return 'ضغط زيت المحرك منخفض جدًا';
    if (/^A\/C Refrigerant Charge Loss$/i.test(text)) return 'فقدان شحنة وسيط تبريد التكييف';
    if (/^Control Module Vehicle Options Error$/i.test(text)) {
      return 'خطأ في خيارات السيارة المسجلة في وحدة التحكم';
    }
    if (/^ECM\/TCM Incompatible$/i.test(text)) {
      return 'وحدة التحكم في المحرك غير متوافقة مع وحدة التحكم في ناقل الحركة';
    }
    if (/^Fuel Delivery Error$/i.test(text)) return 'خطأ في إمداد الوقود';
    if (/^Fuel Timing Error$/i.test(text)) return 'خطأ في توقيت الوقود';
    if (/^Incorrect Gear Ratio$/i.test(text)) return 'نسبة التروس غير صحيحة';
    const gear = /^Gear (\d+) Incorrect Ratio$/i.exec(text);
    if (gear) return `نسبة الترس ${gear[1]} غير صحيحة`;
    if (/^Reverse Incorrect Ratio$/i.test(text)) return 'نسبة ترس الرجوع للخلف غير صحيحة';

    const catalyst = /^Catalyst(?: (\d+))? (?:System )?Efficiency Below Threshold$/i.exec(text);
    if (catalyst) {
      return withQualifier(
        `كفاءة ${catalyst[1] ? `المحول الحفاز ${catalyst[1]}` : 'نظام المحول الحفاز'} أقل من الحد المسموح`,
        qualifierAr,
      );
    }
    if (/^Heated Catalyst Efficiency Below Threshold$/i.test(text)) {
      return withQualifier('كفاءة المحول الحفاز المُسخَّن أقل من الحد المسموح', qualifierAr);
    }
    if (/^Heated Catalyst Temperature Below Threshold$/i.test(text)) {
      return withQualifier('حرارة المحول الحفاز المُسخَّن أقل من الحد المسموح', qualifierAr);
    }

    const evapLeak = /^EVAP System Leak Detected(?:\s*[-(]\s*(.+?)\s*\)?)?$/i.exec(text);
    if (evapLeak) {
      const detail = evapLeak[1]?.toLowerCase() ?? '';
      const known = KNOWN_EVAP_LEAKS.get(detail);
      if (known) {
        return `تم رصد تسرب في نظام التحكم في أبخرة الوقود (${known})`;
      }
      return 'تم رصد تسرب في نظام التحكم في أبخرة الوقود';
    }

    const coolantThermostat = /^Coolant Thermostat \((.+)\)$/i.exec(text);
    if (coolantThermostat) {
      const detail = nouns(coolantThermostat[1]);
      return `ثرموستات سائل التبريد (${detail})`;
    }

    const transmissionMil = /^Transmission Control System \(MIL Request\)$/i.exec(text);
    if (transmissionMil) {
      return 'نظام التحكم في ناقل الحركة (طلب إضاءة لمبة فحص المحرك)';
    }

    const controlOutput = /^Control Module (.+) Output (.+)$/i.exec(text);
    if (controlOutput) {
      return `خرج ${nouns(controlOutput[1])} ${controlOutput[2]} من وحدة التحكم`;
    }

    const stageDeployment = /^(.*)\s+Stage\s+(\d+)\s+Deployment Control$/i.exec(text);
    if (stageDeployment) {
      return `التحكم في انتفاخ ${nouns(stageDeployment[1])} — المرحلة ${stageDeployment[2]}`;
    }

    // Common two-word sentence forms read better with the noun first in Arabic.
    const reorderings = [
      [/^(.*)\s+Range\/Performance$/i, (rest) => `نطاق/أداء ${nouns(rest)}`],
      [/^(.*)\s+Performance$/i, (rest) => `أداء ${nouns(rest)}`],
      [/^(.*)\s+Supply$/i, (rest) => `تغذية ${nouns(rest)}`],
      [/^(.*)\s+Signal$/i, (rest) => `إشارة ${nouns(rest)}`],
      [/^(.*)\s+Control$/i, (rest) => `التحكم في ${nouns(rest)}`],
      [/^(.*)\s+Malfunction$/i, (rest) => `عطل في ${nouns(rest)}`],
      [/^(.*)\s+Failure$/i, (rest) => `فشل ${nouns(rest)}`],
      [/^(.*)\s+Low$/i, (rest) => `${nouns(rest)} منخفض`],
      [/^(.*)\s+High$/i, (rest) => `${nouns(rest)} مرتفع`],
    ];
    for (const [pattern, build] of reorderings) {
      const match = pattern.exec(text);
      if (match) return withQualifier(build(match[1] ?? ''), qualifierAr);
    }

    const circuit = circuitTitle(text);
    if (circuit) return withQualifier(circuit, qualifierAr);

    return withQualifier(nouns(text), qualifierAr);
  }

  return { title };
}

/**
 * Splits a title into the component phrase and Arabic condition, used to build
 * family-specific causes and inspection steps for Tier 1.
 */
export function describeTitle(title, glossary) {
  const { translate } = createTranslator(glossary);
  const { title: withoutQualifier } = splitQualifierFor(title);
  const match = /^(.*)\s+Circuit(?:\s+(.+))?$/i.exec(withoutQualifier);
  const baseEn = (match?.[1] ?? withoutQualifier).trim();
  return {
    baseEn,
    baseAr: clean(translate(baseEn)),
    conditionEn: (match?.[2] ?? '').trim(),
    conditionAr: match
      ? (CIRCUIT_CONDITIONS.find(([e]) => e === `Circuit ${match[2]}`)?.[1] ?? '')
      : '',
  };
}

function splitQualifierFor(raw) {
  for (const qualifier of QUALIFIERS) {
    const match = qualifier.re.exec(raw);
    if (match) return { title: raw.slice(0, match.index).trim(), qualifierAr: qualifier.ar(match) };
  }
  return { title: raw, qualifierAr: '' };
}

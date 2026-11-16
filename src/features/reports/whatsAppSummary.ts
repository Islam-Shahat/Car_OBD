import type { DiagnosticReportData } from './reportTypes';

export function maskVin(vin: string | null | undefined): string {
  if (!vin) return 'N/A';
  const clean = vin.trim();
  if (clean.length === 0) return 'N/A';

  // Standard VIN (ISO 3779 / 17 characters):
  // - Characters 1–3: World Manufacturer Identifier (WMI)
  // - Characters 4–8: Vehicle Descriptor Section (VDS) - model, body type, engine code
  // - Character 9: Security check digit
  // - Characters 10–17: Vehicle Identifier Section (VIS) - model year, plant code, serial production number
  //
  // Privacy rule: keep the manufacturer and model descriptor (first 9 characters)
  // and mask the serial/production portion (last 8 characters) with asterisks.
  if (clean.length === 17) {
    return `${clean.slice(0, 9)}********`;
  }

  // Non-standard or older VINs (e.g. 11-16 characters):
  // Mask the last 6 to 8 characters while preserving at least the leading identifier.
  const maskCount = Math.min(8, Math.max(6, Math.floor(clean.length / 2)));
  const visibleCount = Math.max(1, clean.length - maskCount);
  return `${clean.slice(0, visibleCount)}${'*'.repeat(clean.length - visibleCount)}`;
}

export function generateWhatsAppSummary(
  data: DiagnosticReportData,
  options: { maskVin?: boolean; language?: string } = {},
): string {
  const isAr = options.language !== 'en';
  const shouldMask = options.maskVin ?? true;

  const vehicleName = data.vehicle
    ? `${data.vehicle.make ?? ''} ${data.vehicle.model ?? ''} ${data.vehicle.year ? `(${data.vehicle.year})` : ''}`.trim() ||
      (isAr ? 'مركبة غير محددة' : 'Unknown vehicle')
    : isAr
      ? 'مركبة غير محددة'
      : 'Unknown vehicle';

  const vinDisplay = shouldMask ? maskVin(data.vehicle?.vin) : (data.vehicle?.vin ?? 'N/A');

  const totalCodes =
    data.storedCodes.length + data.pendingCodes.length + data.permanentCodes.length;

  const lines: string[] = [];

  if (isAr) {
    lines.push(`📋 *تقرير فحص تشخيصي - OBD Diagnose*`);
    if (data.mode === 'pre_purchase') {
      lines.push(`🔍 *وضع الفحص: فحص ما قبل الشراء*`);
    }
    lines.push(`───────────────`);
    lines.push(`🚗 *المركبة:* ${vehicleName}`);
    lines.push(`🔢 *رقم الهيكل:* ${vinDisplay}`);
    lines.push(`📅 *التاريخ:* ${data.scanDate}`);

    if (data.prePurchase) {
      const levelTexts: Record<string, string> = {
        no_indicators: '✅ لا توجد مؤشرات على مسح حديث للأعطال',
        some_indicators: '⚠️ بعض المؤشرات متوافقة مع إعادة تعيين حديثة',
        several_indicators: '🚨 عدة مؤشرات ترجح احتمالية مسح الأعطال مؤخراً',
      };
      lines.push(`───────────────`);
      lines.push(`🔎 *تقييم ما قبل الشراء:*`);
      lines.push(levelTexts[data.prePurchase.level] ?? data.prePurchase.level);
      const { distanceSinceClearedKm, warmupsSinceCleared, incompleteMonitorsCount } =
        data.prePurchase.rawCounters;
      lines.push(
        `• مؤشرات غير مكتملة: ${incompleteMonitorsCount} | مسافة منذ المسح: ${
          distanceSinceClearedKm !== null ? `${distanceSinceClearedKm} كم` : 'غير متوفر'
        } | دورات إحماء: ${warmupsSinceCleared ?? 'غير متوفر'}`,
      );
    }

    lines.push(`───────────────`);
    if (totalCodes === 0) {
      lines.push(`✅ *الحالة:* لم يتم العثور على أكواد أعطال (منظومة المحرك والانبعاثات فقط).`);
    } else {
      lines.push(`⚠️ *أكواد الأعطال المسجلة (${totalCodes}):*`);
      if (data.storedCodes.length > 0) {
        lines.push(`*أعطال مؤكدة (Stored):*`);
        for (const item of data.storedCodes) {
          const desc = item.lookup?.record?.descriptionAr || item.lookup?.record?.descriptionEn || '';
          lines.push(`  • ${item.code}${desc ? `: ${desc}` : ''}`);
        }
      }
      if (data.pendingCodes.length > 0) {
        lines.push(`*أعطال قيد الانتظار (Pending):*`);
        for (const item of data.pendingCodes) {
          const desc = item.lookup?.record?.descriptionAr || item.lookup?.record?.descriptionEn || '';
          lines.push(`  • ${item.code}${desc ? `: ${desc}` : ''}`);
        }
      }
      if (data.permanentCodes.length > 0) {
        lines.push(`*أعطال دائمة (Permanent):*`);
        for (const item of data.permanentCodes) {
          const desc = item.lookup?.record?.descriptionAr || item.lookup?.record?.descriptionEn || '';
          lines.push(`  • ${item.code}${desc ? `: ${desc}` : ''}`);
        }
      }
    }

    lines.push(`───────────────`);
    lines.push(
      `⚠️ *تنبيه:* الفحص استرشادي ويقتصر على منظومة المحرك والانبعاثات (OBD-II). مسح الأعطال لا يحل العطل الفعلي بل يعيد ضبط العدادات.`,
    );
  } else {
    lines.push(`📋 *Diagnostic Report - OBD Diagnose*`);
    if (data.mode === 'pre_purchase') {
      lines.push(`🔍 *Inspection Mode: Pre-Purchase Inspection*`);
    }
    lines.push(`───────────────`);
    lines.push(`🚗 *Vehicle:* ${vehicleName}`);
    lines.push(`🔢 *VIN:* ${vinDisplay}`);
    lines.push(`📅 *Date:* ${data.scanDate}`);

    if (data.prePurchase) {
      const levelTexts: Record<string, string> = {
        no_indicators: '✅ No indicators of recent code clearing',
        some_indicators: '⚠️ Some indicators consistent with recent reset',
        several_indicators: '🚨 Several indicators suggest codes may have been cleared recently',
      };
      lines.push(`───────────────`);
      lines.push(`🔎 *Pre-Purchase Assessment:*`);
      lines.push(levelTexts[data.prePurchase.level] ?? data.prePurchase.level);
      const { distanceSinceClearedKm, warmupsSinceCleared, incompleteMonitorsCount } =
        data.prePurchase.rawCounters;
      lines.push(
        `• Incomplete monitors: ${incompleteMonitorsCount} | Distance since clear: ${
          distanceSinceClearedKm !== null ? `${distanceSinceClearedKm} km` : 'N/A'
        } | Warm-ups: ${warmupsSinceCleared ?? 'N/A'}`,
      );
    }

    lines.push(`───────────────`);
    if (totalCodes === 0) {
      lines.push(`✅ *Status:* No fault codes found (engine & emissions only).`);
    } else {
      lines.push(`⚠️ *Diagnostic Trouble Codes (${totalCodes}):*`);
      if (data.storedCodes.length > 0) {
        lines.push(`*Stored DTCs:*`);
        for (const item of data.storedCodes) {
          const desc = item.lookup?.record?.descriptionEn || '';
          lines.push(`  • ${item.code}${desc ? `: ${desc}` : ''}`);
        }
      }
      if (data.pendingCodes.length > 0) {
        lines.push(`*Pending DTCs:*`);
        for (const item of data.pendingCodes) {
          const desc = item.lookup?.record?.descriptionEn || '';
          lines.push(`  • ${item.code}${desc ? `: ${desc}` : ''}`);
        }
      }
      if (data.permanentCodes.length > 0) {
        lines.push(`*Permanent DTCs:*`);
        for (const item of data.permanentCodes) {
          const desc = item.lookup?.record?.descriptionEn || '';
          lines.push(`  • ${item.code}${desc ? `: ${desc}` : ''}`);
        }
      }
    }

    lines.push(`───────────────`);
    lines.push(
      `⚠️ *Notice:* Diagnostic information only, limited to generic powertrain OBD-II. Clearing codes resets monitors and does not fix faults.`,
    );
  }

  return lines.join('\n');
}

import { useTranslation } from 'react-i18next';
import { IconAlert, IconCheck } from '../../app/icons';
import type { PidReading } from '../../lib/obd/pids';

interface FuelTrimViewProps {
  readings: Record<number, PidReading>;
}

export function FuelTrimView({ readings }: FuelTrimViewProps) {
  const { t } = useTranslation();

  const stft1 = readings[0x06]?.measurements[0]?.value;
  const ltft1 = readings[0x07]?.measurements[0]?.value;
  const stft2 = readings[0x08]?.measurements[0]?.value;
  const ltft2 = readings[0x09]?.measurements[0]?.value;

  const hasBank1 = stft1 !== undefined || ltft1 !== undefined;
  const hasBank2 = stft2 !== undefined || ltft2 !== undefined;

  const totalTrim1 = (stft1 ?? 0) + (ltft1 ?? 0);
  const totalTrim2 = (stft2 ?? 0) + (ltft2 ?? 0);

  const getHint = (totalTrim: number) => {
    if (totalTrim > 10) {
      return {
        level: 'warning',
        title: t('live.fuelTrimHighPositiveTitle'),
        text: t('live.fuelTrimHighPositiveHint'),
      };
    }
    if (totalTrim < -10) {
      return {
        level: 'warning',
        title: t('live.fuelTrimHighNegativeTitle'),
        text: t('live.fuelTrimHighNegativeHint'),
      };
    }
    return {
      level: 'normal',
      title: t('live.fuelTrimNormalTitle'),
      text: t('live.fuelTrimNormalHint'),
    };
  };

  const hint1 = hasBank1 ? getHint(totalTrim1) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold">{t('live.fuelTrimTitle')}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('live.fuelTrimSubtitle')}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {t('live.informationalOnly')}
          </span>
        </div>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {/* Bank 1 */}
          <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {t('live.bank1')}
              </span>
              <span className="font-mono text-xs font-semibold tabular-nums">
                {t('live.totalTrim')}:{' '}
                {totalTrim1 > 0 ? `+${totalTrim1.toFixed(1)}` : totalTrim1.toFixed(1)}%
              </span>
            </div>

            <TrimBar label={t('scan.pids.shortFuelTrim', { bank: 1 })} value={stft1} />
            <TrimBar label={t('scan.pids.longFuelTrim', { bank: 1 })} value={ltft1} />
          </div>

          {/* Bank 2 */}
          <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {t('live.bank2')}
              </span>
              <span className="font-mono text-xs font-semibold tabular-nums">
                {hasBank2
                  ? `${t('live.totalTrim')}: ${totalTrim2 > 0 ? `+${totalTrim2.toFixed(1)}` : totalTrim2.toFixed(1)}%`
                  : t('live.notReported')}
              </span>
            </div>

            {hasBank2 ? (
              <>
                <TrimBar label={t('scan.pids.shortFuelTrim', { bank: 2 })} value={stft2} />
                <TrimBar label={t('scan.pids.longFuelTrim', { bank: 2 })} value={ltft2} />
              </>
            ) : (
              <p className="py-4 text-center text-xs text-slate-400">
                {t('live.singleBankVehicle')}
              </p>
            )}
          </div>
        </div>

        {/* Informational Hint Card */}
        {hint1 && (
          <div
            className={`mt-4 rounded-lg border p-3.5 text-xs leading-5 ${
              hint1.level === 'warning'
                ? 'border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                : 'border-emerald-200 bg-emerald-50/60 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {hint1.level === 'warning' ? (
                <IconAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              ) : (
                <IconCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              <div>
                <p className="font-semibold">{hint1.title}</p>
                <p className="mt-0.5 opacity-90">{hint1.text}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrimBar({ label, value }: { label: string; value?: number }) {
  if (value === undefined) {
    return (
      <div className="text-xs text-slate-400">
        <span className="font-medium">{label}:</span> —
      </div>
    );
  }

  const clamped = Math.max(-25, Math.min(25, value));
  // 0% is in the middle (50%)
  const isPositive = clamped >= 0;
  const widthPercent = (Math.abs(clamped) / 25) * 50;

  const barColor =
    Math.abs(value) > 10 ? 'bg-amber-500 dark:bg-amber-400' : 'bg-blue-600 dark:bg-blue-400';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-100">
          {value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)}%
        </span>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        {/* Center Zero Marker */}
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-slate-400 dark:bg-slate-500 z-10" />

        {/* Dynamic bar extending from center */}
        {isPositive ? (
          <div
            className={`absolute top-0 bottom-0 left-1/2 rounded-r-full ${barColor} transition-all duration-150`}
            style={{ width: `${widthPercent}%` }}
          />
        ) : (
          <div
            className={`absolute top-0 bottom-0 rounded-l-full ${barColor} transition-all duration-150`}
            style={{ left: `${50 - widthPercent}%`, width: `${widthPercent}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[9px] font-mono text-slate-400">
        <span>-25%</span>
        <span>0%</span>
        <span>+25%</span>
      </div>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { IconAlert, IconCheck } from '../../app/icons';
import type { PidReading } from '../../lib/obd/pids';
import type { TimePoint } from './liveStore';

interface O2SensorViewProps {
  readings: Record<number, PidReading>;
  history?: Record<number, TimePoint[]>;
}

interface SensorData {
  pid: number;
  bank: number;
  sensor: number;
  voltage?: number;
  trim?: number;
  history?: TimePoint[];
}

export function O2SensorView({ readings, history = {} }: O2SensorViewProps) {
  const { t } = useTranslation();

  // Extract sensor data for Bank 1 (0x14, 0x15) and Bank 2 (0x18, 0x19)
  const extractSensor = (pid: number, bank: number, sensor: number): SensorData => {
    const reading = readings[pid];
    const voltM = reading?.measurements.find((m) => m.unit === 'volts');
    const trimM = reading?.measurements.find((m) => m.unit === 'percent');
    return {
      pid,
      bank,
      sensor,
      voltage: voltM?.value,
      trim: trimM?.value,
      history: history[pid],
    };
  };

  const b1s1 = extractSensor(0x14, 1, 1);
  const b1s2 = extractSensor(0x15, 1, 2);
  const b2s1 = extractSensor(0x18, 2, 1);
  const b2s2 = extractSensor(0x19, 2, 2);

  const hasBank1 = b1s1.voltage !== undefined || b1s2.voltage !== undefined;
  const hasBank2 = b2s1.voltage !== undefined || b2s2.voltage !== undefined;

  // Evaluate sensor dynamics from history or current readings
  const evaluateUpstream = (sensor: SensorData) => {
    if (sensor.voltage === undefined) return null;
    const pts = sensor.history?.slice(-20) ?? [];
    if (pts.length >= 5) {
      const vals = pts.map((p) => p.value);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const delta = max - min;
      if (delta < 0.15) {
        return {
          status: 'sluggish',
          title: t('live.o2HintUpstreamSluggishTitle'),
          text: t('live.o2HintUpstreamSluggish'),
          level: 'warning' as const,
        };
      }
      return {
        status: 'switching',
        title: t('live.o2StatusSwitching'),
        text: t('live.o2HintNormal'),
        level: 'normal' as const,
      };
    }
    // Static fallback based on voltage bounds
    return {
      status: 'active',
      title: t('live.o2StatusSwitching'),
      text: t('live.o2HintNormal'),
      level: 'normal' as const,
    };
  };

  const evaluateDownstream = (sensor: SensorData) => {
    if (sensor.voltage === undefined) return null;
    const pts = sensor.history?.slice(-20) ?? [];
    if (pts.length >= 6) {
      const vals = pts.map((p) => p.value);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const delta = max - min;
      // If downstream swings widely (>0.4V), catalytic converter is not buffering
      if (delta > 0.4 && min < 0.3 && max > 0.7) {
        return {
          status: 'oscillating',
          title: t('live.o2HintDownstreamOscillatingTitle'),
          text: t('live.o2HintDownstreamOscillating'),
          level: 'warning' as const,
        };
      }
      return {
        status: 'steady',
        title: t('live.o2StatusCatNormal'),
        text: t('live.o2HintNormal'),
        level: 'normal' as const,
      };
    }
    return {
      status: 'steady',
      title: t('live.o2StatusCatNormal'),
      text: t('live.o2HintNormal'),
      level: 'normal' as const,
    };
  };

  const hintB1S1 = evaluateUpstream(b1s1);
  const hintB1S2 = evaluateDownstream(b1s2);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold">{t('live.o2Title')}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('live.o2Subtitle')}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {t('live.informationalOnly')}
          </span>
        </div>

        {/* Bank 1 Sensors */}
        <div className="mt-4 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {t('live.bank1')}
          </div>
          {hasBank1 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <SensorCard
                title={t('live.o2Sensor1')}
                voltage={b1s1.voltage}
                trim={b1s1.trim}
                evaluation={hintB1S1}
                isUpstream={true}
              />
              <SensorCard
                title={t('live.o2Sensor2')}
                voltage={b1s2.voltage}
                trim={b1s2.trim}
                evaluation={hintB1S2}
                isUpstream={false}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-slate-800">
              {t('live.notReported')}
            </div>
          )}
        </div>

        {/* Bank 2 Sensors if present */}
        {hasBank2 && (
          <div className="mt-6 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              {t('live.bank2')}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SensorCard
                title={t('live.o2Sensor1')}
                voltage={b2s1.voltage}
                trim={b2s1.trim}
                evaluation={evaluateUpstream(b2s1)}
                isUpstream={true}
              />
              <SensorCard
                title={t('live.o2Sensor2')}
                voltage={b2s2.voltage}
                trim={b2s2.trim}
                evaluation={evaluateDownstream(b2s2)}
                isUpstream={false}
              />
            </div>
          </div>
        )}

        {/* Informational Guidance Callout */}
        {(hintB1S1 || hintB1S2) && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
              {hintB1S1?.level === 'warning' || hintB1S2?.level === 'warning' ? (
                <IconAlert className="h-4 w-4 text-amber-500" />
              ) : (
                <IconCheck className="h-4 w-4 text-emerald-500" />
              )}
              <span>
                {hintB1S1?.level === 'warning'
                  ? hintB1S1.title
                  : hintB1S2?.level === 'warning'
                    ? hintB1S2.title
                    : t('live.o2HintNormalTitle')}
              </span>
            </div>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              {hintB1S1?.level === 'warning'
                ? hintB1S1.text
                : hintB1S2?.level === 'warning'
                  ? hintB1S2.text
                  : t('live.o2HintNormal')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface SensorCardProps {
  title: string;
  voltage?: number;
  trim?: number;
  evaluation: {
    status: string;
    title: string;
    text: string;
    level: 'normal' | 'warning';
  } | null;
  isUpstream: boolean;
}

function SensorCard({ title, voltage, trim, evaluation, isUpstream }: SensorCardProps) {
  const { t } = useTranslation();

  if (voltage === undefined) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <span className="text-xs font-medium text-slate-500">{title}</span>
        <p className="mt-2 text-xs text-slate-400">{t('live.notReported')}</p>
      </div>
    );
  }

  // Voltage ratio across 0V to 1.0V (clamped)
  const clampedV = Math.max(0, Math.min(1.0, voltage));
  const percentV = (clampedV / 1.0) * 100;

  return (
    <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{title}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
            evaluation?.level === 'warning'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          }`}
        >
          {evaluation?.title ?? (isUpstream ? t('live.o2Sensor1') : t('live.o2Sensor2'))}
        </span>
      </div>

      {/* Voltage Meter */}
      <div className="space-y-1">
        <div className="flex justify-between font-mono text-xs">
          <span className="text-slate-500">{t('live.o2Voltage')}</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {voltage.toFixed(2)} V
          </span>
        </div>

        {/* Visual 0-1V bar with 0.45V stoichiometric marker */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          {/* Stoichiometric Center line at 45% */}
          <div
            className="absolute top-0 bottom-0 z-10 w-0.5 bg-slate-400 dark:bg-slate-300"
            style={{ left: '45%' }}
            title={t('live.o2Stoich')}
          />
          <div
            className={`h-full transition-all duration-300 ${
              voltage > 0.45 ? 'bg-blue-600 dark:bg-blue-400' : 'bg-amber-500 dark:bg-amber-400'
            }`}
            style={{ width: `${percentV}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-slate-400">
          <span>{t('live.o2Lean')}</span>
          <span>{t('live.o2Stoich')}</span>
          <span>{t('live.o2Rich')}</span>
        </div>
      </div>

      {/* Associated Trim if available */}
      {trim !== undefined && trim !== -100 && (
        <div className="flex justify-between border-t border-slate-200/60 pt-2 font-mono text-xs dark:border-slate-800">
          <span className="text-slate-500">{t('live.o2Trim')}</span>
          <span
            className={`font-semibold ${
              trim > 0
                ? 'text-amber-600 dark:text-amber-400'
                : trim < 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {trim > 0 ? `+${trim.toFixed(1)}` : trim.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

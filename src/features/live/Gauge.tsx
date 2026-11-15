interface GaugeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  decimals?: number;
  dangerThreshold?: number;
  warningThreshold?: number;
}

export function Gauge({
  label,
  value,
  min,
  max,
  unit,
  decimals = 0,
  dangerThreshold,
  warningThreshold,
}: GaugeProps) {
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (clamped - min) / (max - min || 1);

  // 240 degree arc from -210 to +30 degrees
  const startAngle = -210;
  const totalAngle = 240;
  const currentAngle = startAngle + ratio * totalAngle;

  // Determine active zone color
  let arcColor = 'stroke-blue-600 dark:stroke-blue-400';
  let badgeColor = 'text-blue-600 dark:text-blue-400';

  if (dangerThreshold !== undefined && value >= dangerThreshold) {
    arcColor = 'stroke-red-600 dark:stroke-red-400';
    badgeColor = 'text-red-600 dark:text-red-400';
  } else if (warningThreshold !== undefined && value >= warningThreshold) {
    arcColor = 'stroke-amber-500 dark:stroke-amber-400';
    badgeColor = 'text-amber-500 dark:text-amber-400';
  }

  // Radius and geometry
  const r = 70;
  const cx = 90;
  const cy = 90;
  const strokeWidth = 10;

  // SVG arc path helper
  const polarToCartesian = (
    centerX: number,
    centerY: number,
    radius: number,
    angleInDegrees: number,
  ) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x: number, y: number, radius: number, start: number, end: number) => {
    const pStart = polarToCartesian(x, y, radius, end);
    const pEnd = polarToCartesian(x, y, radius, start);
    const largeArcFlag = end - start <= 180 ? '0' : '1';
    return ['M', pStart.x, pStart.y, 'A', radius, radius, 0, largeArcFlag, 0, pEnd.x, pEnd.y].join(
      ' ',
    );
  };

  const bgArc = describeArc(cx, cy, r, startAngle, startAngle + totalAngle);
  const activeArc = describeArc(cx, cy, r, startAngle, Math.max(startAngle + 0.1, currentAngle));

  const formattedValue = value.toFixed(decimals);

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900 select-none"
    >
      <div className="relative size-44">
        <svg viewBox="0 0 180 180" className="size-full">
          {/* Background Track */}
          <path
            d={bgArc}
            fill="none"
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active Arc */}
          <path
            d={activeArc}
            fill="none"
            className={`${arcColor} transition-all duration-150`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Digital Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className="font-mono text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 tabular-nums">
            {formattedValue}
          </span>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${badgeColor}`}>
            {unit}
          </span>
        </div>
      </div>

      <div className="w-full text-center">
        <p className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</p>
        <div className="mt-1 flex justify-between px-3 text-[10px] font-mono text-slate-400 dark:text-slate-500">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
}

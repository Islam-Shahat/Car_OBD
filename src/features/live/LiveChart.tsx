import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

import { useTheme } from '../../lib/theme/useTheme';
import type { TimePoint } from './liveStore';

interface LiveChartProps {
  label: string;
  data: TimePoint[];
  color?: string;
  unit: string;
  height?: number;
}

export function LiveChart({ label, data, color = '#2563eb', unit, height = 180 }: LiveChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<uPlot | null>(null);
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';

  useEffect(() => {
    if (!containerRef.current) return;

    const gridColor = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const initialWidth = containerRef.current.clientWidth || 300;

    const opts: uPlot.Options = {
      width: initialWidth,
      height,
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      axes: [
        {
          stroke: textColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: gridColor, width: 1 },
          font: '10px monospace',
          space: 50,
          values: [
            [3600 * 24, '%m/%d', 7, null, 1],
            [3600, '%H:%M', 4, null, 1],
            [60, '%H:%M', 2, null, 1],
            [1, ':%S', 2, null, 1],
            [0.1, ':%S.%1', 2, null, 1],
          ],
        },
        {
          stroke: textColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: gridColor, width: 1 },
          font: '10px monospace',
          size: 45,
          values: (_u, vals) => vals.map((v) => (v != null ? `${v.toFixed(0)} ${unit}` : '')),
        },
      ],
      series: [
        {},
        {
          label,
          stroke: color,
          width: 2,
          spanGaps: true,
          points: { show: false },
        },
      ],
      cursor: {
        drag: { setScale: false },
        points: { size: 6, fill: color },
      },
    };

    const initialData: [number[], (number | null)[]] = [[], []];
    const chart = new uPlot(opts, initialData, containerRef.current);
    chartInstanceRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && chartInstanceRef.current) {
        const newWidth = entry.contentRect.width;
        if (newWidth > 50) {
          chartInstanceRef.current.setSize({ width: newWidth, height });
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.destroy();
      chartInstanceRef.current = null;
    };
  }, [color, height, isDark, label, unit]);

  // Update chart data on changes
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    if (data.length === 0) {
      chart.setData([[], []]);
      return;
    }

    // uPlot expects seconds for time: true
    const timestamps = data.map((pt) => pt.ts / 1000);
    const values = data.map((pt) => pt.value);

    chart.setData([timestamps, values]);
  }, [data]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between pb-2">
        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</h4>
        <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{unit}</span>
      </div>
      <div ref={containerRef} className="w-full overflow-hidden" />
    </div>
  );
}

"use client";

import type { CumulativePoint } from "@/lib/cumulative-earnings";

type Props = {
  points: CumulativePoint[];
  year: number;
};

function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const formatted =
    abs >= 1000
      ? `$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
      : `$${abs.toFixed(0)}`;
  return n < 0 ? `-${formatted}` : formatted;
}

function parseDay(date: string): number {
  return new Date(date + "T12:00:00").getTime();
}

/** Nice round tick values covering [min, max]. */
function niceTicks(min: number, max: number, targetCount = 5): number[] {
  const lo = Math.min(min, max, 0);
  const hi = Math.max(min, max, 0);
  const span = Math.max(hi - lo, 1);
  const rawStep = span / Math.max(targetCount - 1, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step * 0.5; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  if (!ticks.includes(0) && start < 0 && end > 0) {
    ticks.push(0);
    ticks.sort((a, b) => a - b);
  }
  return ticks;
}

export function CumulativeEarningsChart({ points, year }: Props) {
  if (points.length < 2) {
    return (
      <p className="rounded-lg border border-slate-700 bg-slate-800/30 p-6 text-center text-slate-400 text-sm">
        No closed earnings yet this year.
      </p>
    );
  }

  const width = 720;
  const height = 280;
  const pad = { top: 16, right: 16, bottom: 36, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const xs = points.map((p) => parseDay(p.date));
  const ys = points.map((p) => p.cumulative);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const yTickVals = niceTicks(Math.min(...ys), Math.max(...ys));
  const y0 = yTickVals[0];
  const y1 = yTickVals[yTickVals.length - 1];
  const xSpan = Math.max(maxX - minX, 1);
  const ySpan = Math.max(y1 - y0, 1);

  const xOf = (t: number) => pad.left + ((t - minX) / xSpan) * innerW;
  const yOf = (v: number) => pad.top + ((y1 - v) / ySpan) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(parseDay(p.date)).toFixed(2)} ${yOf(p.cumulative).toFixed(2)}`)
    .join(" ");

  const areaPath = [
    `M ${xOf(xs[0]).toFixed(2)} ${yOf(0).toFixed(2)}`,
    ...points.map((p) => `L ${xOf(parseDay(p.date)).toFixed(2)} ${yOf(p.cumulative).toFixed(2)}`),
    `L ${xOf(xs[xs.length - 1]).toFixed(2)} ${yOf(0).toFixed(2)}`,
    "Z",
  ].join(" ");

  const zeroY = yOf(0);
  const last = points[points.length - 1];

  const monthLabels: { x: number; label: string }[] = [];
  const start = new Date(points[0].date + "T12:00:00");
  const end = new Date(points[points.length - 1].date + "T12:00:00");
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  if (cursor < start) cursor.setMonth(cursor.getMonth() + 1);
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    monthLabels.push({
      x: xOf(parseDay(iso)),
      label: cursor.toLocaleString("en-US", { month: "short" }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  if (monthLabels.length === 0) {
    monthLabels.push({
      x: xOf(xs[0]),
      label: start.toLocaleString("en-US", { month: "short" }),
    });
  }

  const positive = last.cumulative >= 0;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Cumulative P/L</h2>
        <p className={`text-sm font-medium ${positive ? "text-green-400" : "text-red-400"}`}>
          YTD {fmtMoney(last.cumulative)}
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`Cumulative P/L for ${year}`}>
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={zeroY}
          y2={zeroY}
          stroke="rgb(71 85 105)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {yTickVals.map((v) => (
          <g key={v}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yOf(v)}
              y2={yOf(v)}
              stroke="rgb(51 65 85)"
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={yOf(v) + 4}
              textAnchor="end"
              className="fill-slate-500"
              fontSize={11}
            >
              {fmtMoney(v)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill={positive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"} />
        <path
          d={linePath}
          fill="none"
          stroke={positive ? "rgb(74 222 128)" : "rgb(248 113 113)"}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={xOf(parseDay(last.date))}
          cy={yOf(last.cumulative)}
          r={4}
          fill={positive ? "rgb(74 222 128)" : "rgb(248 113 113)"}
        />
        {monthLabels.map((m) => (
          <text
            key={`${m.label}-${m.x}`}
            x={m.x}
            y={height - 12}
            textAnchor="middle"
            className="fill-slate-500"
            fontSize={11}
          >
            {m.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

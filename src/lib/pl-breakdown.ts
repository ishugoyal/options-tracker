import type { ClosedPositionWithDate } from "./open-positions";

/** P/L for a single group (e.g. one ticker or one week). */
export interface PLBucket {
  label: string; // e.g. "AAPL" or "2025-01" or "2025-W03"
  profit: number;
  count: number; // number of closed positions in this bucket
}

/** Get Monday of the week (YYYY-MM-DD) for a given date string. */
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday = 1
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

/** Aggregate realized P/L by ticker. */
export function plByTicker(positions: ClosedPositionWithDate[]): PLBucket[] {
  const map = new Map<string, { profit: number; count: number }>();
  for (const p of positions) {
    const cur = map.get(p.ticker) ?? { profit: 0, count: 0 };
    cur.profit += p.profit;
    cur.count += 1;
    map.set(p.ticker, cur);
  }
  return Array.from(map.entries())
    .map(([label, { profit, count }]) => ({ label, profit, count }))
    .sort((a, b) => b.profit - a.profit);
}

/** Aggregate realized P/L by week (Monday date YYYY-MM-DD). */
export function plByWeek(positions: ClosedPositionWithDate[]): PLBucket[] {
  const map = new Map<string, { profit: number; count: number }>();
  for (const p of positions) {
    if (!p.closedAt) continue;
    const week = getWeekStart(p.closedAt);
    const cur = map.get(week) ?? { profit: 0, count: 0 };
    cur.profit += p.profit;
    cur.count += 1;
    map.set(week, cur);
  }
  return Array.from(map.entries())
    .map(([label, { profit, count }]) => ({ label, profit, count }))
    .sort((a, b) => b.label.localeCompare(a.label));
}

/** Aggregate realized P/L by month (YYYY-MM). */
export function plByMonth(positions: ClosedPositionWithDate[]): PLBucket[] {
  const map = new Map<string, { profit: number; count: number }>();
  for (const p of positions) {
    if (!p.closedAt) continue;
    const month = p.closedAt.slice(0, 7); // YYYY-MM
    const cur = map.get(month) ?? { profit: 0, count: 0 };
    cur.profit += p.profit;
    cur.count += 1;
    map.set(month, cur);
  }
  return Array.from(map.entries())
    .map(([label, { profit, count }]) => ({ label, profit, count }))
    .sort((a, b) => b.label.localeCompare(a.label));
}

/** Aggregate realized P/L by quarter (YYYY-Q1, YYYY-Q2, ...). */
export function plByQuarter(positions: ClosedPositionWithDate[]): PLBucket[] {
  const map = new Map<string, { profit: number; count: number }>();
  for (const p of positions) {
    if (!p.closedAt) continue;
    const [y, m] = p.closedAt.split("-").map(Number);
    const q = Math.floor((m - 1) / 3) + 1;
    const label = `${y}-Q${q}`;
    const cur = map.get(label) ?? { profit: 0, count: 0 };
    cur.profit += p.profit;
    cur.count += 1;
    map.set(label, cur);
  }
  return Array.from(map.entries())
    .map(([label, { profit, count }]) => ({ label, profit, count }))
    .sort((a, b) => b.label.localeCompare(a.label));
}

/** Aggregate realized P/L by year (YYYY). */
export function plByYear(positions: ClosedPositionWithDate[]): PLBucket[] {
  const map = new Map<string, { profit: number; count: number }>();
  for (const p of positions) {
    if (!p.closedAt) continue;
    const year = p.closedAt.slice(0, 4);
    const cur = map.get(year) ?? { profit: 0, count: 0 };
    cur.profit += p.profit;
    cur.count += 1;
    map.set(year, cur);
  }
  return Array.from(map.entries())
    .map(([label, { profit, count }]) => ({ label, profit, count }))
    .sort((a, b) => b.label.localeCompare(a.label));
}

export type PLGroupBy = "ticker" | "week" | "month" | "quarter" | "year";

/** Generate all period labels between start and end (inclusive) for the given granularity. */
export function getAllPeriodLabels(
  startDate: string,
  endDate: string,
  groupBy: Exclude<PLGroupBy, "ticker">
): string[] {
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  const labels: string[] = [];

  if (groupBy === "week") {
    let d = new Date(start);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    while (d <= end) {
      labels.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 7);
    }
  } else if (groupBy === "month") {
    let y = start.getFullYear();
    let m = start.getMonth();
    const endY = end.getFullYear();
    const endM = end.getMonth();
    while (y < endY || (y === endY && m <= endM)) {
      labels.push(`${y}-${String(m + 1).padStart(2, "0")}`);
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  } else if (groupBy === "quarter") {
    let y = start.getFullYear();
    let q = Math.floor(start.getMonth() / 3) + 1;
    const endY = end.getFullYear();
    const endQ = Math.floor(end.getMonth() / 3) + 1;
    while (y < endY || (y === endY && q <= endQ)) {
      labels.push(`${y}-Q${q}`);
      q += 1;
      if (q > 4) {
        q = 1;
        y += 1;
      }
    }
  } else if (groupBy === "year") {
    const startY = start.getFullYear();
    const endY = end.getFullYear();
    for (let y = startY; y <= endY; y++) {
      labels.push(String(y));
    }
  }

  return labels;
}

export function getPLBreakdown(
  positions: ClosedPositionWithDate[],
  groupBy: PLGroupBy
): PLBucket[] {
  switch (groupBy) {
    case "ticker":
      return plByTicker(positions);
    case "week":
      return plByWeek(positions);
    case "month":
      return plByMonth(positions);
    case "quarter":
      return plByQuarter(positions);
    case "year":
      return plByYear(positions);
    default:
      return [];
  }
}

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

export type PLGroupBy = "ticker" | "week" | "month" | "year";

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
    case "year":
      return plByYear(positions);
    default:
      return [];
  }
}

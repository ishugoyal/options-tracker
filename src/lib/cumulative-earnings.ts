export type CumulativePoint = {
  date: string; // YYYY-MM-DD
  cumulative: number;
};

/**
 * Build a YTD cumulative earnings series from closed earnings events
 * (chain-realization or cash — caller chooses the position set).
 */
export function buildCumulativeEarningsSeries(
  positions: Array<{ closedAt: string; profit: number }>,
  yearStart: string,
  asOf: string
): CumulativePoint[] {
  const byDate = new Map<string, number>();
  for (const p of positions) {
    if (!p.closedAt || p.closedAt < yearStart || p.closedAt > asOf) continue;
    byDate.set(p.closedAt, (byDate.get(p.closedAt) ?? 0) + p.profit);
  }

  const dates = Array.from(byDate.keys()).sort();
  const points: CumulativePoint[] = [{ date: yearStart, cumulative: 0 }];
  let running = 0;
  for (const date of dates) {
    running += byDate.get(date) ?? 0;
    points.push({ date, cumulative: running });
  }

  const last = points[points.length - 1];
  if (last.date < asOf) {
    points.push({ date: asOf, cumulative: last.cumulative });
  }

  return points;
}

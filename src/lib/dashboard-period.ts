import { getActionLabels, type TradeForActionLabel } from "@/lib/action-labels";
import type { ClosedPositionWithDate } from "@/lib/open-positions";

export type DashboardTrade = TradeForActionLabel & {
  pricePerContract: number;
  fees?: number | null;
};

export type ClosedActivityItem = {
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  quantity: number;
  profit: number;
  date: string;
};

export type OpenedActivityItem = {
  id: string;
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  quantity: number;
  /** Credit collected (sell to open); positive = premium in. */
  premium: number;
  date: string;
  label: string;
};

export type PeriodActivity = {
  start: string;
  end: string;
  realizedPl: number;
  closedCount: number;
  newPremium: number;
  openedCount: number;
  closedItems: ClosedActivityItem[];
  openedItems: OpenedActivityItem[];
};

export type CalendarDay = {
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
  realized: number;
  closedCount: number;
  openedCount: number;
};

export type CalendarWeek = {
  days: CalendarDay[];
  weekTotal: number;
};

export type PlCalendarModel = {
  year: number;
  month: number; // 1-12
  monthLabel: string;
  monthTotal: number;
  weeks: CalendarWeek[];
};

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `dateStr` (YYYY-MM-DD). */
export function weekStartMonday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

export function last7DayRange(today: string): { start: string; end: string } {
  return { start: addDays(today, -6), end: today };
}

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function isSellToOpen(label: string): boolean {
  return label === "Sell to open";
}

function isOpeningLabel(label: string): boolean {
  return label.includes("to open");
}

/**
 * Build last-N-days (or any range) activity using chain-realization closes
 * and action-labeled opening sells for new premium.
 */
export function buildPeriodActivity(
  chainEarnings: ClosedPositionWithDate[],
  trades: DashboardTrade[],
  start: string,
  end: string
): PeriodActivity {
  const labels = getActionLabels(trades);

  const closedItems: ClosedActivityItem[] = chainEarnings
    .filter((p) => p.closedAt && inRange(p.closedAt, start, end))
    .map((p) => ({
      ticker: p.ticker,
      optionType: p.optionType,
      strike: p.strike,
      expiry: p.expiry,
      quantity: p.quantity,
      profit: p.profit,
      date: p.closedAt,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker));

  const openedItems: OpenedActivityItem[] = [];
  for (const t of trades) {
    if (!inRange(t.tradeDate, start, end)) continue;
    const label = labels[t.id] ?? "";
    if (!isSellToOpen(label)) continue;
    const premium = t.quantity * t.pricePerContract * 100;
    openedItems.push({
      id: t.id,
      ticker: t.ticker,
      optionType: t.optionType,
      strike: t.strike,
      expiry: t.expiry,
      quantity: t.quantity,
      premium,
      date: t.tradeDate,
      label,
    });
  }
  openedItems.sort((a, b) => b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker));

  const realizedPl = closedItems.reduce((sum, p) => sum + p.profit, 0);
  const newPremium = openedItems.reduce((sum, p) => sum + p.premium, 0);

  return {
    start,
    end,
    realizedPl,
    closedCount: closedItems.length,
    newPremium,
    openedCount: openedItems.length,
    closedItems,
    openedItems,
  };
}

/**
 * Current (or given) calendar month P/L calendar: daily chain realized + open counts,
 * Mon–Sun weeks with week totals.
 */
export function buildPlCalendar(
  chainEarnings: ClosedPositionWithDate[],
  trades: DashboardTrade[],
  year: number,
  month: number // 1-12
): PlCalendarModel {
  const labels = getActionLabels(trades);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const realizedByDay = new Map<string, { profit: number; count: number }>();
  for (const p of chainEarnings) {
    if (!p.closedAt || !inRange(p.closedAt, monthStart, monthEnd)) continue;
    const cur = realizedByDay.get(p.closedAt) ?? { profit: 0, count: 0 };
    cur.profit += p.profit;
    cur.count += 1;
    realizedByDay.set(p.closedAt, cur);
  }

  const openedByDay = new Map<string, number>();
  for (const t of trades) {
    if (!inRange(t.tradeDate, monthStart, monthEnd)) continue;
    const label = labels[t.id] ?? "";
    if (!isOpeningLabel(label) || t.action !== "sell") continue;
    openedByDay.set(t.tradeDate, (openedByDay.get(t.tradeDate) ?? 0) + 1);
  }

  const gridStart = weekStartMonday(monthStart);
  // End on Sunday of the week containing monthEnd
  const monthEndDate = new Date(monthEnd + "T12:00:00");
  const endDow = monthEndDate.getDay(); // 0 Sun
  const daysToSunday = endDow === 0 ? 0 : 7 - endDow;
  const gridEnd = addDays(monthEnd, daysToSunday);

  const days: CalendarDay[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    const stats = realizedByDay.get(d);
    days.push({
      date: d,
      dayOfMonth: Number(d.slice(8, 10)),
      inMonth: d >= monthStart && d <= monthEnd,
      realized: stats?.profit ?? 0,
      closedCount: stats?.count ?? 0,
      openedCount: openedByDay.get(d) ?? 0,
    });
  }

  const weeks: CalendarWeek[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const weekDays = days.slice(i, i + 7);
    weeks.push({
      days: weekDays,
      weekTotal: weekDays.reduce((sum, day) => sum + (day.inMonth ? day.realized : 0), 0),
    });
  }

  const monthTotal = days
    .filter((d) => d.inMonth)
    .reduce((sum, d) => sum + d.realized, 0);

  const monthLabel = new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return { year, month, monthLabel, monthTotal, weeks };
}

import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, startOfDay, endOfDay } from "date-fns";

export type DatePresetKey =
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear"
  | "range";

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;
}

const today = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

export function getPresetRange(preset: DatePresetKey, customStart?: string, customEnd?: string): DateRange | null {
  const t = today();
  switch (preset) {
    case "last7": {
      const start = subDays(t, 6);
      return { start: format(start, "yyyy-MM-dd"), end: format(t, "yyyy-MM-dd") };
    }
    case "last30": {
      const start = subDays(t, 29);
      return { start: format(start, "yyyy-MM-dd"), end: format(t, "yyyy-MM-dd") };
    }
    case "thisMonth": {
      const start = startOfMonth(t);
      return { start: format(start, "yyyy-MM-dd"), end: format(t, "yyyy-MM-dd") };
    }
    case "lastMonth": {
      const prev = new Date(t.getFullYear(), t.getMonth() - 1);
      return {
        start: format(startOfMonth(prev), "yyyy-MM-dd"),
        end: format(endOfMonth(prev), "yyyy-MM-dd"),
      };
    }
    case "thisYear": {
      const start = startOfYear(t);
      return { start: format(start, "yyyy-MM-dd"), end: format(t, "yyyy-MM-dd") };
    }
    case "lastYear": {
      const prevYear = t.getFullYear() - 1;
      return {
        start: format(startOfYear(new Date(prevYear, 0, 1)), "yyyy-MM-dd"),
        end: format(endOfYear(new Date(prevYear, 11, 31)), "yyyy-MM-dd"),
      };
    }
    case "range":
      if (customStart && customEnd) return { start: customStart, end: customEnd };
      return null;
    default:
      return null;
  }
}

export function getPresetLabel(preset: DatePresetKey): string {
  switch (preset) {
    case "last7":
      return "Last 7 days";
    case "last30":
      return "Last 30 days";
    case "thisMonth":
      return "This month";
    case "lastMonth":
      return "Last month";
    case "thisYear":
      return "This year";
    case "lastYear":
      return "Last year";
    case "range":
      return "Custom range";
    default:
      return "Select range";
  }
}

export function getPresetDescription(preset: DatePresetKey, range: DateRange | null): string {
  if (!range) return "Select a date range to filter earnings.";
  switch (preset) {
    case "last7":
      return "Earnings from the last 7 days.";
    case "last30":
      return "Earnings from the last 30 days.";
    case "thisMonth":
      return "Earnings from the start of the current month through today.";
    case "lastMonth":
      return "Earnings from the previous calendar month.";
    case "thisYear":
      return "This date range shows the current year to date.";
    case "lastYear":
      return "Earnings from the previous calendar year.";
    case "range":
      return "Custom date range selected.";
    default:
      return `${format(parseISO(range.start), "MMM d, yyyy")} – ${format(parseISO(range.end), "MMM d, yyyy")}`;
  }
}

export function formatDateRange(range: DateRange): string {
  return `${format(parseISO(range.start), "MMM d, yyyy")} – ${format(parseISO(range.end), "MMM d, yyyy")}`;
}

/** Check if closedAt (YYYY-MM-DD) is within [start, end] inclusive. */
export function isDateInRange(closedAt: string, range: DateRange): boolean {
  const d = parseISO(closedAt);
  const start = startOfDay(parseISO(range.start));
  const end = endOfDay(parseISO(range.end));
  return d >= start && d <= end;
}

"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import type { ClosedPositionWithDate } from "@/lib/open-positions";
import { getPLBreakdown, getAllPeriodLabels, type PLGroupBy } from "@/lib/pl-breakdown";
import { isDateInRange, formatDateRange, type DateRange } from "@/lib/earnings-filters";
import { TimeFilterModal } from "@/components/TimeFilterModal";

interface EarningsViewProps {
  positions: ClosedPositionWithDate[];
  allTickers: string[];
}

const GRANULARITY_OPTIONS: { value: PLGroupBy; label: string }[] = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "year", label: "Yearly" },
];

function fmtMoney(profit: number) {
  return (profit >= 0 ? "+" : "") + "$" + profit.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function EarningsView({ positions, allTickers }: EarningsViewProps) {
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [granularity, setGranularity] = useState<PLGroupBy>("month");
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [tickerDropdownOpen, setTickerDropdownOpen] = useState(false);

  const filteredPositions = useMemo(() => {
    let list = positions;
    if (dateRange) {
      list = list.filter((p) => p.closedAt && isDateInRange(p.closedAt, dateRange));
    }
    if (selectedTickers.length > 0) {
      const set = new Set(selectedTickers);
      list = list.filter((p) => set.has(p.ticker));
    }
    return list;
  }, [positions, dateRange, selectedTickers]);

  const buckets = useMemo(
    () => getPLBreakdown(filteredPositions, granularity),
    [filteredPositions, granularity]
  );

  const chartBuckets = useMemo(() => {
    if (granularity === "ticker") return buckets;
    return [...buckets].reverse();
  }, [buckets, granularity]);

  const bucketByLabel = useMemo(() => {
    const m = new Map<string, { profit: number; count: number }>();
    for (const b of buckets) m.set(b.label, { profit: b.profit, count: b.count });
    return m;
  }, [buckets]);

  const allPeriodLabels = useMemo(() => {
    if (granularity === "ticker") return chartBuckets.map((b) => b.label);
    const range = dateRange ?? (() => {
      const dates = filteredPositions.map((p) => p.closedAt).filter(Boolean) as string[];
      if (dates.length === 0) return null;
      return { start: dates.sort()[0]!, end: dates.sort().reverse()[0]! };
    })();
    if (!range) return chartBuckets.map((b) => b.label);
    return getAllPeriodLabels(range.start, range.end, granularity);
  }, [dateRange, filteredPositions, granularity, chartBuckets]);

  const totalProfit = useMemo(
    () => filteredPositions.reduce((sum, p) => sum + p.profit, 0),
    [filteredPositions]
  );

  const toggleTicker = (t: string) => {
    setSelectedTickers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const clearTickers = () => setSelectedTickers([]);

  const timeLabel = dateRange ? formatDateRange(dateRange) : "All time";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Earnings</h1>
        <p className="mt-1 text-slate-400">
          Realized profit/loss from closed positions. Use filters and time granularity to explore.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <p className="text-slate-400 text-sm">Total earnings</p>
          <p className={`text-xl font-bold ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
            {fmtMoney(totalProfit)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <p className="text-slate-400 text-sm">Closed positions</p>
          <p className="text-xl font-bold text-white">{filteredPositions.length}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <p className="text-slate-400 text-sm">Average per position</p>
          <p
            className={`text-xl font-bold ${
              filteredPositions.length
                ? (totalProfit / filteredPositions.length >= 0 ? "text-green-400" : "text-red-400")
                : "text-slate-500"
            }`}
          >
            {filteredPositions.length ? fmtMoney(totalProfit / filteredPositions.length) : "—"}
          </p>
        </div>
      </div>

      {/* Toolbar: Time filter, Granularity, Ticker filter */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setTimeModalOpen(true)}
          className="flex items-center gap-2 rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          <span className="text-slate-500">📅</span>
          {timeLabel}
        </button>
        <select
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as PLGroupBy)}
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
        >
          {GRANULARITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="relative">
          <button
            type="button"
            onClick={() => setTickerDropdownOpen((o) => !o)}
            className="flex items-center gap-2 rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Tickers {selectedTickers.length > 0 ? `(${selectedTickers.length})` : ""} ▾
          </button>
          {tickerDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={() => setTickerDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-56 overflow-auto rounded border border-slate-700 bg-slate-900 py-1">
                {selectedTickers.length > 0 && (
                  <button
                    type="button"
                    onClick={clearTickers}
                    className="w-full px-3 py-1.5 text-left text-xs text-sky-400 hover:bg-slate-800"
                  >
                    Clear selection
                  </button>
                )}
                {allTickers.map((t) => (
                  <label
                    key={t}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTickers.includes(t)}
                      onChange={() => toggleTicker(t)}
                      className="rounded border-slate-600"
                    />
                    <span className="text-sm text-white">{t}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <TimeFilterModal
        open={timeModalOpen}
        value={dateRange}
        onClose={() => setTimeModalOpen(false)}
        onApply={(r) => setDateRange(r)}
      />

      {/* Bar chart */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Earnings by period</h2>
        {buckets.length === 0 && allPeriodLabels.length === 0 ? (
          <p className="rounded-lg border border-slate-700 bg-slate-800/30 p-6 text-center text-slate-400">
            No closed positions in the selected range.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800/30 p-4">
            <div
              className="flex items-end gap-4"
              style={{
                height: 200,
                justifyContent: allPeriodLabels.length === 1 ? "center" : "space-evenly",
                minWidth:
                  allPeriodLabels.length === 1
                    ? undefined
                    : allPeriodLabels.length * 48 + (allPeriodLabels.length - 1) * 16,
              }}
            >
              {allPeriodLabels.map((label) => {
                const bucket = bucketByLabel.get(label);
                const profit = bucket?.profit ?? 0;
                const maxAbs = Math.max(
                  ...Array.from(bucketByLabel.values()).map((x) => Math.abs(x.profit)),
                  1
                );
                const heightPx = bucket
                  ? Math.max((Math.abs(profit) / maxAbs) * 200, 8)
                  : 0;
                return (
                  <div
                    key={label}
                    className="flex flex-col items-center justify-end gap-0.5"
                    style={{
                      height: 200,
                      flex: allPeriodLabels.length === 1 ? "0 0 80px" : "1 1 0",
                      minWidth: allPeriodLabels.length === 1 ? undefined : 48,
                      maxWidth: allPeriodLabels.length === 1 ? 80 : 64,
                    }}
                  >
                    {heightPx > 0 ? (
                      <>
                        <span
                          className={`text-xs font-medium ${profit >= 0 ? "text-green-400" : "text-red-400"}`}
                          style={{ lineHeight: 1 }}
                        >
                          {fmtMoney(profit)}
                        </span>
                        <div
                          className="w-full min-w-0 rounded transition-opacity hover:opacity-90"
                          style={{
                            height: heightPx,
                            backgroundColor: profit >= 0 ? "rgb(34 197 94)" : "rgb(239 68 68)",
                          }}
                        />
                      </>
                    ) : (
                      <div className="w-full" style={{ height: 8 }} aria-hidden />
                    )}
                    <span className="truncate w-full text-center text-xs text-slate-400" title={label}>
                      {label.length > 10 ? label.slice(0, 8) + "…" : label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Detailed list */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Closed positions</h2>
        {filteredPositions.length === 0 ? (
          <p className="rounded-lg border border-slate-700 bg-slate-800/30 p-6 text-center text-slate-400">
            No positions to show. Adjust filters or date range.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Closed date</th>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Strike</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3 text-right">P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {[...filteredPositions]
                  .sort((a, b) => (b.closedAt || "").localeCompare(a.closedAt || ""))
                  .map((p, i) => (
                    <tr key={`${p.ticker}-${p.expiry}-${p.optionType}-${p.strike}-${i}`} className="hover:bg-slate-800/50">
                      <td className="px-4 py-2 text-slate-300">
                        {p.closedAt ? format(parseISO(p.closedAt), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-2 font-medium text-white">{p.ticker}</td>
                      <td className="px-4 py-2 capitalize text-slate-300">{p.optionType}</td>
                      <td className="px-4 py-2 text-slate-300">{p.strike}</td>
                      <td className="px-4 py-2 text-slate-300">{p.expiry}</td>
                      <td className="px-4 py-2 text-slate-300">{p.quantity}</td>
                      <td
                        className={`px-4 py-2 text-right font-medium ${
                          p.profit >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {fmtMoney(p.profit)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

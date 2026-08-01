"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import type { ClosedPositionWithDate } from "@/lib/open-positions";
import type { RollChain } from "@/lib/rolls";
import { getPLBreakdown, getAllPeriodLabels, type PLGroupBy } from "@/lib/pl-breakdown";
import { isDateInRange, formatDateRange, type DateRange } from "@/lib/earnings-filters";
import {
  buildEarningsPositions,
  type EarningsTimingMode,
} from "@/lib/earnings-positions";
import { TimeFilterModal } from "@/components/TimeFilterModal";

interface EarningsViewProps {
  positions: ClosedPositionWithDate[];
  rollChains: RollChain[];
  allTickers: string[];
}

type PeriodGranularity = Exclude<PLGroupBy, "ticker">;

const GRANULARITY_OPTIONS: { value: PeriodGranularity; label: string }[] = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "year", label: "Yearly" },
];

const TIMING_OPTIONS: { value: EarningsTimingMode; label: string; hint: string }[] = [
  {
    value: "chain",
    label: "Chain realization",
    hint: "Confirmed roll chains book full P/L on the final close date.",
  },
  {
    value: "cash",
    label: "Cash timing",
    hint: "Each closed leg books P/L on its own close date (FIFO).",
  },
];

function fmtMoney(profit: number) {
  return (profit >= 0 ? "+" : "") + "$" + profit.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

function applyFilters(
  list: ClosedPositionWithDate[],
  dateRange: DateRange | null,
  selectedTickers: string[]
): ClosedPositionWithDate[] {
  let next = list;
  if (dateRange) {
    next = next.filter((p) => p.closedAt && isDateInRange(p.closedAt, dateRange));
  }
  if (selectedTickers.length > 0) {
    const set = new Set(selectedTickers);
    next = next.filter((p) => set.has(p.ticker));
  }
  return next;
}

export function EarningsView({ positions, rollChains, allTickers }: EarningsViewProps) {
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [granularity, setGranularity] = useState<PeriodGranularity>("month");
  const [timingMode, setTimingMode] = useState<EarningsTimingMode>("chain");
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [tickerDropdownOpen, setTickerDropdownOpen] = useState(false);

  const earningsPositions = useMemo(
    () => buildEarningsPositions(positions, rollChains, timingMode),
    [positions, rollChains, timingMode]
  );

  // Closed-positions table stays FIFO reality regardless of timing mode.
  const filteredPositions = useMemo(
    () => applyFilters(positions, dateRange, selectedTickers),
    [positions, dateRange, selectedTickers]
  );

  // Totals / charts / by-ticker use earnings timing.
  const filteredEarnings = useMemo(
    () => applyFilters(earningsPositions, dateRange, selectedTickers),
    [earningsPositions, dateRange, selectedTickers]
  );

  const filteredRollChains = useMemo(() => {
    let list = rollChains;
    if (dateRange) {
      list = list.filter((chain) =>
        isDateInRange(chain.closedAt ?? chain.lastActivityAt, dateRange)
      );
    }
    if (selectedTickers.length > 0) {
      const set = new Set(selectedTickers);
      list = list.filter((chain) => set.has(chain.ticker));
    }
    return list;
  }, [rollChains, dateRange, selectedTickers]);

  const buckets = useMemo(
    () => getPLBreakdown(filteredEarnings, granularity),
    [filteredEarnings, granularity]
  );

  const tickerBuckets = useMemo(
    () => getPLBreakdown(filteredEarnings, "ticker"),
    [filteredEarnings]
  );

  const chartBuckets = useMemo(() => [...buckets].reverse(), [buckets]);

  const bucketByLabel = useMemo(() => {
    const m = new Map<string, { profit: number; count: number }>();
    for (const b of buckets) m.set(b.label, { profit: b.profit, count: b.count });
    return m;
  }, [buckets]);

  const allPeriodLabels = useMemo(() => {
    const range = dateRange ?? (() => {
      const dates = filteredEarnings.map((p) => p.closedAt).filter(Boolean) as string[];
      if (dates.length === 0) return null;
      return { start: dates.sort()[0]!, end: dates.sort().reverse()[0]! };
    })();
    if (!range) return chartBuckets.map((b) => b.label);
    return getAllPeriodLabels(range.start, range.end, granularity);
  }, [dateRange, filteredEarnings, granularity, chartBuckets]);

  const totalProfit = useMemo(
    () => filteredEarnings.reduce((sum, p) => sum + p.profit, 0),
    [filteredEarnings]
  );

  const timingHint = TIMING_OPTIONS.find((o) => o.value === timingMode)?.hint;

  const toggleTicker = (t: string) => {
    setSelectedTickers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const clearTickers = () => setSelectedTickers([]);

  const timeLabel = dateRange ? formatDateRange(dateRange) : "All time";

  const viewAllHref = useMemo(() => {
    const params = new URLSearchParams();
    if (dateRange) {
      params.set("start", dateRange.start);
      params.set("end", dateRange.end);
    }
    if (selectedTickers.length > 0) {
      params.set("tickers", selectedTickers.join(","));
    }
    const qs = params.toString();
    return qs ? `/closed-positions?${qs}` : "/closed-positions";
  }, [dateRange, selectedTickers]);

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
          <p className="text-slate-400 text-sm">
            {timingMode === "chain" ? "Earnings events" : "Closed positions"}
          </p>
          <p className="text-xl font-bold text-white">{filteredEarnings.length}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <p className="text-slate-400 text-sm">Average per event</p>
          <p
            className={`text-xl font-bold ${
              filteredEarnings.length
                ? (totalProfit / filteredEarnings.length >= 0 ? "text-green-400" : "text-red-400")
                : "text-slate-500"
            }`}
          >
            {filteredEarnings.length ? fmtMoney(totalProfit / filteredEarnings.length) : "—"}
          </p>
        </div>
      </div>

      {/* Toolbar: filters + timing mode */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setTimeModalOpen(true)}
            className="flex items-center gap-2 rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            <span className="text-slate-500">📅</span>
            {timeLabel}
          </button>
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
          <div className="flex rounded border border-slate-600 p-0.5">
            {TIMING_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setTimingMode(o.value)}
                className={`rounded px-3 py-1.5 text-sm ${
                  timingMode === o.value
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {timingHint && <p className="text-xs text-slate-500">{timingHint}</p>}
      </div>

      <TimeFilterModal
        open={timeModalOpen}
        value={dateRange}
        onClose={() => setTimeModalOpen(false)}
        onApply={(r) => setDateRange(r)}
      />

      {/* Primary: ticker contribution for the selected period */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">Earnings by ticker</h2>
          <p className="text-sm text-slate-400">
            How much each ticker contributed in {timeLabel.toLowerCase()}
            {timingMode === "chain" ? " (chain realization)" : " (cash timing)"}.
          </p>
        </div>
        {tickerBuckets.length === 0 ? (
          <p className="rounded-lg border border-slate-700 bg-slate-800/30 p-6 text-center text-slate-400">
            No closed positions in the selected range.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Positions</th>
                  <th className="px-4 py-3 text-right">P/L</th>
                  <th className="px-4 py-3 text-right">Share of total</th>
                  <th className="px-4 py-3 text-right">Avg / position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {tickerBuckets.map((b) => {
                  const share = totalProfit !== 0 ? (b.profit / totalProfit) * 100 : 0;
                  const shareNa = share < 0 || share > 100;
                  return (
                    <tr key={b.label} className="hover:bg-slate-800/50">
                      <td className="px-4 py-2 font-medium text-white">{b.label}</td>
                      <td className="px-4 py-2 text-slate-300">{b.count}</td>
                      <td
                        className={`px-4 py-2 text-right font-medium ${
                          b.profit >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {fmtMoney(b.profit)}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-300">
                        {shareNa ? "n/a" : `+${share.toFixed(1)}%`}
                      </td>
                      <td
                        className={`px-4 py-2 text-right ${
                          b.profit / b.count >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {fmtMoney(b.profit / b.count)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Secondary: time series for the same filtered set */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Earnings by period</h2>
            <p className="text-sm text-slate-400">Same filtered range, grouped over time.</p>
          </div>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as PeriodGranularity)}
            className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
          >
            {GRANULARITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Closed positions</h2>
          {filteredPositions.length > 20 && (
            <a
              href={viewAllHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-slate-600 px-3 py-1.5 text-sm text-sky-400 hover:bg-slate-800"
            >
              View all {filteredPositions.length} →
            </a>
          )}
        </div>
        {filteredPositions.length === 0 ? (
          <p className="rounded-lg border border-slate-700 bg-slate-800/30 p-6 text-center text-slate-400">
            No positions to show. Adjust filters or date range.
          </p>
        ) : (
          <>
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
                    .slice(0, 20)
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
            {filteredPositions.length > 20 && (
              <p className="mt-2 text-sm text-slate-500">
                Showing 20 of {filteredPositions.length}.{" "}
                <a
                  href={viewAllHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline"
                >
                  Open full list in a new tab
                </a>
              </p>
            )}
          </>
        )}
      </section>

      {/* Additive roll-chain reporting. Closed-position/FIFO rows above remain unchanged. */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">Roll chains</h2>
          <p className="text-sm text-slate-400">
            One row per confirmed chain. Whole-chain P/L includes the original opening trade, every confirmed roll
            step, the final close, and allocated fees.
          </p>
        </div>
        {filteredRollChains.length === 0 ? (
          <p className="rounded-lg border border-slate-700 bg-slate-800/30 p-6 text-center text-slate-400">
            No confirmed roll chains in the selected range.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Closed / last activity</th>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Chain</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Steps</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Premium</th>
                  <th className="px-4 py-3 text-right">Fees</th>
                  <th className="px-4 py-3 text-right">Whole-chain P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredRollChains.map((chain) => (
                  <tr key={chain.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-2 text-slate-300">
                      {format(parseISO(chain.startedAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-2 text-slate-300">
                      {format(parseISO(chain.closedAt ?? chain.lastActivityAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-2 font-medium text-white">{chain.ticker}</td>
                    <td className="px-4 py-2 capitalize text-slate-300">{chain.optionType}</td>
                    <td className="px-4 py-2 text-slate-300">
                      ${chain.startStrike} {chain.startExpiry} → ${chain.endStrike} {chain.endExpiry}
                    </td>
                    <td className="px-4 py-2 text-slate-300">{chain.quantity}</td>
                    <td className="px-4 py-2 text-slate-300">{chain.steps.length}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          chain.isClosed
                            ? "bg-green-900/40 text-green-300"
                            : "bg-amber-900/40 text-amber-300"
                        }`}
                      >
                        {chain.isClosed ? "Closed" : "Open"}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${
                        chain.pl.premium >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {fmtMoney(chain.pl.premium)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-400">
                      ${chain.pl.fees.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        chain.isClosed
                          ? chain.pl.pl >= 0
                            ? "text-green-400"
                            : "text-red-400"
                          : "text-slate-500"
                      }`}
                    >
                      {chain.isClosed ? fmtMoney(chain.pl.pl) : "Pending"}
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

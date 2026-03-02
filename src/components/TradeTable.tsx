"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tradeCost } from "@/types/trade";
import type { Trade } from "@/types/trade";
import { isDateInRange, formatDateRange, type DateRange } from "@/lib/earnings-filters";
import { TimeFilterModal } from "@/components/TimeFilterModal";

interface TradeTableProps {
  trades: Trade[];
  actionLabels?: Record<string, string>;
}

export function TradeTable({ trades, actionLabels }: TradeTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [tickerDropdownOpen, setTickerDropdownOpen] = useState(false);

  const allTickers = useMemo(
    () => Array.from(new Set(trades.map((t) => t.ticker))).sort(),
    [trades]
  );

  const filteredTrades = useMemo(() => {
    let list = trades;
    if (dateRange) {
      list = list.filter((t) => isDateInRange(t.tradeDate, dateRange));
    }
    if (selectedTickers.length > 0) {
      const set = new Set(selectedTickers);
      list = list.filter((t) => set.has(t.ticker));
    }
    return list;
  }, [trades, dateRange, selectedTickers]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTrades.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTrades.map((t) => t.id)));
    }
  };

  const toggleTicker = (t: string) => {
    setSelectedTickers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const clearFilters = () => {
    setDateRange(null);
    setSelectedTickers([]);
  };

  const hasFilters = dateRange !== null || selectedTickers.length > 0;
  const timeLabel = dateRange ? formatDateRange(dateRange) : "All time";

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} trade${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/trades/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      alert("Failed to delete trades");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this trade? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.refresh();
    } catch {
      alert("Failed to delete trade");
    }
  };

  if (trades.length === 0) {
    return (
      <p className="rounded-lg border border-slate-700 bg-slate-800/30 p-8 text-center text-slate-400">
        No trades yet. <Link href="/trades/new" className="text-sky-400 hover:underline">Add a trade</Link> or{" "}
        <Link href="/trades/import" className="text-sky-400 hover:underline">import CSV</Link>.
      </p>
    );
  }

  return (
    <div className="space-y-3">
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
                    onClick={() => setSelectedTickers([])}
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
        {hasFilters && (
          <>
            <span className="text-sm text-slate-400">
              Showing {filteredTrades.length} of {trades.length} trades
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-slate-400 hover:text-white"
            >
              Clear filters
            </button>
          </>
        )}
      </div>

      <TimeFilterModal
        open={timeModalOpen}
        value={dateRange}
        onClose={() => setTimeModalOpen(false)}
        onApply={(r) => setDateRange(r)}
      />

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2">
          <span className="text-slate-300">
            {selectedIds.size} trade{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <button
            type="button"
            onClick={handleBulkDelete}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
          >
            Delete selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-slate-400 hover:text-white"
          >
            Clear selection
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={!!filteredTrades.length && selectedIds.size === filteredTrades.length}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-600 bg-slate-800 text-sky-600 focus:ring-sky-500"
                />
              </th>
              <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Ticker</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Strike</th>
            <th className="px-4 py-3">Expiry</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Cost</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {filteredTrades.length === 0 ? (
            <tr>
              <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                No trades match your filters.
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-2 text-sky-400 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </td>
            </tr>
          ) : (
          filteredTrades.map((t) => {
            const cost = tradeCost(t);
            return (
              <tr key={t.id} className="hover:bg-slate-800/50">
                <td className="w-10 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleSelect(t.id)}
                    className="rounded border-slate-600 bg-slate-800 text-sky-600 focus:ring-sky-500"
                  />
                </td>
                <td className="px-4 py-2 text-slate-300">{t.tradeDate}</td>
                <td className="px-4 py-2 font-medium text-white">{t.ticker}</td>
                <td className="px-4 py-2 capitalize text-slate-300">{t.optionType}</td>
                <td className="px-4 py-2 text-slate-300">{t.strike}</td>
                <td className="px-4 py-2 text-slate-300">{t.expiry}</td>
                <td className="px-4 py-2">
                  <span className={t.action === "buy" ? "text-green-400" : "text-amber-400"}>
                    {t.isOrphanClose || t.closesTradeId
                      ? t.action === "buy"
                        ? "Buy to close"
                        : "Sell to close"
                      : (actionLabels?.[t.id] ?? (t.action === "buy" ? "Buy to open" : "Sell to open"))}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-300">{t.quantity}</td>
                <td className="px-4 py-2 text-slate-300">${t.pricePerContract.toFixed(2)}</td>
                <td className={`px-4 py-2 ${cost >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {cost >= 0 ? "+" : ""}${cost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2 text-slate-500 text-xs">{t.source}</td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/trades/${t.id}/edit`}
                    className="mr-2 text-sky-400 hover:underline"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    className="text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
}

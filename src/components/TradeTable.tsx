"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tradeCost } from "@/types/trade";
import type { Trade } from "@/types/trade";

interface TradeTableProps {
  trades: Trade[];
  actionLabels?: Record<string, string>;
}

export function TradeTable({ trades, actionLabels }: TradeTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === trades.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(trades.map((t) => t.id)));
    }
  };

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
                  checked={selectedIds.size === trades.length && trades.length > 0}
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
            <th className="px-4 py-3">Closes</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {trades.map((t) => {
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
                <td className="px-4 py-2 text-slate-500 text-xs">
                  {t.closesTradeId ? (
                    <Link href={`/trades/${t.closesTradeId}/edit`} className="text-sky-400 hover:underline">
                      Trade {t.closesTradeId.slice(0, 8)}…
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
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
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}

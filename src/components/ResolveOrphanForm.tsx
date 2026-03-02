"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Orphan = {
  id: string;
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  action: string;
  quantity: number;
  pricePerContract: number;
  tradeDate: string;
};

export function ResolveOrphanForm({ orphan }: { orphan: Orphan }) {
  const router = useRouter();
  const oppositeAction = orphan.action === "buy" ? "sell" : "buy";
  const [tradeDate, setTradeDate] = useState("");
  const [pricePerContract, setPricePerContract] = useState("");
  const [fees, setFees] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const openingDate = tradeDate.trim();
    if (!openingDate) return;
    if (openingDate > orphan.tradeDate) {
      setError("Opening trade date cannot be after the close date.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orphaned-closes/${orphan.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeDate: tradeDate.trim(),
          pricePerContract: pricePerContract === "" ? 0 : Number(pricePerContract),
          fees: fees.trim() === "" ? null : Number(fees),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to resolve");
      router.push("/orphaned-closes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4 rounded-lg border border-slate-700 bg-slate-800/30 p-6">
      {error && (
        <div className="rounded bg-red-900/30 px-4 py-2 text-red-300 text-sm">{error}</div>
      )}

      <p className="text-slate-400 text-sm">
        Add the matching opening trade. Ticker, expiry, type, strike, and action are fixed from the orphan close.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Ticker</label>
          <input
            type="text"
            value={orphan.ticker}
            readOnly
            className="w-full rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-400 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Expiry</label>
          <input
            type="text"
            value={orphan.expiry}
            readOnly
            className="w-full rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-400 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Type</label>
          <input
            type="text"
            value={orphan.optionType === "call" ? "Call" : "Put"}
            readOnly
            className="w-full rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-400 cursor-not-allowed capitalize"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Strike</label>
          <input
            type="text"
            value={String(orphan.strike)}
            readOnly
            className="w-full rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-400 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Action (opening)</label>
          <input
            type="text"
            value={oppositeAction === "buy" ? "Buy" : "Sell"}
            readOnly
            className="w-full rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-400 cursor-not-allowed capitalize"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Quantity</label>
          <input
            type="text"
            value={String(orphan.quantity)}
            readOnly
            className="w-full rounded border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-400 cursor-not-allowed"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Opening trade date *</label>
          <input
            type="date"
            required
            max={orphan.tradeDate}
            value={tradeDate}
            onChange={(e) => setTradeDate(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">Must be on or before close date ({orphan.tradeDate})</p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Price per contract ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={pricePerContract}
            onChange={(e) => setPricePerContract(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Commission / fees ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !tradeDate.trim()}
          className="rounded bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          {submitting ? "Resolving…" : "Resolve — add opening trade"}
        </button>
        <Link
          href="/orphaned-closes"
          className="rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

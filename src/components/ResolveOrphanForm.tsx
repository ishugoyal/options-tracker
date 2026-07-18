"use client";

import { useEffect, useState } from "react";
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

export type OpenTradeCandidate = {
  id: string;
  ticker: string;
  optionType: string;
  strike: number;
  expiry: string;
  action: string;
  quantity: number;
  pricePerContract: number;
  tradeDate: string;
  source: string;
  notes: string | null;
  remainingQuantity: number;
};

type ResolveMode = "link" | "create";

export function ResolveOrphanForm({
  orphan,
  candidates,
}: {
  orphan: Orphan;
  candidates: OpenTradeCandidate[];
}) {
  const oppositeAction = orphan.action === "buy" ? "sell" : "buy";
  const [mode, setMode] = useState<ResolveMode>(candidates.length > 0 ? "link" : "create");
  const [selectedOpenId, setSelectedOpenId] = useState("");
  const [linkQuantity, setLinkQuantity] = useState(1);
  const [createQuantity, setCreateQuantity] = useState(orphan.quantity);
  const [tradeDate, setTradeDate] = useState("");
  const [pricePerContract, setPricePerContract] = useState("");
  const [fees, setFees] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCandidate = candidates.find((c) => c.id === selectedOpenId);
  const maxLinkQty = selectedCandidate
    ? Math.min(orphan.quantity, selectedCandidate.remainingQuantity)
    : orphan.quantity;

  useEffect(() => {
    if (candidates.length === 0) {
      setSelectedOpenId("");
      return;
    }
    if (!candidates.some((c) => c.id === selectedOpenId)) {
      setSelectedOpenId(candidates[0].id);
    }
  }, [candidates, selectedOpenId]);

  useEffect(() => {
    setLinkQuantity((prev) => {
      const max = selectedCandidate
        ? Math.min(orphan.quantity, selectedCandidate.remainingQuantity)
        : orphan.quantity;
      if (prev < 1) return 1;
      if (prev > max) return max;
      return prev;
    });
  }, [selectedCandidate, orphan.quantity]);

  const handleLink = async () => {
    setError(null);
    if (!selectedOpenId) {
      setError("Select an opening trade to link.");
      return;
    }
    const qty = Math.floor(linkQuantity);
    if (qty < 1 || qty > maxLinkQty) {
      setError(`Link quantity must be between 1 and ${maxLinkQty}.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orphaned-closes/${orphan.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openTradeId: selectedOpenId, linkQuantity: qty }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to resolve");
      window.location.href = "/orphaned-closes";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const openingDate = tradeDate.trim();
    if (!openingDate) return;
    if (openingDate > orphan.tradeDate) {
      setError("Opening trade date cannot be after the close date.");
      return;
    }
    const qty = Math.floor(createQuantity);
    if (qty < 1 || qty > orphan.quantity) {
      setError(`Resolve quantity must be between 1 and ${orphan.quantity}.`);
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
          linkQuantity: qty,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to resolve");
      window.location.href = "/orphaned-closes";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      {error && (
        <div className="rounded bg-red-900/30 px-4 py-2 text-red-300 text-sm">{error}</div>
      )}

      <div className="flex gap-2 rounded-lg border border-slate-700 bg-slate-800/30 p-1">
        <button
          type="button"
          onClick={() => setMode("link")}
          disabled={candidates.length === 0}
          className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-colors ${
            mode === "link"
              ? "bg-sky-600 text-white"
              : "text-slate-400 hover:text-white disabled:opacity-40"
          }`}
        >
          Link existing open{candidates.length > 0 ? ` (${candidates.length})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-colors ${
            mode === "create"
              ? "bg-sky-600 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Create new opening trade
        </button>
      </div>

      {mode === "link" ? (
        <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/30 p-6">
          <p className="text-slate-400 text-sm">
            Link this orphan close to an opening trade already in the app (same option, opposite action, on or before the close date).
          </p>
          <p className="text-slate-300 text-sm">
            This orphan close has{" "}
            <span className="font-medium text-white">
              {orphan.quantity} contract{orphan.quantity !== 1 ? "s" : ""}
            </span>
            . Choose how many to link now; any remainder stays orphaned until you resolve again.
          </p>

          {candidates.length === 0 ? (
            <p className="text-amber-400/90 text-sm">
              No matching unlinked opening trades found. Use &quot;Create new opening trade&quot; instead.
            </p>
          ) : (
            <div className="overflow-x-auto rounded border border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-700 bg-slate-800/80 text-slate-400">
                  <tr>
                    <th className="w-10 px-3 py-2" />
                    <th className="px-3 py-2">Open date</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Available</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {candidates.map((c) => (
                    <tr
                      key={c.id}
                      className={`cursor-pointer hover:bg-slate-800/50 ${selectedOpenId === c.id ? "bg-sky-900/20" : ""}`}
                      onClick={() => setSelectedOpenId(c.id)}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="radio"
                          name="openTrade"
                          checked={selectedOpenId === c.id}
                          onChange={() => setSelectedOpenId(c.id)}
                          className="text-sky-600"
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-300">{c.tradeDate}</td>
                      <td className="px-3 py-2 capitalize text-slate-300">
                        {c.action === "buy" ? "Buy to open" : "Sell to open"}
                      </td>
                      <td className="px-3 py-2 font-medium text-white">{c.remainingQuantity}</td>
                      <td className="px-3 py-2 text-slate-300">${c.pricePerContract.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{c.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {candidates.length > 0 && selectedCandidate && (
            <div className="max-w-xs">
              <label className="mb-1 block text-sm text-slate-400">Contracts to link</label>
              <input
                type="number"
                min={1}
                max={maxLinkQty}
                step={1}
                value={linkQuantity}
                onChange={(e) => setLinkQuantity(Number(e.target.value))}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Max {maxLinkQty} (orphan {orphan.quantity}, available {selectedCandidate.remainingQuantity})
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleLink}
              disabled={submitting || candidates.length === 0}
              className="rounded bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-500 disabled:opacity-50"
            >
              {submitting
                ? "Linking…"
                : `Link ${linkQuantity} contract${linkQuantity !== 1 ? "s" : ""} to selected open`}
            </button>
            <Link
              href="/orphaned-closes"
              className="rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/30 p-6">
          {error && (
            <div className="rounded bg-red-900/30 px-4 py-2 text-red-300 text-sm">{error}</div>
          )}
          <p className="text-slate-400 text-sm">
            Add a new opening trade. Ticker, expiry, type, strike, and action are fixed from the orphan close.
          </p>
          <p className="text-slate-300 text-sm">
            Orphan has{" "}
            <span className="font-medium text-white">
              {orphan.quantity} contract{orphan.quantity !== 1 ? "s" : ""}
            </span>
            . You can resolve part now; any remainder stays orphaned.
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
              <label className="mb-1 block text-sm text-slate-400">Contracts to resolve</label>
              <input
                type="number"
                min={1}
                max={orphan.quantity}
                step={1}
                value={createQuantity}
                onChange={(e) => setCreateQuantity(Number(e.target.value))}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">Opening trade qty will match this (max {orphan.quantity})</p>
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
              {submitting
                ? "Resolving…"
                : `Resolve ${createQuantity} contract${createQuantity !== 1 ? "s" : ""} — add opening trade`}
            </button>
            <Link
              href="/orphaned-closes"
              className="rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
